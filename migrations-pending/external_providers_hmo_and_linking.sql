-- Phase F (Find a Doctor product redesign — zero MyCareDesk providers must
-- be a normal empty state, plus a two-source directory: real MyCareDesk
-- providers vs. manually-curated External/Directory providers).
--
-- Audit finding: an External Provider Directory system already exists in
-- full (external_providers table, admin_upsert_external_provider /
-- admin_delete_external_provider RPCs, a working admin CRUD UI at
-- app/admin/providers-directory). Per Angel's explicit instruction not to
-- build a duplicate system, this migration only ADDS the two capabilities
-- her spec needs that the existing system doesn't have yet:
--
-- 1. hmo_names — a plain text array of HMO affiliations for an external
--    (non-MyCareDesk) provider. External providers have no tenant, so they
--    can't participate in the structured clinic_accepted_hmos table real
--    MyCareDesk providers use — a free-text list is the honest equivalent
--    for a manually-curated directory entry.
-- 2. linked_provider_id — controlled admin linking of an external listing
--    to a real user_profiles row, once that doctor actually joins
--    MyCareDesk. This is intentionally a plain nullable FK set only via the
--    admin form (never automatic, never merged by name) so a linked
--    external row can be hidden from the patient-facing External section
--    (the app queries add `.is("linked_provider_id", null)`) without ever
--    deleting the historical directory record.
--
-- APPLIED DIRECTLY TO PRODUCTION (pfoeuildrnlrrmjvwoss) via
-- mcp__Supabase__apply_migration on 2026-09-11, migration name
-- "external_providers_hmo_and_linking". This file is the source-controlled
-- record of that exact change, written after the fact.
alter table public.external_providers
  add column if not exists hmo_names text[],
  add column if not exists linked_provider_id uuid references public.user_profiles(id) on delete set null;

create index if not exists external_providers_linked_provider_idx
  on public.external_providers(linked_provider_id) where linked_provider_id is not null;

comment on column public.external_providers.hmo_names is 'Free-text list of HMOs this external (non-MyCareDesk) provider is known to accept. Not linked to clinic_accepted_hmos — external providers have no tenant.';
comment on column public.external_providers.linked_provider_id is 'Controlled admin link to the real user_profiles row once this externally-listed doctor joins MyCareDesk as an actual provider account. Set only via explicit admin action (never auto-merged by name). When set, patient-facing queries exclude this row from the External section so the doctor is not shown twice.';

-- CREATE OR REPLACE FUNCTION allows appending new parameters as long as
-- they all have defaults and the return type is unchanged — no need to
-- drop the existing function or touch its call sites that don't pass the
-- new arguments.
create or replace function public.admin_upsert_external_provider(
  p_id uuid,
  p_full_name text,
  p_credentials text,
  p_specialty text,
  p_subspecialty text,
  p_clinic_name text,
  p_hospital text,
  p_address text,
  p_city text,
  p_contact_number text,
  p_photo_path text,
  p_schedule_text text,
  p_source text,
  p_source_url text,
  p_verified boolean,
  p_is_active boolean,
  p_hmo_names text[] default null,
  p_linked_provider_id uuid default null
)
returns uuid
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_id uuid;
  v_verified_at timestamptz;
  v_existing_verified_at timestamptz;
  v_linked_role text;
begin
  if not is_platform_admin() then
    raise exception 'not authorized';
  end if;

  if p_full_name is null or trim(p_full_name) = '' then
    raise exception 'Provider name is required';
  end if;

  if p_linked_provider_id is not null then
    select role into v_linked_role from user_profiles where id = p_linked_provider_id;
    if v_linked_role is null then
      raise exception 'Selected MyCareDesk provider was not found';
    end if;
    if v_linked_role not in ('doctor', 'clinic_admin') then
      raise exception 'Selected account is not a provider';
    end if;
  end if;

  if p_id is not null then
    select verified_at into v_existing_verified_at from external_providers where id = p_id;
  end if;

  v_verified_at := case
    when p_verified and v_existing_verified_at is not null then v_existing_verified_at
    when p_verified then now()
    else null
  end;

  if p_id is null then
    insert into external_providers (
      full_name, credentials, specialty, subspecialty, clinic_name, hospital,
      address, city, contact_number, photo_path, schedule_text,
      source, source_url, verified_at, is_active, hmo_names, linked_provider_id
    ) values (
      trim(p_full_name), p_credentials, p_specialty, p_subspecialty, p_clinic_name, p_hospital,
      p_address, p_city, p_contact_number, p_photo_path, p_schedule_text,
      coalesce(nullif(trim(p_source), ''), 'Virtual Angel Systems (manually verified)'), p_source_url, v_verified_at, p_is_active,
      p_hmo_names, p_linked_provider_id
    )
    returning id into v_id;
  else
    update external_providers set
      full_name = trim(p_full_name),
      credentials = p_credentials,
      specialty = p_specialty,
      subspecialty = p_subspecialty,
      clinic_name = p_clinic_name,
      hospital = p_hospital,
      address = p_address,
      city = p_city,
      contact_number = p_contact_number,
      photo_path = p_photo_path,
      schedule_text = p_schedule_text,
      source = coalesce(nullif(trim(p_source), ''), 'Virtual Angel Systems (manually verified)'),
      source_url = p_source_url,
      verified_at = v_verified_at,
      is_active = p_is_active,
      hmo_names = p_hmo_names,
      linked_provider_id = p_linked_provider_id,
      updated_at = now()
    where id = p_id
    returning id into v_id;

    if v_id is null then
      raise exception 'Provider not found';
    end if;
  end if;

  insert into audit_logs (actor_user_id, action, entity_type, entity_id, new_value)
  values (
    auth.uid(),
    case when p_id is null then 'external_provider_created' else 'external_provider_updated' end,
    'external_providers', v_id,
    jsonb_build_object('full_name', p_full_name, 'linked_provider_id', p_linked_provider_id)
  );

  return v_id;
end;
$function$;
