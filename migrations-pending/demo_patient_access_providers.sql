-- ============================================================================
-- AngelClinic Demo — Patient Access & Payments demo data (spec §59-60, Phase 6)
-- ============================================================================
-- Configures the 3 existing demo doctors on the "AngelClinic Demo" tenant
-- (c759e954-20e3-4949-bc81-c0c780cb3624) to each demonstrate a distinct
-- real-world Patient Access configuration, and extends the existing Angel
-- Testpatient demo patient's appointment history so every surface (Find a
-- Doctor, provider profile, booking, HMO, messaging, cancellation policy)
-- has real data to show rather than an empty state.
--
--   Dr. Andrea Bautista — Provider A: Walk-In Only, cash, no online
--     payment, messaging off, no HMO. Only booking_type needs an
--     override — everything else already matches the safe clinic
--     default, which is the whole point of the override architecture.
--   Dr. Juan Santos     — Provider B: Walk-In + Appointment (the clinic
--     default — no override needed), scheduled visits prioritized,
--     cash + HMO, messaging on.
--   Dr. Maria Dela Cruz — Provider C: Appointment Only, HMO + YAKAP,
--     messaging opens up after a visit, 10-minute arrival reminder, a
--     real configured (non-default) no-show policy, and an
--     advance-payment-required bookable service — the one provider that
--     demonstrates the live PayMongo Test online-payment flow end to end.
--
-- NOTE on Online Payments: clinic_settings.accept_online_payments is a
-- single clinic-wide switch (one shared PayMongo merchant account per
-- clinic — see lib/patient-paymongo.ts), so turning it on for Provider
-- C's demo also makes "Pay Online" a selectable payment method when
-- booking with Provider B. Provider B's own bookable service has no
-- advance-payment requirement and her profile leads with Cash/HMO, so
-- nothing is broken or misleading, but her "no online payment" isn't
-- literally enforced the way accept_hmo/accept_yakap are per-provider.
-- A true per-provider override for this (same nullable-column pattern as
-- accept_hmo) is a small, contained follow-up if ever wanted.

-- ── Clinic-wide defaults ────────────────────────────────────────────────
update clinic_settings set
  default_booking_type = 'both',
  default_prioritize_scheduled = false,
  default_appointment_instructions = 'Please arrive a few minutes early and bring a valid ID. Let the front desk know if this is your first visit.',
  accept_online_payments = true,
  yakap_instructions = 'YAKAP/PhilHealth coverage is subject to verification by our staff — please bring a valid ID and your PhilHealth MDR or member number to your appointment.',
  patient_access_setup_completed = true
where tenant_id = 'c759e954-20e3-4949-bc81-c0c780cb3624';

-- ── HMO catalog ──────────────────────────────────────────────────────────
insert into clinic_accepted_hmos (tenant_id, hmo_name, is_active, verification_requirement, patient_instructions)
select 'c759e954-20e3-4949-bc81-c0c780cb3624', v.hmo_name, true, v.verification_requirement, v.patient_instructions
from (values
  ('Maxicare Healthcare Corporation', 'none', null),
  ('Intellicare (Asalus Corp.)', 'before_visit', 'Please bring your Intellicare card and a valid ID to your appointment for verification.')
) as v(hmo_name, verification_requirement, patient_instructions)
where not exists (
  select 1 from clinic_accepted_hmos existing
  where existing.tenant_id = 'c759e954-20e3-4949-bc81-c0c780cb3624' and existing.hmo_name = v.hmo_name
);

-- ── Public directory visibility + profile copy ─────────────────────────
update user_profiles set
  public_directory_enabled = true,
  public_bio = 'Family medicine physician focused on walk-in and same-day care.',
  public_languages = array['English', 'Filipino'],
  public_consultation_type = 'in_person',
  public_consultation_fee_php = 500
where id = '07b3ff8d-e819-4015-a812-85e16e595300'; -- Dr. Andrea Bautista (A)

update user_profiles set
  public_directory_enabled = true,
  public_bio = 'General practitioner seeing both walk-in and scheduled patients, with HMO coordination for established patients.',
  public_languages = array['English', 'Filipino'],
  public_consultation_type = 'in_person',
  public_consultation_fee_php = 500
where id = 'c14b29cb-e717-4ba5-978c-6171339e2af8'; -- Dr. Juan Santos (B)

update user_profiles set
  public_directory_enabled = true,
  public_bio = 'Internal medicine specialist, appointment-only, offering online booking with secure online payment.',
  public_languages = array['English', 'Filipino', 'Spanish'],
  public_consultation_type = 'both',
  public_consultation_fee_php = 1500
where id = '82ac85d0-28bf-4062-9220-89bcc282aa4f'; -- Dr. Maria Dela Cruz (C)

-- ── Per-provider overrides ───────────────────────────────────────────────

-- A — Walk-In Only. Messaging/HMO already match the safe clinic default,
-- so only booking_type needs an explicit override.
insert into provider_patient_access_settings (tenant_id, provider_id, booking_type, updated_at, updated_by)
values ('c759e954-20e3-4949-bc81-c0c780cb3624', '07b3ff8d-e819-4015-a812-85e16e595300', 'walk_in', now(), 'e2d2f80d-16c9-4f30-9b6b-03a95a0cd818')
on conflict (provider_id) do update set
  booking_type = excluded.booking_type, updated_at = now(), updated_by = excluded.updated_by;

-- B — booking_type inherits the clinic default ('both'); scheduled
-- visits prioritized, HMO accepted, messaging on (audience/hours stay at
-- clinic defaults — always available to established patients).
insert into provider_patient_access_settings (tenant_id, provider_id, prioritize_scheduled, accept_hmo, messaging_enabled, custom_instructions, updated_at, updated_by)
values (
  'c759e954-20e3-4949-bc81-c0c780cb3624', 'c14b29cb-e717-4ba5-978c-6171339e2af8',
  true, true, true,
  'Walk-ins welcome, but booking ahead helps us prioritize your visit.',
  now(), 'e2d2f80d-16c9-4f30-9b6b-03a95a0cd818'
)
on conflict (provider_id) do update set
  prioritize_scheduled = excluded.prioritize_scheduled, accept_hmo = excluded.accept_hmo, messaging_enabled = excluded.messaging_enabled,
  custom_instructions = excluded.custom_instructions, updated_at = now(), updated_by = excluded.updated_by;

-- C — appointment-only, HMO + YAKAP, messaging opens after a completed
-- visit (30-day window), 10-minute arrival reminder, and a real
-- configured no-show policy (₱500 fee after the 1st no-show; a prepaid
-- no-show keeps 50% of the advance payment; a late cancellation keeps a
-- 50% refund) — deliberately not the safe-default "never charge" policy,
-- to demonstrate the versioned-policy machinery holding a real value.
insert into provider_patient_access_settings (
  tenant_id, provider_id, booking_type, accept_hmo, accept_yakap,
  messaging_enabled, messaging_availability_mode, messaging_after_days,
  arrival_reminder_enabled, arrival_reminder_minutes, custom_instructions,
  cancellation_policy, cancellation_policy_version, updated_at, updated_by
)
values (
  'c759e954-20e3-4949-bc81-c0c780cb3624', '82ac85d0-28bf-4062-9220-89bcc282aa4f', 'appointment', true, true,
  true, 'after_appointment', 30,
  true, 10,
  'Please arrive 10 minutes early. Bring your HMO card or PhilHealth MDR if applicable. A ₱500 no-show fee applies for missed appointments without 24-hour notice.',
  '{
    "lateCancellationWindowMinutes": 1440,
    "noShowFee": {"afterCount": "1", "afterCountCustom": null, "amountPhp": 500},
    "prepaidNoShow": {"mode": "keep_percent", "percent": 50, "fixedAmountPhp": null},
    "cancellationRefund": {"mode": "full", "percent": null, "fixedAmountPhp": null},
    "lateCancellationRefund": {"mode": "percent", "percent": 50, "fixedAmountPhp": null}
  }'::jsonb, 1, now(), 'e2d2f80d-16c9-4f30-9b6b-03a95a0cd818'
)
on conflict (provider_id) do update set
  booking_type = excluded.booking_type, accept_hmo = excluded.accept_hmo, accept_yakap = excluded.accept_yakap,
  messaging_enabled = excluded.messaging_enabled, messaging_availability_mode = excluded.messaging_availability_mode,
  messaging_after_days = excluded.messaging_after_days,
  arrival_reminder_enabled = excluded.arrival_reminder_enabled, arrival_reminder_minutes = excluded.arrival_reminder_minutes,
  custom_instructions = excluded.custom_instructions,
  cancellation_policy = excluded.cancellation_policy,
  cancellation_policy_version = coalesce(provider_patient_access_settings.cancellation_policy_version, 0) + 1,
  updated_at = now(), updated_by = excluded.updated_by;

-- ── Schedules — open up patient-bookable slots ──────────────────────────
-- B currently has Mon-Fri hours but none marked patient_bookable; C
-- currently only has Sun/Tue bookable. Widen both so the booking demo has
-- real weekday availability.
update provider_schedules set patient_bookable = true
where provider_id = 'c14b29cb-e717-4ba5-978c-6171339e2af8' and day_of_week in (1, 2, 3, 4, 5);

update provider_schedules set patient_bookable = true
where provider_id = '82ac85d0-28bf-4062-9220-89bcc282aa4f' and day_of_week in (1, 2, 3, 4);

-- ── Bookable services (reusing the existing pricing system — §58) ──────

-- B's bookable service: Follow-up, ₱300, no advance payment.
update appointment_types set
  price_php = 300, price_type = 'fixed', show_price_to_patient = true,
  allow_advance_payment = false, require_advance_payment = false,
  patient_booking_enabled = true, delivery_mode = 'in_person'
where id = 'd91f615b-3e47-4b5f-a19e-4bfeac65aa84' and tenant_id = 'c759e954-20e3-4949-bc81-c0c780cb3624'; -- Follow-up

insert into appointment_type_providers (tenant_id, appointment_type_id, provider_id)
select 'c759e954-20e3-4949-bc81-c0c780cb3624', 'd91f615b-3e47-4b5f-a19e-4bfeac65aa84', 'c14b29cb-e717-4ba5-978c-6171339e2af8'
where not exists (
  select 1 from appointment_type_providers where appointment_type_id = 'd91f615b-3e47-4b5f-a19e-4bfeac65aa84' and provider_id = 'c14b29cb-e717-4ba5-978c-6171339e2af8'
);

-- C's bookable service: New Consultation, ₱1,500, advance payment
-- required — the one service in this demo that shows a live "Pay Now" /
-- PayMongo Test checkout during booking.
update appointment_types set
  price_php = 1500, price_type = 'fixed', show_price_to_patient = true,
  allow_advance_payment = true, require_advance_payment = true,
  patient_booking_enabled = true, delivery_mode = 'both'
where id = '028bc815-29cc-4849-bab9-545bb42691e8' and tenant_id = 'c759e954-20e3-4949-bc81-c0c780cb3624'; -- New Consultation

insert into appointment_type_providers (tenant_id, appointment_type_id, provider_id)
select 'c759e954-20e3-4949-bc81-c0c780cb3624', '028bc815-29cc-4849-bab9-545bb42691e8', '82ac85d0-28bf-4062-9220-89bcc282aa4f'
where not exists (
  select 1 from appointment_type_providers where appointment_type_id = '028bc815-29cc-4849-bab9-545bb42691e8' and provider_id = '82ac85d0-28bf-4062-9220-89bcc282aa4f'
);

-- ── Angel Testpatient history ────────────────────────────────────────────
-- Angel already has a completed + an upcoming appointment with Provider C
-- (Dr. Maria Dela Cruz) from earlier demo data — that's what makes her
-- "established" and "after visit" eligible for C's messaging demo. Give
-- her the same kind of established relationship with Provider B so the
-- messaging demo has a real thread partner on that side too.
insert into appointments (tenant_id, patient_id, provider_id, appointment_type_id, start_at, end_at, status, payment_method)
select 'c759e954-20e3-4949-bc81-c0c780cb3624', '6221afa4-d025-4e85-8b86-fcc8eea058b9', 'c14b29cb-e717-4ba5-978c-6171339e2af8',
  'd91f615b-3e47-4b5f-a19e-4bfeac65aa84', date_trunc('day', now()) + interval '7 days' + interval '10 hours',
  date_trunc('day', now()) + interval '7 days' + interval '10 hours 15 minutes', 'scheduled', 'cash'
where not exists (
  select 1 from appointments where patient_id = '6221afa4-d025-4e85-8b86-fcc8eea058b9' and provider_id = 'c14b29cb-e717-4ba5-978c-6171339e2af8'
);

-- ── Audit trail (§62) ────────────────────────────────────────────────────
insert into audit_logs (tenant_id, actor_user_id, action, entity_type, entity_id, old_value, new_value)
select 'c759e954-20e3-4949-bc81-c0c780cb3624', 'e2d2f80d-16c9-4f30-9b6b-03a95a0cd818',
  'accept_online_payments_changed', 'clinic_settings', 'c759e954-20e3-4949-bc81-c0c780cb3624',
  '{"enabled": false}'::jsonb, '{"enabled": true}'::jsonb
where not exists (
  select 1 from audit_logs where tenant_id = 'c759e954-20e3-4949-bc81-c0c780cb3624' and action = 'accept_online_payments_changed'
);

insert into audit_logs (tenant_id, actor_user_id, action, entity_type, entity_id, old_value, new_value)
select 'c759e954-20e3-4949-bc81-c0c780cb3624', 'e2d2f80d-16c9-4f30-9b6b-03a95a0cd818',
  'cancellation_policy_changed', 'provider_patient_access_settings', '82ac85d0-28bf-4062-9220-89bcc282aa4f',
  null, '{"noShowFee": {"afterCount": "1", "amountPhp": 500}, "prepaidNoShow": {"mode": "keep_percent", "percent": 50}}'::jsonb
where not exists (
  select 1 from audit_logs where tenant_id = 'c759e954-20e3-4949-bc81-c0c780cb3624' and action = 'cancellation_policy_changed' and entity_id = '82ac85d0-28bf-4062-9220-89bcc282aa4f'
);
