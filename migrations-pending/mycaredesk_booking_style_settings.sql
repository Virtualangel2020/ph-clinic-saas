-- Angel's consolidated booking-style spec: "online booking on/off" and
-- "how do patients book" (specific times / flexible arrival / walk-in) are
-- two separate questions, not one 5-value enum. Today both clinic_settings
-- and provider_patient_access_settings only have `booking_type`/
-- `default_booking_type` (walk_in|appointment|both|appointment_request|
-- flexible) — 'flexible' has never had a real booking flow behind it
-- (lib/patient-access.ts:supportsSlotBooking excludes it; the portal routes
-- it to a dead-end "contact the clinic" message).
--
-- Additive only: booking_type/default_booking_type are left in place as a
-- legacy/back-compat column (nothing reads them after this pass, but
-- nothing breaks if something still does). New columns, backfilled from the
-- existing value so every provider's effective behavior is unchanged the
-- moment this ships:
--   appointment/both/appointment_request -> online_booking_enabled=true,  booking_style='specific_times'
--   walk_in                              -> online_booking_enabled=true,  booking_style='walk_in'
--   flexible                             -> online_booking_enabled=false, booking_style='flexible_arrival'
--     (flexible today already dead-ends to "contact the clinic" for
--     patients, i.e. online booking is *effectively* off — backfilling
--     online_booking_enabled=false preserves that exact behavior. Once a
--     clinic explicitly flips the new toggle on, they get the real,
--     newly-built flexible-arrival flow instead of the old dead end.)

alter table clinic_settings
  add column if not exists online_booking_enabled boolean not null default true,
  add column if not exists booking_style text not null default 'specific_times'
    check (booking_style in ('specific_times','flexible_arrival','walk_in')),
  add column if not exists flexible_arrival_interval_minutes integer
    check (flexible_arrival_interval_minutes in (15,30,60)),
  add column if not exists flexible_arrival_max_patients_per_day integer
    check (flexible_arrival_max_patients_per_day is null or flexible_arrival_max_patients_per_day > 0);

update clinic_settings set
  online_booking_enabled = (default_booking_type <> 'flexible'),
  booking_style = case
    when default_booking_type = 'walk_in' then 'walk_in'
    when default_booking_type = 'flexible' then 'flexible_arrival'
    else 'specific_times'
  end;

comment on column clinic_settings.online_booking_enabled is 'Clinic-wide default; a provider row with online_booking_enabled IS NULL inherits this. When false, patients see the provider in Find a Doctor but cannot self-book (Book Appointment is replaced with "please contact the clinic").';
comment on column clinic_settings.booking_style is 'Clinic-wide default booking style; NULL-inherit on the provider override row. Replaces default_booking_type going forward — that column stays for back-compat only, nothing new reads it.';
comment on column clinic_settings.flexible_arrival_interval_minutes is 'How patients pick an expected-arrival time under flexible_arrival. NULL = no time picker at all, clinic hours shown only.';
comment on column clinic_settings.flexible_arrival_max_patients_per_day is 'Optional capacity cap for flexible_arrival/walk_in bookings per provider per day. NULL = unlimited.';

alter table provider_patient_access_settings
  add column if not exists online_booking_enabled boolean,
  add column if not exists booking_style text
    check (booking_style in ('specific_times','flexible_arrival','walk_in')),
  add column if not exists flexible_arrival_interval_minutes integer
    check (flexible_arrival_interval_minutes in (15,30,60)),
  add column if not exists flexible_arrival_max_patients_per_day integer
    check (flexible_arrival_max_patients_per_day is null or flexible_arrival_max_patients_per_day > 0);

update provider_patient_access_settings set
  online_booking_enabled = case when booking_type is null then null else (booking_type <> 'flexible') end,
  booking_style = case
    when booking_type is null then null
    when booking_type = 'walk_in' then 'walk_in'
    when booking_type = 'flexible' then 'flexible_arrival'
    else 'specific_times'
  end
where booking_type is not null;

comment on column provider_patient_access_settings.online_booking_enabled is 'NULL = inherit clinic_settings.online_booking_enabled.';
comment on column provider_patient_access_settings.booking_style is 'NULL = inherit clinic_settings.booking_style. Replaces booking_type going forward.';
