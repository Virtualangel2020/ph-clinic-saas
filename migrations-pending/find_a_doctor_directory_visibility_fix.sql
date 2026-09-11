-- Find a Doctor — patient-directory visibility fix (Angel's spec item 5:
-- "Only show active/patient-visible providers... exclude inactive, deleted,
-- internal-only staff, providers without valid patient-facing profiles,
-- test/system accounts (unless intentionally configured)").
--
-- Root cause found by direct inspection of production data: as of this
-- migration, the ONLY tenant with any public_directory_enabled=true
-- providers is the seeded "MyCareDesk Demo" tenant (is_test = true,
-- originally named "AngelClinic Demo" per earlier migration comments) —
-- so a real signed-in patient hitting Find a Doctor sees only 3 fake demo
-- doctors, never a real clinic's own providers. Separately,
-- public_list_directory_providers() never checked is_active at all (its
-- sibling public_get_provider_profile already does), so a deactivated
-- staff member who once had public_directory_enabled=true stays listed
-- forever. Both are fixed here, in the read path only — no data changes.
create or replace function public.public_list_directory_providers()
returns table(
  id uuid, tenant_id uuid, full_name text, title text, specialty text, subspecialty text,
  public_bio text, public_languages text[], public_consultation_type text, public_consultation_fee_php numeric,
  public_booking_mode text, public_photo_path text, clinic_name text, city text,
  default_booking_type text, booking_type_override text,
  clinic_accept_hmo boolean, accept_hmo_override boolean,
  clinic_accept_yakap boolean, accept_yakap_override boolean,
  accept_online_payments boolean,
  clinic_messaging_enabled boolean, messaging_enabled_override boolean
)
language sql
stable security definer
set search_path to 'public'
as $$
  select
    up.id,
    up.tenant_id,
    up.full_name,
    up.title,
    up.specialty,
    up.subspecialty,
    up.public_bio,
    up.public_languages,
    up.public_consultation_type,
    up.public_consultation_fee_php,
    up.public_booking_mode,
    up.public_photo_path,
    cs.clinic_name,
    cs.city,
    cs.default_booking_type, pas.booking_type,
    cs.accept_hmo, pas.accept_hmo,
    cs.accept_yakap, pas.accept_yakap,
    cs.accept_online_payments,
    cs.default_messaging_enabled, pas.messaging_enabled
  from public.user_profiles up
  join public.tenants t on t.id = up.tenant_id
  left join public.clinic_settings cs on cs.tenant_id = up.tenant_id
  left join public.provider_patient_access_settings pas on pas.provider_id = up.id
  where up.public_directory_enabled = true
    and up.role in ('doctor', 'clinic_admin')
    and up.is_active = true
    and up.full_name is not null and btrim(up.full_name) <> ''
    and coalesce(t.is_test, false) = false
  order by up.full_name;
$$;

comment on function public.public_list_directory_providers() is
  'Patient-facing Find a Doctor directory. Requires is_active + public_directory_enabled + a real full_name, and excludes is_test tenants (demo/seed data) — mirrors public_get_provider_profile''s own is_active gate so a provider can never appear in the list but 404 on click, or vice versa.';
