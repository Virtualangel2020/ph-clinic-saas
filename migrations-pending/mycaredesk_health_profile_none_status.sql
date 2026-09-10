-- Health Profile "None vs. not-answered vs. has-entries" (spec Phase 3):
-- Angel wants an explicit "None" option so "patient said none" is
-- distinguishable from "patient hasn't gotten to this yet." One status
-- column per list-type section, defaulted 'unknown' and backfilled
-- 'has_entries' where existing data is already non-empty (an old blank
-- can't be retroactively known to mean "none" vs. "never asked").
alter table public.mycaredesk_health_profiles
  add column allergies_status text not null default 'unknown' check (allergies_status in ('unknown','none','has_entries')),
  add column medications_status text not null default 'unknown' check (medications_status in ('unknown','none','has_entries')),
  add column conditions_status text not null default 'unknown' check (conditions_status in ('unknown','none','has_entries')),
  add column surgical_history_status text not null default 'unknown' check (surgical_history_status in ('unknown','none','has_entries')),
  add column family_history_status text not null default 'unknown' check (family_history_status in ('unknown','none','has_entries'));

update public.mycaredesk_health_profiles set allergies_status = 'has_entries' where coalesce(array_length(allergies,1),0) > 0;
update public.mycaredesk_health_profiles set medications_status = 'has_entries' where coalesce(array_length(medications,1),0) > 0;
update public.mycaredesk_health_profiles set conditions_status = 'has_entries' where coalesce(array_length(conditions,1),0) > 0;
update public.mycaredesk_health_profiles set surgical_history_status = 'has_entries' where surgical_history is not null and trim(surgical_history) <> '';
update public.mycaredesk_health_profiles set family_history_status = 'has_entries' where family_history is not null and trim(family_history) <> '';

-- Mutual exclusivity is enforced HERE, not just trusted from the client:
-- choosing "none" for a section always clears its data, and any non-empty
-- data always forces that section's status to 'has_entries' regardless of
-- what status flag was sent — so a stale client can never desync data
-- from its own status label.
create or replace function public.upsert_my_health_profile(
  p_allergies text[] default '{}'::text[],
  p_medications text[] default '{}'::text[],
  p_conditions text[] default '{}'::text[],
  p_surgical_history text default null::text,
  p_family_history text default null::text,
  p_social_history text default null::text,
  p_hmo_name text default null::text,
  p_hmo_number text default null::text,
  p_philhealth_number text default null::text,
  p_emergency_contact_name text default null::text,
  p_emergency_contact_relationship text default null::text,
  p_emergency_contact_phone text default null::text,
  p_for_account_id uuid default null::uuid,
  p_allergies_status text default 'unknown',
  p_medications_status text default 'unknown',
  p_conditions_status text default 'unknown',
  p_surgical_history_status text default 'unknown',
  p_family_history_status text default 'unknown'
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
  v_allergies text[];
  v_medications text[];
  v_conditions text[];
  v_surgical_history text;
  v_family_history text;
  v_allergies_status text;
  v_medications_status text;
  v_conditions_status text;
  v_surgical_history_status text;
  v_family_history_status text;
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

  if p_allergies_status not in ('unknown','none','has_entries') then raise exception 'invalid allergies status'; end if;
  if p_medications_status not in ('unknown','none','has_entries') then raise exception 'invalid medications status'; end if;
  if p_conditions_status not in ('unknown','none','has_entries') then raise exception 'invalid conditions status'; end if;
  if p_surgical_history_status not in ('unknown','none','has_entries') then raise exception 'invalid surgical history status'; end if;
  if p_family_history_status not in ('unknown','none','has_entries') then raise exception 'invalid family history status'; end if;

  v_allergies := coalesce(p_allergies, '{}');
  if array_length(v_allergies,1) > 0 then v_allergies_status := 'has_entries';
  elsif p_allergies_status = 'none' then v_allergies_status := 'none'; v_allergies := '{}';
  else v_allergies_status := p_allergies_status; end if;

  v_medications := coalesce(p_medications, '{}');
  if array_length(v_medications,1) > 0 then v_medications_status := 'has_entries';
  elsif p_medications_status = 'none' then v_medications_status := 'none'; v_medications := '{}';
  else v_medications_status := p_medications_status; end if;

  v_conditions := coalesce(p_conditions, '{}');
  if array_length(v_conditions,1) > 0 then v_conditions_status := 'has_entries';
  elsif p_conditions_status = 'none' then v_conditions_status := 'none'; v_conditions := '{}';
  else v_conditions_status := p_conditions_status; end if;

  v_surgical_history := nullif(trim(p_surgical_history), '');
  if v_surgical_history is not null then v_surgical_history_status := 'has_entries';
  elsif p_surgical_history_status = 'none' then v_surgical_history_status := 'none';
  else v_surgical_history_status := p_surgical_history_status; end if;

  v_family_history := nullif(trim(p_family_history), '');
  if v_family_history is not null then v_family_history_status := 'has_entries';
  elsif p_family_history_status = 'none' then v_family_history_status := 'none';
  else v_family_history_status := p_family_history_status; end if;

  insert into public.mycaredesk_health_profiles (
    mycaredesk_account_id, allergies, medications, conditions, surgical_history, family_history,
    social_history, hmo_name, hmo_number, philhealth_number,
    emergency_contact_name, emergency_contact_relationship, emergency_contact_phone, updated_at,
    allergies_status, medications_status, conditions_status, surgical_history_status, family_history_status
  ) values (
    v_account_id, v_allergies, v_medications, v_conditions,
    v_surgical_history, v_family_history, nullif(trim(p_social_history), ''),
    nullif(trim(p_hmo_name), ''), nullif(trim(p_hmo_number), ''), nullif(trim(p_philhealth_number), ''),
    nullif(trim(p_emergency_contact_name), ''), nullif(trim(p_emergency_contact_relationship), ''), nullif(trim(p_emergency_contact_phone), ''),
    now(),
    v_allergies_status, v_medications_status, v_conditions_status, v_surgical_history_status, v_family_history_status
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
    updated_at = now(),
    allergies_status = excluded.allergies_status,
    medications_status = excluded.medications_status,
    conditions_status = excluded.conditions_status,
    surgical_history_status = excluded.surgical_history_status,
    family_history_status = excluded.family_history_status
  returning * into v_row;

  return v_row;
end;
$function$;
