import { notFound } from "next/navigation";
import Link from "next/link";
import { requireClinicMember } from "@/lib/require-clinic-member";
import { BackLink } from "@/components/back-link";
import { ArchiveButton } from "./archive-button";
import { canViewClinicalContent } from "@/lib/permissions";
import { PatientAlertsBanner } from "./patient-alerts-banner";
import { PatientChartTabs } from "./patient-chart-tabs";
import { getPatientChartData, age } from "@/lib/patients/get-patient-chart-data";

// Standalone patient chart route — the canonical, deep-linkable URL for
// one patient (linked to from Calendar, Encounters, Documents, Records
// Exchange, etc. throughout the app). The master-detail Patients list
// (app/dashboard/patients?patient=...) renders the exact same tabs via the
// exact same data loader (lib/patients/get-patient-chart-data.ts) — this
// page is not a fork of that view, just the other place it's reachable.
export default async function PatientDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { supabase, profile, user } = await requireClinicMember();
  const canViewClinical = await canViewClinicalContent(supabase, user.id, profile.role);

  const data = await getPatientChartData(supabase, profile.tenant_id, id);
  if (!data) notFound();
  const { patient, fullName } = data;

  return (
    <div style={{ maxWidth: 980 }}>
      <BackLink href="/dashboard/patients" label="Patients" />
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 12, marginBottom: 4 }}>
        <div>
          <h1 style={{ fontSize: 22, marginBottom: 2 }}>
            {fullName}
            {!patient.is_active && <span style={{ marginLeft: 10, fontSize: 12, color: "#a12a2a", fontWeight: 600 }}>ARCHIVED</span>}
          </h1>
          <p style={{ color: "#666", fontSize: 13 }}>
            {age(patient.date_of_birth)} y/o {patient.sex} · Born {new Date(patient.date_of_birth).toLocaleDateString()}
            {patient.blood_type ? ` · Blood type ${patient.blood_type}` : ""}
            {patient.patient_code ? ` · ${patient.patient_code}` : ""}
          </p>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <Link
            href={`/dashboard/patients/${patient.id}/edit`}
            style={{ border: "1px solid var(--input-border)", borderRadius: 8, padding: "8px 14px", fontSize: 13, textDecoration: "none", color: "#333" }}
          >
            Edit
          </Link>
          <ArchiveButton patientId={patient.id} isActive={patient.is_active} />
        </div>
      </div>

      <div style={{ marginTop: 14 }}>
        <PatientAlertsBanner patientId={patient.id} alerts={data.alerts} />
      </div>

      {patient.notes && (
        <div style={{ marginTop: 14, background: "#fff7e6", border: "1px solid #e6c66b", borderRadius: 10, padding: "10px 14px", fontSize: 12.5, color: "#7a5c12" }}>
          {patient.notes}
        </div>
      )}

      <div style={{ marginTop: 18 }}>
        <PatientChartTabs data={data} canViewClinical={canViewClinical} />
      </div>
    </div>
  );
}
