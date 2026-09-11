-- Companion to dob_year_range_validation.sql: that migration added a table-
-- level CHECK constraint on patients.date_of_birth / mycaredesk_accounts.
-- date_of_birth as the bulletproof backstop, but a raw constraint
-- violation surfaces to the patient/staff as a generic Postgres error
-- ("violates check constraint..."). This migration adds the SAME bound as
-- an explicit, friendly raise inside every RPC that actually writes a
-- date_of_birth, so the real, useful message shows up in the UI instead.
-- Every function body below is otherwise byte-for-byte unchanged from
-- production — only the new validation block is added, right after each
-- function's existing auth check.
create or replace function public.self_register_mycaredesk_account(p_first_name text, p_last_name text, p_date_of_birth date, p_sex text, p_mobile_phone text, p_email text, p_city text DEFAULT NULL::text, p_province text DEFAULT NULL::text)
 RETURNS mycaredesk_accounts
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_account public.mycaredesk_accounts;
begin
  if auth.uid() is null then
    raise exception 'not authorized';
  end if;

  if p_date_of_birth is null or p_date_of_birth < date '1900-01-01' or p_date_of_birth > current_date then
    raise exception 'Please enter a valid date of birth (year 1900 or later, not in the future).';
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
$function$;

create or replace function public.update_my_mycaredesk_personal_info(p_account_id uuid, p_first_name text, p_last_name text, p_date_of_birth date, p_sex text, p_mobile_phone text DEFAULT NULL::text, p_email text DEFAULT NULL::text, p_address_line1 text DEFAULT NULL::text, p_address_line2 text DEFAULT NULL::text, p_city text DEFAULT NULL::text, p_province text DEFAULT NULL::text, p_postal_code text DEFAULT NULL::text, p_civil_status text DEFAULT NULL::text, p_occupation text DEFAULT NULL::text, p_employer_name text DEFAULT NULL::text, p_employer_position text DEFAULT NULL::text, p_employer_contact text DEFAULT NULL::text, p_employer_address text DEFAULT NULL::text)
 RETURNS mycaredesk_accounts
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
  if p_date_of_birth < date '1900-01-01' or p_date_of_birth > current_date then
    raise exception 'Please enter a valid date of birth (year 1900 or later, not in the future).';
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

-- Two overloads exist in production (6-arg legacy + 8-arg with
-- relationship) — both get the same check. Postgres resolves by argument
-- list, so both CREATE OR REPLACE statements are needed; neither touches
-- the other's signature.
create or replace function public.create_dependent_mycaredesk_account(p_first_name text, p_last_name text, p_date_of_birth date, p_sex text, p_mobile_phone text DEFAULT NULL::text, p_email text DEFAULT NULL::text)
 RETURNS mycaredesk_accounts
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_manager_id uuid;
  v_account public.mycaredesk_accounts;
begin
  if auth.uid() is null then
    raise exception 'not authorized';
  end if;

  if p_date_of_birth is null or p_date_of_birth < date '1900-01-01' or p_date_of_birth > current_date then
    raise exception 'Please enter a valid date of birth (year 1900 or later, not in the future).';
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

create or replace function public.create_dependent_mycaredesk_account(p_first_name text, p_last_name text, p_date_of_birth date, p_sex text, p_mobile_phone text DEFAULT NULL::text, p_email text DEFAULT NULL::text, p_relationship text DEFAULT 'child'::text, p_relationship_other_description text DEFAULT NULL::text)
 RETURNS mycaredesk_accounts
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_manager_id uuid;
  v_account public.mycaredesk_accounts;
begin
  if auth.uid() is null then
    raise exception 'not authorized';
  end if;

  if p_date_of_birth is null or p_date_of_birth < date '1900-01-01' or p_date_of_birth > current_date then
    raise exception 'Please enter a valid date of birth (year 1900 or later, not in the future).';
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

create or replace function public.set_patient(p_id uuid, p_first_name text, p_middle_name text, p_last_name text, p_suffix text, p_date_of_birth date, p_sex text, p_civil_status text, p_blood_type text, p_mobile_phone text, p_email text, p_address_line1 text, p_address_line2 text, p_city text, p_province text, p_postal_code text, p_emergency_contact_name text, p_emergency_contact_relationship text, p_emergency_contact_phone text, p_guardian_name text, p_guardian_relationship text, p_guardian_phone text, p_notes text, p_occupation text, p_employer_name text, p_employer_position text, p_employer_contact text, p_employer_address text, p_employment_status text DEFAULT NULL::text, p_referred_by_note text DEFAULT NULL::text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare v_tenant_id uuid; v_id uuid;
begin
  v_tenant_id := current_tenant_id();
  if v_tenant_id is null then raise exception 'Not a clinic member.'; end if;

  if p_date_of_birth is null or p_date_of_birth < date '1900-01-01' or p_date_of_birth > current_date then
    raise exception 'Please enter a valid date of birth (year 1900 or later, not in the future).';
  end if;

  if p_id is not null then
    update patients set
      first_name = p_first_name, middle_name = p_middle_name, last_name = p_last_name, suffix = p_suffix,
      date_of_birth = p_date_of_birth, sex = p_sex, civil_status = p_civil_status, blood_type = p_blood_type,
      mobile_phone = p_mobile_phone, email = p_email, address_line1 = p_address_line1, address_line2 = p_address_line2,
      city = p_city, province = p_province, postal_code = p_postal_code,
      emergency_contact_name = p_emergency_contact_name, emergency_contact_relationship = p_emergency_contact_relationship,
      emergency_contact_phone = p_emergency_contact_phone, guardian_name = p_guardian_name,
      guardian_relationship = p_guardian_relationship, guardian_phone = p_guardian_phone, notes = p_notes,
      occupation = p_occupation, employer_name = p_employer_name, employer_position = p_employer_position,
      employer_contact = p_employer_contact, employer_address = p_employer_address,
      employment_status = p_employment_status, referred_by_note = p_referred_by_note, updated_at = now()
    where id = p_id and tenant_id = v_tenant_id
    returning id into v_id;
    if v_id is null then raise exception 'Patient not found.'; end if;
    return v_id;
  else
    insert into patients (
      tenant_id, first_name, middle_name, last_name, suffix, date_of_birth, sex, civil_status, blood_type,
      mobile_phone, email, address_line1, address_line2, city, province, postal_code,
      emergency_contact_name, emergency_contact_relationship, emergency_contact_phone,
      guardian_name, guardian_relationship, guardian_phone, notes,
      occupation, employer_name, employer_position, employer_contact, employer_address,
      employment_status, referred_by_note, created_by
    ) values (
      v_tenant_id, p_first_name, p_middle_name, p_last_name, p_suffix, p_date_of_birth, p_sex, p_civil_status, p_blood_type,
      p_mobile_phone, p_email, p_address_line1, p_address_line2, p_city, p_province, p_postal_code,
      p_emergency_contact_name, p_emergency_contact_relationship, p_emergency_contact_phone,
      p_guardian_name, p_guardian_relationship, p_guardian_phone, p_notes,
      p_occupation, p_employer_name, p_employer_position, p_employer_contact, p_employer_address,
      p_employment_status, p_referred_by_note, auth.uid()
    ) returning id into v_id;
    return v_id;
  end if;
end;
$function$;
