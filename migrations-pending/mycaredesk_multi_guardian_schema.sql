-- Family Profiles Phase 1.1-1.3: multi-guardian co-management schema.
--
-- Today mycaredesk_accounts.managed_by_account_id is a single nullable FK
-- — one manager per dependent, which blocks "both parents manage the same
-- child" (spec Test C). This adds an additive join table so a dependent
-- can have MORE THAN ONE active manager, without touching
-- managed_by_account_id (kept as a frozen "who originally created this
-- dependent" display field — every authorization check below moves to
-- the join table instead).

create table public.mycaredesk_account_managers (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references public.mycaredesk_accounts(id) on delete cascade,        -- the dependent
  manager_account_id uuid not null references public.mycaredesk_accounts(id) on delete cascade, -- the adult
  relationship text not null check (relationship in
    ('mother','father','parent','legal_guardian','sibling','caregiver','other')),
  relationship_other_description text,
  status text not null default 'active' check (status in ('pending','active','revoked')),
  is_primary boolean not null default false,
  invited_by_account_id uuid references public.mycaredesk_accounts(id),
  invited_at timestamptz not null default now(),
  accepted_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz not null default now(),
  constraint mycaredesk_account_managers_no_self_manage check (account_id <> manager_account_id)
);

create unique index mycaredesk_account_managers_active_pair_idx
  on public.mycaredesk_account_managers (account_id, manager_account_id)
  where status in ('pending','active');
create index mycaredesk_account_managers_manager_idx on public.mycaredesk_account_managers(manager_account_id);
create index mycaredesk_account_managers_account_idx on public.mycaredesk_account_managers(account_id);

comment on table public.mycaredesk_account_managers is
  'Co-management join table: which mycaredesk_accounts (adults) may act as a manager for which dependent account. Additive alongside mycaredesk_accounts.managed_by_account_id (kept as a frozen "originally created by" display field only) — every authorization check reads from here so a dependent can have more than one active manager (e.g. both parents).';

-- Backfill: every existing dependent's current single manager becomes
-- their first, primary, already-accepted row.
insert into public.mycaredesk_account_managers
  (account_id, manager_account_id, relationship, status, is_primary, accepted_at, created_at)
select id, managed_by_account_id, 'parent', 'active', true, created_at, created_at
from public.mycaredesk_accounts where managed_by_account_id is not null;

comment on column public.mycaredesk_accounts.managed_by_account_id is
  'DEPRECATED for authorization — kept only as a frozen "who originally created this dependent" display field. Every access check now goes through mycaredesk_account_managers (see is_my_mycaredesk_account_or_managed).';

-- 1.2: central RLS helper (used by mycaredesk_accounts + mycaredesk_health_profiles) —
-- now checks the join table in addition to the single legacy FK, so every
-- existing policy that already calls this gets multi-guardian support for
-- free with no other change.
create or replace function public.is_my_mycaredesk_account_or_managed(p_account_id uuid)
returns boolean language sql stable security definer set search_path to 'public' as $$
  select exists (select 1 from public.mycaredesk_accounts a where a.id = p_account_id and a.auth_user_id = auth.uid())
  or exists (
    select 1 from public.mycaredesk_account_managers m
    join public.mycaredesk_accounts my on my.id = m.manager_account_id
    where m.account_id = p_account_id and m.status = 'active' and my.auth_user_id = auth.uid()
  );
$$;

-- 1.3: clinic-side helper — same multi-guardian extension, routed through
-- patients.mycaredesk_account_id so a co-manager gets the same clinic-scoped
-- access (patients, appointments, documents, prescriptions, invoices, etc.)
-- as the account's original single manager did before.
create or replace function public.is_portal_patient(p_patient_id uuid)
returns boolean
language sql
stable
security definer
set search_path to 'public'
as $function$
  select exists (
    select 1 from public.patient_portal_accounts
    where patient_id = p_patient_id and auth_user_id = auth.uid() and status = 'active'
  )
  or exists (
    select 1 from public.patients p
    join public.mycaredesk_account_managers m on m.account_id = p.mycaredesk_account_id
    join public.mycaredesk_accounts my on my.id = m.manager_account_id
    where p.id = p_patient_id
      and p.mycaredesk_account_id is not null
      and m.status = 'active'
      and my.auth_user_id = auth.uid()
  );
$function$;

-- The one raw policy that didn't delegate to a shared helper — needs the
-- same OR-managed-dependent clause so a manager can see a dependent's
-- patient_portal_accounts row (needed to resolve which clinic(s) that
-- dependent is connected to).
drop policy if exists patient_portal_accounts_self_select on public.patient_portal_accounts;
create policy patient_portal_accounts_self_select on public.patient_portal_accounts
for select using (
  auth_user_id = auth.uid()
  or exists (
    select 1 from public.patients p
    join public.mycaredesk_account_managers m on m.account_id = p.mycaredesk_account_id
    join public.mycaredesk_accounts my on my.id = m.manager_account_id
    where p.id = patient_portal_accounts.patient_id
      and p.mycaredesk_account_id is not null
      and m.status = 'active'
      and my.auth_user_id = auth.uid()
  )
);

alter table public.mycaredesk_account_managers enable row level security;

-- A manager can see their own management rows (both as the dependent's
-- record and as the manager) — needed for the "My Family" screen and the
-- profile chooser to resolve who manages whom.
create policy mycaredesk_account_managers_self_select on public.mycaredesk_account_managers
for select using (
  exists (select 1 from public.mycaredesk_accounts a where a.id = manager_account_id and a.auth_user_id = auth.uid())
  or exists (select 1 from public.mycaredesk_accounts a where a.id = account_id and a.auth_user_id = auth.uid())
);
