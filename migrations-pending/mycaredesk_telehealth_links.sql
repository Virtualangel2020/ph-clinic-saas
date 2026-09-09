-- Telehealth meeting links — deliberately simple version.
--
-- Angel: "for the meeting link, just leave it blank. Whatever the doctor
-- put in there, the patient will see. Just have to click on it and it will
-- redirect them. as simple as that" — this replaces the original spec
-- (Document 1 Parts 14-21: platform picker, auto-generation, validation)
-- with the simplest possible thing: a plain URL the doctor pastes, stored
-- per provider+patient pair so it's remembered and reused for every future
-- telehealth appointment between them (no re-pasting each visit), with a
-- per-appointment override that doesn't destroy that recurring default.
--
-- Applied to production (project pfoeuildrnlrrmjvwoss) as migration
-- "mycaredesk_telehealth_links" on 2026-09-09. This file documents that
-- applied migration for the repo's migrations-pending/ convention; it was
-- not run from this file.

create table if not exists public.provider_patient_telehealth_links (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id),
  provider_id uuid not null,
  patient_id uuid not null references public.patients(id) on delete cascade,
  meeting_url text not null,
  updated_at timestamptz not null default now(),
  updated_by uuid,
  unique (tenant_id, provider_id, patient_id)
);

alter table public.provider_patient_telehealth_links enable row level security;

-- Clinic staff (any tenant member) can see/manage their own tenant's links.
create policy telehealth_links_tenant_select on public.provider_patient_telehealth_links
  for select using (tenant_id = current_tenant_id());

-- The patient themself can read the link (to render "Join Online Visit"),
-- reusing the existing is_portal_patient() helper — same pattern as
-- appointments_portal_self_read / patients_portal_self_read.
create policy telehealth_links_portal_self_read on public.provider_patient_telehealth_links
  for select using (is_portal_patient(patient_id));

-- Per-appointment override — set without touching the recurring default.
alter table public.appointments add column if not exists telehealth_link_override text;

create or replace function public.upsert_provider_patient_telehealth_link(
  p_patient_id uuid,
  p_provider_id uuid,
  p_meeting_url text
)
returns public.provider_patient_telehealth_links
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_tenant_id uuid := current_tenant_id();
  v_row public.provider_patient_telehealth_links;
begin
  if v_tenant_id is null then
    raise exception 'not authorized';
  end if;

  insert into public.provider_patient_telehealth_links (
    tenant_id, provider_id, patient_id, meeting_url, updated_at, updated_by
  ) values (
    v_tenant_id, p_provider_id, p_patient_id, trim(p_meeting_url), now(), auth.uid()
  )
  on conflict (tenant_id, provider_id, patient_id) do update set
    meeting_url = excluded.meeting_url,
    updated_at = now(),
    updated_by = auth.uid()
  returning * into v_row;

  return v_row;
end;
$$;

create or replace function public.set_appointment_telehealth_override(
  p_appointment_id uuid,
  p_meeting_url text
)
returns void
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_tenant_id uuid := current_tenant_id();
begin
  if v_tenant_id is null then
    raise exception 'not authorized';
  end if;

  update public.appointments
    set telehealth_link_override = nullif(trim(p_meeting_url), '')
  where id = p_appointment_id and tenant_id = v_tenant_id;
end;
$$;
