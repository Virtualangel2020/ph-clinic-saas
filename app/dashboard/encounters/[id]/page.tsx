import { notFound } from "next/navigation";
import Link from "next/link";
import { requireClinicMember } from "@/lib/require-clinic-member";
import { BackLink } from "@/components/back-link";
import { ProgressNotesSection } from "../../patients/[id]/progress-notes-section";
import { EncounterHeader } from "./encounter-header";

export default async function EncounterDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { supabase, profile } = await requireClinicMember();

  const { data: encounter } = await supabase
    .from("encounters")
    .select("id, patient_id, provider_id, appointment_id, encounter_date, encounter_type, chief_complaint, status, created_at, patients(id, first_name, last_name), user_profiles(full_name)")
    .eq("id", id)
    .eq("tenant_id", profile.tenant_id)
    .maybeSingle();

  if (!encounter) notFound();

  const [{ data: notes }, { data: providers }, { data: appointmentTypes }] = await Promise.all([
    supabase
      .from("patient_progress_notes")
      .select("id, note_date, chief_complaint, subjective, objective, assessment, plan, bp_systolic, bp_diastolic, pulse_rate, respiratory_rate, oxygen_saturation, temperature_c, weight_kg, height_cm, created_at, user_profiles(full_name)")
      .eq("encounter_id", id)
      .order("created_at", { ascending: false }),
    supabase.from("user_profiles").select("id, full_name, title").eq("tenant_id", profile.tenant_id).eq("role", "doctor").eq("is_active", true).order("full_name"),
    supabase.from("appointment_types").select("id, name").eq("tenant_id", profile.tenant_id).eq("is_active", true).order("sort_order"),
  ]);

  const patient = (encounter as any).patients;

  return (
    <div style={{ maxWidth: 820 }}>
      <BackLink href="/dashboard/encounters" label="Encounters" />

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 12, marginBottom: 4 }}>
        <div>
          <h1 style={{ fontSize: 22, marginBottom: 2 }}>
            {patient ? (
              <Link href={`/dashboard/patients/${patient.id}`} style={{ color: "#0c1730", textDecoration: "none" }}>
                {patient.last_name}, {patient.first_name}
              </Link>
            ) : (
              "Unknown patient"
            )}
          </h1>
          <p style={{ color: "#666", fontSize: 13 }}>
            {new Date(encounter.encounter_date).toLocaleDateString()}
            {encounter.appointment_id && (
              <>
                {" · "}
                <Link href="/dashboard/calendar" style={{ color: "#0c1730" }}>
                  from a booked appointment
                </Link>
              </>
            )}
          </p>
        </div>
      </div>

      <EncounterHeader
        encounterId={encounter.id}
        patientId={encounter.patient_id}
        status={encounter.status}
        providerId={encounter.provider_id}
        encounterType={encounter.encounter_type}
        chiefComplaint={encounter.chief_complaint}
        providers={(providers as any) ?? []}
        appointmentTypes={(appointmentTypes as any) ?? []}
      />

      <ProgressNotesSection patientId={encounter.patient_id} notes={(notes as any) ?? []} encounterId={encounter.id} />
    </div>
  );
}
