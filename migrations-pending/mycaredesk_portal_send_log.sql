-- Durable, Super-Admin-visible log of every Patient Portal invite/resend
-- SEND ATTEMPT (not just the invite record itself, which only tracks
-- current status, not delivery history). Angel: "errors MUST be logged
-- for Super Admin/development troubleshooting" — this exists because the
-- resend/invite UI necessarily shows a generic success message to the
-- patient for privacy reasons, so without a durable log there was no way
-- for Angel (or me) to tell "nothing matched" apart from "matched, but
-- the email provider rejected it" apart from "matched, sent fine" after
-- the fact. Written only by trusted server code via the admin
-- (service_role) client — never by anon/authenticated directly — and
-- readable only by platform admins.
create table if not exists public.patient_portal_send_log (
  id uuid primary key default gen_random_uuid(),
  account_id uuid references public.patient_portal_accounts(id) on delete set null,
  tenant_id uuid,
  event text not null check (event in ('invite', 'resend')),
  channel text not null check (channel in ('email', 'sms')),
  contact_masked text,
  status text not null check (status in ('sent', 'failed', 'no_match')),
  error_message text,
  created_at timestamptz not null default now()
);

alter table public.patient_portal_send_log enable row level security;

create policy "platform admins can read the portal send log"
  on public.patient_portal_send_log for select
  using (public.is_platform_admin());

revoke all on public.patient_portal_send_log from anon, authenticated;
grant select on public.patient_portal_send_log to authenticated;
grant insert on public.patient_portal_send_log to service_role;
