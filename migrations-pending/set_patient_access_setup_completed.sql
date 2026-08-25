-- Marks the Patient Access & Payments setup wizard as walked-through
-- (spec §1-2, §55). Never gates functionality on this — every setting
-- already has a safe default and clinic use is never blocked — it only
-- drives the "Setup isn't marked complete yet" banner on the hub page.
create or replace function public.set_patient_access_setup_completed(p_completed boolean)
returns void
language plpgsql
security definer
set search_path to 'public'
as $function$
declare v_tenant_id uuid := current_tenant_id();
begin
  if not is_clinic_admin() then raise exception 'not authorized'; end if;
  update public.clinic_settings set patient_access_setup_completed = p_completed where tenant_id = v_tenant_id;
end;
$function$;
