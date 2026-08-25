-- ============================================================================
-- Patient <-> Provider messaging (spec §29-34, Phase 5)
-- ============================================================================
-- One thread per (provider, patient) pair, Messenger-style, modeled directly
-- on the existing support_messages / clinic_send_support_message pattern
-- (see app/dashboard/settings/customer-care) — same shape, same
-- SECURITY DEFINER write-gateway convention, just two-sided instead of
-- clinic<->platform.
--
-- Gating (patient-side send only — see staff_send_patient_message below for
-- why the provider side is gated differently):
--   1. messaging_enabled must resolve true (clinic default + provider
--      override, via the SAME resolveEffectiveSettings merge logic used
--      everywhere else — mirrored here in SQL by _effective_messaging_settings).
--   2. messaging_audience must accept this patient (§: never assume a
--      patient can message a provider just because they navigated here).
--   3. messaging_availability_mode's appointment-proximity window, if any.
--   4. messaging_availability_mode = 'custom_hours': provider_messaging_hours
--      must currently be open, UNLESS messaging_outside_hours_behavior =
--      'allow_queue' (message still accepted, just flagged to the patient
--      as "outside hours" rather than rejected).
-- All four checks are re-validated server-side on every send — a patient
-- reaching a thread page during an eligible window and then losing
-- eligibility (appointment cancelled, hours changed) can't sneak a message
-- through on stale client state.

create table if not exists provider_patient_messages (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  provider_id uuid not null references user_profiles(id) on delete cascade,
  patient_id uuid not null references patients(id) on delete cascade,
  sender_type text not null check (sender_type in ('patient', 'provider')),
  sender_user_id uuid references user_profiles(id),
  sender_name text not null,
  body text not null,
  read_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists provider_patient_messages_thread_idx on provider_patient_messages (provider_id, patient_id, created_at);
alter table provider_patient_messages enable row level security;
create policy "tenant members view own provider_patient_messages" on provider_patient_messages
  for select using (tenant_id = current_tenant_id());
-- No insert/update policy — every write goes through the SECURITY DEFINER
-- RPCs below (RPC-per-write convention used throughout this project).

-- ── Internal helpers (reused by every RPC below, so the eligibility logic
-- lives in exactly one place) ───────────────────────────────────────────

create or replace function public._effective_messaging_settings(p_provider_id uuid)
returns table (
  tenant_id uuid,
  messaging_enabled boolean,
  messaging_audience text,
  messaging_availability_mode text,
  messaging_before_days integer,
  messaging_after_days integer,
  messaging_outside_hours_behavior text,
  messaging_disclaimer text
)
language sql
stable
security definer
set search_path to 'public'
as $function$
  select
    up.tenant_id,
    coalesce(o.messaging_enabled, cs.default_messaging_enabled),
    coalesce(o.messaging_audience, cs.default_messaging_audience),
    coalesce(o.messaging_availability_mode, cs.default_messaging_availability_mode),
    coalesce(o.messaging_before_days, cs.default_messaging_before_days),
    coalesce(o.messaging_after_days, cs.default_messaging_after_days),
    coalesce(o.messaging_outside_hours_behavior, cs.default_messaging_outside_hours_behavior),
    coalesce(o.messaging_disclaimer, cs.default_messaging_disclaimer)
  from public.user_profiles up
  join public.clinic_settings cs on cs.tenant_id = up.tenant_id
  left join public.provider_patient_access_settings o on o.provider_id = up.id
  where up.id = p_provider_id and up.is_active = true;
$function$;

create or replace function public._patient_messaging_eligible(p_provider_id uuid, p_patient_id uuid, p_audience text)
returns boolean
language plpgsql
stable
security definer
set search_path to 'public'
as $function$
declare
  v_ok boolean;
begin
  if p_audience = 'all_established' then
    select exists(
      select 1 from public.appointments a
      where a.provider_id = p_provider_id and a.patient_id = p_patient_id
        and a.status not in ('cancelled', 'no_show', 'late_cancellation')
    ) into v_ok;
  elsif p_audience = 'upcoming_appointment' then
    select exists(
      select 1 from public.appointments a
      where a.provider_id = p_provider_id and a.patient_id = p_patient_id
        and a.status not in ('cancelled', 'no_show', 'late_cancellation')
        and a.start_at >= now()
    ) into v_ok;
  elsif p_audience = 'after_visit' then
    select exists(
      select 1 from public.appointments a
      where a.provider_id = p_provider_id and a.patient_id = p_patient_id and a.status = 'completed'
    ) into v_ok;
  elsif p_audience in ('selected_patients', 'custom') then
    -- 'custom' has no separate data source of its own yet — treated the
    -- same as an explicit allow-list (deny-by-default is the safe choice
    -- for an audience mode with no further configuration surface).
    select exists(
      select 1 from public.provider_messaging_allowed_patients m
      where m.provider_id = p_provider_id and m.patient_id = p_patient_id
    ) into v_ok;
  else
    v_ok := false;
  end if;
  return coalesce(v_ok, false);
end;
$function$;

create or replace function public._patient_messaging_within_appointment_window(
  p_provider_id uuid, p_patient_id uuid, p_mode text, p_before_days integer, p_after_days integer
)
returns boolean
language plpgsql
stable
security definer
set search_path to 'public'
as $function$
declare
  v_before_ok boolean := false;
  v_after_ok boolean := false;
begin
  if p_mode not in ('before_appointment', 'after_appointment', 'before_after_appointment') then
    return true;
  end if;

  if p_mode in ('before_appointment', 'before_after_appointment') then
    select exists(
      select 1 from public.appointments a
      where a.provider_id = p_provider_id and a.patient_id = p_patient_id
        and a.status not in ('cancelled', 'no_show', 'late_cancellation')
        and a.start_at >= now()
        and (p_before_days is null or a.start_at <= now() + make_interval(days => p_before_days))
    ) into v_before_ok;
  end if;

  if p_mode in ('after_appointment', 'before_after_appointment') then
    select exists(
      select 1 from public.appointments a
      where a.provider_id = p_provider_id and a.patient_id = p_patient_id and a.status = 'completed'
        and (p_after_days is null or a.end_at >= now() - make_interval(days => p_after_days))
    ) into v_after_ok;
  end if;

  return v_before_ok or v_after_ok;
end;
$function$;

create or replace function public._patient_messaging_within_hours(p_provider_id uuid, p_mode text)
returns boolean
language plpgsql
stable
security definer
set search_path to 'public'
as $function$
declare
  v_tz text := 'Asia/Manila';
  v_now timestamptz := now();
  v_dow smallint;
  v_time time;
  v_ok boolean;
begin
  if p_mode != 'custom_hours' then
    return true;
  end if;
  v_dow := extract(dow from (v_now at time zone v_tz));
  v_time := (v_now at time zone v_tz)::time;
  select exists(
    select 1 from public.provider_messaging_hours h
    where h.provider_id = p_provider_id and h.day_of_week = v_dow
      and v_time >= h.start_time and v_time <= h.end_time
  ) into v_ok;
  return coalesce(v_ok, false);
end;
$function$;

-- ── Patient-side ─────────────────────────────────────────────────────────

-- Read-only precheck so the thread page can show the right state (locked
-- banner, "outside hours" notice, or a live composer) WITHOUT the patient
-- having to attempt a send just to find out. Mirrors the wording used on
-- the provider profile ("Messaging is currently unavailable for this
-- provider.") so the two surfaces never disagree.
create or replace function public.portal_get_messaging_status(p_provider_id uuid)
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
  select patient_id into v_patient_id from public.patient_portal_accounts where auth_user_id = auth.uid() and status = 'active';
  if v_patient_id is null then raise exception 'not authorized'; end if;

  select full_name, title into v_provider from public.user_profiles where id = p_provider_id;
  if v_provider is null then raise exception 'Provider not found.'; end if;

  select * into v_settings from public._effective_messaging_settings(p_provider_id);
  if v_settings.tenant_id is null then raise exception 'Provider not found.'; end if;

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

create or replace function public.portal_get_provider_thread(p_provider_id uuid)
returns setof provider_patient_messages
language plpgsql
stable
security definer
set search_path to 'public'
as $function$
declare
  v_patient_id uuid;
begin
  select patient_id into v_patient_id from public.patient_portal_accounts where auth_user_id = auth.uid() and status = 'active';
  if v_patient_id is null then raise exception 'not authorized'; end if;

  return query
    select * from public.provider_patient_messages
    where provider_id = p_provider_id and patient_id = v_patient_id
    order by created_at asc;
end;
$function$;

-- Overview list for /portal/messages — every provider thread this patient
-- has ever started, newest activity first. Same "zero messages = doesn't
-- show up yet" convention as the admin Customer Care inbox.
create or replace function public.portal_list_message_threads()
returns jsonb
language plpgsql
stable
security definer
set search_path to 'public'
as $function$
declare
  v_patient_id uuid;
  v_result jsonb;
begin
  select patient_id into v_patient_id from public.patient_portal_accounts where auth_user_id = auth.uid() and status = 'active';
  if v_patient_id is null then raise exception 'not authorized'; end if;

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
    where m.patient_id = v_patient_id
    group by m.provider_id, up.full_name, up.title
  ) t;

  return v_result;
end;
$function$;

create or replace function public.portal_send_provider_message(p_provider_id uuid, p_body text)
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
  select patient_id into v_patient_id from public.patient_portal_accounts where auth_user_id = auth.uid() and status = 'active';
  if v_patient_id is null then raise exception 'not authorized'; end if;

  select coalesce(trim(coalesce(first_name, '') || ' ' || coalesce(last_name, '')), 'Patient') into v_patient_name
  from public.patients where id = v_patient_id;

  select * into v_settings from public._effective_messaging_settings(p_provider_id);
  if v_settings.tenant_id is null then raise exception 'Provider not found.'; end if;
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

create or replace function public.portal_mark_provider_thread_read(p_provider_id uuid)
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

  update public.provider_patient_messages
  set read_at = now()
  where provider_id = p_provider_id and patient_id = v_patient_id and sender_type = 'provider' and read_at is null;
end;
$function$;

-- ── Provider/staff-side ──────────────────────────────────────────────────
-- Gated only by the messaging_enabled master switch — NOT by audience or
-- appointment-window, which exist to protect the provider from unsolicited
-- inbound messages, not to stop a provider replying to their own patient.
-- (When messaging is off entirely, the feature is off for both directions —
-- a patient couldn't have reached this thread in the first place.)

create or replace function public.staff_send_patient_message(p_patient_id uuid, p_body text)
returns provider_patient_messages
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_provider_id uuid := auth.uid();
  v_tenant_id uuid;
  v_sender_name text;
  v_patient_tenant uuid;
  v_settings record;
  v_row public.provider_patient_messages;
begin
  select tenant_id, coalesce(full_name, 'Clinic staff') into v_tenant_id, v_sender_name
  from public.user_profiles where id = v_provider_id;
  if v_tenant_id is null then raise exception 'not authorized'; end if;

  select tenant_id into v_patient_tenant from public.patients where id = p_patient_id;
  if v_patient_tenant is null or v_patient_tenant != v_tenant_id then
    raise exception 'Patient not found.';
  end if;

  select * into v_settings from public._effective_messaging_settings(v_provider_id);
  if v_settings.tenant_id is null or not v_settings.messaging_enabled then
    raise exception 'Messaging is currently unavailable for this provider.';
  end if;

  if coalesce(trim(p_body), '') = '' then raise exception 'message cannot be empty'; end if;

  insert into public.provider_patient_messages (tenant_id, provider_id, patient_id, sender_type, sender_user_id, sender_name, body)
  values (v_tenant_id, v_provider_id, p_patient_id, 'provider', v_provider_id, v_sender_name, trim(p_body))
  returning * into v_row;

  return v_row;
end;
$function$;

create or replace function public.staff_mark_patient_thread_read(p_patient_id uuid)
returns void
language plpgsql
security definer
set search_path to 'public'
as $function$
begin
  update public.provider_patient_messages
  set read_at = now()
  where provider_id = auth.uid() and patient_id = p_patient_id and sender_type = 'patient' and read_at is null;
end;
$function$;
