-- CREATE OR REPLACE FUNCTION with a changed parameter list creates a NEW
-- overload rather than replacing the original (Postgres function identity
-- includes the parameter type signature) — patient_access_and_payments_rpcs
-- added set_appointment_type(...15 args...) alongside the original
-- set_appointment_type(...7 args...) instead of replacing it, which would
-- make every call ambiguous (both candidates match when only the first 7
-- named params are passed, since the new one's extra params all have
-- defaults). Drop the stale 7-arg original so only the 15-arg version
-- (backward-compatible via defaults) remains.
drop function if exists public.set_appointment_type(uuid, text, text, integer, text, boolean, integer);
