-- Phase 2 (Patient Dashboard + Follow-Ups): patient-portal follow-up
-- scheduling + a small new appointment_status_events table for the
-- dashboard's "your appointment was rescheduled/cancelled" notice.
--
-- Design (see Design decisions #3 and #5 in the approved Phase 1/2 plan):
-- patient_follow_ups already exists fully built server-side (created from
-- a progress note's Plan section) but has zero patient-portal surfacing.
-- We add ONE new status value + ONE new column rather than a parallel
-- table, and reuse is_portal_patient() (already used by
-- appointments_portal_self_read) for the new patient self-read policy.
--
-- Status lifecycle: pending (=Outstanding) -> patient books via the
-- dashboard's "Schedule Follow-Up" button -> scheduled (stamped by
-- patient_schedule_follow_up) -> the linked appointment completes ->
-- completed (stamped automatically by set_appointment_status below). If
-- that linked appointment instead gets cancelled/no-showed, the follow-up
-- reverts to pending (scheduled_appointment_id cleared) rather than
-- silently looking resolved — the patient still needs to come back.
-- "Overdue" stays a derived state (status='pending' and due_date < today),
-- computed by the caller, same as the existing staff-side section.

-- 1. patient_follow_ups: add 'scheduled' status + link to the appointment
-- that will satisfy it.
alter table public.patient_follow_ups drop constraint patient_follow_ups_status_check;
alter table public.patient_follow_ups add constraint patient_follow_ups_status_check
  check (status in ('pending', 'scheduled', 'completed', 'cancelled'));
alter table public.patient_follow_ups add column if not exists scheduled_appointment_id uuid references public.appointments(id);

-- Patient self-read (mirrors appointments_portal_self_read's shape) — the
-- only new patient-facing read path this table needs; staff already read
-- everything via patient_follow_ups_tenant_read.
create policy patient_follow_ups_portal_self_read on public.patient_follow_ups
  for select using (is_portal_patient(patient_id));

-- 2. New minimal appointment-change-notice table (Design #5). Written by
-- set_appointment_status/update_appointment below, read by the patient
-- dashboard, dismissed via patient_acknowledge_status_event so it never
-- lingers after the patient has seen it.
create table public.appointment_status_events (
  id uuid primary key default gen_random_uuid(),
  appointment_id uuid not null references public.appointments(id) on delete cascade,
  tenant_id uuid not null,
  patient_id uuid not null,
  old_status text,
  new_status text,
  old_start_at timestamptz,
  new_start_at timestamptz,
  changed_at timestamptz not null default now(),
  acknowledged_at timestamptz
);
create index appointment_status_events_patient_idx on public.appointment_status_events (patient_id, acknowledged_at);
alter table public.appointment_status_events enable row level security;

create policy appointment_status_events_tenant_read on public.appointment_status_events
  for select using (tenant_id = current_tenant_id());
create policy appointment_status_events_portal_self_read on public.appointment_status_events
  for select using (is_portal_patient(patient_id));

-- 3. Patient-facing RPCs.

create or replace function public.patient_list_my_follow_ups()
returns setof public.patient_follow_ups
language sql
stable
security definer
set search_path to 'public'
as $function$
  select f.*
  from public.patient_follow_ups f
  join public.patient_portal_accounts ppa on ppa.patient_id = f.patient_id
  where ppa.auth_user_id = auth.uid() and ppa.status = 'active'
    and f.status in ('pending', 'scheduled')
  order by f.due_date asc;
$function$;

-- Called once the booking wizard's own booking RPC (portal_book_appointment
-- or portal_book_flexible_or_walkin) returns a real appointment id for a
-- "Schedule Follow-Up" deep-link booking — stamps the follow-up as
-- scheduled against that appointment. Re-verifies the follow-up and the
-- appointment both belong to the calling patient (never trusts the ids
-- blindly) and that the follow-up hasn't already been resolved.
create or replace function public.patient_schedule_follow_up(p_follow_up_id uuid, p_appointment_id uuid)
returns void
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_patient_id uuid;
begin
  select patient_id into v_patient_id from public.patient_portal_accounts where auth_user_id = auth.uid() and status = 'active';
  if v_patient_id is null then raise exception 'not authorized'; end if;

  if not exists (select 1 from public.appointments where id = p_appointment_id and patient_id = v_patient_id) then
    raise exception 'not authorized';
  end if;

  update public.patient_follow_ups
  set status = 'scheduled', scheduled_appointment_id = p_appointment_id, updated_at = now()
  where id = p_follow_up_id and patient_id = v_patient_id and status = 'pending';
  if not found then raise exception 'follow-up not found, not yours, or already resolved'; end if;
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
  select patient_id into v_patient_id from public.patient_portal_accounts where auth_user_id = auth.uid() and status = 'active';
  if v_patient_id is null then raise exception 'not authorized'; end if;

  update public.appointment_status_events
  set acknowledged_at = now()
  where id = p_id and patient_id = v_patient_id;
  if not found then raise exception 'not found or not yours'; end if;
end;
$function$;

-- 4. Widen the two existing staff RPCs so a 'scheduled' follow-up (one the
-- patient already booked) can still be manually resolved by staff — e.g.
-- the provider decides it's satisfied by a different visit already on the
-- chart. Purely additive to the WHERE clause; behavior for 'pending' rows
-- is unchanged.
create or replace function public.complete_patient_follow_up(p_id uuid)
returns void
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_tenant_id uuid := current_tenant_id();
begin
  if v_tenant_id is null then raise exception 'not authorized'; end if;
  update public.patient_follow_ups
  set status = 'completed', completed_at = now(), completed_by = auth.uid(), updated_at = now()
  where id = p_id and tenant_id = v_tenant_id and status in ('pending', 'scheduled');
  if not found then raise exception 'follow-up not found, not yours, or already resolved'; end if;
end;
$function$;

create or replace function public.cancel_patient_follow_up(p_id uuid)
returns void
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_tenant_id uuid := current_tenant_id();
begin
  if v_tenant_id is null then raise exception 'not authorized'; end if;
  update public.patient_follow_ups
  set status = 'cancelled', updated_at = now()
  where id = p_id and tenant_id = v_tenant_id and status in ('pending', 'scheduled');
  if not found then raise exception 'follow-up not found, not yours, or already resolved'; end if;
end;
$function$;

-- 5. Hook appointment_status_events + auto follow-up resolution into the
-- two existing staff calendar RPCs that change an appointment's
-- status/time. Both are CREATE OR REPLACE on their EXISTING signatures —
-- no app-code call site needs to change.

create or replace function public.set_appointment_status(p_id uuid, p_status text, p_cancel_reason text DEFAULT NULL::text)
returns void
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_tenant_id uuid := current_tenant_id();
  v_old_status text;
  v_patient_id uuid;
  v_start_at timestamptz;
begin
  if v_tenant_id is null then raise exception 'not authorized'; end if;
  if not user_has_permission(auth.uid(), 'scheduling.manage') then raise exception 'You do not have permission to manage scheduling.'; end if;
  if p_status not in ('scheduled','confirmed','checked_in','waiting','with_provider','completed','cancelled','no_show','walk_in','late_cancellation') then
    raise exception 'invalid status';
  end if;

  select status, patient_id, start_at into v_old_status, v_patient_id, v_start_at
  from public.appointments where id = p_id and tenant_id = v_tenant_id;
  if v_old_status is null then raise exception 'not authorized'; end if;

  update public.appointments
  set status = p_status,
      cancel_reason = case when p_status in ('cancelled','late_cancellation') then p_cancel_reason else cancel_reason end,
      updated_at = now()
  where id = p_id and tenant_id = v_tenant_id;

  insert into public.audit_logs (tenant_id, actor_user_id, action, entity_type, entity_id, old_value, new_value)
  values (v_tenant_id, auth.uid(), 'appointment_status_changed', 'appointments', p_id,
    jsonb_build_object('status', v_old_status), jsonb_build_object('status', p_status, 'reason', p_cancel_reason));

  if v_old_status is distinct from p_status then
    insert into public.appointment_status_events (appointment_id, tenant_id, patient_id, old_status, new_status, old_start_at, new_start_at)
    values (p_id, v_tenant_id, v_patient_id, v_old_status, p_status, v_start_at, v_start_at);
  end if;

  -- Keep the linked follow-up's status connected to what actually
  -- happened to the visit that was supposed to satisfy it (spec Part 19 —
  -- "smart" status, never left stuck or falsely resolved).
  if p_status = 'completed' then
    update public.patient_follow_ups
    set status = 'completed', completed_at = now(), updated_at = now()
    where scheduled_appointment_id = p_id and status = 'scheduled';
  elsif p_status in ('cancelled', 'no_show', 'late_cancellation') then
    update public.patient_follow_ups
    set status = 'pending', scheduled_appointment_id = null, updated_at = now()
    where scheduled_appointment_id = p_id and status = 'scheduled';
  end if;
end;
$function$;

create or replace function public.update_appointment(p_id uuid, p_patient_id uuid, p_provider_id uuid, p_appointment_type_id uuid, p_start_at timestamp with time zone, p_end_at timestamp with time zone, p_notes text)
returns void
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_tenant_id uuid := current_tenant_id();
  v_old record;
  v_allow_double boolean;
  v_conflict record;
begin
  if v_tenant_id is null then raise exception 'not authorized'; end if;
  if not user_has_permission(auth.uid(), 'scheduling.manage') then raise exception 'You do not have permission to manage scheduling.'; end if;
  select * into v_old from public.appointments where id = p_id and tenant_id = v_tenant_id;
  if v_old.id is null then raise exception 'not authorized'; end if;
  if not exists (select 1 from public.patients where id = p_patient_id and tenant_id = v_tenant_id) then raise exception 'not authorized'; end if;
  if p_provider_id is not null and not exists (select 1 from public.user_profiles where id = p_provider_id and tenant_id = v_tenant_id) then raise exception 'not authorized'; end if;
  if p_end_at <= p_start_at then raise exception 'End time must be after start time'; end if;

  select allow_double_booking into v_allow_double from public.clinic_settings where tenant_id = v_tenant_id;
  if p_provider_id is not null and coalesce(v_allow_double, true) = false then
    select * into v_conflict from public.find_appointment_conflicts(p_provider_id, p_start_at, p_end_at, p_id) limit 1;
    if v_conflict.id is not null then
      raise exception 'Scheduling conflict: this provider already has an appointment with % % at that time.', v_conflict.patient_first_name, v_conflict.patient_last_name;
    end if;
  end if;

  update public.appointments
  set patient_id = p_patient_id, provider_id = p_provider_id, appointment_type_id = p_appointment_type_id,
      start_at = p_start_at, end_at = p_end_at, notes = p_notes, updated_at = now()
  where id = p_id and tenant_id = v_tenant_id;

  insert into public.audit_logs (tenant_id, actor_user_id, action, entity_type, entity_id, old_value, new_value)
  values (v_tenant_id, auth.uid(), 'appointment_rescheduled', 'appointments', p_id,
    jsonb_build_object('provider_id', v_old.provider_id, 'start_at', v_old.start_at, 'end_at', v_old.end_at),
    jsonb_build_object('provider_id', p_provider_id, 'start_at', p_start_at, 'end_at', p_end_at));

  if v_old.start_at is distinct from p_start_at or v_old.provider_id is distinct from p_provider_id then
    insert into public.appointment_status_events (appointment_id, tenant_id, patient_id, old_status, new_status, old_start_at, new_start_at)
    values (p_id, v_tenant_id, p_patient_id, v_old.status, v_old.status, v_old.start_at, p_start_at);
  end if;
end;
$function$;
