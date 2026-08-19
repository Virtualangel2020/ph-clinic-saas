import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

// Every /admin page calls this first. It relies on the SAME session-scoped
// Supabase client as the rest of the app (no service-role key anywhere) -
// RLS on user_profiles/tenants/etc. already restricts a non-platform_admin
// to their own tenant, this just also bounces them out of /admin entirely
// so a clinic user never even sees the Super Admin shell.
export async function requireAdmin() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login?next=/admin");
  }

  const { data: profile } = await supabase
    .from("user_profiles")
    .select("id, role, full_name")
    .eq("id", user!.id)
    .single();

  if (!profile || profile.role !== "platform_admin") {
    redirect("/dashboard");
  }

  return { supabase, user: user!, profile };
}
