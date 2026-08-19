import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

// Same shape as lib/require-admin.ts, but for a CLINIC's own admin (the
// "CLINIC ADMIN" role from Part 63) rather than the platform admin. Used by
// pages under /dashboard/settings that only the clinic's own admin should
// reach — e.g. clinic profile/branding, inviting staff, approving
// signatures/credential changes. RLS on every table these pages touch
// already enforces this server-side; this just keeps the wrong role from
// even seeing the page.
export async function requireClinicAdmin() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login?next=/dashboard/settings");
  }

  const { data: profile } = await supabase
    .from("user_profiles")
    .select("id, tenant_id, role, full_name")
    .eq("id", user!.id)
    .maybeSingle();

  if (!profile?.tenant_id || (profile.role !== "clinic_admin" && profile.role !== "platform_admin")) {
    redirect("/dashboard");
  }

  return { supabase, user: user!, profile };
}
