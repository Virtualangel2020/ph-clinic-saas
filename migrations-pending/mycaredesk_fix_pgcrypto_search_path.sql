-- CRITICAL FIX: every Patient Portal invite/activation function was
-- silently broken in production. All four call a pgcrypto function
-- (gen_random_bytes and/or digest) while pinning
-- `SET search_path TO 'public'` — but this project's pgcrypto extension
-- lives in the `extensions` schema, not `public` (confirmed via
-- pg_extension), so any unqualified call to gen_random_bytes()/digest()
-- inside these functions raised `function ... does not exist` the moment
-- it ran, regardless of whether the email provider was configured or
-- anything else was correct. Verified directly against production: a
-- scratch SECURITY DEFINER function with the exact same search_path
-- setting threw the identical "function gen_random_bytes(integer) does
-- not exist" / "function digest(unknown, unknown) does not exist" errors
-- outside of any other context, and both errors disappeared immediately
-- after this fix (re-verified with a live call against the actual test
-- account).
--
-- This explains failures well beyond just the new resend feature: every
-- one of invite_patient_to_portal (creating ANY invite, any channel),
-- verify_patient_portal_invite_token (checking an emailed activation
-- link), and verify_patient_portal_otp (checking a texted code) would
-- have thrown this same error the moment they were actually exercised —
-- which very likely explains the generic, redacted "An error occurred in
-- the Server Components render..." message Angel hit testing
-- /portal/activate earlier in this project, whose true underlying cause
-- was never isolated to this specific bug until traced here.
--
-- Minimal, surgical fix: widen each affected function's search_path to
-- also include `extensions`, rather than rewriting every call site to
-- schema-qualify pgcrypto calls. Function bodies are untouched.
--
-- NOTE ON SYNTAX: `set search_path to 'public, extensions'` (as ONE
-- quoted string) is WRONG — it sets search_path to a single schema
-- literally named "public, extensions", not a two-schema list, and does
-- NOT fix the bug (this was caught immediately by re-testing after
-- applying it — see the corrected version below, which quotes each
-- schema name as its own argument).
alter function public.invite_patient_to_portal(uuid, text) set search_path to 'public', 'extensions';
alter function public.verify_patient_portal_invite_token(text) set search_path to 'public', 'extensions';
alter function public.verify_patient_portal_otp(uuid, text) set search_path to 'public', 'extensions';
alter function public.resend_patient_portal_invite(text, uuid) set search_path to 'public', 'extensions';
