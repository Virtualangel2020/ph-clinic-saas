import { createClient } from "@/lib/supabase/server";
import { EmrShell } from "@/components/emr/emr-shell";

// Wraps every /dashboard/* page. Individual pages still do their own
// auth/role/tenant redirects (see lib/require-clinic-member.ts,
// lib/require-clinic-admin.ts) — this layout only decides whether to draw
// the fixed nav + jellybean chrome (Part 2/3) around whatever they render.
// A signed-out visitor or a customer who hasn't purchased yet gets the
// page's own plain layout instead — the EMR shell is for an activated
// clinic, not the pre-purchase "choose a plan" screen.
export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return <>{children}</>;
  }

  const { data: profile } = await supabase
    .from("user_profiles")
    .select("full_name, role, tenant_id, tenants(name)")
    .eq("id", user.id)
    .maybeSingle();

  if (!profile?.tenant_id || profile.role === "platform_admin") {
    return <>{children}</>;
  }

  const { data: entitlements } = await supabase
    .from("tenant_entitlements")
    .select("feature_key")
    .eq("status", "active")
    .eq("source", "addon");

  // Jellybean counts: every underlying queue (referrals, messages, alerts,
  // etc.) ships in a later phase — these are honestly 0 today, not
  // placeholder fake numbers, and each will start querying its real table
  // the moment that module lands.
  const jellybeanCounts = { R: 0, M: 0, P: 0, T: 0, A: 0, D: 0 };

  return (
    <EmrShell
      clinicName={(profile as any).tenants?.name ?? "Your clinic"}
      userLabel={profile.full_name || user.email || ""}
      enabledAddonKeys={(entitlements ?? []).map((e) => e.feature_key)}
      jellybeanCounts={jellybeanCounts}
    >
      {children}
    </EmrShell>
  );
}
