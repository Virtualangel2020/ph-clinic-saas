import { notFound } from "next/navigation";
import Link from "next/link";
import { requireClinicMember } from "@/lib/require-clinic-member";
import { canViewClinicalContent } from "@/lib/permissions";
import { PatientAlertsBanner } from "./[id]/patient-alerts-banner";
import { PatientChartTabs } from "./[id]/patient-chart-tabs";
import { ArchiveButton } from "./[id]/archive-button";
import { getPatientChartData, age } from "@/lib/patients/get-patient-chart-data";

// Right-pane chart for the master-detail Patients list. Same data loader,
// same tab component as the standalone /dashboard/patients/[id] route —
// selecting a patient here never re-fetches or duplicates anything, it's
// the identical chart in a different frame. A small "Full chart" link
// still points at the standalone route for deep-linking/bookmarking one
// patient directly.
export async function PatientChartPane({ patientId }: { patientId: string }) {
  const { supabase, profile, user } = await requireClinicMember();
  const canViewClinical = await canViewClinicalContent(supabase, user.id, profile.role);

  const data = await getPatientChartData(supabase, profile.tenant_id, patientId);
  if (!data) notFound();
  const { patient, fullName } = data;

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 12, marginBottom: 4 }}>
        <div>
          <h1 style={{ fontSize: 20, marginBottom: 2 }}>
            {fullName}
            {!patient.is_active && <span style={{ marginLeft: 10, fontSize: 12, color: "#a12a2a", fontWeight: 600 }}>ARCHIVED</span>}
          </h1>
          <p style={{ color: "#666", fontSize: 12.5 }}>
            {age(patient.date_of_birth)} y/o {patient.sex} · Born {new Date(patient.date_of_birth).toLocaleDateString()}
            {patient.patient_code ? ` · ${patient.patient_code}` : ""}
          </p>
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <Link href={`/dashboard/patients/${patient.id}`} style={{ fontSize: 12, color: "#666", textDecoration: "none" }}>
            Open full page ↗
          </Link>
          <Link
            href={`/dashboard/patients/${patient.id}/edit`}
            style={{ border: "1px solid var(--input-border)", borderRadius: 8, padding: "7px 12px", fontSize: 12.5, textDecoration: "none", color: "#333" }}
          >
            Edit
          </Link>
          <ArchiveButton patientId={patient.id} isActive={patient.is_active} />
        </div>
      </div>

      <div style={{ marginTop: 12 }}>
        <PatientAlertsBanner patientId={patient.id} alerts={data.alerts} />
      </div>

      {patient.notes && (
        <div style={{ marginTop: 12, background: "#fff7e6", border: "1px solid #e6c66b", borderRadius: 10, padding: "10px 14px", fontSize: 12.5, color: "#7a5c12" }}>
          {patient.notes}
        </div>
      )}

      <div style={{ marginTop: 16 }}>
        <PatientChartTabs data={data} canViewClinical={canViewClinical} />
      </div>
    </div>
  );
}
