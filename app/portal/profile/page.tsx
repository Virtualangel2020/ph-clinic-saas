import { requirePatientPortal } from "@/lib/require-patient-portal";
import { PortalShell } from "@/components/portal-shell";
import { age } from "@/lib/patients/get-patient-chart-data";

// Profile (spec Part 23's simplified nav). The demographics shown here are
// this clinic's own patients row (unchanged, same query the portal Home
// page's "My Info" card already used) — a patient's MyCareDesk platform
// account (name/DOB/mobile at the account level, for patients who have
// one) is edited separately in Health Profile / account setup, since that
// identity is intentionally independent of any one clinic.
export default async function PatientProfilePage() {
  const { supabase, account } = await requirePatientPortal();
  const patientId = (account as any).patient_id;

  const { data: patient } = await supabase
    .from("patients")
    .select("first_name, last_name, middle_name, date_of_birth, sex, mobile_phone, email, patient_code, address_line1, city, province")
    .eq("id", patientId)
    .maybeSingle();

  const fullName = patient ? `${patient.first_name} ${patient.middle_name ? patient.middle_name + " " : ""}${patient.last_name}` : "";

  return (
    <PortalShell patientName={patient?.first_name}>
      <h1 style={{ fontSize: 21, marginBottom: 4 }}>Profile</h1>
      <p style={{ color: "#666", fontSize: 13, marginBottom: 20 }}>Your information on file at this clinic.</p>

      <div style={{ background: "white", border: "1px solid #eee", borderRadius: 12, padding: 18, marginBottom: 12 }}>
        {patient ? (
          <div style={{ fontSize: 13.5, lineHeight: 1.9 }}>
            <div>
              <strong>{fullName}</strong>
            </div>
            <div style={{ color: "#666" }}>
              {patient.sex} · {age(patient.date_of_birth)}y · {new Date(patient.date_of_birth).toLocaleDateString()}
            </div>
            <div style={{ color: "#666" }}>{patient.mobile_phone ?? "No mobile on file"}</div>
            <div style={{ color: "#666" }}>{patient.email ?? "No email on file"}</div>
            {(patient.address_line1 || patient.city) && (
              <div style={{ color: "#666" }}>{[patient.address_line1, patient.city, patient.province].filter(Boolean).join(", ")}</div>
            )}
            <div style={{ color: "#999", fontSize: 11.5, marginTop: 6 }}>Patient ID {patient.patient_code ?? "—"}</div>
          </div>
        ) : (
          <p style={{ color: "#999", fontSize: 12.5 }}>We couldn't load your profile — please contact your clinic.</p>
        )}
        <p style={{ fontSize: 11.5, color: "#aaa", marginTop: 12 }}>To update your contact details, please contact your clinic directly.</p>
      </div>

      <a
        href="/portal/billing"
        style={{ display: "block", background: "white", border: "1px solid #eee", borderRadius: 10, padding: "12px 14px", fontSize: 12.5, fontWeight: 600, color: "#333", textDecoration: "none", marginBottom: 8 }}
      >
        My Billing →
      </a>
      <a
        href="/portal/health-profile"
        style={{ display: "block", background: "white", border: "1px solid #eee", borderRadius: 10, padding: "12px 14px", fontSize: 12.5, fontWeight: 600, color: "#333", textDecoration: "none" }}
      >
        My MyCareDesk Account & Health Info →
      </a>
    </PortalShell>
  );
}
