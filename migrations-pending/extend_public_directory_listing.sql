-- Extend the public directory listing RPC with the raw clinic-default +
-- provider-override fields Find a Doctor's new Booking/Payment/Coverage
-- filters need (spec §28). Return shape changed (added columns), so the
-- old function must be dropped before CREATE OR REPLACE can redefine it
-- (Postgres won't let a function's return TABLE shape change in place).
-- Resolved client-side via resolveEffectiveSettings() in
-- lib/patient-access.ts — the exact same merge logic
-- public_get_provider_profile's consumer uses, so the directory's badges
-- can never disagree with what the profile page itself shows.
drop function if exists public.public_list_directory_providers();

create or replace function public.public_list_directory_providers()
returns table(
  id uuid, tenant_id uuid, full_name text, title text, specialty text, subspecialty text, public_bio text,
  public_languages text[], public_consultation_type text, public_consultation_fee_php numeric, public_booking_mode text,
  clinic_name text, city text,
  default_booking_type text, booking_type_override text,
  clinic_accept_hmo boolean, accept_hmo_override boolean,
  clinic_accept_yakap boolean, accept_yakap_override boolean,
  accept_online_payments boolean,
  clinic_messaging_enabled boolean, messaging_enabled_override boolean
)
language sql
stable
security definer
set search_path to 'public'
as $function$
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
    cs.clinic_name,
    cs.city,
    cs.default_booking_type, pas.booking_type,
    cs.accept_hmo, pas.accept_hmo,
    cs.accept_yakap, pas.accept_yakap,
    cs.accept_online_payments,
    cs.default_messaging_enabled, pas.messaging_enabled
  from user_profiles up
  join tenants t on t.id = up.tenant_id
  left join clinic_settings cs on cs.tenant_id = up.tenant_id
  left join provider_patient_access_settings pas on pas.provider_id = up.id
  where up.public_directory_enabled = true
    and up.role in ('doctor', 'clinic_admin')
  order by up.full_name;
$function$;
