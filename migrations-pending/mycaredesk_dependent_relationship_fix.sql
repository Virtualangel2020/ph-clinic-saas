-- Bug + gap reported by Angel: adding a dependent (e.g. her daughter
-- Ziarra) always labeled the relationship "Parent" with no way to say
-- otherwise, and there was no way to fix it afterward. Two root causes:
--
-- 1. create_dependent_mycaredesk_account() never accepted a relationship
--    at all — it hardcoded 'parent' into every new mycaredesk_account_
--    managers row it created, regardless of who was actually being added.
-- 2. Even the ALLOWED values on that column (mother/father/parent/
--    legal_guardian/sibling/caregiver/other, from the original Phase 1.1
--    schema) only cover "this dependent is my parent/elder relative" —
--    there was never a value for the far more common MyCareDesk case,
--    "this dependent is my child." That's not just a missing UI option;
--    the correct value literally didn't exist to pick.
--
-- Fixed by widening the allowed values to cover both directions (a
-- dependent can be an adult's child OR an adult's own parent/elder they
-- care for), giving create_dependent_mycaredesk_account a real
-- p_relationship parameter (default 'child', the common case, replacing
-- the old hardcoded 'parent'), and adding a small RPC so a manager can
-- correct their OWN relationship label on an existing dependent at any
-- time (per Angel's ask: "click on the word 'parent' then can change it
-- to something else") — deliberately scoped to only the caller's own
-- mycaredesk_account_managers row, since two co-managers of the same
-- dependent (e.g. both parents) can each have a different, independently
-- correct relationship to that same child.

alter table public.mycaredesk_account_managers drop constraint if exists mycaredesk_account_managers_relationship_check;
alter table public.mycaredesk_account_managers add constraint mycaredesk_account_managers_relationship_check
  check (relationship in ('child','son','daughter','ward','mother','father','parent','spouse','legal_guardian','sibling','caregiver','other'));

create or replace function public.create_dependent_mycaredesk_account(
  p_first_name text, p_last_name text, p_date_of_birth date, p_sex text,
  p_mobile_phone text default null, p_email text default null,
  p_relationship text default 'child',
  p_relationship_other_description text default null
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

  if p_relationship not in ('child','son','daughter','ward','mother','father','parent','spouse','legal_guardian','sibling','caregiver','other') then
    raise exception 'invalid relationship';
  end if;

  insert into public.mycaredesk_accounts (
    managed_by_account_id, first_name, last_name, date_of_birth, sex, mobile_phone, email
  ) values (
    v_manager_id, trim(p_first_name), trim(p_last_name), p_date_of_birth, p_sex,
    nullif(trim(p_mobile_phone), ''), nullif(trim(p_email), '')
  )
  returning * into v_account;

  insert into public.mycaredesk_account_managers (account_id, manager_account_id, relationship, relationship_other_description, status, is_primary, accepted_at)
  values (v_account.id, v_manager_id, p_relationship, nullif(trim(p_relationship_other_description), ''), 'active', true, now());

  return v_account;
end;
$function$;

grant execute on function public.create_dependent_mycaredesk_account(text, text, date, text, text, text, text, text) to authenticated;

-- Lets a manager correct how THEY relate to a dependent they already
-- manage (only their own mycaredesk_account_managers row — a co-manager's
-- own relationship label is theirs to set independently). Used by the
-- profile chooser / My Family screen's inline "change relationship" editor.
create or replace function public.update_my_mycaredesk_relationship(
  p_account_id uuid,
  p_relationship text,
  p_relationship_other_description text default null
)
returns mycaredesk_account_managers
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_manager_id uuid;
  v_row public.mycaredesk_account_managers;
begin
  select id into v_manager_id from public.mycaredesk_accounts where auth_user_id = auth.uid();
  if v_manager_id is null then
    raise exception 'not authorized';
  end if;

  if p_relationship not in ('child','son','daughter','ward','mother','father','parent','spouse','legal_guardian','sibling','caregiver','other') then
    raise exception 'invalid relationship';
  end if;

  update public.mycaredesk_account_managers
    set relationship = p_relationship,
        relationship_other_description = nullif(trim(p_relationship_other_description), '')
    where account_id = p_account_id
      and manager_account_id = v_manager_id
      and status = 'active'
    returning * into v_row;

  if v_row.id is null then
    raise exception 'not authorized';
  end if;

  return v_row;
end;
$function$;

grant execute on function public.update_my_mycaredesk_relationship(uuid, text, text) to authenticated;
