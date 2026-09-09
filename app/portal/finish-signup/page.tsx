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
export default async function FinishSignupPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/portal/login");

  // Idempotent: revisiting this link (or a slow double-click) shouldn't
  // try to create a second account for the same login.
  const { data: existing } = await supabase.rpc("get_my_mycaredesk_account");
  if (existing) redirect("/portal/welcome");

  const meta = user.user_metadata ?? {};
  if (meta.account_kind === "mycaredesk_patient" && meta.first_name && meta.last_name && meta.date_of_birth && meta.sex) {
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
  }

  redirect("/portal/welcome");
}
