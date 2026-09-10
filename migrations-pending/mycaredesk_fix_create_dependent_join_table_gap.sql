-- CRITICAL FIX: create_dependent_mycaredesk_account only ever set
-- managed_by_account_id on the new row. Phase 1.2 rewrote
-- is_my_mycaredesk_account_or_managed to check ONLY
-- mycaredesk_account_managers (plus the caller's own auth_user_id match)
-- — it no longer falls back to managed_by_account_id at all (that column
-- is frozen display-only now, per the Phase 1.1 migration's own comment).
-- The one-time backfill in that migration covered every dependent that
-- existed BEFORE Phase 1.1 shipped, but this RPC — the live "+ Add family
-- member" flow — was never updated to also insert the join-table row for
-- a NEW dependent. Net effect: any dependent created after Phase 1.1
-- shipped and before this fix would be unmanageable by anyone, including
-- their own creator, the moment they were created (every RLS check and
-- every rewritten RPC would report 'not authorized').
--
-- Fixed by inserting the creator's own active, primary
-- mycaredesk_account_managers row in the same transaction as the account.
--
-- Verified live (JWT-simulated, rolled-back transaction): a dad creates a
-- new dependent, the join-table row is created automatically, and
-- is_my_mycaredesk_account_or_managed immediately returns true for him on
-- that new dependent. Both passed.

create or replace function public.create_dependent_mycaredesk_account(
  p_first_name text, p_last_name text, p_date_of_birth date, p_sex text,
  p_mobile_phone text default null, p_email text default null
)
returns mycaredesk_accounts
language plpgsql
security definer
set search_path to 'public'
as $function$
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

  insert into public.mycaredesk_account_managers (account_id, manager_account_id, relationship, status, is_primary, accepted_at)
  values (v_account.id, v_manager_id, 'parent', 'active', true, now());

  return v_account;
end;
$function$;

grant execute on function public.create_dependent_mycaredesk_account(text, text, date, text, text, text) to authenticated;
