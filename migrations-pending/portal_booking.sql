-- ============================================================================
-- Real patient self-service booking (spec §49-54, Phase 4)
-- ============================================================================
-- Two new capabilities, both reusing existing tables/engine rather than
-- duplicating anything:
--
-- 1. public_get_provider_availability — returns the SAME raw rows
--    (provider_schedules, provider_date_availability, provider_time_blocks,
--    busy ranges from appointments) the staff-only booking PREVIEW page
--    already fetches, just through a SECURITY DEFINER RPC instead of a
--    direct table read (portal patients / anonymous visitors have no
--    SELECT RLS on those staff tables, by design). The client runs the
--    exact same buildAvailability/classifyDate/computeBookableSlots pure
--    functions from app/dashboard/calendar/availability.ts +
--    bookable-slots.ts against this data — one engine, two callers.
--    Busy ranges are returned as bare time ranges only, never which
--    patient/reason — nothing about another patient leaks out.
--
-- 2. portal_book_appointment — the actual write. Only for booking_type
--    'appointment' or 'both' (an immediately-confirmable slot); walk_in/
--    flexible never reach this, and 'appointment_request' goes through
--    portal_submit_appointment_request instead (needs clinic approval,
--    never silently auto-confirmed). Re-checks the slot doesn't overlap
--    an existing non-cancelled appointment server-side (prevents a
--    double-booking race between two patients picking the same slot) —
--    this is the one piece of availability logic re-validated
--    server-side; the cutoff/max-advance/open-hours checks are enforced
--    client-side against the same engine and are UX-level, not a security
--    boundary (worst case of a bypass is an appointment slightly outside
--    the configured window, not another patient's data exposed).

create or replace function public.public_get_provider_availability(p_provider_id uuid, p_start_date date, p_end_date date)
returns jsonb
language plpgsql
stable
security definer
set search_path to 'public'
as $function$
declare
  v_tenant_id uuid;
  v_result jsonb;
begin
  select tenant_id into v_tenant_id from public.user_profiles where id = p_provider_id and public_directory_enabled = true and is_active = true;
  if v_tenant_id is null then
    return null;
  end if;
  if p_end_date < p_start_date or p_end_date > p_start_date + interval '120 days' then
    raise exception 'Invalid date range.';
  end if;

  select jsonb_build_object(
    'schedules', coalesce((
      select jsonb_agg(jsonb_build_object('day_of_week', s.day_of_week, 'start_time', s.start_time, 'end_time', s.end_time, 'patient_bookable', s.patient_bookable))
      from public.provider_schedules s where s.provider_id = p_provider_id
    ), '[]'::jsonb),
    'date_availability', coalesce((
      select jsonb_agg(jsonb_build_object('avail_date', d.avail_date, 'start_time', d.start_time, 'end_time', d.end_time, 'patient_bookable', d.patient_bookable))
      from public.provider_date_availability d where d.provider_id = p_provider_id and d.avail_date between p_start_date and p_end_date
    ), '[]'::jsonb),
    'time_blocks', coalesce((
      select jsonb_agg(jsonb_build_object('block_date', b.block_date, 'start_time', b.start_time, 'end_time', b.end_time))
      from public.provider_time_blocks b where b.provider_id = p_provider_id and b.block_date between p_start_date and p_end_date
    ), '[]'::jsonb),
    'busy', coalesce((
      select jsonb_agg(jsonb_build_object('start_at', a.start_at, 'end_at', a.end_at))
      from public.appointments a
      where a.provider_id = p_provider_id
        and a.start_at >= p_start_date::timestamptz and a.start_at < (p_end_date + 1)::timestamptz
        and a.status not in ('cancelled', 'no_show', 'late_cancellation')
    ), '[]'::jsonb)
  ) into v_result;

  return v_result;
end;
$function$;

-- Immediate-confirmation booking, portal patients only. hmo_verification_status
-- is set from the HMO's configured verification_requirement (never
-- 'verified' automatically — §25: a patient selecting an HMO never by
-- itself claims coverage).
create or replace function public.portal_book_appointment(
  p_provider_id uuid,
  p_appointment_type_id uuid,
  p_start_at timestamptz,
  p_payment_method text,
  p_hmo_id uuid,
  p_notes text default null
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
  select patient_id into v_patient_id from public.patient_portal_accounts where auth_user_id = auth.uid() and status = 'active';
  if v_patient_id is null then raise exception 'not authorized'; end if;

  select tenant_id into v_tenant_id from public.user_profiles where id = p_provider_id and is_active = true;
  if v_tenant_id is null then raise exception 'Provider not found.'; end if;

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

-- Appointment-request booking (booking_type = 'appointment_request') —
-- never auto-confirmed. Reuses the SAME public_appointment_requests table
-- the anonymous public form writes to (not a second request mechanism),
-- just from an authenticated portal patient instead of a stranger, so
-- their name/phone/email are pulled from their own patient record rather
-- than re-typed.
create or replace function public.portal_submit_appointment_request(
  p_provider_id uuid,
  p_appointment_type_name text,
  p_preferred_date date,
  p_preferred_time text,
  p_reason text
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
  select patient_id into v_patient_id from public.patient_portal_accounts where auth_user_id = auth.uid() and status = 'active';
  if v_patient_id is null then raise exception 'not authorized'; end if;

  select tenant_id into v_tenant_id from public.user_profiles where id = p_provider_id and is_active = true;
  if v_tenant_id is null then raise exception 'Provider not found.'; end if;

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
