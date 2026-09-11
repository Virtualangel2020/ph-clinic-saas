-- DOB/year range validation (Angel's spec items 14-16): "date/year dropdowns
-- currently allow impossible years back to the beginning of time... minimum
-- year 1900, maximum current year, no future DOB, and must validate
-- server-side too (not just frontend dropdown)."
--
-- Scoped ONLY to the two tables that actually store a person's real date of
-- birth (public.patients — every clinic-side patient record, including
-- provider-created ones — and public.mycaredesk_accounts — the platform
-- identity for a self-registered patient AND every dependent/family
-- member). A table-level CHECK constraint is the one place that
-- automatically covers every insert/update path (every RPC, every direct
-- write) with zero risk of a future RPC forgetting to validate — which is
-- what "server-side too, not just the frontend dropdown" actually
-- requires. Deliberately NOT touched: appointments, documents,
-- prescriptions, billing, or any other date field — none of those are a
-- date of birth, and Angel was explicit that only true DOB fields should
-- get this bound.
--
-- Verified against production data first: zero existing rows in either
-- table fall outside [1900-01-01, today] as of this migration, so this is
-- safe to apply with no backfill.
alter table public.patients
  add constraint patients_date_of_birth_range_check
  check (date_of_birth >= date '1900-01-01' and date_of_birth <= current_date);

alter table public.mycaredesk_accounts
  add constraint mycaredesk_accounts_date_of_birth_range_check
  check (date_of_birth >= date '1900-01-01' and date_of_birth <= current_date);
