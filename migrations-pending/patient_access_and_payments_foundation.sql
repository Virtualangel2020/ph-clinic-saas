-- ============================================================================
-- Patient Access & Payments — foundation schema (Phase 1)
-- ============================================================================
-- Implements the "clinic defaults + provider overrides" architecture
-- requested: every setting a provider can customize lives on
-- provider_patient_access_settings as a NULLABLE column (NULL = inherit the
-- clinic-wide default from clinic_settings). No setting is ever duplicated
-- per-provider unless a clinic admin explicitly overrides it — a group
-- practice with 10 identically-configured providers only ever writes the
-- clinic default once.
--
-- Nothing here removes or renames an existing column; every new column on
-- an existing table is nullable-or-defaulted so no existing read/write
-- breaks. appointment_types keeps its existing 7 columns; set_appointment_type
-- gets new OPTIONAL trailing params (all defaulted) so its one existing call
-- site (app/dashboard/settings/actions.ts) keeps compiling unmodified until
-- I update it to actually pass pricing.

-- ── A. clinic_settings — clinic-wide Patient Access & Payments defaults ────
alter table clinic_settings
  add column if not exists default_booking_type text not null default 'both'
    check (default_booking_type in ('walk_in','appointment','both','appointment_request','flexible')),
  add column if not exists default_prioritize_scheduled boolean not null default false,
  add column if not exists booking_cutoff_minutes integer not null default 0,
  add column if not exists max_advance_booking_days integer not null default 30,
  add column if not exists default_arrival_reminder_enabled boolean not null default false,
  add column if not exists default_arrival_reminder_minutes integer not null default 15,
  add column if not exists default_appointment_instructions text,
  add column if not exists default_messaging_enabled boolean not null default false,
  add column if not exists default_messaging_audience text not null default 'all_established'
    check (default_messaging_audience in ('all_established','upcoming_appointment','after_visit','selected_patients','custom')),
  add column if not exists default_messaging_availability_mode text not null default 'always'
    check (default_messaging_availability_mode in ('always','before_appointment','after_appointment','before_after_appointment','custom_hours')),
  add column if not exists default_messaging_before_days integer,
  add column if not exists default_messaging_after_days integer,
  add column if not exists default_messaging_outside_hours_behavior text not null default 'allow_queue'
    check (default_messaging_outside_hours_behavior in ('allow_queue','disable')),
  add column if not exists default_messaging_disclaimer text default 'Portal messaging is not intended for emergencies.',
  add column if not exists accept_hmo boolean not null default false,
  add column if not exists accept_yakap boolean not null default false,
  add column if not exists yakap_instructions text,
  add column if not exists cancellation_policy jsonb not null default '{
    "lateCancellationWindowMinutes": 1440,
    "noShowFee": {"afterCount": "never", "afterCountCustom": null, "amountPhp": null},
    "prepaidNoShow": {"mode": "keep_0", "percent": null, "fixedAmountPhp": null},
    "cancellationRefund": {"mode": "full", "percent": null, "fixedAmountPhp": null},
    "lateCancellationRefund": {"mode": "full", "percent": null, "fixedAmountPhp": null}
  }'::jsonb,
  add column if not exists cancellation_policy_version integer not null default 1,
  add column if not exists patient_access_setup_completed boolean not null default false;

comment on column clinic_settings.default_booking_type is 'Clinic-wide default; a provider row in provider_patient_access_settings with booking_type IS NULL inherits this.';
comment on column clinic_settings.cancellation_policy is 'Structured policy — see docs/patient-access-payments.md shape. Bump cancellation_policy_version on every save that changes it; patient_policy_acknowledgements snapshots the exact jsonb + version a patient agreed to, so a later policy edit never rewrites history.';

-- ── B. appointment_types — pricing + booking + delivery-mode fields ────────
alter table appointment_types
  add column if not exists price_php numeric(12,2),
  add column if not exists price_max_php numeric(12,2),
  add column if not exists price_type text not null default 'fixed'
    check (price_type in ('fixed','starting_at','range','variable','free')),
  add column if not exists show_price_to_patient boolean not null default false,
  add column if not exists allow_advance_payment boolean not null default false,
  add column if not exists require_advance_payment boolean not null default false,
  add column if not exists patient_booking_enabled boolean not null default false,
  add column if not exists delivery_mode text not null default 'in_person'
    check (delivery_mode in ('in_person','telehealth','both')),
  add constraint appointment_types_price_range_check
    check (price_type != 'range' or (price_php is not null and price_max_php is not null and price_max_php >= price_php));

-- Provider eligibility for an appointment type. No rows for a given
-- appointment_type_id = every active provider is eligible (the "easy
-- default" — a clinic never has to opt every provider into every type).
create table if not exists appointment_type_providers (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  appointment_type_id uuid not null references appointment_types(id) on delete cascade,
  provider_id uuid not null references user_profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (appointment_type_id, provider_id)
);
alter table appointment_type_providers enable row level security;
create policy "tenant members view own appointment_type_providers" on appointment_type_providers
  for select using (tenant_id = current_tenant_id());

-- ── C. Per-provider overrides ───────────────────────────────────────────────
create table if not exists provider_patient_access_settings (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  provider_id uuid not null references user_profiles(id) on delete cascade,
  -- Booking
  booking_type text check (booking_type in ('walk_in','appointment','both','appointment_request','flexible')),
  prioritize_scheduled boolean,
  booking_cutoff_minutes integer,
  max_advance_booking_days integer,
  -- Arrival / instructions
  arrival_reminder_enabled boolean,
  arrival_reminder_minutes integer,
  custom_instructions text,
  -- Coverage
  accept_hmo boolean,
  accept_yakap boolean,
  -- Messaging
  messaging_enabled boolean,
  messaging_audience text check (messaging_audience in ('all_established','upcoming_appointment','after_visit','selected_patients','custom')),
  messaging_availability_mode text check (messaging_availability_mode in ('always','before_appointment','after_appointment','before_after_appointment','custom_hours')),
  messaging_before_days integer,
  messaging_after_days integer,
  messaging_outside_hours_behavior text check (messaging_outside_hours_behavior in ('allow_queue','disable')),
  messaging_disclaimer text,
  -- Cancellation policy override — NULL = inherit clinic_settings.cancellation_policy
  -- entirely; non-null REPLACES the clinic policy wholesale for this provider
  -- (no partial field-merge ambiguity).
  cancellation_policy jsonb,
  cancellation_policy_version integer,
  updated_at timestamptz not null default now(),
  updated_by uuid references user_profiles(id),
  unique (provider_id)
);
alter table provider_patient_access_settings enable row level security;
create policy "tenant members view own provider_patient_access_settings" on provider_patient_access_settings
  for select using (tenant_id = current_tenant_id());

-- Custom weekly messaging-hours ranges (mirrors provider_schedules' row-per-
-- range shape exactly, per the existing app convention) — only relevant
-- when messaging_availability_mode = 'custom_hours'.
create table if not exists provider_messaging_hours (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  provider_id uuid not null references user_profiles(id) on delete cascade,
  day_of_week smallint not null check (day_of_week between 0 and 6),
  start_time time not null,
  end_time time not null,
  created_at timestamptz not null default now(),
  check (end_time > start_time)
);
alter table provider_messaging_hours enable row level security;
create policy "tenant members view own provider_messaging_hours" on provider_messaging_hours
  for select using (tenant_id = current_tenant_id());

-- Selected-patients messaging audience (only relevant when
-- messaging_audience = 'selected_patients').
create table if not exists provider_messaging_allowed_patients (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  provider_id uuid not null references user_profiles(id) on delete cascade,
  patient_id uuid not null references patients(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (provider_id, patient_id)
);
alter table provider_messaging_allowed_patients enable row level security;
create policy "tenant members view own provider_messaging_allowed_patients" on provider_messaging_allowed_patients
  for select using (tenant_id = current_tenant_id());

-- ── D. HMO catalog ───────────────────────────────────────────────────────
-- Clinic-wide curated list — patients currently type free-text insurer
-- names on patient_insurance; this is a SEPARATE, curated "what we accept"
-- catalog for booking/display purposes, not a rename of that table.
create table if not exists clinic_accepted_hmos (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  hmo_name text not null,
  is_active boolean not null default true,
  verification_requirement text not null default 'none'
    check (verification_requirement in ('none','before_confirmation','before_visit','bring_card_loa','clinic_contacts_patient')),
  patient_instructions text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references user_profiles(id)
);
alter table clinic_accepted_hmos enable row level security;
create policy "tenant members view own clinic_accepted_hmos" on clinic_accepted_hmos
  for select using (tenant_id = current_tenant_id());

-- Per-provider subset override. No rows for a provider = that provider (if
-- accept_hmo is effectively true) accepts the FULL active clinic list —
-- rows only need to exist when a clinic wants to restrict a specific
-- provider to fewer HMOs than the clinic-wide list.
create table if not exists provider_hmo_acceptance (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  provider_id uuid not null references user_profiles(id) on delete cascade,
  hmo_id uuid not null references clinic_accepted_hmos(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (provider_id, hmo_id)
);
alter table provider_hmo_acceptance enable row level security;
create policy "tenant members view own provider_hmo_acceptance" on provider_hmo_acceptance
  for select using (tenant_id = current_tenant_id());

-- ── E. Policy acknowledgement (versioned, immutable snapshot) ──────────────
create table if not exists patient_policy_acknowledgements (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  patient_id uuid not null references patients(id) on delete cascade,
  appointment_id uuid references appointments(id) on delete set null,
  policy_version integer not null,
  policy_snapshot jsonb not null,
  acknowledged_at timestamptz not null default now(),
  created_via text not null default 'portal_booking'
);
alter table patient_policy_acknowledgements enable row level security;
create policy "tenant members view own patient_policy_acknowledgements" on patient_policy_acknowledgements
  for select using (tenant_id = current_tenant_id());
create policy "portal patients view own policy acknowledgements" on patient_policy_acknowledgements
  for select using (is_portal_patient(patient_id));

-- ── F. appointments — booking-time payment/coverage capture (nullable) ─────
-- Nullable/defaulted additions only — every existing appointments read/write
-- (add_appointment, update_appointment, calendar, patient-booking preview)
-- keeps working with these simply defaulting to null/'not_required'.
alter table appointments
  add column if not exists payment_method text
    check (payment_method is null or payment_method in ('cash','hmo','philhealth','yakap','online','other')),
  add column if not exists hmo_id uuid references clinic_accepted_hmos(id),
  add column if not exists hmo_verification_status text not null default 'not_required'
    check (hmo_verification_status in ('not_required','pending','submitted','verified','info_needed','unable_to_verify'));
