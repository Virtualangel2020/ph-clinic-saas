import { requirePatientPortal } from "@/lib/require-patient-portal";
import { PortalShell } from "@/components/portal-shell";

// My Prescriptions (spec §15) — read-only view of this patient's own
// prescriptions, the same rows the chart's Prescriptions tab and the
// global Refills queue work from. No dispensing or electronic-pharmacy
// action here — that's the honest "Coming Soon" the global Refills page
// states plainly (Task #65); this page only lets a patient see what's
// been prescribed.
export default async function PortalPrescriptionsPage() {
  const { supabase, account } = await requirePatientPortal();
  const patientId = (account as any).patient_id;

  const { data: prescriptions } = await supabase
    .from("prescriptions")
    .select("id, status, notes, prescribed_at, user_profiles(full_name, title), prescription_items(id, drug_name, dosage, form, frequency, duration, quantity, instructions)")
    .eq("patient_id", patientId)
    .order("prescribed_at", { ascending: false });

  return (
    <PortalShell>
      <h1 style={{ fontSize: 20, marginBottom: 4 }}>My Prescriptions</h1>
      <p style={{ color: "#666", fontSize: 13, marginBottom: 16 }}>
        Prescriptions issued by your AngelClinic provider. Electronic sending to a pharmacy is coming soon — for now,
        please bring a printed or photographed copy when filling a prescription.
      </p>

      <div style={{ display: "grid", gap: 10 }}>
        {(!prescriptions || prescriptions.length === 0) && <p style={{ color: "#999", fontSize: 12.5 }}>No prescriptions on file yet.</p>}
        {(prescriptions as any[])?.map((p) => (
          <div key={p.id} style={{ background: "white", border: "1px solid #eee", borderRadius: 10, padding: "12px 14px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 6 }}>
              <div style={{ fontSize: 12.5, color: "#888" }}>
                {new Date(p.prescribed_at).toLocaleDateString()} ·{" "}
                {p.user_profiles ? `${p.user_profiles.title ? p.user_profiles.title + " " : ""}${p.user_profiles.full_name}` : "—"}
              </div>
              <span style={{ fontSize: 11, fontWeight: 700, background: "#f0f0f0", color: "#555", borderRadius: 999, padding: "3px 10px" }}>{p.status}</span>
            </div>
            <div style={{ marginTop: 8, display: "grid", gap: 4 }}>
              {(p.prescription_items ?? []).map((item: any) => (
                <div key={item.id} style={{ fontSize: 13 }}>
                  <strong>{item.drug_name}</strong> {item.dosage ? `— ${item.dosage}` : ""} {item.form ? `(${item.form})` : ""}
                  <div style={{ color: "#666", fontSize: 12 }}>
                    {[item.frequency, item.duration, item.quantity ? `Qty ${item.quantity}` : null].filter(Boolean).join(" · ")}
                  </div>
                  {item.instructions && <div style={{ color: "#888", fontSize: 11.5 }}>{item.instructions}</div>}
                </div>
              ))}
            </div>
            {p.notes && <div style={{ marginTop: 8, color: "#666", fontSize: 12 }}>{p.notes}</div>}
          </div>
        ))}
      </div>
    </PortalShell>
  );
}
