-- Family / dependent MyCareDesk accounts.
--
-- Angel: "if I want to create an account for my husband and kid, i should
-- be able to create another one too" — a dependent has no login of their
-- own (auth_user_id is null); it is linked to the managing (logged-in)
-- account via managed_by_account_id. Every RLS policy and RPC that used to
-- check "auth_user_id = auth.uid()" is generalized to also allow "this
-- account is managed by my account," via a single reusable helper function
-- (is_my_mycaredesk_account_or_managed), same pattern as the pre-existing
-- is_portal_patient() helper.
--
-- Applied to production (project pfoeuildrnlrrmjvwoss) as migration
-- "mycaredesk_family_dependent_accounts" on 2026-09-09, after an earlier
-- attempt failed atomically (Postgres 42P13: create-or-replace cannot
-- change an existing function's return-type shape — patient_list_my_
-- access_requests needed an explicit DROP FUNCTION first, added below).
-- This file documents that applied migration; it was not run from here.

create table if not exists public._baseline_snapshot_mycaredesk_accounts_family as
  select * from public.mycaredesk_accounts where false;

-- 1. Schema: allow a login-less dependent row, linked to its manager.
alter table public.mycaredesk_accounts alter column auth_user_id drop not null;

alter table public.mycaredesk_accounts
  add column managed_by_account_id uuid references public.mycaredesk_accounts(id) on delete cascade;

alter table public.mycaredesk_accounts
  add constraint mycaredesk_accounts_has_owner_or_manager
  check (auth_user_id is not null or managed_by_account_id is not null);

create index if not exists mycaredesk_accounts_managed_by_idx on public.mycaredesk_accounts(managed_by_account_id);

-- 2. Reusable authorization helper (SECURITY DEFINER, like is_portal_patient).
create or replace function public.is_my_mycaredesk_account_or_managed(p_account_id uuid)
returns boolean
language sql
stable
security definer
set search_path to 'public'
as $$
  select exists (
    select 1 from public.mycaredesk_accounts a
    where a.id = p_account_id
      and (
        a.auth_user_id = auth.uid()
        or a.managed_by_account_id in (select id from public.mycaredesk_accounts where auth_user_id = auth.uid())
      )
  );
$$;

-- 3. mycaredesk_accounts RLS: owner-or-manager instead of owner-only.
drop policy if exists mycaredesk_accounts_owner_select on public.mycaredesk_accounts;
drop policy if exists mycaredesk_accounts_owner_update on public.mycaredesk_accounts;

create policy mycaredesk_accounts_owner_or_manager_select on public.mycaredesk_accounts
  for select using (public.is_my_mycaredesk_account_or_managed(id));

create policy mycaredesk_accounts_owner_or_manager_update on public.mycaredesk_accounts
  for update using (public.is_my_mycaredesk_account_or_managed(id));

-- 4. mycaredesk_health_profiles RLS: same owner-or-manager generalization.
drop policy if exists health_profile_owner_all on public.mycaredesk_health_profiles;

create policy health_profile_owner_or_manager_all on public.mycaredesk_health_profiles
  for all using (public.is_my_mycaredesk_account_or_managed(mycaredesk_account_id));

-- 5. Create a dependent account under the caller's own account.
create or replace function public.create_dependent_mycaredesk_account(
  p_first_name text,
  p_last_name text,
  p_date_of_birth date,
  p_sex text,
  p_mobile_phone text default null,
  p_email text default null
)
returns public.mycaredesk_accounts
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_manager_id uuid;
  v_account public.mycaredesk_accounts;
begin
  if auth.uid() is null then
    raise exception 'not authorized';
  end if;

  select id into v_manager_id from public.mycaredesk_accounts where auth_user_id = auth.uid();
  if v_manager_id is null then
    raise exception 'You need your own MyCareDesk account before adding a family member.';
  end if;

  insert into public.mycaredesk_accounts (
    managed_by_account_id, first_name, last_name, date_of_birth, sex, mobile_phone, email
  ) values (
    v_manager_id, trim(p_first_name), trim(p_last_name), p_date_of_birth, p_sex,
    nullif(trim(p_mobile_phone), ''), nullif(trim(p_email), '')
  )
  returning * into v_account;

  return v_account;
end;
$$;

-- 6. List everyone the caller manages (their family "roster").
create or replace function public.get_my_mycaredesk_family()
returns setof public.mycaredesk_accounts
language sql
stable
security definer
set search_path to 'public'
as $$
  select *
  from public.mycaredesk_accounts
  where managed_by_account_id in (select id from public.mycaredesk_accounts where auth_user_id = auth.uid())
  order by created_at asc;
$$;

-- 7. Health profile writes: let a manager write a dependent's profile too.
--    (Fixes what would otherwise be a dead end: creating a dependent
--    account with no way to ever fill in their health info.)
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
  p_emergency_contact_phone text default null,
  p_for_account_id uuid default null
)
returns public.mycaredesk_health_profiles
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_manager_id uuid;
  v_account_id uuid;
  v_row public.mycaredesk_health_profiles;
begin
  select id into v_manager_id from public.mycaredesk_accounts where auth_user_id = auth.uid();
  if v_manager_id is null then
    raise exception 'Complete your MyCareDesk account first.';
  end if;

  if p_for_account_id is null or p_for_account_id = v_manager_id then
    v_account_id := v_manager_id;
  else
    select id into v_account_id from public.mycaredesk_accounts
      where id = p_for_account_id and managed_by_account_id = v_manager_id;
    if v_account_id is null then
      raise exception 'not authorized';
    end if;
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

-- 8. Fix latent auth bug + extend for dependents: a dependent's access
--    request has auth_user_id = null, so the old "!= auth.uid()" check
--    silently evaluated to NULL (never raised) instead of denying.
create or replace function public.patient_respond_to_mycaredesk_access_request(p_request_id uuid, p_approve boolean)
returns void
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_request record;
  v_patient_id uuid;
  v_authorized boolean;
  v_login_auth_user_id uuid;
begin
  select r.*, a.auth_user_id, a.managed_by_account_id, a.first_name, a.last_name, a.date_of_birth, a.sex, a.mobile_phone, a.email
    into v_request
  from public.mycaredesk_account_access_requests r
  join public.mycaredesk_accounts a on a.id = r.mycaredesk_account_id
  where r.id = p_request_id and r.status = 'pending';

  if v_request.id is null then
    raise exception 'This request was already resolved or does not exist.';
  end if;

  v_authorized := (
    v_request.auth_user_id = auth.uid()
    or v_request.managed_by_account_id in (select id from public.mycaredesk_accounts where auth_user_id = auth.uid())
  );
  if not coalesce(v_authorized, false) then
    raise exception 'not authorized';
  end if;

  -- The clinic-side portal login for this new patient record: the
  -- account's own login if it has one, otherwise whoever (the manager)
  -- is approving on the dependent's behalf.
  v_login_auth_user_id := coalesce(v_request.auth_user_id, auth.uid());

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
    coalesce(v_request.email, v_request.mobile_phone), 'active', v_login_auth_user_id, now()
  );

  update public.mycaredesk_account_access_requests set status = 'approved', responded_at = now() where id = p_request_id;
end;
$$;

-- 9. Extend the pending-requests list to also surface dependents' requests,
--    tagged with which family member each request is for.
--    (Must DROP first: changing OUT-parameter shape is not a valid
--    CREATE OR REPLACE — this is the exact statement that failed before.)
drop function if exists public.patient_list_my_access_requests();

create or replace function public.patient_list_my_access_requests()
returns table(
  id uuid,
  tenant_id uuid,
  clinic_name text,
  message text,
  status text,
  created_at timestamptz,
  for_account_id uuid,
  for_account_name text
)
language sql
stable
security definer
set search_path to 'public'
as $$
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
  where a.auth_user_id = auth.uid()
     or a.managed_by_account_id in (select id from public.mycaredesk_accounts where auth_user_id = auth.uid())
  order by r.created_at desc;
$$;
