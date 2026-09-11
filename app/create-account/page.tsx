import Link from "next/link";
import { BrandHeader } from "@/components/brand-header";
import { createClient } from "@/lib/supabase/server";
import { getMaintenanceStatus } from "@/lib/maintenance";
import { MaintenanceNotice } from "@/components/maintenance-notice";

// The account-type chooser MyCareDesk's patient-side spec calls for
// ("How would you like to use MyCareDesk?"). Deliberately a NEW, separate
// page rather than a rework of /signup: /signup is the existing clinic
// self-serve signup funnel (create-account-first, pay-to-unlock a new
// clinic) and nothing there changes — this page just sits in front as an
// additional, optional entry point so a patient arriving fresh doesn't
// have to guess that "Sign up" means "buy a clinic subscription."
export default async function CreateAccountPage() {
  // Angel: "do not allow anybody to create an account or login" during a
  // system update — this is the front door to both signup flows, so show
  // the notice here too instead of only on the pages it links to.
  const supabase = await createClient();
  const { isEnabled, message } = await getMaintenanceStatus(supabase);
  if (isEnabled) return <MaintenanceNotice message={message} />;

  return (
    <main style={{ maxWidth: 480, margin: "70px auto", padding: 24 }}>
      <div style={{ marginBottom: 28 }}>
        <BrandHeader />
      </div>
      <h1 style={{ fontSize: 22, marginBottom: 6 }}>How would you like to use MyCareDesk?</h1>
      <p style={{ color: "#666", fontSize: 13.5, marginBottom: 24 }}>Pick the option that matches what you need — you can always sign in a different way later.</p>

      <div style={{ display: "grid", gap: 14 }}>
        <Link href="/patient-signup" style={choiceCard}>
          <div style={{ fontSize: 15.5, fontWeight: 700, color: "var(--brand-primary)" }}>I'm a Patient</div>
          <div style={{ fontSize: 12.5, color: "#666", marginTop: 4 }}>
            Create a free MyCareDesk account to find doctors, book appointments, and see your records.
          </div>
        </Link>
        <Link href="/signup" style={choiceCard}>
          <div style={{ fontSize: 15.5, fontWeight: 700, color: "var(--brand-primary)" }}>I'm a Healthcare Provider</div>
          <div style={{ fontSize: 12.5, color: "#666", marginTop: 4 }}>
            Set up MyCareDesk for your clinic — choose a plan and get your team's workspace running.
          </div>
        </Link>
      </div>

      <p style={{ fontSize: 12.5, color: "#999", marginTop: 22 }}>
        Already have an account? <Link href="/login" style={{ color: "var(--brand-primary)" }}>Clinic staff sign in</Link> ·{" "}
        <Link href="/portal/login" style={{ color: "var(--brand-primary)" }}>Patient sign in</Link>
      </p>
    </main>
  );
}

const choiceCard: React.CSSProperties = {
  display: "block",
  border: "1px solid #ddd",
  borderRadius: 12,
  padding: "18px 20px",
  textDecoration: "none",
  background: "white",
};
