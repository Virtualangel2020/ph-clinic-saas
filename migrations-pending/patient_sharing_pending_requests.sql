-- Records & Authorizations — patient-facing "Pending Request -> Review ->
-- Acknowledge/Authorize" workflow (spec point 44). Reuses the existing
-- patient_sharing_preferences table (does NOT touch its existing
-- semantics or the existing immediate-authorize path used by
-- set_sharing_preference / the "Send to AngelClinic Provider" flow) —
-- only ADDS a new 'pending' status so staff can optionally ask a patient
-- to review and confirm a sharing authorization themselves, from their
-- Patient Portal, instead of staff authorizing it unilaterally.
--
-- checkSharingAuthorizedAction and every other authorization check in the
-- app filter on status = 'active', so a 'pending' row is inert everywhere
-- until the patient (or staff) acts on it — nothing that currently reads
-- this table changes behavior.

do $$
declare v_conname text;
begin
  select conname into v_conname from pg_constraint
  where conrelid = 'patient_sharing_preferences'::regclass
    and contype = 'c'
    and pg_get_constraintdef(oid) ilike '%active%revoked%';
  if v_conname is not null then
    execute format('alter table patient_sharing_preferences drop constraint %I', v_conname);
  end if;
  alter table patient_sharing_preferences
    add constraint patient_sharing_preferences_status_check
    check (status in ('active', 'revoked', 'pending'));
end $$;

-- Staff asks a patient to review and authorize sharing with an
-- AngelClinic provider, rather than authorizing it immediately
-- themselves. Blocks a duplicate pending request for the same patient.
create or replace function public.request_patient_sharing_authorization(p_patient_id uuid, p_provider_user_id uuid)
returns uuid
language plpgsql
security definer
set search_path to 'public'
as $function$
declare v_tenant_id uuid := current_tenant_id(); v_id uuid;
begin
  if v_tenant_id is null then raise exception 'not authorized'; end if;
  if not exists (select 1 from public.patients where id = p_patient_id and tenant_id = v_tenant_id) then
    raise exception 'not authorized';
  end if;
  if not exists (select 1 from public.user_profiles where id = p_provider_user_id and role = 'doctor' and is_active = true) then
    raise exception 'That provider was not found.';
  end if;
  if exists (select 1 from public.patient_sharing_preferences where patient_id = p_patient_id and status = 'pending') then
    raise exception 'A request is already pending for this patient.';
  end if;

  insert into public.patient_sharing_preferences (tenant_id, patient_id, provider_user_id, status, authorized_by)
  values (v_tenant_id, p_patient_id, p_provider_user_id, 'pending', auth.uid())
  returning id into v_id;

  insert into public.audit_logs (tenant_id, actor_user_id, action, entity_type, entity_id, new_value)
  values (v_tenant_id, auth.uid(), 'patient_sharing_request_created', 'patient_sharing_preferences', v_id, jsonb_build_object('provider_user_id', p_provider_user_id));

  return v_id;
end;
$function$;

-- Patient (Portal) reviews a pending request and acknowledges/authorizes
-- or declines it. Portal-only — mirrors the auth_user_id + status='active'
-- check complete_patient_form() already uses for portal-originated writes.
create or replace function public.patient_respond_sharing_request(p_id uuid, p_approve boolean)
returns void
language plpgsql
security definer
set search_path to 'public'
as $function$
declare v_row public.patient_sharing_preferences;
begin
  select * into v_row from public.patient_sharing_preferences where id = p_id;
  if v_row.id is null or v_row.status != 'pending' then
    raise exception 'This request is no longer pending.';
  end if;
  if not exists (
    select 1 from public.patient_portal_accounts ppa
    where ppa.patient_id = v_row.patient_id and ppa.auth_user_id = auth.uid() and ppa.status = 'active'
  ) then
    raise exception 'not authorized';
  end if;

  if p_approve then
    update public.patient_sharing_preferences set status = 'revoked', revoked_at = now()
    where patient_id = v_row.patient_id and status = 'active';
    update public.patient_sharing_preferences set status = 'active', authorized_at = now()
    where id = p_id;
  else
    update public.patient_sharing_preferences set status = 'revoked', revoked_at = now()
    where id = p_id;
  end if;

  insert into public.audit_logs (tenant_id, actor_user_id, action, entity_type, entity_id, new_value)
  values (v_row.tenant_id, auth.uid(), case when p_approve then 'patient_sharing_request_authorized' else 'patient_sharing_request_declined' end, 'patient_sharing_preferences', p_id, jsonb_build_object('patient_id', v_row.patient_id));
end;
$function$;

-- Now also cancels a still-pending request, not just an active one — a
-- strict superset of its previous behavior (still exactly one active row
-- max), so every existing caller is unaffected.
create or replace function public.revoke_sharing_preference(p_patient_id uuid)
returns void
language plpgsql
security definer
set search_path to 'public'
as $function$
declare v_tenant_id uuid := current_tenant_id();
begin
  if v_tenant_id is null then raise exception 'not authorized'; end if;
  update public.patient_sharing_preferences set status = 'revoked', revoked_at = now(), revoked_by = auth.uid()
  where patient_id = p_patient_id and tenant_id = v_tenant_id and status in ('active', 'pending');
end;
$function$;
