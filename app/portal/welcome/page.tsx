import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { BrandHeader } from "@/components/brand-header";

// Landing screen right after free patient self-registration (spec Part 3:
// "Welcome to MyCareDesk — [Complete Health Profile] [Find a Doctor]").
// Deliberately outside PortalShell: a brand-new self-registered patient has
// no clinic relationship yet, so none of PortalShell's per-clinic tabs
// (Appointments, Billing, Records, ...) have anything to show until they
// book with — or are added by — a clinic. This page and
// /portal/health-profile are the only two portal pages that work before
// that relationship exists.
export default async function PortalWelcomePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/portal/login");

  const { data: account } = await supabase.rpc("get_my_mycaredesk_account");

  return (
    <main style={{ maxWidth: 480, margin: "70px auto", padding: 24, textAlign: "center" }}>
      <div style={{ marginBottom: 24, display: "flex", justifyContent: "center" }}>
        <BrandHeader />
      </div>
      <h1 style={{ fontSize: 24, marginBottom: 8 }}>Welcome to MyCareDesk{account?.first_name ? `, ${account.first_name}` : ""}!</h1>
      <p style={{ color: "#666", fontSize: 14, marginBottom: 28 }}>
        Your free account is ready. Fill in your Health Profile whenever you have a few minutes, or jump straight to finding a doctor.
      </p>
      <div style={{ display: "grid", gap: 12 }}>
        <Link
          href="/portal/health-profile"
          style={{ display: "block", background: "var(--brand-primary)", color: "white", borderRadius: 10, padding: "14px 20px", fontWeight: 700, fontSize: 14.5, textDecoration: "none" }}
        >
          Complete Health Profile
        </Link>
        <Link
          href="/find-a-doctor"
          style={{ display: "block", background: "white", border: "1px solid #ddd", color: "var(--brand-primary)", borderRadius: 10, padding: "14px 20px", fontWeight: 700, fontSize: 14.5, textDecoration: "none" }}
        >
          Find a Doctor
        </Link>
      </div>
    </main>
  );
}
