-- Same category of gap as upsert_my_health_profile: this RPC's own inline
-- authorization check used managed_by_account_id directly instead of
-- is_my_mycaredesk_account_or_managed. A dependent's access-request
-- approval/denial (the step that actually creates the clinic's patients +
-- patient_portal_accounts rows) could therefore only ever be actioned by
-- whichever manager originally created the dependent — a second co-manager
-- added later via mycaredesk_account_managers would hit 'not authorized'
-- trying to approve a new clinic connection for a child they jointly
-- manage. Fixed by routing through the shared helper.
--
-- Verified live (JWT-simulated, rolled-back transaction): a dependent
-- managed by both a dad (original creator) and a mom (added later, only
-- via the join table) gets a pending access request; mom approves it
-- successfully and the request's status flips to 'approved'.

create or replace function public.patient_respond_to_mycaredesk_access_request(p_request_id uuid, p_approve boolean)
returns void
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_request record;
  v_patient_id uuid;
  v_authorized boolean;
  v_login_auth_user_id uuid;
begin
  select r.*, a.auth_user_id, a.managed_by_account_id, a.first_name, a.last_name, a.date_of_birth, a.sex, a.mobile_phone, a.email
    into v_request
  from public.mycaredesk_account_access_requests r
  join public.mycaredesk_accounts a on a.id = r.mycaredesk_account_id
  where r.id = p_request_id and r.status = 'pending';

  if v_request.id is null then
    raise exception 'This request was already resolved or does not exist.';
  end if;

  v_authorized := (
    v_request.auth_user_id = auth.uid()
    or public.is_my_mycaredesk_account_or_managed(v_request.mycaredesk_account_id)
  );
  if not coalesce(v_authorized, false) then
    raise exception 'not authorized';
  end if;

  -- The clinic-side portal login for this new patient record: the
  -- account's own login if it has one, otherwise whoever (the manager)
  -- is approving on the dependent's behalf.
  v_login_auth_user_id := coalesce(v_request.auth_user_id, auth.uid());

  if not p_approve then
    update public.mycaredesk_account_access_requests set status = 'denied', responded_at = now() where id = p_request_id;
    return;
  end if;

  insert into public.patients (
    tenant_id, first_name, last_name, date_of_birth, sex, mobile_phone, email, mycaredesk_account_id, is_active, payment_type, bill_types
  ) values (
    v_request.tenant_id, v_request.first_name, v_request.last_name, v_request.date_of_birth, v_request.sex,
    v_request.mobile_phone, v_request.email, v_request.mycaredesk_account_id, true, 'cash', '{}'
  )
  returning id into v_patient_id;

  insert into public.patient_portal_accounts (
    tenant_id, patient_id, channel, contact_value, status, auth_user_id, activated_at
  ) values (
    v_request.tenant_id, v_patient_id, case when v_request.email is not null then 'email' else 'sms' end,
    coalesce(v_request.email, v_request.mobile_phone), 'active', v_login_auth_user_id, now()
  );

  update public.mycaredesk_account_access_requests set status = 'approved', responded_at = now() where id = p_request_id;
end;
$function$;

grant execute on function public.patient_respond_to_mycaredesk_access_request(uuid, boolean) to authenticated;
