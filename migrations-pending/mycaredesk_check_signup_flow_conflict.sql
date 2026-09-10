-- Pre-signUp() guard against cross-flow auth.users.user_metadata
-- clobbering (bug report: a patient's activation link sometimes redirects
-- them into the clinic/provider signup flow instead of the Patient
-- Portal). Root cause: both app/patient-signup/page.tsx and
-- app/signup/page.tsx write to the SAME mutable auth.users.user_metadata
-- blob for a given email via signUp()'s options.data, keyed by nothing but
-- that email being unconfirmed. If the same address is submitted through
-- the OTHER form before the first confirmation link is clicked,
-- signUp() silently overwrites the metadata with the second flow's shape.
--
-- This function is called from both signup forms, BEFORE calling
-- signUp(), so the client can block with a clear message instead of
-- silently clobbering an in-flight signup of the other kind. Only
-- unconfirmed identities matter — a fully confirmed account is already
-- caught by each form's own existing "already registered"
-- (identities.length === 0) anti-enumeration check, which needs no
-- change here.
create or replace function public.check_signup_flow_conflict(p_email text, p_intended_kind text)
returns text
language plpgsql
stable
security definer
set search_path to 'public'
as $function$
declare
  v_meta jsonb;
  v_confirmed timestamptz;
  v_other_kind text;
begin
  select raw_user_meta_data, email_confirmed_at
    into v_meta, v_confirmed
  from auth.users
  where lower(email) = lower(trim(p_email))
  order by created_at desc
  limit 1;

  if v_meta is null or v_confirmed is not null then
    return null;
  end if;

  v_other_kind := case when coalesce(v_meta->>'account_kind', '') = 'mycaredesk_patient' then 'mycaredesk_patient' else 'clinic' end;

  if v_other_kind <> p_intended_kind then
    return v_other_kind;
  end if;

  return null;
end;
$function$;

comment on function public.check_signup_flow_conflict is
  'Pre-signUp() guard: returns the OTHER in-progress signup flow kind (''clinic'' or ''mycaredesk_patient'') for an email with an unconfirmed identity already mid-signup through the other form, or null when there''s no conflict. Prevents auth.users.user_metadata clobbering across /signup and /patient-signup, which share the same mutable per-email metadata blob.';

grant execute on function public.check_signup_flow_conflict(text, text) to anon, authenticated;
