import { requirePatientPortal } from "@/lib/require-patient-portal";
import { BrandHeader } from "@/components/brand-header";
import { SignOutButton } from "./sign-out-button";

// Placeholder home — the login/identity foundation is real (this page is
// genuinely gated by an active portal account), but the actual features
// promised in the Records Exchange spec — reviewing/authorizing record
// requests, viewing shared records — aren't built yet. Ships next.
export default async function PortalHomePage() {
  const { account } = await requirePatientPortal();
  const patient = (account as any).patients;

  return (
    <main style={{ maxWidth: 480, margin: "60px auto", padding: 24 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
        <BrandHeader />
        <SignOutButton />
      </div>
      <h1 style={{ fontSize: 22 }}>Welcome{patient ? `, ${patient.first_name}` : ""}</h1>
      <p style={{ color: "#666", fontSize: 13.5, marginTop: 10 }}>
        Your Patient Portal login is active. Reviewing and authorizing record requests between your clinics, and
        viewing what's been shared, is coming soon here.
      </p>
      <div style={{ marginTop: 20, background: "#f7f7f9", border: "1px dashed #ccc", borderRadius: 10, padding: 16, color: "#888", fontSize: 12.5 }}>
        Nothing to review yet — you'll see requests here once your clinic starts using Records Exchange.
      </div>
    </main>
  );
}
