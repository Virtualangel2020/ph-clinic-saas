-- Family Profiles Phase 1 follow-up: upsert_my_health_profile's
-- p_for_account_id overload still did its own inline
-- "managed_by_account_id = v_manager_id" check instead of routing through
-- is_my_mycaredesk_account_or_managed (the shared helper Phase 1.2 gave
-- multi-guardian support to). That meant a SECOND co-manager added via
-- mycaredesk_account_managers (e.g. mom, added after dad) could see a
-- shared dependent everywhere else, but still couldn't save that
-- dependent's health profile — a real gap in spec Test C ("both parents
-- manage the same child"). Fixed by routing through the shared helper.
--
-- Also drops the dead pre-p_for_account_id 12-param overload: the one
-- live call site (app/portal/health-profile/health-profile-form.tsx)
-- already always passes all 13 named params including p_for_account_id,
-- so this wasn't causing today's "function is not unique" ambiguity bug
-- in practice (an exact named-argument match wins over a defaulted one)
-- — but it's confusing dead weight that could bite the next call site
-- added, so it goes now per the same overload-hygiene pattern used
-- elsewhere in Phase 1.
--
-- Verified live (JWT-simulated, rolled-back transaction): dad saves the
-- child's health profile, mom (a second co-manager added ONLY via the
-- join table, never touching managed_by_account_id) successfully updates
-- the same profile, a stranger is rejected with 'not authorized', exactly
-- one mycaredesk_health_profiles row exists for the child throughout, and
-- exactly one overload of the function exists afterward. All passed.

drop function if exists public.upsert_my_health_profile(text[], text[], text[], text, text, text, text, text, text, text, text, text);

create or replace function public.upsert_my_health_profile(
  p_allergies text[] default '{}', p_medications text[] default '{}', p_conditions text[] default '{}',
  p_surgical_history text default null, p_family_history text default null, p_social_history text default null,
  p_hmo_name text default null, p_hmo_number text default null, p_philhealth_number text default null,
  p_emergency_contact_name text default null, p_emergency_contact_relationship text default null,
  p_emergency_contact_phone text default null, p_for_account_id uuid default null
)
returns mycaredesk_health_profiles
language plpgsql
security definer
set search_path to 'public'
as $function$
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
  elsif public.is_my_mycaredesk_account_or_managed(p_for_account_id) then
    v_account_id := p_for_account_id;
  else
    raise exception 'not authorized';
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
$function$;

grant execute on function public.upsert_my_health_profile(text[], text[], text[], text, text, text, text, text, text, text, text, text, uuid) to authenticated;
