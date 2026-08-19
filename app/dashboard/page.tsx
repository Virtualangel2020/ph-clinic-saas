import type { Metadata } from "next";
import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { BrandHeader } from "@/components/brand-header";
import { InstallPwaButton } from "@/components/install-pwa-button";

// Overrides the root manifest so /dashboard installs as its own app
// ("Angel Clinic — Staff"), separate from the Super Admin dashboard.
export const metadata: Metadata = {
  manifest: "/api/pwa/staff-manifest",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "AC Staff",
  },
};

// Protected page. Deliberately queries user_profiles and tenants with
// the LOGGED-IN USER'S OWN session (no service-role key anywhere in
// this app) — if tenant isolation is working, this user can only ever
// see their own profile and their own tenant, never another clinic's.
export default async function DashboardPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: profile } = await supabase
    .from("user_profiles")
    .select("full_name, role, tenant_id, tenants(name, status)")
    .eq("id", user!.id)
    .single();

  const { data: entitlements } = await supabase
    .from("tenant_entitlements")
    .select("feature_key, status, features(label)")
    .order("feature_key");

  return (
    <main style={{ maxWidth: 640, margin: "0 auto", padding: "48px 24px" }}>
      <div style={{ marginBottom: 24, display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12 }}>
        <BrandHeader />
        <InstallPwaButton
          label="Install app"
          style={{ borderColor: "#0c1730", color: "#0c1730" }}
        />
      </div>
      <h1 style={{ fontSize: 24 }}>Dashboard</h1>
      <p style={{ color: "#555" }}>Signed in as {user!.email}</p>

      {profile?.role === "platform_admin" && (
        <Link
          href="/admin"
          style={{
            display: "inline-block",
            marginTop: 8,
            padding: "8px 14px",
            borderRadius: 8,
            background: "#0c1730",
            color: "#e6c66b",
            fontWeight: 700,
            fontSize: 13,
            textDecoration: "none",
          }}
        >
          Go to Super Admin →
        </Link>
      )}

      <Link
        href="/dashboard/billing"
        style={{
          display: "inline-block",
          marginTop: 8,
          marginLeft: 8,
          padding: "8px 14px",
          borderRadius: 8,
          background: "white",
          border: "1px solid #0c1730",
          color: "#0c1730",
          fontWeight: 700,
          fontSize: 13,
          textDecoration: "none",
        }}
      >
        Billing & invoices →
      </Link>

      <div style={{ background: "white", border: "1px solid #e2e2e5", borderRadius: 12, padding: 20, marginTop: 24 }}>
        <h2 style={{ fontSize: 16, marginTop: 0 }}>Your profile (RLS-scoped)</h2>
        <pre style={{ fontSize: 13, whiteSpace: "pre-wrap" }}>{JSON.stringify(profile, null, 2)}</pre>
      </div>

      <div style={{ background: "white", border: "1px solid #e2e2e5", borderRadius: 12, padding: 20, marginTop: 16 }}>
        <h2 style={{ fontSize: 16, marginTop: 0 }}>Your tenant's active entitlements</h2>
        <pre style={{ fontSize: 13, whiteSpace: "pre-wrap" }}>{JSON.stringify(entitlements, null, 2)}</pre>
        <p style={{ fontSize: 12, color: "#888" }}>
          Empty until a tenant + subscription exist for you specifically.
        </p>
      </div>
    </main>
  );
}
