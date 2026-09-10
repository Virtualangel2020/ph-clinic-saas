import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

// Landing spot for a patient self-signup's email confirmation link (see
// emailRedirectTo in app/patient-signup/page.tsx and the next= param
// /auth/callback forwards here with). By the time we're here, Supabase
// has already exchanged the confirmation code for a real session — this
// page's only job is to finish creating the mycaredesk_accounts row using
// the demographic data stashed in the auth user's metadata at signup
// time (self_register_mycaredesk_account needs auth.uid(), which didn't
// exist yet back on the signup page if email confirmation was required),
// then send the patient straight into the portal. No second login, no
// separate verification code — this IS the verification.
//
// Bug fix: this page used to gate account creation on
// `user_metadata.account_kind === "mycaredesk_patient"`. That metadata
// blob is shared, mutable storage keyed only by email — if the same
// address was also submitted through the clinic /signup form (retry,
// mixed-up email, shared test address) before this confirmation link was
// clicked, signUp() silently overwrites it with the OTHER flow's shape
// (no account_kind at all), so the check failed and this page redirected
// to /portal having created no mycaredesk_accounts row at all — a patient
// who "activated" but got no patient account, with no error shown.
// Reaching THIS page at all already proves patient intent (it is only
// ever linked from patient-signup's own emailRedirectTo — /auth/callback
// just honors whatever next= was baked into that specific link), so the
// account_kind check is dropped entirely. Instead, only the presence of
// the actual required fields decides whether we can register right now;
// if metadata got clobbered and they're missing, send the patient to
// /portal/health-profile, which already has a graceful "set up your
// MyCareDesk account" step (AccountSetupPanel, with best-effort prefill
// from any existing clinic patient record) for exactly this situation —
// reusing that instead of building a second recovery form.
export default async function FinishSignupPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/portal/login");

  // Idempotent: revisiting this link (or a slow double-click) shouldn't
  // try to create a second account for the same login.
  const { data: existing } = await supabase.rpc("get_my_mycaredesk_account");
  if (existing) redirect("/portal");

  const meta = user.user_metadata ?? {};
  if (meta.first_name && meta.last_name && meta.date_of_birth && meta.sex) {
    await supabase.rpc("self_register_mycaredesk_account", {
      p_first_name: meta.first_name,
      p_last_name: meta.last_name,
      p_date_of_birth: meta.date_of_birth,
      p_sex: meta.sex,
      p_mobile_phone: meta.mobile_phone ?? null,
      p_email: user.email ?? null,
    });
    // Best-effort — link any existing clinic-invited patient records this
    // same login already has, same as the inline AccountSetupPanel path.
    await supabase.rpc("link_my_existing_patients_to_mycaredesk_account");
    // /portal (the dashboard) handles the "no clinic relationship yet"
    // case gracefully on its own now — no need for a separate Welcome
    // dead end.
    redirect("/portal");
  }

  // Metadata got clobbered by the other signup flow before this link was
  // clicked — finish setting up the account inline instead of silently
  // skipping it.
  redirect("/portal/health-profile");
}
