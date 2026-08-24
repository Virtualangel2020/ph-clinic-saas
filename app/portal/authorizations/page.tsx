import { requirePatientPortal } from "@/lib/require-patient-portal";
import { PortalShell } from "@/components/portal-shell";

// Records & Authorizations (spec §15) — shows which AngelClinic provider,
// if any, your primary clinic has authorized to view your shared record
// (patient_sharing_preferences, the same table the chart's Patient
// History tab reads/writes). Changing this authorization is a clinic
// front-desk/admin action today (set_sharing_preference /
// revoke_sharing_preference are staff-only RPCs) — this page is
// read-only and says so plainly rather than offering a control that
// doesn't work yet. Reviewing/approving cross-clinic records-exchange
// REQUESTS (a different, not-yet-built workflow) will land here once
// that patient-facing approval flow exists.
export default async function PortalAuthorizationsPage() {
  const { supabase, account } = await requirePatientPortal();
  const patientId = (account as any).patient_id;

  const { data: sharing } = await supabase
    .from("patient_sharing_preferences")
    .select("id, status, authorized_at, revoked_at, user_profiles(full_name, title)")
    .eq("patient_id", patientId)
    .order("authorized_at", { ascending: false });

  const active = (sharing as any[])?.find((s) => s.status === "active");

  return (
    <PortalShell>
      <h1 style={{ fontSize: 20, marginBottom: 4 }}>Records & Authorizations</h1>
      <p style={{ color: "#666", fontSize: 13, marginBottom: 16 }}>
        Which provider your clinic has authorized to view your shared medical record.
      </p>

      <div style={{ background: "white", border: "1px solid #eee", borderRadius: 10, padding: "14px 16px", marginBottom: 16 }}>
        {active ? (
          <div style={{ fontSize: 13.5 }}>
            <strong>
              {active.user_profiles?.title ? active.user_profiles.title + " " : ""}
              {active.user_profiles?.full_name ?? "—"}
            </strong>{" "}
            is currently authorized to view your shared record.
            <div style={{ color: "#888", fontSize: 11.5, marginTop: 4 }}>Since {new Date(active.authorized_at).toLocaleDateString()}</div>
          </div>
        ) : (
          <p style={{ color: "#999", fontSize: 12.5, margin: 0 }}>No provider is currently authorized to view your shared record.</p>
        )}
      </div>

      <div style={{ background: "#f7f7f9", border: "1px dashed #ccc", borderRadius: 10, padding: "12px 16px", color: "#888", fontSize: 12, marginBottom: 20 }}>
        To change who is authorized, please contact your clinic directly. Requesting and approving record sharing
        between different clinics, right here in the portal, is coming in a later update.
      </div>

      {(sharing as any[])?.some((s) => s.status !== "active") && (
        <>
          <h2 style={{ fontSize: 13.5, color: "#888", textTransform: "uppercase", letterSpacing: 0.4, marginBottom: 8 }}>History</h2>
          <div style={{ display: "grid", gap: 6 }}>
            {(sharing as any[])
              .filter((s) => s.status !== "active")
              .map((s) => (
                <div key={s.id} style={{ background: "white", border: "1px solid #eee", borderRadius: 8, padding: "8px 12px", fontSize: 12, color: "#666" }}>
                  {s.user_profiles?.title ? s.user_profiles.title + " " : ""}
                  {s.user_profiles?.full_name ?? "—"} · authorized {new Date(s.authorized_at).toLocaleDateString()}
                  {s.revoked_at ? ` · revoked ${new Date(s.revoked_at).toLocaleDateString()}` : ""}
                </div>
              ))}
          </div>
        </>
      )}
    </PortalShell>
  );
}
