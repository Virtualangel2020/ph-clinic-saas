import { notFound } from "next/navigation";
import { requireClinicMember } from "@/lib/require-clinic-member";
import { BackLink } from "@/components/back-link";
import { PatientForm } from "../../patient-form";

export default async function EditPatientPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { supabase, profile } = await requireClinicMember();

  const { data: patient } = await supabase.from("patients").select("*").eq("id", id).eq("tenant_id", profile.tenant_id).maybeSingle();
  if (!patient) notFound();

  return (
    <div>
      <BackLink href={`/dashboard/patients/${id}`} label="Patient" />
      <h1 style={{ fontSize: 22, marginBottom: 16 }}>Edit Patient</h1>
      <PatientForm patient={patient as any} />
    </div>
  );
}
