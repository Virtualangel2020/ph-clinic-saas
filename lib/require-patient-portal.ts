import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

// Patient-side equivalent of requireClinicMember — confirms the session
// belongs to an ACTIVE patient_portal_accounts row (never a staff
// user_profiles account, even if somehow signed in here) before letting
// anything under /portal/* render.
export async function requirePatientPortal() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/portal/login");
  }

  const { data: account } = await supabase
    .from("patient_portal_accounts")
    .select("id, tenant_id, patient_id, status, channel, contact_value, patients(first_name, last_name)")
    .eq("auth_user_id", user!.id)
    .eq("status", "active")
    .maybeSingle();

  if (!account) {
    redirect("/portal/login");
  }

  return { supabase, user: user!, account: account! };
}
