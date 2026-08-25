import { notFound } from "next/navigation";
import { requireClinicMember } from "@/lib/require-clinic-member";
import { BackLink } from "@/components/back-link";
import { StaffThread } from "./staff-thread";

export default async function PatientMessageThreadPage({ params }: { params: Promise<{ patientId: string }> }) {
  const { patientId } = await params;
  const { supabase, profile } = await requireClinicMember();

  const { data: patient } = await supabase.from("patients").select("id, first_name, last_name").eq("id", patientId).eq("tenant_id", profile.tenant_id).maybeSingle();
  if (!patient) notFound();

  const { data: messages } = await supabase
    .from("provider_patient_messages")
    .select("id, sender_type, sender_name, body, created_at, read_at")
    .eq("provider_id", profile.id)
    .eq("patient_id", patientId)
    .order("created_at", { ascending: true });

  const { data: settingsRow } = await supabase.from("provider_patient_access_settings").select("messaging_enabled").eq("provider_id", profile.id).maybeSingle();
  const { data: clinicRow } = await supabase.from("clinic_settings").select("default_messaging_enabled").eq("tenant_id", profile.tenant_id).maybeSingle();
  const messagingEnabled = settingsRow?.messaging_enabled ?? clinicRow?.default_messaging_enabled ?? false;

  return (
    <div style={{ maxWidth: 720 }}>
      <BackLink href="/dashboard/patient-portal" label="Patient Messages" />
      <h1 style={{ fontSize: 22, marginBottom: 4 }}>
        {patient.first_name} {patient.last_name}
      </h1>
      <p style={{ color: "#666", fontSize: 13, marginBottom: 20 }}>Message thread</p>

      <StaffThread patientId={patientId} initialMessages={(messages as any[]) ?? []} messagingEnabled={messagingEnabled} />
    </div>
  );
}
