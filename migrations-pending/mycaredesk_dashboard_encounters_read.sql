-- Phase 2 (Patient Dashboard): the new dashboard's "Recent Care" card and
-- Task #139's /portal/care "Last Visit" summary both need to read this
-- patient's own encounters (date, provider, visit type/reason) for the
-- last COMPLETED (status='closed') visit — patient-safe fields only, never
-- the SOAP/progress-note text itself (no patient_visible flag exists on
-- progress notes, so app code never queries that table for the patient
-- portal). No /portal/* page has ever read `encounters` before this.
--
-- Mirrors the same is_portal_patient() self-read shape used everywhere
-- else (appointments_portal_self_read, lab_results_portal_self_read,
-- etc.) — RLS grants the row, app code filters to status='closed' and
-- selects only the patient-safe columns, same convention as
-- lab_results_portal_self_read (RLS doesn't gate on status='released';
-- app/portal/results/page.tsx does).

create policy encounters_portal_self_read on public.encounters
  for select using (is_portal_patient(patient_id));
