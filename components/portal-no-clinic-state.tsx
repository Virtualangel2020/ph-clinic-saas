import Link from "next/link";

// Shared empty state for every clinic-scoped /portal/* page (Appointments,
// Billing, Results, Files, Prescriptions, Records & Authorizations, Forms,
// My Care, Profile) when the signed-in patient hasn't connected with a
// clinic yet — no patient_portal_accounts row exists for them (see
// requirePatientPortal). Per Angel's explicit fix request: never redirect
// a signed-in patient away from a page just because there's nothing to
// show yet — keep the normal portal nav visible and show one consistent,
// friendly nudge toward the thing that actually creates that connection
// (booking with a provider, or accepting a clinic's access request).
export function PortalNoClinicState({ what }: { what: string }) {
  return (
    <div style={{ background: "white", border: "1px solid #eee", borderRadius: 12, padding: "24px 20px", textAlign: "center" }}>
      <p style={{ fontSize: 13.5, color: "#666", margin: "0 0 16px" }}>
        You're not connected with a clinic yet, so there's no {what} to show. Booking your first appointment — or a clinic
        approving your access request — will connect your account automatically.
      </p>
      <Link
        href="/find-a-doctor"
        style={{ display: "inline-block", background: "var(--brand-primary)", color: "white", borderRadius: 8, padding: "10px 20px", fontWeight: 700, fontSize: 13, textDecoration: "none" }}
      >
        Find a Doctor →
      </Link>
    </div>
  );
}
