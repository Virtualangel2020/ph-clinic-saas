-- Patient Portal Redesign, Phase 3 — Section U fix ("the dashboard must
-- fully change context when switching profiles... never mix data between
-- profiles").
--
-- THE BUG: two RPCs the Patient Dashboard depends on were never updated
-- when Family Profiles Phase 1 introduced the "currently selected profile"
-- (mycaredesk_account_managers / p_for_account_id) system — they still
-- resolved "which patient" from a bare `patient_portal_accounts where
-- auth_user_id = auth.uid()` lookup, same shape as the cross-tenant booking
-- bug fixed earlier in mycaredesk_family_identity_resolution_rpcs.sql, just
-- in two spots that migration didn't touch:
--
--   1. patient_list_my_follow_ups() — a manager viewing a co-managed
--      dependent's profile (e.g. Sofia) still saw follow-ups tied to their
--      OWN patient record, not Sofia's, because the query joins
--      patient_portal_accounts on auth_user_id with no account parameter
--      at all.
--   2. patient_schedule_follow_up(follow_up_id, appointment_id) — same bug
--      on the write side: booking a follow-up visit while a dependent's
--      profile is active would try to stamp the follow-up using the
--      MANAGER's own patient_id, which almost never matches the follow-up's
--      actual patient_id, so real dependent follow-up scheduling from the
--      dashboard was silently broken (raises "follow-up not found, not
--      yours, or already resolved" even though it IS the dependent's own
--      follow-up).
--
-- THE FIX: both gain an explicit p_for_account_id uuid default null
-- parameter, following the exact same pattern already established in
-- mycaredesk_family_identity_resolution_rpcs.sql — validate via
-- is_my_mycaredesk_account_or_managed, resolve patient rows through
-- patients.mycaredesk_account_id when the caller/dependent has a platform
-- identity, and fall back to the legacy auth_user_id join for a
-- pre-Phase-1 patient with no mycaredesk_accounts row (zero behavior
-- change for that case). patient_schedule_follow_up specifically reuses
-- the shared _resolve_portal_patient_id(tenant, for_account) resolver,
-- deriving the tenant from the follow-up row itself so it doesn't need a
-- new parameter for that.
--
-- Per the Postgres gotcha already documented in
-- mycaredesk_family_identity_resolution_rpcs.sql: CREATE OR REPLACE
-- FUNCTION does not replace a function when its parameter list changes —
-- Postgres keys on (name, argument types) — so both old signatures are
-- explicitly dropped first to avoid leaving a second, ambiguous overload
-- live.

drop function if exists public.patient_list_my_follow_ups();
create or replace function public.patient_list_my_follow_ups(p_for_account_id uuid default null)
returns setof public.patient_follow_ups
language plpgsql
stable
security definer
set search_path to 'public'
as $function$
declare
  v_account_id uuid;
begin
  if p_for_account_id is not null then
    if not public.is_my_mycaredesk_account_or_managed(p_for_account_id) then
      raise exception 'not authorized';
    end if;
    v_account_id := p_for_account_id;
  else
    select id into v_account_id from public.mycaredesk_accounts where auth_user_id = auth.uid();
  end if;

  return query
  select f.*
  from public.patient_follow_ups f
  where f.status in ('pending', 'scheduled')
    and (
      (v_account_id is not null and exists (
        select 1 from public.patients p where p.id = f.patient_id and p.mycaredesk_account_id = v_account_id
      ))
      or (
        v_account_id is null and exists (
          select 1 from public.patient_portal_accounts ppa
          where ppa.patient_id = f.patient_id and ppa.auth_user_id = auth.uid() and ppa.status = 'active'
        )
      )
    )
  order by f.due_date asc;
end;
$function$;

grant execute on function public.patient_list_my_follow_ups(uuid) to authenticated;

drop function if exists public.patient_schedule_follow_up(uuid, uuid);
create or replace function public.patient_schedule_follow_up(p_follow_up_id uuid, p_appointment_id uuid, p_for_account_id uuid default null)
returns void
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_follow_up_patient_id uuid;
  v_follow_up_tenant_id uuid;
  v_resolved_patient_id uuid;
begin
  select patient_id, tenant_id into v_follow_up_patient_id, v_follow_up_tenant_id
  from public.patient_follow_ups where id = p_follow_up_id and status = 'pending';
  if v_follow_up_patient_id is null then
    raise exception 'follow-up not found, not yours, or already resolved';
  end if;

  -- Resolve "which patient is the caller (or the explicitly named profile)
  -- for THIS follow-up's own tenant" using the same shared resolver every
  -- other write-path RPC uses, then require it to match the follow-up's
  -- actual patient — this is what lets a manager schedule a co-managed
  -- dependent's follow-up while that dependent's profile is active, and
  -- still rejects anyone the follow-up doesn't actually belong to.
  v_resolved_patient_id := public._resolve_portal_patient_id(v_follow_up_tenant_id, p_for_account_id);
  if v_resolved_patient_id is null or v_resolved_patient_id <> v_follow_up_patient_id then
    raise exception 'not authorized';
  end if;

  if not exists (select 1 from public.appointments where id = p_appointment_id and patient_id = v_follow_up_patient_id) then
    raise exception 'not authorized';
  end if;

  update public.patient_follow_ups
  set status = 'scheduled', scheduled_appointment_id = p_appointment_id, updated_at = now()
  where id = p_follow_up_id and patient_id = v_follow_up_patient_id and status = 'pending';
  if not found then raise exception 'follow-up not found, not yours, or already resolved'; end if;
end;
$function$;

grant execute on function public.patient_schedule_follow_up(uuid, uuid, uuid) to authenticated;
