import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

// Shared by every page under the EMR shell (/dashboard/*) once a clinic
// exists: confirms the session, loads the profile + tenant, and bounces
// platform admins to their own panel and not-yet-provisioned customers
// back to /dashboard (which shows the "choose a plan" state). Pages that
// need clinic_admin specifically should use requireClinicAdmin instead.
export async function requireClinicMember() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login?next=/dashboard");
  }

  const { data: profile } = await supabase
    .from("user_profiles")
    .select(
      "id, tenant_id, role, full_name, title, specialty, subspecialty, prc_license, ptr_number, public_directory_enabled, public_bio, public_languages, public_consultation_type, public_consultation_fee_php, public_booking_mode, tenants(name, status)"
    )
    .eq("id", user!.id)
    .maybeSingle();

  if (profile?.role === "platform_admin") {
    redirect("/admin");
  }
  if (!profile?.tenant_id) {
    redirect("/dashboard");
  }

  return { supabase, user: user!, profile, tenant: (profile as any).tenants ?? null };
}
