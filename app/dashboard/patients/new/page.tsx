import { requireClinicMember } from "@/lib/require-clinic-member";
import { BackLink } from "@/components/back-link";
import { PatientForm } from "../patient-form";

export default async function NewPatientPage() {
  await requireClinicMember();
  return (
    <div>
      <BackLink href="/dashboard/patients" label="Patients" />
      <h1 style={{ fontSize: 22, marginBottom: 16 }}>Add Patient</h1>
      <PatientForm patient={null} />
    </div>
  );
}
