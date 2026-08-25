-- ============================================================================
-- Patient Access & Payments — write RPCs (Phase 1, part 2)
-- ============================================================================
-- Every write to the tables/columns added in
-- patient_access_and_payments_foundation.sql goes through one of these
-- SECURITY DEFINER RPCs (RLS on those tables is SELECT-only, per this
-- app's established convention). Settings-writer RPCs are gated by
-- is_clinic_admin() and audit-log old/new values for anything that can
-- affect money or patient access (spec §62).

-- ── set_appointment_type — extended with pricing/booking/delivery fields ───
-- New params are OPTIONAL trailing params with defaults matching the
-- column defaults, so the one existing call site
-- (setAppointmentTypeAction, currently 7 named params) keeps compiling
-- and behaving identically until it's updated to actually pass pricing.
create or replace function public.set_appointment_type(
  p_id uuid,
  p_name text,
  p_color text,
  p_duration_minutes integer,
  p_description text,
  p_is_active boolean,
  p_sort_order integer,
  p_price_php numeric default null,
  p_price_max_php numeric default null,
  p_price_type text default 'fixed',
  p_show_price_to_patient boolean default false,
  p_allow_advance_payment boolean default false,
  p_require_advance_payment boolean default false,
  p_patient_booking_enabled boolean default false,
  p_delivery_mode text default 'in_person'
)
returns uuid
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_tenant_id uuid := current_tenant_id();
  v_id uuid;
  v_before public.appointment_types;
begin
  if not is_clinic_admin() then raise exception 'not authorized'; end if;

  if p_id is not null then
    select * into v_before from public.appointment_types where id = p_id and tenant_id = v_tenant_id;
  end if;

  insert into public.appointment_types (
    id, tenant_id, name, color, default_duration_minutes, description, is_active, sort_order,
    price_php, price_max_php, price_type, show_price_to_patient, allow_advance_payment,
    require_advance_payment, patient_booking_enabled, delivery_mode
  )
  values (
    coalesce(p_id, gen_random_uuid()), v_tenant_id, p_name, p_color, p_duration_minutes, p_description, p_is_active, p_sort_order,
    p_price_php, p_price_max_php, p_price_type, p_show_price_to_patient, p_allow_advance_payment,
    p_require_advance_payment, p_patient_booking_enabled, p_delivery_mode
  )
  on conflict (id) do update set
    name = excluded.name, color = excluded.color, default_duration_minutes = excluded.default_duration_minutes,
    description = excluded.description, is_active = excluded.is_active, sort_order = excluded.sort_order,
    price_php = excluded.price_php, price_max_php = excluded.price_max_php, price_type = excluded.price_type,
    show_price_to_patient = excluded.show_price_to_patient, allow_advance_payment = excluded.allow_advance_payment,
    require_advance_payment = excluded.require_advance_payment, patient_booking_enabled = excluded.patient_booking_enabled,
    delivery_mode = excluded.delivery_mode
  returning id into v_id;

  -- Audit only the fields that affect money or patient access, and only
  -- when they actually changed (a brand-new type or an untouched save on
  -- an existing one that didn't change price/visibility isn't noise-worthy).
  if v_before.id is not null and (
    v_before.price_php is distinct from p_price_php or
    v_before.price_max_php is distinct from p_price_max_php or
    v_before.price_type is distinct from p_price_type or
    v_before.show_price_to_patient is distinct from p_show_price_to_patient or
    v_before.allow_advance_payment is distinct from p_allow_advance_payment or
    v_before.require_advance_payment is distinct from p_require_advance_payment
  ) then
    insert into public.audit_logs (tenant_id, actor_user_id, action, entity_type, entity_id, old_value, new_value)
    values (
      v_tenant_id, auth.uid(), 'appointment_type_pricing_changed', 'appointment_types', v_id,
      jsonb_build_object('price_php', v_before.price_php, 'price_max_php', v_before.price_max_php, 'price_type', v_before.price_type,
        'show_price_to_patient', v_before.show_price_to_patient, 'allow_advance_payment', v_before.allow_advance_payment,
        'require_advance_payment', v_before.require_advance_payment),
      jsonb_build_object('price_php', p_price_php, 'price_max_php', p_price_max_php, 'price_type', p_price_type,
        'show_price_to_patient', p_show_price_to_patient, 'allow_advance_payment', p_allow_advance_payment,
        'require_advance_payment', p_require_advance_payment)
    );
  end if;

  return v_id;
end;
$function$;

-- ── set_appointment_type_providers — replace the eligible-provider list ────
-- Empty/NULL array = "every active provider is eligible" (no rows), the
-- easy default described in the schema comment.
create or replace function public.set_appointment_type_providers(p_appointment_type_id uuid, p_provider_ids uuid[])
returns void
language plpgsql
security definer
set search_path to 'public'
as $function$
declare v_tenant_id uuid := current_tenant_id();
begin
  if not is_clinic_admin() then raise exception 'not authorized'; end if;
  if not exists (select 1 from public.appointment_types where id = p_appointment_type_id and tenant_id = v_tenant_id) then
    raise exception 'not authorized';
  end if;

  delete from public.appointment_type_providers where appointment_type_id = p_appointment_type_id and tenant_id = v_tenant_id;
  if p_provider_ids is not null and array_length(p_provider_ids, 1) > 0 then
    insert into public.appointment_type_providers (tenant_id, appointment_type_id, provider_id)
    select v_tenant_id, p_appointment_type_id, pid from unnest(p_provider_ids) as pid
    where exists (select 1 from public.user_profiles where id = pid and tenant_id = v_tenant_id);
  end if;
end;
$function$;

-- ── set_clinic_patient_access_defaults — clinic-wide defaults writer ───────
-- One call sets every clinic-wide default at once (the settings pages save
-- a whole card/tab at a time). Audit-logs only the subset that's money- or
-- access-relevant per §62: HMO/YAKAP acceptance and messaging enabled.
create or replace function public.set_clinic_patient_access_defaults(
  p_default_booking_type text,
  p_default_prioritize_scheduled boolean,
  p_booking_cutoff_minutes integer,
  p_max_advance_booking_days integer,
  p_default_arrival_reminder_enabled boolean,
  p_default_arrival_reminder_minutes integer,
  p_default_appointment_instructions text,
  p_default_messaging_enabled boolean,
  p_default_messaging_audience text,
  p_default_messaging_availability_mode text,
  p_default_messaging_before_days integer,
  p_default_messaging_after_days integer,
  p_default_messaging_outside_hours_behavior text,
  p_default_messaging_disclaimer text,
  p_accept_hmo boolean,
  p_accept_yakap boolean,
  p_yakap_instructions text
)
returns void
language plpgsql
security definer
set search_path to 'public'
as $function$
declare v_tenant_id uuid := current_tenant_id(); v_before public.clinic_settings;
begin
  if not is_clinic_admin() then raise exception 'not authorized'; end if;
  select * into v_before from public.clinic_settings where tenant_id = v_tenant_id;
  if v_before.tenant_id is null then raise exception 'Clinic settings not found.'; end if;

  update public.clinic_settings set
    default_booking_type = p_default_booking_type,
    default_prioritize_scheduled = p_default_prioritize_scheduled,
    booking_cutoff_minutes = p_booking_cutoff_minutes,
    max_advance_booking_days = p_max_advance_booking_days,
    default_arrival_reminder_enabled = p_default_arrival_reminder_enabled,
    default_arrival_reminder_minutes = p_default_arrival_reminder_minutes,
    default_appointment_instructions = p_default_appointment_instructions,
    default_messaging_enabled = p_default_messaging_enabled,
    default_messaging_audience = p_default_messaging_audience,
    default_messaging_availability_mode = p_default_messaging_availability_mode,
    default_messaging_before_days = p_default_messaging_before_days,
    default_messaging_after_days = p_default_messaging_after_days,
    default_messaging_outside_hours_behavior = p_default_messaging_outside_hours_behavior,
    default_messaging_disclaimer = p_default_messaging_disclaimer,
    accept_hmo = p_accept_hmo,
    accept_yakap = p_accept_yakap,
    yakap_instructions = p_yakap_instructions
  where tenant_id = v_tenant_id;

  if v_before.accept_hmo is distinct from p_accept_hmo or v_before.accept_yakap is distinct from p_accept_yakap
     or v_before.default_messaging_enabled is distinct from p_default_messaging_enabled then
    insert into public.audit_logs (tenant_id, actor_user_id, action, entity_type, entity_id, old_value, new_value)
    values (
      v_tenant_id, auth.uid(), 'clinic_patient_access_defaults_changed', 'clinic_settings', v_tenant_id,
      jsonb_build_object('accept_hmo', v_before.accept_hmo, 'accept_yakap', v_before.accept_yakap, 'default_messaging_enabled', v_before.default_messaging_enabled),
      jsonb_build_object('accept_hmo', p_accept_hmo, 'accept_yakap', p_accept_yakap, 'default_messaging_enabled', p_default_messaging_enabled)
    );
  end if;
end;
$function$;

-- ── set_provider_patient_access_settings — per-provider override writer ────
-- Every param is nullable; passing NULL means "inherit the clinic
-- default" for that setting (the whole point of this table). Upserts on
-- the (provider_id) unique constraint — one row per provider, ever.
create or replace function public.set_provider_patient_access_settings(
  p_provider_id uuid,
  p_booking_type text,
  p_prioritize_scheduled boolean,
  p_booking_cutoff_minutes integer,
  p_max_advance_booking_days integer,
  p_arrival_reminder_enabled boolean,
  p_arrival_reminder_minutes integer,
  p_custom_instructions text,
  p_accept_hmo boolean,
  p_accept_yakap boolean,
  p_messaging_enabled boolean,
  p_messaging_audience text,
  p_messaging_availability_mode text,
  p_messaging_before_days integer,
  p_messaging_after_days integer,
  p_messaging_outside_hours_behavior text,
  p_messaging_disclaimer text
)
returns void
language plpgsql
security definer
set search_path to 'public'
as $function$
declare v_tenant_id uuid := current_tenant_id(); v_before public.provider_patient_access_settings;
begin
  if not is_clinic_admin() then raise exception 'not authorized'; end if;
  if not exists (select 1 from public.user_profiles where id = p_provider_id and tenant_id = v_tenant_id) then
    raise exception 'not authorized';
  end if;

  select * into v_before from public.provider_patient_access_settings where provider_id = p_provider_id and tenant_id = v_tenant_id;

  insert into public.provider_patient_access_settings (
    tenant_id, provider_id, booking_type, prioritize_scheduled, booking_cutoff_minutes, max_advance_booking_days,
    arrival_reminder_enabled, arrival_reminder_minutes, custom_instructions, accept_hmo, accept_yakap,
    messaging_enabled, messaging_audience, messaging_availability_mode, messaging_before_days, messaging_after_days,
    messaging_outside_hours_behavior, messaging_disclaimer, updated_at, updated_by
  )
  values (
    v_tenant_id, p_provider_id, p_booking_type, p_prioritize_scheduled, p_booking_cutoff_minutes, p_max_advance_booking_days,
    p_arrival_reminder_enabled, p_arrival_reminder_minutes, p_custom_instructions, p_accept_hmo, p_accept_yakap,
    p_messaging_enabled, p_messaging_audience, p_messaging_availability_mode, p_messaging_before_days, p_messaging_after_days,
    p_messaging_outside_hours_behavior, p_messaging_disclaimer, now(), auth.uid()
  )
  on conflict (provider_id) do update set
    booking_type = excluded.booking_type, prioritize_scheduled = excluded.prioritize_scheduled,
    booking_cutoff_minutes = excluded.booking_cutoff_minutes, max_advance_booking_days = excluded.max_advance_booking_days,
    arrival_reminder_enabled = excluded.arrival_reminder_enabled, arrival_reminder_minutes = excluded.arrival_reminder_minutes,
    custom_instructions = excluded.custom_instructions, accept_hmo = excluded.accept_hmo, accept_yakap = excluded.accept_yakap,
    messaging_enabled = excluded.messaging_enabled, messaging_audience = excluded.messaging_audience,
    messaging_availability_mode = excluded.messaging_availability_mode, messaging_before_days = excluded.messaging_before_days,
    messaging_after_days = excluded.messaging_after_days, messaging_outside_hours_behavior = excluded.messaging_outside_hours_behavior,
    messaging_disclaimer = excluded.messaging_disclaimer, updated_at = now(), updated_by = auth.uid();

  if v_before.provider_id is null or v_before.accept_hmo is distinct from p_accept_hmo
     or v_before.accept_yakap is distinct from p_accept_yakap or v_before.messaging_enabled is distinct from p_messaging_enabled
     or v_before.booking_type is distinct from p_booking_type then
    insert into public.audit_logs (tenant_id, actor_user_id, action, entity_type, entity_id, old_value, new_value)
    values (
      v_tenant_id, auth.uid(), 'provider_patient_access_settings_changed', 'provider_patient_access_settings', p_provider_id,
      jsonb_build_object('booking_type', v_before.booking_type, 'accept_hmo', v_before.accept_hmo, 'accept_yakap', v_before.accept_yakap, 'messaging_enabled', v_before.messaging_enabled),
      jsonb_build_object('booking_type', p_booking_type, 'accept_hmo', p_accept_hmo, 'accept_yakap', p_accept_yakap, 'messaging_enabled', p_messaging_enabled)
    );
  end if;
end;
$function$;

-- ── set_provider_messaging_hours — replace a provider's custom weekly hours ─
-- p_hours: jsonb array of {day_of_week, start_time, end_time}. Only
-- meaningful when messaging_availability_mode = 'custom_hours', but not
-- enforced here — the UI only shows/sends this when that mode is picked.
create or replace function public.set_provider_messaging_hours(p_provider_id uuid, p_hours jsonb)
returns void
language plpgsql
security definer
set search_path to 'public'
as $function$
declare v_tenant_id uuid := current_tenant_id();
begin
  if not is_clinic_admin() then raise exception 'not authorized'; end if;
  if not exists (select 1 from public.user_profiles where id = p_provider_id and tenant_id = v_tenant_id) then
    raise exception 'not authorized';
  end if;

  delete from public.provider_messaging_hours where provider_id = p_provider_id and tenant_id = v_tenant_id;
  insert into public.provider_messaging_hours (tenant_id, provider_id, day_of_week, start_time, end_time)
  select v_tenant_id, p_provider_id, (h->>'day_of_week')::smallint, (h->>'start_time')::time, (h->>'end_time')::time
  from jsonb_array_elements(coalesce(p_hours, '[]'::jsonb)) as h;
end;
$function$;

-- ── set_provider_messaging_allowed_patients — replace "selected patients" list ─
create or replace function public.set_provider_messaging_allowed_patients(p_provider_id uuid, p_patient_ids uuid[])
returns void
language plpgsql
security definer
set search_path to 'public'
as $function$
declare v_tenant_id uuid := current_tenant_id();
begin
  if not is_clinic_admin() then raise exception 'not authorized'; end if;
  if not exists (select 1 from public.user_profiles where id = p_provider_id and tenant_id = v_tenant_id) then
    raise exception 'not authorized';
  end if;

  delete from public.provider_messaging_allowed_patients where provider_id = p_provider_id and tenant_id = v_tenant_id;
  if p_patient_ids is not null and array_length(p_patient_ids, 1) > 0 then
    insert into public.provider_messaging_allowed_patients (tenant_id, provider_id, patient_id)
    select v_tenant_id, p_provider_id, pid from unnest(p_patient_ids) as pid
    where exists (select 1 from public.patients where id = pid and tenant_id = v_tenant_id);
  end if;
end;
$function$;

-- ── set_clinic_accepted_hmo — create/update one HMO catalog entry ──────────
create or replace function public.set_clinic_accepted_hmo(
  p_id uuid,
  p_hmo_name text,
  p_is_active boolean,
  p_verification_requirement text,
  p_patient_instructions text,
  p_notes text
)
returns uuid
language plpgsql
security definer
set search_path to 'public'
as $function$
declare v_tenant_id uuid := current_tenant_id(); v_id uuid; v_before public.clinic_accepted_hmos;
begin
  if not is_clinic_admin() then raise exception 'not authorized'; end if;
  if p_id is not null then
    select * into v_before from public.clinic_accepted_hmos where id = p_id and tenant_id = v_tenant_id;
  end if;

  insert into public.clinic_accepted_hmos (id, tenant_id, hmo_name, is_active, verification_requirement, patient_instructions, notes, updated_at, created_by)
  values (coalesce(p_id, gen_random_uuid()), v_tenant_id, p_hmo_name, p_is_active, p_verification_requirement, p_patient_instructions, p_notes, now(), auth.uid())
  on conflict (id) do update set
    hmo_name = excluded.hmo_name, is_active = excluded.is_active, verification_requirement = excluded.verification_requirement,
    patient_instructions = excluded.patient_instructions, notes = excluded.notes, updated_at = now()
  returning id into v_id;

  if v_before.id is not null and v_before.verification_requirement is distinct from p_verification_requirement then
    insert into public.audit_logs (tenant_id, actor_user_id, action, entity_type, entity_id, old_value, new_value)
    values (
      v_tenant_id, auth.uid(), 'hmo_verification_requirement_changed', 'clinic_accepted_hmos', v_id,
      jsonb_build_object('verification_requirement', v_before.verification_requirement),
      jsonb_build_object('verification_requirement', p_verification_requirement)
    );
  end if;

  return v_id;
end;
$function$;

-- ── set_provider_hmo_acceptance — per-provider HMO subset override ─────────
-- Empty/NULL array = clear the override (provider accepts the FULL active
-- clinic list, per the schema comment on provider_hmo_acceptance).
create or replace function public.set_provider_hmo_acceptance(p_provider_id uuid, p_hmo_ids uuid[])
returns void
language plpgsql
security definer
set search_path to 'public'
as $function$
declare v_tenant_id uuid := current_tenant_id();
begin
  if not is_clinic_admin() then raise exception 'not authorized'; end if;
  if not exists (select 1 from public.user_profiles where id = p_provider_id and tenant_id = v_tenant_id) then
    raise exception 'not authorized';
  end if;

  delete from public.provider_hmo_acceptance where provider_id = p_provider_id and tenant_id = v_tenant_id;
  if p_hmo_ids is not null and array_length(p_hmo_ids, 1) > 0 then
    insert into public.provider_hmo_acceptance (tenant_id, provider_id, hmo_id)
    select v_tenant_id, p_provider_id, hid from unnest(p_hmo_ids) as hid
    where exists (select 1 from public.clinic_accepted_hmos where id = hid and tenant_id = v_tenant_id);
  end if;
end;
$function$;

-- ── set_cancellation_policy — clinic or provider scope, versioned ──────────
-- p_scope 'clinic': updates clinic_settings.cancellation_policy, bumps
-- cancellation_policy_version. p_scope 'provider' (p_provider_id
-- required): updates provider_patient_access_settings.cancellation_policy
-- (a wholesale override, not a field-merge) with its own version counter
-- starting fresh at 1 the first time a provider is overridden. Either way,
-- patient_policy_acknowledgements already holds a jsonb snapshot + the
-- version in effect at acknowledgment time, so this bump never rewrites
-- what a patient already agreed to (§63).
create or replace function public.set_cancellation_policy(p_scope text, p_provider_id uuid, p_policy jsonb)
returns integer
language plpgsql
security definer
set search_path to 'public'
as $function$
declare v_tenant_id uuid := current_tenant_id(); v_old_policy jsonb; v_new_version integer;
begin
  if not is_clinic_admin() then raise exception 'not authorized'; end if;
  if p_scope not in ('clinic', 'provider') then raise exception 'Invalid scope.'; end if;

  if p_scope = 'clinic' then
    select cancellation_policy into v_old_policy from public.clinic_settings where tenant_id = v_tenant_id;
    update public.clinic_settings
    set cancellation_policy = p_policy, cancellation_policy_version = cancellation_policy_version + 1
    where tenant_id = v_tenant_id
    returning cancellation_policy_version into v_new_version;

    insert into public.audit_logs (tenant_id, actor_user_id, action, entity_type, entity_id, old_value, new_value)
    values (v_tenant_id, auth.uid(), 'cancellation_policy_changed', 'clinic_settings', v_tenant_id, v_old_policy, p_policy);
  else
    if p_provider_id is null or not exists (select 1 from public.user_profiles where id = p_provider_id and tenant_id = v_tenant_id) then
      raise exception 'not authorized';
    end if;
    select cancellation_policy into v_old_policy from public.provider_patient_access_settings where provider_id = p_provider_id and tenant_id = v_tenant_id;

    insert into public.provider_patient_access_settings (tenant_id, provider_id, cancellation_policy, cancellation_policy_version, updated_at, updated_by)
    values (v_tenant_id, p_provider_id, p_policy, 1, now(), auth.uid())
    on conflict (provider_id) do update set
      cancellation_policy = excluded.cancellation_policy,
      cancellation_policy_version = coalesce(public.provider_patient_access_settings.cancellation_policy_version, 0) + 1,
      updated_at = now(), updated_by = auth.uid()
    returning cancellation_policy_version into v_new_version;

    insert into public.audit_logs (tenant_id, actor_user_id, action, entity_type, entity_id, old_value, new_value)
    values (v_tenant_id, auth.uid(), 'cancellation_policy_changed', 'provider_patient_access_settings', p_provider_id, v_old_policy, p_policy);
  end if;

  return v_new_version;
end;
$function$;

-- ── record_patient_policy_acknowledgement — immutable snapshot ─────────────
-- Callable by the patient themselves (portal booking flow) or by staff
-- recording it on the patient's behalf (e.g. phone booking) — mirrors the
-- dual-path check used by complete_patient_form /
-- record_patient_charge_checkout_session elsewhere in this app.
create or replace function public.record_patient_policy_acknowledgement(
  p_patient_id uuid,
  p_appointment_id uuid,
  p_policy_version integer,
  p_policy_snapshot jsonb,
  p_created_via text default 'portal_booking'
)
returns uuid
language plpgsql
security definer
set search_path to 'public'
as $function$
declare v_tenant_id uuid; v_id uuid;
begin
  select tenant_id into v_tenant_id from public.patients where id = p_patient_id;
  if v_tenant_id is null then raise exception 'not authorized'; end if;
  if not (is_portal_patient(p_patient_id) or v_tenant_id = current_tenant_id()) then
    raise exception 'not authorized';
  end if;

  insert into public.patient_policy_acknowledgements (tenant_id, patient_id, appointment_id, policy_version, policy_snapshot, created_via)
  values (v_tenant_id, p_patient_id, p_appointment_id, p_policy_version, p_policy_snapshot, p_created_via)
  returning id into v_id;

  return v_id;
end;
$function$;
