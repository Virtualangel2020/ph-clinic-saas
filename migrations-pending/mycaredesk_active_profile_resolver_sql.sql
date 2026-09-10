-- Family Profiles Phase 1.5: SQL layer for "currently selected profile."
--
-- 1. get_my_mycaredesk_family() rewritten (drop+recreate — return shape
--    changes) to source from mycaredesk_account_managers (the Phase 1.1
--    join table) instead of the single-manager managed_by_account_id FK,
--    so it correctly lists a dependent for EVERY active co-manager, not
--    just whoever originally created the dependent. Adds columns the
--    profile chooser / My Family screen need: relationship (specific to
--    the calling manager, not just an arbitrary one), is_primary (the
--    calling manager's own flag for this dependent), co_manager_count
--    (how many OTHER active managers also cover this dependent),
--    has_own_login (true once a dependent later claims their own login —
--    Phase 2), and photo_path.
--
--    Existing callers (app/portal/health-profile/page.tsx's FamilyPanel)
--    only ever read .id/.first_name/.last_name from this — all still
--    present — so this is a drop-in upgrade, not a breaking change.
--
-- 2. is_selectable_mycaredesk_profile(account_id): can the caller
--    currently select this profile in the chooser? True for the caller's
--    own account, or an ACTIVE dependent they actively co-manage — same
--    authorization is_my_mycaredesk_account_or_managed already grants,
--    plus a check that the target account itself hasn't been
--    deactivated. Kept as its own named function (rather than inlining
--    is_my_mycaredesk_account_or_managed at every call site) so the
--    profile-switch action has one clear thing to call, and so a future
--    Phase 2 grant type (household adult links) has one place to extend.
--
-- Verified live (JWT-simulated, rolled-back transaction): both dad and mom
-- (two independent co-managers of the same child, added only via the
-- Phase 1.1 join table) see the child in their own get_my_mycaredesk_family()
-- with their own correct relationship/is_primary and co_manager_count=1
-- each; both pass is_selectable_mycaredesk_profile for the child; a
-- stranger sees an empty family list and fails is_selectable_mycaredesk_profile
-- for the same child. All six assertions passed.

drop function if exists public.get_my_mycaredesk_family();
create or replace function public.get_my_mycaredesk_family()
returns table(
  id uuid,
  first_name text,
  last_name text,
  date_of_birth date,
  sex text,
  photo_path text,
  relationship text,
  relationship_other_description text,
  is_primary boolean,
  co_manager_count integer,
  has_own_login boolean,
  status text,
  created_at timestamptz
)
language sql
stable
security definer
set search_path to 'public'
as $function$
  select
    a.id,
    a.first_name,
    a.last_name,
    a.date_of_birth,
    a.sex,
    a.photo_path,
    m.relationship,
    m.relationship_other_description,
    m.is_primary,
    (
      select count(*)::integer from public.mycaredesk_account_managers m2
      where m2.account_id = a.id and m2.status = 'active' and m2.manager_account_id <> m.manager_account_id
    ) as co_manager_count,
    (a.auth_user_id is not null) as has_own_login,
    a.status,
    m.created_at
  from public.mycaredesk_account_managers m
  join public.mycaredesk_accounts a on a.id = m.account_id
  where m.status = 'active'
    and m.manager_account_id in (select id from public.mycaredesk_accounts where auth_user_id = auth.uid())
  order by m.created_at asc;
$function$;

grant execute on function public.get_my_mycaredesk_family() to authenticated;

create or replace function public.is_selectable_mycaredesk_profile(p_account_id uuid)
returns boolean
language sql
stable
security definer
set search_path to 'public'
as $function$
  select public.is_my_mycaredesk_account_or_managed(p_account_id)
    and exists (select 1 from public.mycaredesk_accounts where id = p_account_id and status = 'active');
$function$;

grant execute on function public.is_selectable_mycaredesk_profile(uuid) to authenticated;
