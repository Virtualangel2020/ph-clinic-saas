-- Family Profiles Phase 1.4: identity-resolution RPCs, closes the critical
-- cross-tenant booking bug and lets a manager act explicitly FOR a chosen
-- dependent profile instead of only ever implicitly for themselves.
--
-- THE BUG: every write-path RPC below used to resolve "which patient is
-- this" from a bare, unscoped subquery on patient_portal_accounts —
--   select patient_id from patient_portal_accounts
--   where auth_user_id = auth.uid() and status = 'active'
-- with NO tenant filter. A patient connected to two different clinics could
-- get an appointment/message/form recorded under Clinic B's tenant but
-- pointing at their Clinic A patient record — a real cross-tenant data
-- leak, independent of the family-profiles feature. It also meant there was
-- no way for a manager to book/message/etc. explicitly on behalf of a
-- dependent — every call implicitly meant "me."
--
-- THE FIX: one shared resolver, _resolve_portal_patient_id(tenant, for
-- whom), used by every write-path RPC below. It resolves a patient_id
-- scoped to BOTH the specific tenant AND either the caller's own account or
-- an explicitly-authorized p_for_account_id (validated via
-- is_my_mycaredesk_account_or_managed, so only an active manager of that
-- dependent — or the dependent's own login — may pass it), falling back to
-- the legacy tenant-scoped patient_portal_accounts lookup for patients who
-- don't have a mycaredesk_accounts row yet.
--
-- POSTGRES GOTCHA this migration bakes in the fix for: CREATE OR REPLACE
-- FUNCTION does NOT replace a function when the parameter list changes —
-- Postgres identifies functions by (name, argument types), so adding a
-- trailing p_for_account_id param silently creates a SECOND overloaded
-- function, leaving the old one live and causing "function ... is not
-- unique" ambiguity errors on any call that omits the new optional param.
-- Every signature that gained a parameter here is preceded by an explicit
-- DROP FUNCTION IF EXISTS on its exact old signature.
--
-- Verified live (JWT-simulated, rolled-back transaction) against all three
-- required scenarios in one pass: (1) a patient connected to two tenants
-- books with tenant B's provider — the resulting appointment's patient_id
-- correctly belongs to tenant B, not tenant A; (2) a manager (dad) books an
-- appointment for a co-managed dependent (child) via p_for_account_id —
-- resolves to the dependent's own patient record; (3) a non-manager
-- (stranger) attempting to book for that same dependent is rejected with
-- 'not authorized'. All three passed cleanly.

-- ============================================================
-- The shared resolver
-- ============================================================
create or replace function public._resolve_portal_patient_id(p_tenant_id uuid, p_for_account_id uuid default null)
returns uuid
language plpgsql
stable
security definer
set search_path to 'public'
as $function$
declare
  v_account_id uuid;
  v_patient_id uuid;
begin
  if p_for_account_id is not null then
    if not public.is_my_mycaredesk_account_or_managed(p_for_account_id) then
      raise exception 'not authorized';
    end if;
    v_account_id := p_for_account_id;
  else
    select id into v_account_id from public.mycaredesk_accounts where auth_user_id = auth.uid();
  end if;

  if v_account_id is not null then
    select p.id into v_patient_id
    from public.patients p
    where p.tenant_id = p_tenant_id and p.mycaredesk_account_id = v_account_id;
  end if;

  if v_patient_id is null then
    select patient_id into v_patient_id
    from public.patient_portal_accounts
    where auth_user_id = auth.uid() and status = 'active' and tenant_id = p_tenant_id;
  end if;

  return v_patient_id;
end;
$function$;

grant execute on function public._resolve_portal_patient_id(uuid, uuid) to authenticated;

-- ============================================================
-- Booking
-- ============================================================
drop function if exists public.self_book_ensure_clinic_patient(uuid);
create or replace function public.self_book_ensure_clinic_patient(p_provider_id uuid, p_for_account_id uuid default null)
returns uuid
language plpgsql
security definer
set search_path to 'public', 'extensions'
as $function$
declare
  v_account public.mycaredesk_accounts;
  v_account_id uuid;
  v_tenant_id uuid;
  v_patient_id uuid;
  v_portal_status text;
begin
  if auth.uid() is null then
    raise exception 'not authorized';
  end if;

  if p_for_account_id is not null then
    if not public.is_my_mycaredesk_account_or_managed(p_for_account_id) then
      raise exception 'not authorized';
    end if;
    v_account_id := p_for_account_id;
  else
    select id into v_account_id from public.mycaredesk_accounts where auth_user_id = auth.uid();
  end if;

  select * into v_account from public.mycaredesk_accounts where id = v_account_id;
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
$function$;
grant execute on function public.self_book_ensure_clinic_patient(uuid, uuid) to authenticated;

drop function if exists public.portal_book_appointment(uuid, uuid, timestamptz, text, uuid, text);
create or replace function public.portal_book_appointment(
  p_provider_id uuid, p_appointment_type_id uuid, p_start_at timestamptz,
  p_payment_method text, p_hmo_id uuid, p_notes text default null,
  p_for_account_id uuid default null
)
returns uuid
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_patient_id uuid;
  v_tenant_id uuid;
  v_duration integer;
  v_end_at timestamptz;
  v_id uuid;
  v_verification text := 'not_required';
begin
  select tenant_id into v_tenant_id from public.user_profiles where id = p_provider_id and is_active = true;
  if v_tenant_id is null then raise exception 'Provider not found.'; end if;

  v_patient_id := public._resolve_portal_patient_id(v_tenant_id, p_for_account_id);
  if v_patient_id is null then raise exception 'not authorized'; end if;

  select default_duration_minutes into v_duration
  from public.appointment_types
  where id = p_appointment_type_id and tenant_id = v_tenant_id and is_active = true and patient_booking_enabled = true;
  if v_duration is null then raise exception 'This service is not available for online booking.'; end if;

  v_end_at := p_start_at + make_interval(mins => v_duration);

  if exists (
    select 1 from public.appointments a
    where a.provider_id = p_provider_id
      and a.status not in ('cancelled', 'no_show', 'late_cancellation')
      and a.start_at < v_end_at and a.end_at > p_start_at
  ) then
    raise exception 'This time was just taken — please choose another.';
  end if;

  if p_hmo_id is not null then
    select verification_requirement into v_verification from public.clinic_accepted_hmos where id = p_hmo_id and tenant_id = v_tenant_id;
    v_verification := coalesce(v_verification, 'pending');
    if v_verification = 'none' then v_verification := 'not_required'; else v_verification := 'pending'; end if;
  end if;

  insert into public.appointments (tenant_id, patient_id, provider_id, appointment_type_id, start_at, end_at, status, notes, payment_method, hmo_id, hmo_verification_status)
  values (v_tenant_id, v_patient_id, p_provider_id, p_appointment_type_id, p_start_at, v_end_at, 'scheduled', p_notes, p_payment_method, p_hmo_id, v_verification)
  returning id into v_id;

  return v_id;
end;
$function$;
grant execute on function public.portal_book_appointment(uuid, uuid, timestamptz, text, uuid, text, uuid) to authenticated;

drop function if exists public.portal_submit_appointment_request(uuid, text, date, text, text);
create or replace function public.portal_submit_appointment_request(
  p_provider_id uuid, p_appointment_type_name text, p_preferred_date date,
  p_preferred_time text, p_reason text, p_for_account_id uuid default null
)
returns uuid
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_patient_id uuid;
  v_tenant_id uuid;
  v_patient public.patients;
  v_id uuid;
begin
  select tenant_id into v_tenant_id from public.user_profiles where id = p_provider_id and is_active = true;
  if v_tenant_id is null then raise exception 'Provider not found.'; end if;

  v_patient_id := public._resolve_portal_patient_id(v_tenant_id, p_for_account_id);
  if v_patient_id is null then raise exception 'not authorized'; end if;

  select * into v_patient from public.patients where id = v_patient_id;

  insert into public.public_appointment_requests (tenant_id, provider_user_id, patient_name, patient_phone, patient_email, reason, preferred_date, preferred_time)
  values (
    v_tenant_id, p_provider_id,
    trim(coalesce(v_patient.first_name, '') || ' ' || coalesce(v_patient.last_name, '')),
    coalesce(v_patient.mobile_phone, ''),
    v_patient.email,
    trim(coalesce(p_appointment_type_name, '') || case when p_reason is not null and p_reason != '' then ' — ' || p_reason else '' end),
    p_preferred_date,
    p_preferred_time
  )
  returning id into v_id;

  return v_id;
end;
$function$;
grant execute on function public.portal_submit_appointment_request(uuid, text, date, text, text, uuid) to authenticated;

-- portal_book_flexible_or_walkin: the live signature already carries
-- p_payment_method/p_hmo_id from a later migration
-- (mycaredesk_flexible_walkin_payment_fields.sql) — that 9-param shape is
-- what app/portal/book/actions.ts actually calls, NOT the original 7-param
-- version. Drop that exact 9-param (no p_for_account_id) signature before
-- recreating it with the 10th param added.
drop function if exists public.portal_book_flexible_or_walkin(uuid, uuid, text, timestamptz, timestamptz, timestamptz, text, text, uuid);
create or replace function public.portal_book_flexible_or_walkin(
  p_provider_id uuid, p_appointment_type_id uuid, p_booking_mode text,
  p_window_start timestamptz, p_window_end timestamptz,
  p_expected_arrival_at timestamptz default null, p_notes text default null,
  p_payment_method text default 'cash', p_hmo_id uuid default null,
  p_for_account_id uuid default null
)
returns uuid
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_patient_id uuid;
  v_tenant_id uuid;
  v_id uuid;
  v_max_capacity integer;
  v_existing_count integer;
  v_type_ok boolean;
begin
  if p_booking_mode not in ('flexible_arrival', 'walk_in_intent') then
    raise exception 'Invalid booking mode.';
  end if;
  if p_window_end <= p_window_start then
    raise exception 'Invalid availability window.';
  end if;

  select tenant_id into v_tenant_id from public.user_profiles where id = p_provider_id and is_active = true;
  if v_tenant_id is null then raise exception 'Provider not found.'; end if;

  v_patient_id := public._resolve_portal_patient_id(v_tenant_id, p_for_account_id);
  if v_patient_id is null then raise exception 'not authorized'; end if;

  select exists(
    select 1 from public.appointment_types
    where id = p_appointment_type_id and tenant_id = v_tenant_id and is_active = true and patient_booking_enabled = true
  ) into v_type_ok;
  if not v_type_ok then raise exception 'This service is not available for online booking.'; end if;

  if p_booking_mode = 'flexible_arrival' then
    select coalesce(pas.flexible_arrival_max_patients_per_day, cs.flexible_arrival_max_patients_per_day)
    into v_max_capacity
    from public.clinic_settings cs
    left join public.provider_patient_access_settings pas on pas.provider_id = p_provider_id and pas.tenant_id = v_tenant_id
    where cs.tenant_id = v_tenant_id;

    if v_max_capacity is not null then
      select count(*) into v_existing_count
      from public.appointments a
      where a.provider_id = p_provider_id
        and a.booking_mode = 'flexible_arrival'
        and a.status not in ('cancelled', 'no_show', 'late_cancellation')
        and a.start_at = p_window_start and a.end_at = p_window_end;
      if v_existing_count >= v_max_capacity then
        raise exception 'This day is fully booked — please choose another date.';
      end if;
    end if;
  end if;

  insert into public.appointments (
    tenant_id, patient_id, provider_id, appointment_type_id, start_at, end_at, status, notes,
    booking_mode, expected_arrival_at, payment_method, hmo_id
  )
  values (
    v_tenant_id, v_patient_id, p_provider_id, p_appointment_type_id, p_window_start, p_window_end, 'scheduled', p_notes,
    p_booking_mode, case when p_booking_mode = 'flexible_arrival' then p_expected_arrival_at else null end,
    p_payment_method, p_hmo_id
  )
  returning id into v_id;

  return v_id;
end;
$function$;
grant execute on function public.portal_book_flexible_or_walkin(uuid, uuid, text, timestamptz, timestamptz, timestamptz, text, text, uuid, uuid) to authenticated;

-- ============================================================
-- Messaging
-- ============================================================
drop function if exists public.portal_get_messaging_status(uuid);
create or replace function public.portal_get_messaging_status(p_provider_id uuid, p_for_account_id uuid default null)
returns jsonb
language plpgsql
stable
security definer
set search_path to 'public'
as $function$
declare
  v_patient_id uuid;
  v_settings record;
  v_provider record;
  v_eligible boolean;
  v_within_window boolean;
  v_within_hours boolean;
begin
  select full_name, title into v_provider from public.user_profiles where id = p_provider_id;
  if v_provider is null then raise exception 'Provider not found.'; end if;

  select * into v_settings from public._effective_messaging_settings(p_provider_id);
  if v_settings.tenant_id is null then raise exception 'Provider not found.'; end if;

  v_patient_id := public._resolve_portal_patient_id(v_settings.tenant_id, p_for_account_id);
  if v_patient_id is null then raise exception 'not authorized'; end if;

  select public._patient_messaging_eligible(p_provider_id, v_patient_id, v_settings.messaging_audience) into v_eligible;
  select public._patient_messaging_within_appointment_window(p_provider_id, v_patient_id, v_settings.messaging_availability_mode, v_settings.messaging_before_days, v_settings.messaging_after_days) into v_within_window;
  select public._patient_messaging_within_hours(p_provider_id, v_settings.messaging_availability_mode) into v_within_hours;

  return jsonb_build_object(
    'providerName', v_provider.full_name,
    'providerTitle', v_provider.title,
    'enabled', v_settings.messaging_enabled,
    'eligible', v_eligible,
    'withinWindow', v_within_window,
    'withinHours', v_within_hours,
    'outsideHoursBehavior', v_settings.messaging_outside_hours_behavior,
    'availabilityMode', v_settings.messaging_availability_mode,
    'disclaimer', v_settings.messaging_disclaimer,
    'canSend', v_settings.messaging_enabled and v_eligible and v_within_window and (v_within_hours or v_settings.messaging_outside_hours_behavior = 'allow_queue')
  );
end;
$function$;
grant execute on function public.portal_get_messaging_status(uuid, uuid) to authenticated;

drop function if exists public.portal_get_provider_thread(uuid);
create or replace function public.portal_get_provider_thread(p_provider_id uuid, p_for_account_id uuid default null)
returns setof provider_patient_messages
language plpgsql
stable
security definer
set search_path to 'public'
as $function$
declare
  v_tenant_id uuid;
  v_patient_id uuid;
begin
  select tenant_id into v_tenant_id from public.user_profiles where id = p_provider_id and is_active = true;
  if v_tenant_id is null then raise exception 'Provider not found.'; end if;

  v_patient_id := public._resolve_portal_patient_id(v_tenant_id, p_for_account_id);
  if v_patient_id is null then raise exception 'not authorized'; end if;

  return query
    select * from public.provider_patient_messages
    where provider_id = p_provider_id and patient_id = v_patient_id
    order by created_at asc;
end;
$function$;
grant execute on function public.portal_get_provider_thread(uuid, uuid) to authenticated;

drop function if exists public.portal_list_message_threads();
create or replace function public.portal_list_message_threads(p_for_account_id uuid default null)
returns jsonb
language plpgsql
stable
security definer
set search_path to 'public'
as $function$
declare
  v_account_id uuid;
  v_patient_ids uuid[];
  v_result jsonb;
begin
  if p_for_account_id is not null then
    if not public.is_my_mycaredesk_account_or_managed(p_for_account_id) then
      raise exception 'not authorized';
    end if;
    v_account_id := p_for_account_id;
  else
    select id into v_account_id from public.mycaredesk_accounts where auth_user_id = auth.uid();
  end if;

  if v_account_id is not null then
    select array_agg(id) into v_patient_ids from public.patients where mycaredesk_account_id = v_account_id;
  end if;

  if v_patient_ids is null or array_length(v_patient_ids, 1) is null then
    select array_agg(patient_id) into v_patient_ids from public.patient_portal_accounts where auth_user_id = auth.uid() and status = 'active';
  end if;

  if v_patient_ids is null or array_length(v_patient_ids, 1) is null then raise exception 'not authorized'; end if;

  select coalesce(jsonb_agg(t.* order by t.last_created_at desc), '[]'::jsonb) into v_result
  from (
    select
      m.provider_id,
      up.full_name as provider_name,
      up.title as provider_title,
      (array_agg(m.body order by m.created_at desc))[1] as last_body,
      (array_agg(m.sender_type order by m.created_at desc))[1] as last_sender_type,
      max(m.created_at) as last_created_at,
      count(*) filter (where m.sender_type = 'provider' and m.read_at is null) as unread_count
    from public.provider_patient_messages m
    join public.user_profiles up on up.id = m.provider_id
    where m.patient_id = any(v_patient_ids)
    group by m.provider_id, up.full_name, up.title
  ) t;

  return v_result;
end;
$function$;
grant execute on function public.portal_list_message_threads(uuid) to authenticated;

drop function if exists public.portal_send_provider_message(uuid, text);
create or replace function public.portal_send_provider_message(p_provider_id uuid, p_body text, p_for_account_id uuid default null)
returns provider_patient_messages
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_patient_id uuid;
  v_patient_name text;
  v_settings record;
  v_eligible boolean;
  v_within_window boolean;
  v_within_hours boolean;
  v_row public.provider_patient_messages;
begin
  select * into v_settings from public._effective_messaging_settings(p_provider_id);
  if v_settings.tenant_id is null then raise exception 'Provider not found.'; end if;

  v_patient_id := public._resolve_portal_patient_id(v_settings.tenant_id, p_for_account_id);
  if v_patient_id is null then raise exception 'not authorized'; end if;

  select coalesce(trim(coalesce(first_name, '') || ' ' || coalesce(last_name, '')), 'Patient') into v_patient_name
  from public.patients where id = v_patient_id;

  if not v_settings.messaging_enabled then
    raise exception 'Messaging is currently unavailable for this provider.';
  end if;

  select public._patient_messaging_eligible(p_provider_id, v_patient_id, v_settings.messaging_audience) into v_eligible;
  if not v_eligible then
    raise exception 'Messaging is currently unavailable for this provider.';
  end if;

  select public._patient_messaging_within_appointment_window(p_provider_id, v_patient_id, v_settings.messaging_availability_mode, v_settings.messaging_before_days, v_settings.messaging_after_days) into v_within_window;
  if not v_within_window then
    raise exception 'Messaging is only available around your appointment with this provider.';
  end if;

  select public._patient_messaging_within_hours(p_provider_id, v_settings.messaging_availability_mode) into v_within_hours;
  if not v_within_hours and v_settings.messaging_outside_hours_behavior = 'disable' then
    raise exception 'This provider is outside messaging hours right now — please try again later.';
  end if;

  if coalesce(trim(p_body), '') = '' then raise exception 'message cannot be empty'; end if;

  insert into public.provider_patient_messages (tenant_id, provider_id, patient_id, sender_type, sender_user_id, sender_name, body)
  values (v_settings.tenant_id, p_provider_id, v_patient_id, 'patient', null, v_patient_name, trim(p_body))
  returning * into v_row;

  return v_row;
end;
$function$;
grant execute on function public.portal_send_provider_message(uuid, text, uuid) to authenticated;

drop function if exists public.portal_mark_provider_thread_read(uuid);
create or replace function public.portal_mark_provider_thread_read(p_provider_id uuid, p_for_account_id uuid default null)
returns void
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_tenant_id uuid;
  v_patient_id uuid;
begin
  select tenant_id into v_tenant_id from public.user_profiles where id = p_provider_id and is_active = true;
  if v_tenant_id is null then raise exception 'Provider not found.'; end if;

  v_patient_id := public._resolve_portal_patient_id(v_tenant_id, p_for_account_id);
  if v_patient_id is null then raise exception 'not authorized'; end if;

  update public.provider_patient_messages
  set read_at = now()
  where provider_id = p_provider_id and patient_id = v_patient_id and sender_type = 'provider' and read_at is null;
end;
$function$;
grant execute on function public.portal_mark_provider_thread_read(uuid, uuid) to authenticated;

-- ============================================================
-- Forms / sharing / status events / follow-ups / access requests — no new
-- parameter needed (they already take a scoped row id), just routed
-- through the multi-guardian-aware helpers from Phase 1.2/1.3 instead of
-- an inline auth_user_id-only check.
-- ============================================================
create or replace function public.complete_patient_form(p_id uuid, p_responses jsonb, p_signature_name text default null)
returns void
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_row public.patient_forms;
  v_tenant_id uuid := current_tenant_id();
  v_is_portal boolean := false;
begin
  select * into v_row from public.patient_forms where id = p_id;
  if v_row.id is null then raise exception 'form not found'; end if;

  if v_tenant_id is not null and v_row.tenant_id = v_tenant_id then
    v_is_portal := false;
  elsif public.is_portal_patient(v_row.patient_id) then
    v_is_portal := true;
  else
    raise exception 'not authorized';
  end if;

  if v_row.status = 'completed' then raise exception 'this form has already been completed'; end if;

  update public.patient_forms
  set responses = p_responses,
      status = 'completed',
      completed_at = now(),
      signature_name = coalesce(p_signature_name, signature_name),
      signed_at = case when p_signature_name is not null then now() else signed_at end,
      updated_at = now()
  where id = p_id;

  if not v_is_portal then
    insert into public.audit_logs (tenant_id, actor_user_id, action, entity_type, entity_id)
    values (v_row.tenant_id, auth.uid(), 'patient_form_completed_by_staff', 'patient_forms', p_id);
  end if;
end;
$function$;

create or replace function public.patient_respond_sharing_request(p_id uuid, p_approve boolean)
returns void
language plpgsql
security definer
set search_path to 'public'
as $function$
declare v_row public.patient_sharing_preferences;
begin
  select * into v_row from public.patient_sharing_preferences where id = p_id;
  if v_row.id is null or v_row.status != 'pending' then
    raise exception 'This request is no longer pending.';
  end if;
  if not public.is_portal_patient(v_row.patient_id) then
    raise exception 'not authorized';
  end if;

  if p_approve then
    update public.patient_sharing_preferences set status = 'revoked', revoked_at = now()
    where patient_id = v_row.patient_id and status = 'active';
    update public.patient_sharing_preferences set status = 'active', authorized_at = now()
    where id = p_id;
  else
    update public.patient_sharing_preferences set status = 'revoked', revoked_at = now()
    where id = p_id;
  end if;

  insert into public.audit_logs (tenant_id, actor_user_id, action, entity_type, entity_id, new_value)
  values (v_row.tenant_id, auth.uid(), case when p_approve then 'patient_sharing_request_authorized' else 'patient_sharing_request_declined' end, 'patient_sharing_preferences', p_id, jsonb_build_object('patient_id', v_row.patient_id));
end;
$function$;

create or replace function public.patient_acknowledge_status_event(p_id uuid)
returns void
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_patient_id uuid;
begin
  select patient_id into v_patient_id from public.appointment_status_events where id = p_id;
  if v_patient_id is null or not public.is_portal_patient(v_patient_id) then
    raise exception 'not found or not yours';
  end if;

  update public.appointment_status_events
  set acknowledged_at = now()
  where id = p_id;
end;
$function$;

create or replace function public.patient_schedule_follow_up(p_follow_up_id uuid, p_appointment_id uuid)
returns void
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_patient_id uuid;
begin
  select patient_id into v_patient_id from public.patient_follow_ups where id = p_follow_up_id and status = 'pending';
  if v_patient_id is null or not public.is_portal_patient(v_patient_id) then
    raise exception 'follow-up not found, not yours, or already resolved';
  end if;

  if not exists (select 1 from public.appointments where id = p_appointment_id and patient_id = v_patient_id) then
    raise exception 'not authorized';
  end if;

  update public.patient_follow_ups
  set status = 'scheduled', scheduled_appointment_id = p_appointment_id, updated_at = now()
  where id = p_follow_up_id and patient_id = v_patient_id and status = 'pending';
  if not found then raise exception 'follow-up not found, not yours, or already resolved'; end if;
end;
$function$;

create or replace function public.patient_list_my_access_requests()
returns table(id uuid, tenant_id uuid, clinic_name text, message text, status text, created_at timestamptz, for_account_id uuid, for_account_name text)
language sql
stable
security definer
set search_path to 'public'
as $function$
  select
    r.id,
    r.tenant_id,
    t.name,
    r.message,
    r.status,
    r.created_at,
    a.id as for_account_id,
    case when a.auth_user_id = auth.uid() then null else (a.first_name || ' ' || a.last_name) end as for_account_name
  from public.mycaredesk_account_access_requests r
  join public.mycaredesk_accounts a on a.id = r.mycaredesk_account_id
  join public.tenants t on t.id = r.tenant_id
  where public.is_my_mycaredesk_account_or_managed(a.id)
  order by r.created_at desc;
$function$;
