-- Angel: "the only time patient's account gets linked to a provider is
-- if they book with this certain doctor, or if the doctor sent them a
-- code to add the doctor as their doctor and linked account." Today,
-- /portal/book/[providerId] and both booking RPCs (portal_book_appointment,
-- portal_submit_appointment_request) require an ALREADY-ACTIVE
-- patient_portal_accounts row (resolved via auth.uid()) — meaning a
-- self-registered patient with only a platform mycaredesk_accounts
-- identity and no clinic relationship yet could never book at all; they'd
-- hit the same "not authorized" wall self_register/login just did. This
-- flips it: booking is what CREATES the clinic-side link, on demand, the
-- first time a self-registered patient books with a given clinic.
--
-- Widen the channel check so a self-service-created portal account can be
-- recorded honestly as such, distinct from an email/sms/manual invite.
alter table public.patient_portal_accounts drop constraint patient_portal_accounts_channel_check;
alter table public.patient_portal_accounts add constraint patient_portal_accounts_channel_check
  check (channel = any (array['email','sms','manual','self']));

-- Ensures (idempotently) that the calling patient has a clinic-side
-- patients row + an ACTIVE patient_portal_accounts row at p_provider_id's
-- tenant, creating them from the caller's own mycaredesk_accounts data if
-- this is their first time connecting to that clinic. Call this right
-- before portal_book_appointment / portal_submit_appointment_request —
-- both already resolve "which patient is this" purely by looking up
-- patient_portal_accounts.auth_user_id = auth.uid(), so once this has run
-- once, they work completely unmodified.
--
-- Idempotent by design: a patient who already has a patients row at this
-- tenant (self-booked before, was invited by staff, or claimed a dedup
-- match) gets that SAME row back — never a second, disconnected identity
-- at the same clinic.
create or replace function public.self_book_ensure_clinic_patient(p_provider_id uuid)
returns uuid
language plpgsql
security definer
set search_path to 'public', 'extensions'
as $$
declare
  v_account public.mycaredesk_accounts;
  v_tenant_id uuid;
  v_patient_id uuid;
  v_portal_status text;
begin
  if auth.uid() is null then
    raise exception 'not authorized';
  end if;

  select * into v_account from public.mycaredesk_accounts where auth_user_id = auth.uid();
  if v_account.id is null then
    raise exception 'Please finish setting up your MyCareDesk account first.';
  end if;

  select tenant_id into v_tenant_id from public.user_profiles where id = p_provider_id and is_active = true;
  if v_tenant_id is null then
    raise exception 'Provider not found.';
  end if;

  select id into v_patient_id from public.patients
  where tenant_id = v_tenant_id and mycaredesk_account_id = v_account.id;

  if v_patient_id is null then
    insert into public.patients (tenant_id, first_name, last_name, date_of_birth, sex, mobile_phone, email, mycaredesk_account_id)
    values (v_tenant_id, v_account.first_name, v_account.last_name, v_account.date_of_birth, v_account.sex, v_account.mobile_phone, v_account.email, v_account.id)
    returning id into v_patient_id;
  end if;

  select status into v_portal_status from public.patient_portal_accounts
  where tenant_id = v_tenant_id and patient_id = v_patient_id;

  if v_portal_status is null then
    insert into public.patient_portal_accounts (tenant_id, patient_id, channel, contact_value, status, auth_user_id, activated_at)
    values (v_tenant_id, v_patient_id, 'self', coalesce(v_account.email, v_account.mobile_phone, ''), 'active', auth.uid(), now());
  elsif v_portal_status != 'active' then
    update public.patient_portal_accounts
    set status = 'active', auth_user_id = auth.uid(), activated_at = now()
    where tenant_id = v_tenant_id and patient_id = v_patient_id;
  end if;

  return v_patient_id;
end;
$$;

-- Expose the provider's tenant_id on the public profile response too —
-- additive field, nothing existing breaks — so the client-side booking
-- flow doesn't need a second round-trip just to know which clinic it's
-- calling self_book_ensure_clinic_patient against for its own display
-- logic (the RPC itself re-derives tenant_id server-side regardless, so
-- this is for the app's convenience/consistency, not a trust boundary).
create or replace function public.public_get_provider_profile(p_provider_id uuid)
returns jsonb
language plpgsql
stable security definer
set search_path to 'public'
as $function$
declare
  v_tenant_id uuid;
  v_result jsonb;
begin
  select tenant_id into v_tenant_id
  from public.user_profiles
  where id = p_provider_id and public_directory_enabled = true and role in ('doctor', 'clinic_admin') and is_active = true;

  if v_tenant_id is null then
    return null;
  end if;

  select jsonb_build_object(
    'provider', jsonb_build_object(
      'id', up.id, 'full_name', up.full_name, 'title', up.title, 'specialty', up.specialty, 'subspecialty', up.subspecialty,
      'public_bio', up.public_bio, 'public_languages', up.public_languages,
      'public_consultation_type', up.public_consultation_type, 'public_consultation_fee_php', up.public_consultation_fee_php
    ),
    'clinic', jsonb_build_object(
      'tenant_id', up.tenant_id,
      'clinic_name', cs.clinic_name, 'city', cs.city,
      'default_booking_type', cs.default_booking_type, 'default_prioritize_scheduled', cs.default_prioritize_scheduled,
      'booking_cutoff_minutes', cs.booking_cutoff_minutes, 'max_advance_booking_days', cs.max_advance_booking_days,
      'default_arrival_reminder_enabled', cs.default_arrival_reminder_enabled, 'default_arrival_reminder_minutes', cs.default_arrival_reminder_minutes,
      'default_appointment_instructions', cs.default_appointment_instructions,
      'default_messaging_enabled', cs.default_messaging_enabled, 'default_messaging_audience', cs.default_messaging_audience,
      'default_messaging_availability_mode', cs.default_messaging_availability_mode,
      'default_messaging_before_days', cs.default_messaging_before_days, 'default_messaging_after_days', cs.default_messaging_after_days,
      'default_messaging_outside_hours_behavior', cs.default_messaging_outside_hours_behavior, 'default_messaging_disclaimer', cs.default_messaging_disclaimer,
      'accept_hmo', cs.accept_hmo, 'accept_yakap', cs.accept_yakap, 'yakap_instructions', cs.yakap_instructions,
      'cancellation_policy', cs.cancellation_policy, 'cancellation_policy_version', cs.cancellation_policy_version,
      'accept_online_payments', cs.accept_online_payments,
      'financial_active', exists (select 1 from public.tenant_entitlements te where te.tenant_id = up.tenant_id and te.feature_key = 'financial_tracker' and te.status = 'active')
    ),
    'override', (
      select jsonb_build_object(
        'provider_id', pas.provider_id, 'booking_type', pas.booking_type, 'prioritize_scheduled', pas.prioritize_scheduled,
        'booking_cutoff_minutes', pas.booking_cutoff_minutes, 'max_advance_booking_days', pas.max_advance_booking_days,
        'arrival_reminder_enabled', pas.arrival_reminder_enabled, 'arrival_reminder_minutes', pas.arrival_reminder_minutes,
        'custom_instructions', pas.custom_instructions, 'accept_hmo', pas.accept_hmo, 'accept_yakap', pas.accept_yakap,
        'messaging_enabled', pas.messaging_enabled, 'messaging_audience', pas.messaging_audience,
        'messaging_availability_mode', pas.messaging_availability_mode, 'messaging_before_days', pas.messaging_before_days,
        'messaging_after_days', pas.messaging_after_days, 'messaging_outside_hours_behavior', pas.messaging_outside_hours_behavior,
        'messaging_disclaimer', pas.messaging_disclaimer, 'cancellation_policy', pas.cancellation_policy,
        'cancellation_policy_version', pas.cancellation_policy_version
      )
      from public.provider_patient_access_settings pas where pas.provider_id = up.id
    ),
    'services', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', at.id, 'name', at.name, 'description', at.description, 'default_duration_minutes', at.default_duration_minutes,
        'color', at.color, 'price_php', at.price_php, 'price_max_php', at.price_max_php, 'price_type', at.price_type,
        'show_price_to_patient', at.show_price_to_patient, 'allow_advance_payment', at.allow_advance_payment,
        'require_advance_payment', at.require_advance_payment, 'delivery_mode', at.delivery_mode
      ) order by at.sort_order)
      from public.appointment_types at
      where at.tenant_id = up.tenant_id and at.is_active = true and at.patient_booking_enabled = true
        and (
          not exists (select 1 from public.appointment_type_providers atp where atp.appointment_type_id = at.id)
          or exists (select 1 from public.appointment_type_providers atp where atp.appointment_type_id = at.id and atp.provider_id = up.id)
        )
    ), '[]'::jsonb),
    'accepted_hmos', coalesce((
      select jsonb_agg(jsonb_build_object('id', h.id, 'hmo_name', h.hmo_name, 'verification_requirement', h.verification_requirement, 'patient_instructions', h.patient_instructions) order by h.hmo_name)
      from public.clinic_accepted_hmos h
      where h.tenant_id = up.tenant_id and h.is_active = true
        and (
          not exists (select 1 from public.provider_hmo_acceptance pha where pha.provider_id = up.id)
          or exists (select 1 from public.provider_hmo_acceptance pha where pha.provider_id = up.id and pha.hmo_id = h.id)
        )
    ), '[]'::jsonb),
    'weekly_hours', coalesce((
      select jsonb_agg(jsonb_build_object('day_of_week', ps.day_of_week, 'start_time', ps.start_time, 'end_time', ps.end_time) order by ps.day_of_week, ps.start_time)
      from public.provider_schedules ps where ps.provider_id = up.id and ps.tenant_id = up.tenant_id
    ), '[]'::jsonb)
  )
  into v_result
  from public.user_profiles up
  left join public.clinic_settings cs on cs.tenant_id = up.tenant_id
  where up.id = p_provider_id;

  return v_result;
end;
$function$;
