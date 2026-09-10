-- Patient self-service "didn't get the code" resend for the Patient
-- Portal activation flow (Angel: "patient should have the option to also
-- choose to receive a new email for the code if they didn't get the
-- code"). Previously the ONLY way to get a fresh activation link/OTP was
-- to ask clinic staff to click Resend from the dashboard — this adds a
-- patient-facing path from /portal/activate (by contact/email) and
-- /portal/verify (by account id, already present in that page's URL).
--
-- SECURITY DEFINER but deliberately NOT callable by anon/authenticated:
-- it looks up an invite by a caller-supplied, easily-guessable value (an
-- email address, or an account id already visible in a URL) and returns
-- the fresh raw activation secret in the result. If this were reachable
-- directly from the browser, anyone who knew or guessed a patient's email
-- could call it and get a live activation token back in the response,
-- fully hijacking that invite without ever touching the patient's inbox.
-- Only service_role may execute it; the Next.js server action
-- (app/portal/actions.ts, requestPortalInviteResendAction) calls it via
-- the admin client, sends the email/SMS itself using the existing
-- lib/patient-portal/send.ts helpers.
--
-- v2 (folded in): the first version matched by the ORIGINAL invite
-- channel (email/sms only), which silently excluded "manual" (in-person
-- code) invites even when that patient has a perfectly good email or
-- mobile on file — exactly what happened testing with
-- nicole.islani18@gmail.com (a manual-channel invite whose contact_value
-- IS a real email, but the old `channel in ('email','sms')` filter
-- skipped it, so the resend silently did nothing while the UI still said
-- "we've sent a new code"). Delivery type is now decided by what the
-- contact value actually looks like (has an "@" → email, otherwise →
-- SMS), not by whatever channel the original invite happened to use — a
-- patient asking for a fresh code here clearly wants it delivered
-- electronically this time, regardless of how the first one went out.
create or replace function public.resend_patient_portal_invite(p_contact text default null, p_account_id uuid default null)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_row record;
  v_raw_token text;
  v_otp text;
  v_is_email boolean;
  v_results jsonb := '[]'::jsonb;
begin
  if (p_contact is null or trim(p_contact) = '') and p_account_id is null then
    return v_results;
  end if;

  for v_row in
    select ppa.id, ppa.contact_value,
      coalesce(p.first_name || ' ' || p.last_name, 'there') as patient_name,
      coalesce(cs.clinic_name, 'Your Clinic') as clinic_name
    from public.patient_portal_accounts ppa
    join public.patients p on p.id = ppa.patient_id
    left join public.clinic_settings cs on cs.tenant_id = ppa.tenant_id
    where ppa.status = 'invited'
      and (
        (p_account_id is not null and ppa.id = p_account_id)
        or (p_contact is not null and trim(p_contact) <> '' and lower(trim(ppa.contact_value)) = lower(trim(p_contact)))
      )
  loop
    v_is_email := v_row.contact_value like '%@%';

    if v_is_email then
      v_raw_token := encode(gen_random_bytes(24), 'hex');
      v_otp := null;
      update public.patient_portal_accounts
        set invite_token_hash = encode(digest(v_raw_token, 'sha256'), 'hex'),
            invite_expires_at = now() + interval '24 hours'
        where id = v_row.id;
    else
      v_otp := lpad(floor(random() * 1000000)::text, 6, '0');
      v_raw_token := null;
      update public.patient_portal_accounts
        set otp_code_hash = encode(digest(v_otp, 'sha256'), 'hex'),
            otp_expires_at = now() + interval '10 minutes',
            otp_attempts = 0
        where id = v_row.id;
    end if;

    v_results := v_results || jsonb_build_object(
      'account_id', v_row.id,
      'channel', case when v_is_email then 'email' else 'sms' end,
      'contact_value', v_row.contact_value,
      'patient_name', v_row.patient_name,
      'clinic_name', v_row.clinic_name,
      'raw_token', v_raw_token,
      'otp', v_otp
    );
  end loop;

  return v_results;
end;
$$;

revoke execute on function public.resend_patient_portal_invite(text, uuid) from public, anon, authenticated;
grant execute on function public.resend_patient_portal_invite(text, uuid) to service_role;
