-- Booking counterpart to portal_book_appointment for the two new styles.
-- Unlike a strict slot, a flexible-arrival or walk-in-intent booking has no
-- exclusive time range to defend — the security-relevant check here is
-- CAPACITY (how many patients already claimed this day), not overlap.
-- window_start/window_end (that day's published clinic-hours) are computed
-- client-side by the same buildAvailability engine every other booking
-- path already trusts client-side for cutoff/advance-day checks (see
-- portal_booking.sql's own comment on that same precedent) — not a
-- security boundary, since the worst case is a booking slightly outside
-- configured hours, never another patient's data.
create or replace function public.portal_book_flexible_or_walkin(
  p_provider_id uuid,
  p_appointment_type_id uuid,
  p_booking_mode text,
  p_window_start timestamptz,
  p_window_end timestamptz,
  p_expected_arrival_at timestamptz default null,
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

  select patient_id into v_patient_id from public.patient_portal_accounts where auth_user_id = auth.uid() and status = 'active';
  if v_patient_id is null then raise exception 'not authorized'; end if;

  select tenant_id into v_tenant_id from public.user_profiles where id = p_provider_id and is_active = true;
  if v_tenant_id is null then raise exception 'Provider not found.'; end if;

  select exists(
    select 1 from public.appointment_types
    where id = p_appointment_type_id and tenant_id = v_tenant_id and is_active = true and patient_booking_enabled = true
  ) into v_type_ok;
  if not v_type_ok then raise exception 'This service is not available for online booking.'; end if;

  -- Capacity only applies to flexible_arrival (Angel's spec never caps
  -- walk-in intent) — effective cap is the provider override if set, else
  -- the clinic default, else unlimited.
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
    booking_mode, expected_arrival_at
  )
  values (
    v_tenant_id, v_patient_id, p_provider_id, p_appointment_type_id, p_window_start, p_window_end, 'scheduled', p_notes,
    p_booking_mode, case when p_booking_mode = 'flexible_arrival' then p_expected_arrival_at else null end
  )
  returning id into v_id;

  return v_id;
end;
$function$;
