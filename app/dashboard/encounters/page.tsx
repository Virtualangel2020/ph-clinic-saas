import { requireClinicMember } from "@/lib/require-clinic-member";
import { EncountersClient } from "./encounters-client";
import { todayPh, phDayStart, addDays } from "../calendar/date-utils";

export default async function EncountersPage({ searchParams }: { searchParams: { patient?: string } }) {
  const { supabase, profile } = await requireClinicMember();
  const today = todayPh();

  const [{ data: encounters }, { data: providers }, { data: patients }, { data: appointmentTypes }, { data: todaysAppointments }] = await Promise.all([
    supabase
      .from("encounters")
      .select("id, encounter_date, encounter_type, chief_complaint, status, created_at, patients(id, first_name, last_name), user_profiles(full_name)")
      .eq("tenant_id", profile.tenant_id)
      .order("created_at", { ascending: false })
      .limit(100),
    supabase.from("user_profiles").select("id, full_name, title").eq("tenant_id", profile.tenant_id).eq("role", "doctor").eq("is_active", true).order("full_name"),
    supabase.from("patients").select("id, first_name, middle_name, last_name, mobile_phone").eq("tenant_id", profile.tenant_id).eq("is_active", true).order("last_name").order("first_name"),
    supabase.from("appointment_types").select("id, name").eq("tenant_id", profile.tenant_id).eq("is_active", true).order("sort_order"),
    supabase
      .from("appointments")
      .select("id, patient_id, provider_id, start_at, status, patients(first_name,last_name)")
      .eq("tenant_id", profile.tenant_id)
      .gte("start_at", phDayStart(today))
      .lt("start_at", phDayStart(addDays(today, 1)))
      .in("status", ["scheduled", "confirmed", "checked_in"])
      .order("start_at"),
  ]);

  return (
    <div>
      <h1 style={{ fontSize: 24, marginBottom: 4 }}>Encounters</h1>
      <p style={{ color: "#666", marginBottom: 20, fontSize: 13 }}>
        Every clinical visit — walk in with a patient or start straight from today's appointments. Vitals and SOAP
        notes are documented inside each encounter and also show up on the patient's chart.
      </p>

      <EncountersClient
        encounters={(encounters as any) ?? []}
        providers={(providers as any) ?? []}
        patients={(patients as any) ?? []}
        appointmentTypes={(appointmentTypes as any) ?? []}
        todaysAppointments={(todaysAppointments as any) ?? []}
        prefillPatientId={searchParams.patient ?? null}
      />
    </div>
  );
}
