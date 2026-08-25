-- Patient-facing PayMongo integration (clinic bills ITS patients, not
-- AngelClinic). Per explicit instruction, this reuses AngelClinic's own
-- existing PayMongo account/keys (process.env.PAYMONGO_SECRET_KEY /
-- PAYMONGO_WEBHOOK_SECRET — the same ones already wired for platform
-- subscription billing in lib/paymongo.ts / app/admin/actions.ts) rather
-- than storing a secret key per tenant. See lib/patient-paymongo.ts for
-- the full note on what changes later if/when a clinic gets its own
-- PayMongo merchant account — this schema doesn't need to change for
-- that, only where the secret key is resolved from.
--
-- What a clinic DOES control per-tenant is whether online payment is
-- offered at all (clinic_settings.accept_online_payments) — a plain
-- on/off switch, no secret involved, safe to read via normal RLS.

alter table clinic_settings add column if not exists accept_online_payments boolean not null default false;

-- One online-payment attempt per patient charge, mirroring the existing
-- invoices.paymongo_checkout_session_id pattern but scoped to a
-- patient_charges row instead of a platform invoice. A charge can have
-- more than one attempt (e.g. a failed one followed by a successful one).
-- resulting_payment_id is the duplicate-webhook guard (§29): once a
-- payment has been recorded from this attempt, a retried/duplicate
-- webhook delivery for the same checkout session is a safe no-op.
create table if not exists patient_charge_online_payments (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  charge_id uuid not null references patient_charges(id) on delete cascade,
  patient_id uuid not null references patients(id) on delete cascade,
  provider text not null default 'paymongo',
  checkout_session_id text,
  checkout_url text,
  amount_php numeric(12,2) not null,
  status text not null default 'pending' check (status in ('pending', 'paid', 'failed', 'cancelled', 'refunded', 'partially_refunded', 'disputed')),
  created_by uuid references user_profiles(id),
  created_at timestamptz not null default now(),
  paid_at timestamptz,
  resulting_payment_id uuid references patient_charge_payments(id)
);

alter table patient_charge_online_payments enable row level security;

create policy "tenant members view own tenant online payments"
  on patient_charge_online_payments for select
  using (tenant_id = current_tenant_id());

create policy "portal patients view own online payments"
  on patient_charge_online_payments for select
  using (is_portal_patient(patient_id));

-- patient_charge_payments.method currently allows the same set as
-- patient_charges.bill_type (cash/hmo/philhealth/yakap/other) — add
-- 'paymongo' as a valid method so a webhook-recorded payment can use it.
-- Constraint name discovered dynamically rather than assumed, since it
-- was never captured in a local migration file.
do $$
declare
  ck_name text;
begin
  select conname into ck_name
  from pg_constraint
  where conrelid = 'patient_charge_payments'::regclass
    and contype = 'c'
    and pg_get_constraintdef(oid) ilike '%method%';
  if ck_name is not null then
    execute format('alter table patient_charge_payments drop constraint %I', ck_name);
  end if;
  alter table patient_charge_payments
    add constraint patient_charge_payments_method_check
    check (method in ('cash', 'hmo', 'philhealth', 'yakap', 'paymongo', 'other'));
end $$;

-- ── RPCs ──────────────────────────────────────────────────────────────

create or replace function set_accept_online_payments(p_enabled boolean)
returns void
language plpgsql security definer set search_path = public as $$
declare
  v_tenant_id uuid := current_tenant_id();
begin
  if not exists (select 1 from user_profiles where id = auth.uid() and tenant_id = v_tenant_id and role = 'clinic_admin') then
    raise exception 'Only a clinic admin can change online payment settings.';
  end if;
  update clinic_settings set accept_online_payments = p_enabled where tenant_id = v_tenant_id;
  insert into audit_logs (tenant_id, actor_user_id, action, entity_type, entity_id, new_value)
  values (v_tenant_id, auth.uid(), 'accept_online_payments_changed', 'clinic_settings', v_tenant_id, jsonb_build_object('enabled', p_enabled));
end $$;

grant execute on function set_accept_online_payments(boolean) to authenticated;

-- Records a Checkout Session attempt against a specific patient charge.
-- The actual PayMongo API call happens in application code
-- (lib/patient-paymongo.ts) — this RPC just does the tenant-scoped
-- bookkeeping around it, same division of labor as
-- admin_set_invoice_checkout_session on the platform-billing side.
create or replace function record_patient_charge_checkout_session(
  p_charge_id uuid,
  p_amount_php numeric,
  p_checkout_session_id text,
  p_checkout_url text
) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_tenant_id uuid := current_tenant_id();
  v_patient_id uuid;
  v_id uuid;
begin
  select patient_id into v_patient_id from patient_charges where id = p_charge_id and tenant_id = v_tenant_id;
  if v_patient_id is null then
    raise exception 'Charge not found for this clinic.';
  end if;

  insert into patient_charge_online_payments (tenant_id, charge_id, patient_id, provider, checkout_session_id, checkout_url, amount_php, status, created_by)
  values (v_tenant_id, p_charge_id, v_patient_id, 'paymongo', p_checkout_session_id, p_checkout_url, p_amount_php, 'pending', auth.uid())
  returning id into v_id;

  return v_id;
end $$;

grant execute on function record_patient_charge_checkout_session(uuid, numeric, text, text) to authenticated;

-- Demo reset (§51) — resets Angel Testpatient's demo invoice back to
-- Unpaid so a sales demo can be re-run, WITHOUT touching real production
-- clinics (hard tenant_id + is_test guard) and WITHOUT deleting the
-- PayMongo transaction history (patient_charge_online_payments rows are
-- kept — only the resulting patient_charge_payments row and the charge's
-- "paid" state are reversed).
create or replace function admin_reset_demo_patient_invoice(p_charge_id uuid)
returns void
language plpgsql security definer set search_path = public as $$
declare
  v_tenant_id uuid;
  v_is_test boolean;
begin
  select tenant_id into v_tenant_id from patient_charges where id = p_charge_id;
  if v_tenant_id is null then
    raise exception 'Charge not found.';
  end if;
  select is_test into v_is_test from tenants where id = v_tenant_id;
  if not coalesce(v_is_test, false) then
    raise exception 'Refusing to reset — this charge does not belong to a test/demo tenant.';
  end if;
  if not exists (select 1 from user_profiles where id = auth.uid() and tenant_id = v_tenant_id and role = 'clinic_admin') then
    raise exception 'Only a clinic admin can reset demo data.';
  end if;

  delete from patient_charge_payments where charge_id = p_charge_id;
  update patient_charge_online_payments set status = 'cancelled' where charge_id = p_charge_id and status = 'paid';

  insert into audit_logs (tenant_id, actor_user_id, action, entity_type, entity_id, new_value)
  values (v_tenant_id, auth.uid(), 'demo_invoice_reset', 'patient_charges', p_charge_id, '{}'::jsonb);
end $$;

grant execute on function admin_reset_demo_patient_invoice(uuid) to authenticated;
