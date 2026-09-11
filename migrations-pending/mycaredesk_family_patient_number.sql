-- "Dependents must have their own patient ID number too."
--
-- THE ACTUAL STATE (confirmed by direct inspection of production data):
-- every mycaredesk_accounts row — self AND every dependent — already gets
-- its own unique, permanent patient_number at creation time (e.g. Angelie
-- is MCD-000001, her dependent Ziarra is MCD-000002). The data model
-- already does the right thing; this was never a schema gap.
--
-- THE ACTUAL BUG: get_my_mycaredesk_family() — the RPC that powers the
-- profile chooser, the "Viewing" banner, and the My Family screen — never
-- selected patient_number at all, so a dependent's own number existed in
-- the database but was invisible everywhere in the patient-facing UI.
-- get_my_mycaredesk_account() (the caller's own identity) already returns
-- it via `select *`, which is why only YOUR OWN patient number ever showed
-- up anywhere (e.g. on /portal/profile).
--
-- Same Postgres gotcha as every other RETURNS TABLE change in this
-- project: CREATE OR REPLACE FUNCTION does not accept a changed return
-- type, so the old signature is dropped first.
drop function if exists public.get_my_mycaredesk_family();

create or replace function public.get_my_mycaredesk_family()
returns table(
  id uuid, first_name text, last_name text, date_of_birth date, sex text, photo_path text,
  patient_number text,
  relationship text, relationship_other_description text, is_primary boolean, co_manager_count integer,
  has_own_login boolean, status text, created_at timestamptz,
  mobile_phone text, email text, address_line1 text, address_line2 text, city text, province text, postal_code text,
  civil_status text, occupation text, employer_name text, employer_position text, employer_contact text, employer_address text
)
language sql
stable security definer
set search_path to 'public'
as $function$
  select
    a.id,
    a.first_name,
    a.last_name,
    a.date_of_birth,
    a.sex,
    a.photo_path,
    a.patient_number,
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
