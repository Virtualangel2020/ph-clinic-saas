-- Wire the new booking_style/online_booking_enabled/flexible-arrival
-- settings into the existing write RPCs (trailing, defaulted params — safe
-- for the current call sites, which pass named args via supabase.rpc).
-- Patches set_clinic_patient_access_defaults and
-- set_provider_patient_access_settings, originally defined in
-- patient_access_and_payments_rpcs.sql — full replacement bodies below via
-- create or replace, same as every other patch file this project uses.

-- 1) Clinic-wide defaults writer — append the 4 new fields.
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
  p_yakap_instructions text,
  p_online_booking_enabled boolean default true,
  p_booking_style text default 'specific_times',
  p_flexible_arrival_interval_minutes integer default null,
  p_flexible_arrival_max_patients_per_day integer default null
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
    yakap_instructions = p_yakap_instructions,
    online_booking_enabled = p_online_booking_enabled,
    booking_style = p_booking_style,
    flexible_arrival_interval_minutes = p_flexible_arrival_interval_minutes,
    flexible_arrival_max_patients_per_day = p_flexible_arrival_max_patients_per_day
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

-- 2) Per-provider override writer — append the 4 new fields (all
-- NULL-default, matching every other override column's inherit semantics).
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
  p_messaging_disclaimer text,
  p_online_booking_enabled boolean default null,
  p_booking_style text default null,
  p_flexible_arrival_interval_minutes integer default null,
  p_flexible_arrival_max_patients_per_day integer default null
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
    messaging_outside_hours_behavior, messaging_disclaimer,
    online_booking_enabled, booking_style, flexible_arrival_interval_minutes, flexible_arrival_max_patients_per_day,
    updated_at, updated_by
  )
  values (
    v_tenant_id, p_provider_id, p_booking_type, p_prioritize_scheduled, p_booking_cutoff_minutes, p_max_advance_booking_days,
    p_arrival_reminder_enabled, p_arrival_reminder_minutes, p_custom_instructions, p_accept_hmo, p_accept_yakap,
    p_messaging_enabled, p_messaging_audience, p_messaging_availability_mode, p_messaging_before_days, p_messaging_after_days,
    p_messaging_outside_hours_behavior, p_messaging_disclaimer,
    p_online_booking_enabled, p_booking_style, p_flexible_arrival_interval_minutes, p_flexible_arrival_max_patients_per_day,
    now(), auth.uid()
  )
  on conflict (provider_id) do update set
    booking_type = excluded.booking_type, prioritize_scheduled = excluded.prioritize_scheduled,
    booking_cutoff_minutes = excluded.booking_cutoff_minutes, max_advance_booking_days = excluded.max_advance_booking_days,
    arrival_reminder_enabled = excluded.arrival_reminder_enabled, arrival_reminder_minutes = excluded.arrival_reminder_minutes,
    custom_instructions = excluded.custom_instructions, accept_hmo = excluded.accept_hmo, accept_yakap = excluded.accept_yakap,
    messaging_enabled = excluded.messaging_enabled, messaging_audience = excluded.messaging_audience,
    messaging_availability_mode = excluded.messaging_availability_mode, messaging_before_days = excluded.messaging_before_days,
    messaging_after_days = excluded.messaging_after_days, messaging_outside_hours_behavior = excluded.messaging_outside_hours_behavior,
    messaging_disclaimer = excluded.messaging_disclaimer,
    online_booking_enabled = excluded.online_booking_enabled, booking_style = excluded.booking_style,
    flexible_arrival_interval_minutes = excluded.flexible_arrival_interval_minutes,
    flexible_arrival_max_patients_per_day = excluded.flexible_arrival_max_patients_per_day,
    updated_at = now(), updated_by = auth.uid();

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
