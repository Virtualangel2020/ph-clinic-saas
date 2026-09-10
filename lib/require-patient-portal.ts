import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export type PatientPortalAccount = {
  id: string;
  tenant_id: string;
  patient_id: string;
  status: string;
  channel: string;
  contact_value: string;
  activated_at: string | null;
  patients: { first_name: string; last_name: string } | null;
};

// Patient-side equivalent of requireClinicMember — confirms a signed-in
// session, nothing more. Every /portal/* page is reachable to any signed-in
// patient regardless of whether they've connected with a clinic yet (bug
// report: a brand-new self-registered patient — mycaredesk_accounts row
// only, no patient_portal_accounts row — used to get silently bounced back
// to the login form on every page except Welcome/Health Profile, because
// this used to hard-require an active clinic-side row and redirect to
// /portal/login when none existed). Callers now get `account: null` in
// that case and are expected to render a graceful "connect with a clinic
// to see this" empty state INSIDE the normal portal shell, per Angel's
// "do not hide the portal because records don't exist yet" principle —
// never redirect a signed-in patient away from a page just because one
// clinic relationship hasn't been established.
//
// `account` resolves to the most-recently-activated clinic relationship
// when more than one exists (a patient can accumulate a patients/
// patient_portal_accounts row per clinic they book with or are invited
// by — see self_book_ensure_clinic_patient). This is a deliberate, scoped
// choice: it fixes the previous unscoped .maybeSingle() query, which
// would silently fail (and bounce to login) for ANY multi-clinic patient.
// A real "which clinic am I viewing" switcher is a bigger follow-up
// feature (see Task notes) — for now every clinic-scoped page just shows
// the one most-recent relationship, same as before for the common
// single-clinic case.
export async function requirePatientPortal() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/portal/login");
  }

  const { data: accounts } = await supabase
    .from("patient_portal_accounts")
    .select("id, tenant_id, patient_id, status, channel, contact_value, activated_at, patients(first_name, last_name)")
    .eq("auth_user_id", user!.id)
    .eq("status", "active")
    .order("activated_at", { ascending: false });

  const allAccounts = (accounts as any as PatientPortalAccount[]) ?? [];
  const account = allAccounts[0] ?? null;

  return { supabase, user: user!, account, allAccounts, hasMultipleClinics: allAccounts.length > 1 };
}
