-- Angel: "Allow us to edit personal information like full name, date of
-- birth, address, also add work, company, those sort of things. Personal
-- information. Health information is different as well."
--
-- Today mycaredesk_accounts (the patient-owned platform identity, separate
-- from any one clinic's `patients` row) can only be SET ONCE, at signup
-- (self_register_mycaredesk_account) — there was never a way to correct a
-- typo'd name, update an address, or add anything afterward. This adds the
-- missing columns (address, civil status, occupation, employer/company —
-- none of which existed anywhere on this table before) and a scoped
-- self-service update RPC, following the exact same pattern already used
-- for relationship (update_my_mycaredesk_relationship) and photo
-- (uploadMyPhotoAction): authorized via is_my_mycaredesk_account_or_managed,
-- so a manager can fix their own info or any dependent they actively
-- co-manage, and never anyone else's.
--
-- Deliberately NOT touching the clinic-side `patients` table or its
-- "On File At Your Clinic" read-only display on /portal/profile — that's
-- the clinic's own EHR record (used for prescriptions, official charting,
-- insurance/HMO paperwork), it can differ patient-to-patient across
-- multiple connected clinics, and it stays "contact your clinic to update"
-- for the same reason it always has. This personal-info section is the
-- platform account only — the same "your account, not your chart" line
-- Health Profile already draws.

alter table public.mycaredesk_accounts
  add column if not exists address_line1 text,
  add column if not exists address_line2 text,
  add column if not exists postal_code text,
  add column if not exists civil_status text,
  add column if not exists occupation text,
  add column if not exists employer_name text,
  add column if not exists employer_position text,
  add column if not exists employer_contact text,
  add column if not exists employer_address text;

create or replace function public.update_my_mycaredesk_personal_info(
  p_account_id uuid,
  p_first_name text,
  p_last_name text,
  p_date_of_birth date,
  p_sex text,
  p_mobile_phone text default null,
  p_email text default null,
  p_address_line1 text default null,
  p_address_line2 text default null,
  p_city text default null,
  p_province text default null,
  p_postal_code text default null,
  p_civil_status text default null,
  p_occupation text default null,
  p_employer_name text default null,
  p_employer_position text default null,
  p_employer_contact text default null,
  p_employer_address text default null
)
returns mycaredesk_accounts
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_row public.mycaredesk_accounts;
begin
  if auth.uid() is null then
    raise exception 'not authorized';
  end if;
  if not public.is_my_mycaredesk_account_or_managed(p_account_id) then
    raise exception 'not authorized';
  end if;
  if p_first_name is null or trim(p_first_name) = '' then
    raise exception 'First name is required';
  end if;
  if p_last_name is null or trim(p_last_name) = '' then
    raise exception 'Last name is required';
  end if;
  if p_date_of_birth is null then
    raise exception 'Date of birth is required';
  end if;
  if p_sex is null or trim(p_sex) = '' then
    raise exception 'Sex is required';
  end if;

  update public.mycaredesk_accounts set
    first_name = trim(p_first_name),
    last_name = trim(p_last_name),
    date_of_birth = p_date_of_birth,
    sex = p_sex,
    mobile_phone = nullif(trim(p_mobile_phone), ''),
    email = nullif(trim(p_email), ''),
    address_line1 = nullif(trim(p_address_line1), ''),
    address_line2 = nullif(trim(p_address_line2), ''),
    city = nullif(trim(p_city), ''),
    province = nullif(trim(p_province), ''),
    postal_code = nullif(trim(p_postal_code), ''),
    civil_status = nullif(trim(p_civil_status), ''),
    occupation = nullif(trim(p_occupation), ''),
    employer_name = nullif(trim(p_employer_name), ''),
    employer_position = nullif(trim(p_employer_position), ''),
    employer_contact = nullif(trim(p_employer_contact), ''),
    employer_address = nullif(trim(p_employer_address), ''),
    updated_at = now()
  where id = p_account_id
  returning * into v_row;

  if v_row.id is null then
    raise exception 'not authorized';
  end if;
  return v_row;
end;
$function$;

grant execute on function public.update_my_mycaredesk_personal_info(
  uuid, text, text, date, text, text, text, text, text, text, text, text, text, text, text, text, text, text
) to authenticated;

-- get_my_mycaredesk_family() returns an explicit TABLE(...) shape, so
-- widening it means drop-then-recreate (same lesson already documented in
-- mycaredesk_family_dependent_accounts.sql) — adds the same personal-info
-- columns so a manager's "My Family" / dependent cards can show and edit a
-- dependent's info exactly like they can already view their relationship
-- and photo. get_my_mycaredesk_account() needs no change — it already
-- returns `select *` from the table, so the new columns flow through it
-- automatically for the signed-in owner's own record.
drop function if exists public.get_my_mycaredesk_family();

create function public.get_my_mycaredesk_family()
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
  created_at timestamptz,
  mobile_phone text,
  email text,
  address_line1 text,
  address_line2 text,
  city text,
  province text,
  postal_code text,
  civil_status text,
  occupation text,
  employer_name text,
  employer_position text,
  employer_contact text,
  employer_address text
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
    m.created_at,
    a.mobile_phone,
    a.email,
    a.address_line1,
    a.address_line2,
    a.city,
    a.province,
    a.postal_code,
    a.civil_status,
    a.occupation,
    a.employer_name,
    a.employer_position,
    a.employer_contact,
    a.employer_address
  from public.mycaredesk_account_managers m
  join public.mycaredesk_accounts a on a.id = m.account_id
  where m.status = 'active'
    and m.manager_account_id in (select id from public.mycaredesk_accounts where auth_user_id = auth.uid())
  order by m.created_at asc;
$function$;

grant execute on function public.get_my_mycaredesk_family() to authenticated;
