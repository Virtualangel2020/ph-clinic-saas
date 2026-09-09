-- MyCareDesk platform-level patient account (Tier 2 foundation).
--
-- Context: today a "patient" only exists as a row in ONE clinic's `patients`
-- table (tenant_id not null) and Patient Portal access is always created by
-- a clinic inviting an existing patient record (invite_patient_to_portal).
-- There's no identity that exists on its own, independent of any one clinic
-- — which blocks free self-signup and a cross-clinic "Find a Doctor"
-- directory (spec: "Update MyCareDesk Patient Portal, Provider Directory,
-- Booking Modes, Telehealth, Patient Files & Responsive UI" Parts 2-4, and
-- "Connect Patient Health Profile to the Provider Chart" Part 1).
--
-- Decision (confirmed by Angel): keep every clinic's own `patients` row
-- exactly as it is today — the right scope for clinical/chart data, and
-- untouched here so existing tenant isolation is preserved by construction.
-- Add ONE platform-level account a patient owns from the moment they
-- self-register (a permanent "MyCareDesk Patient ID"). A clinic's own
-- `patients` row links to it via a new nullable column once a real
-- relationship exists — auto-created the first time a self-registered
-- patient books with that clinic (wired when the booking flow is touched
-- in the next tier), or explicitly linked by staff via the dedup
-- search + access-request flow below when a patient is added manually.
--
-- Explicit requirements this schema satisfies:
--   - One permanent MyCareDesk Patient ID per human, never duplicated
--     across clinics (mycaredesk_accounts.id).
--   - Adding a patient manually must search existing MyCareDesk accounts by
--     name + DOB first and send an access request rather than creating a
--     duplicate identity (staff_search_mycaredesk_accounts /
--     staff_request_mycaredesk_access / patient_respond_to_mycaredesk_access_request).
--   - Tenant isolation is preserved: one clinic never automatically sees
--     another clinic's private chart/encounter data just because a patient
--     has one MyCareDesk account — `patients` keeps its existing tenant_id
--     scoping and RLS untouched. Only the shared platform-level Health
--     Profile becomes readable by a clinic, and only once a `patients` row
--     in that clinic already links to the account (i.e. a relationship is
--     already established) — see the SELECT policy on
--     mycaredesk_health_profiles below.
--   - The Health Profile is patient-owned and patient-writable only; a
--     clinic can read it once authorized but cannot silently overwrite it,
--     matching the "patient-reported vs. clinician-verified" distinction
--     the chart-integration spec calls for (that labeling/reconciliation UI
--     is a later tier — this migration only makes sure clinics can never
--     write over patient-entered data at the database level).
--
-- Baseline snapshot first, matching the precedent set by
-- migrations-pending/promotions_phase1_baseline_snapshot.sql.

create table if not exists public._baseline_snapshot_mycaredesk_accounts as
select * from public.patients where false;

-- ---------------------------------------------------------------------
-- 1. The platform account itself.
-- ---------------------------------------------------------------------
create table public.mycaredesk_accounts (
  id uuid primary key default gen_random_uuid(),
  auth_user_id uuid not null unique references auth.users(id) on delete cascade,
  first_name text not null,
  last_name text not null,
  date_of_birth date not null,
  sex text not null check (sex in ('male', 'female', 'other')),
  mobile_phone text,
  email text,
  city text,
  province text,
  status text not null default 'active' check (status in ('active', 'deactivated')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.mycaredesk_accounts is
  'One row per patient, platform-wide — the permanent "MyCareDesk Patient ID" a patient owns independent of any clinic. A clinic''s own patients row links to one of these via patients.mycaredesk_account_id once a relationship exists; it never replaces that per-clinic clinical record.';

alter table public.mycaredesk_accounts enable row level security;

create policy mycaredesk_accounts_owner_select on public.mycaredesk_accounts
  for select using (auth_user_id = auth.uid());

create policy mycaredesk_accounts_owner_update on public.mycaredesk_accounts
  for update using (auth_user_id = auth.uid());

-- Inserts only happen through self_register_mycaredesk_account (SECURITY
-- DEFINER below), so no insert policy is needed for direct client access.

-- ---------------------------------------------------------------------
-- 2. Link a clinic's own patient record to the platform account.
-- ---------------------------------------------------------------------
alter table public.patients
  add column mycaredesk_account_id uuid references public.mycaredesk_accounts(id);

create index patients_mycaredesk_account_id_idx on public.patients(mycaredesk_account_id);

-- No RLS change needed on patients — it keeps its existing tenant_id
-- scoping untouched, which is exactly what preserves tenant isolation here:
-- linking to the same mycaredesk_account_id does NOT make one tenant's
-- patients row visible to another tenant.

-- ---------------------------------------------------------------------
-- 3. The optional, progressively-completable Health Profile.
-- ---------------------------------------------------------------------
create table public.mycaredesk_health_profiles (
  mycaredesk_account_id uuid primary key references public.mycaredesk_accounts(id) on delete cascade,
  allergies text[] not null default '{}',
  medications text[] not null default '{}',
  conditions text[] not null default '{}',
  surgical_history text,
  family_history text,
  social_history text,
  hmo_name text,
  hmo_number text,
  philhealth_number text,
  emergency_contact_name text,
  emergency_contact_relationship text,
  emergency_contact_phone text,
  updated_at timestamptz not null default now()
);

comment on table public.mycaredesk_health_profiles is
  'Patient-owned, patient-writable-only. A clinic can read a given account''s profile once a patients row in that clinic already links to the account (see SELECT policy) — read access follows the relationship, it is never granted platform-wide. Clinics never write here, by design: this stays "patient reported" until a future chart-integration pass adds an explicit per-field [Verify] action that copies a value into the clinic''s own verified chart data.';

alter table public.mycaredesk_health_profiles enable row level security;

create policy health_profile_owner_all on public.mycaredesk_health_profiles
  for all using (
    exists (
      select 1 from public.mycaredesk_accounts a
      where a.id = mycaredesk_health_profiles.mycaredesk_account_id
        and a.auth_user_id = auth.uid()
    )
  );

create policy health_profile_authorized_clinic_select on public.mycaredesk_health_profiles
  for select using (
    exists (
      select 1 from public.patients p
      where p.mycaredesk_account_id = mycaredesk_health_profiles.mycaredesk_account_id
        and p.tenant_id = current_tenant_id()
    )
  );

-- ---------------------------------------------------------------------
-- 4. Dedup search + access-request workflow for manually adding a patient
--    who may already hold a MyCareDesk account at another clinic.
-- ---------------------------------------------------------------------
create table public.mycaredesk_account_access_requests (
  id uuid primary key default gen_random_uuid(),
  mycaredesk_account_id uuid not null references public.mycaredesk_accounts(id) on delete cascade,
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  requested_by uuid references public.user_profiles(id),
  message text,
  status text not null default 'pending' check (status in ('pending', 'approved', 'denied', 'expired')),
  responded_at timestamptz,
  created_at timestamptz not null default now()
);

comment on table public.mycaredesk_account_access_requests is
  'A clinic asking to link an existing MyCareDesk account to a patient record at their clinic, instead of creating a duplicate identity. Created by staff_request_mycaredesk_access after staff_search_mycaredesk_accounts finds a name+DOB match; resolved by the account owner via patient_respond_to_mycaredesk_access_request.';

create unique index mycaredesk_access_requests_one_pending_idx
  on public.mycaredesk_account_access_requests(mycaredesk_account_id, tenant_id)
  where status = 'pending';

alter table public.mycaredesk_account_access_requests enable row level security;

create policy access_requests_tenant_select on public.mycaredesk_account_access_requests
  for select using (tenant_id = current_tenant_id());

create policy access_requests_owner_select on public.mycaredesk_account_access_requests
  for select using (
    exists (
      select 1 from public.mycaredesk_accounts a
      where a.id = mycaredesk_account_access_requests.mycaredesk_account_id
        and a.auth_user_id = auth.uid()
    )
  );

-- Inserts/updates go through the SECURITY DEFINER functions below only.

-- ---------------------------------------------------------------------
-- 5. Functions
-- ---------------------------------------------------------------------

-- Called immediately after a brand-new patient auth.signUp() completes.
-- One account per auth user, enforced by the unique auth_user_id column.
create or replace function public.self_register_mycaredesk_account(
  p_first_name text,
  p_last_name text,
  p_date_of_birth date,
  p_sex text,
  p_mobile_phone text,
  p_email text,
  p_city text default null,
  p_province text default null
) returns public.mycaredesk_accounts
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_account public.mycaredesk_accounts;
begin
  if auth.uid() is null then
    raise exception 'not authorized';
  end if;

  insert into public.mycaredesk_accounts (
    auth_user_id, first_name, last_name, date_of_birth, sex, mobile_phone, email, city, province
  ) values (
    auth.uid(), trim(p_first_name), trim(p_last_name), p_date_of_birth, p_sex,
    nullif(trim(p_mobile_phone), ''), nullif(trim(p_email), ''), nullif(trim(p_city), ''), nullif(trim(p_province), '')
  )
  returning * into v_account;

  return v_account;
exception
  when unique_violation then
    raise exception 'A MyCareDesk account already exists for this login.';
end;
$$;

comment on function public.self_register_mycaredesk_account is
  'Creates the caller''s one platform-level MyCareDesk account right after auth.signUp(). Spec Part 3: minimal fields only, no health questionnaire required.';

-- Returns the caller's own account (or null), so the client can tell
-- whether this signed-in user already has one.
create or replace function public.get_my_mycaredesk_account()
returns public.mycaredesk_accounts
language sql
security definer
set search_path to 'public'
stable
as $$
  select * from public.mycaredesk_accounts where auth_user_id = auth.uid();
$$;

-- Progressive Health Profile completion (spec Part 4). Upsert so the
-- patient can save partial information at any time.
create or replace function public.upsert_my_health_profile(
  p_allergies text[] default '{}',
  p_medications text[] default '{}',
  p_conditions text[] default '{}',
  p_surgical_history text default null,
  p_family_history text default null,
  p_social_history text default null,
  p_hmo_name text default null,
  p_hmo_number text default null,
  p_philhealth_number text default null,
  p_emergency_contact_name text default null,
  p_emergency_contact_relationship text default null,
  p_emergency_contact_phone text default null
) returns public.mycaredesk_health_profiles
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_account_id uuid;
  v_row public.mycaredesk_health_profiles;
begin
  select id into v_account_id from public.mycaredesk_accounts where auth_user_id = auth.uid();
  if v_account_id is null then
    raise exception 'Complete your MyCareDesk account first.';
  end if;

  insert into public.mycaredesk_health_profiles (
    mycaredesk_account_id, allergies, medications, conditions, surgical_history, family_history,
    social_history, hmo_name, hmo_number, philhealth_number,
    emergency_contact_name, emergency_contact_relationship, emergency_contact_phone, updated_at
  ) values (
    v_account_id, coalesce(p_allergies, '{}'), coalesce(p_medications, '{}'), coalesce(p_conditions, '{}'),
    nullif(trim(p_surgical_history), ''), nullif(trim(p_family_history), ''), nullif(trim(p_social_history), ''),
    nullif(trim(p_hmo_name), ''), nullif(trim(p_hmo_number), ''), nullif(trim(p_philhealth_number), ''),
    nullif(trim(p_emergency_contact_name), ''), nullif(trim(p_emergency_contact_relationship), ''), nullif(trim(p_emergency_contact_phone), ''),
    now()
  )
  on conflict (mycaredesk_account_id) do update set
    allergies = excluded.allergies,
    medications = excluded.medications,
    conditions = excluded.conditions,
    surgical_history = excluded.surgical_history,
    family_history = excluded.family_history,
    social_history = excluded.social_history,
    hmo_name = excluded.hmo_name,
    hmo_number = excluded.hmo_number,
    philhealth_number = excluded.philhealth_number,
    emergency_contact_name = excluded.emergency_contact_name,
    emergency_contact_relationship = excluded.emergency_contact_relationship,
    emergency_contact_phone = excluded.emergency_contact_phone,
    updated_at = now()
  returning * into v_row;

  return v_row;
end;
$$;

-- Staff-facing dedup search — name + DOB only, and returns masked contact
-- info (never the full email/mobile) so staff can confirm identity with the
-- patient before requesting access rather than being handed their contact
-- details outright. Excludes accounts already linked to a patients row in
-- the caller's own tenant (nothing to request — they already have them).
create or replace function public.staff_search_mycaredesk_accounts(
  p_name text,
  p_date_of_birth date
) returns table (
  mycaredesk_account_id uuid,
  first_name text,
  last_name text,
  date_of_birth date,
  masked_email text,
  masked_mobile text
)
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

  return query
  select
    a.id,
    a.first_name,
    a.last_name,
    a.date_of_birth,
    case when a.email is null then null
      else left(a.email, 2) || '***@' || split_part(a.email, '@', 2)
    end,
    case when a.mobile_phone is null then null
      else left(a.mobile_phone, 4) || '****' || right(a.mobile_phone, 2)
    end
  from public.mycaredesk_accounts a
  where a.date_of_birth = p_date_of_birth
    and (a.first_name || ' ' || a.last_name) ilike '%' || trim(p_name) || '%'
    and not exists (
      select 1 from public.patients p
      where p.mycaredesk_account_id = a.id and p.tenant_id = v_tenant_id
    )
  limit 10;
end;
$$;

comment on function public.staff_search_mycaredesk_accounts is
  'Search-before-create for "Add New Patient": name + DOB only, masked contact info. Confirms identity without duplicating it — staff send an access request (staff_request_mycaredesk_access) rather than creating a second patient record for the same person.';

create or replace function public.staff_request_mycaredesk_access(
  p_mycaredesk_account_id uuid,
  p_message text default null
) returns public.mycaredesk_account_access_requests
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_tenant_id uuid := current_tenant_id();
  v_profile_id uuid;
  v_row public.mycaredesk_account_access_requests;
begin
  if v_tenant_id is null then
    raise exception 'not authorized';
  end if;

  select id into v_profile_id from public.user_profiles where id = auth.uid();

  insert into public.mycaredesk_account_access_requests (mycaredesk_account_id, tenant_id, requested_by, message)
  values (p_mycaredesk_account_id, v_tenant_id, v_profile_id, nullif(trim(p_message), ''))
  returning * into v_row;

  return v_row;
exception
  when unique_violation then
    raise exception 'A request for this patient is already pending.';
end;
$$;

-- Called by the account owner (the patient), never by staff. On approval,
-- creates that clinic's own patients row (copying identity fields only —
-- clinical history is NOT copied, the clinic still documents its own
-- encounters) linked to the platform account, plus an active portal
-- account, mirroring exactly how a staff-invited patient looks today.
create or replace function public.patient_respond_to_mycaredesk_access_request(
  p_request_id uuid,
  p_approve boolean
) returns void
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_request record;
  v_account record;
  v_patient_id uuid;
begin
  select r.*, a.auth_user_id, a.first_name, a.last_name, a.date_of_birth, a.sex, a.mobile_phone, a.email
    into v_request
  from public.mycaredesk_account_access_requests r
  join public.mycaredesk_accounts a on a.id = r.mycaredesk_account_id
  where r.id = p_request_id and r.status = 'pending';

  if v_request.id is null then
    raise exception 'This request was already resolved or does not exist.';
  end if;
  if v_request.auth_user_id != auth.uid() then
    raise exception 'not authorized';
  end if;

  if not p_approve then
    update public.mycaredesk_account_access_requests set status = 'denied', responded_at = now() where id = p_request_id;
    return;
  end if;

  insert into public.patients (
    tenant_id, first_name, last_name, date_of_birth, sex, mobile_phone, email, mycaredesk_account_id, is_active, payment_type, bill_types
  ) values (
    v_request.tenant_id, v_request.first_name, v_request.last_name, v_request.date_of_birth, v_request.sex,
    v_request.mobile_phone, v_request.email, v_request.mycaredesk_account_id, true, 'cash', '{}'
  )
  returning id into v_patient_id;

  insert into public.patient_portal_accounts (
    tenant_id, patient_id, channel, contact_value, status, auth_user_id, activated_at
  ) values (
    v_request.tenant_id, v_patient_id, case when v_request.email is not null then 'email' else 'sms' end,
    coalesce(v_request.email, v_request.mobile_phone), 'active', v_request.auth_user_id, now()
  );

  update public.mycaredesk_account_access_requests set status = 'approved', responded_at = now() where id = p_request_id;
end;
$$;

-- Applied to production pfoeuildrnlrrmjvwoss on 2026-09-09, plus a small
-- follow-up (link_my_existing_patients_to_mycaredesk_account) — see the
-- project audit doc for what shipped alongside this schema.

create or replace function public.patient_list_my_access_requests()
returns table (
  id uuid,
  tenant_id uuid,
  clinic_name text,
  message text,
  status text,
  created_at timestamptz
)
language sql
security definer
set search_path to 'public'
stable
as $$
  select r.id, r.tenant_id, t.name, r.message, r.status, r.created_at
  from public.mycaredesk_account_access_requests r
  join public.mycaredesk_accounts a on a.id = r.mycaredesk_account_id
  join public.tenants t on t.id = r.tenant_id
  where a.auth_user_id = auth.uid()
  order by r.created_at desc;
$$;
