"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireClinicMember } from "@/lib/require-clinic-member";

// Booking writes go through these SECURITY DEFINER RPCs (see migration
// appointments_calendar) — same gateway pattern as the rest of the patient
// chart. Every list/read on the calendar page itself goes straight through
// a plain .from("appointments").select() with RLS as the backstop, same
// convention as /dashboard/patients.

export type AppointmentInput = {
  id: string | null;
  patientId: string;
  providerId: string;
  appointmentTypeId: string;
  startAt: string; // ISO
  endAt: string; // ISO
  notes: string;
};

export async function saveAppointmentAction(input: AppointmentInput) {
  await requireClinicMember();
  const supabase = await createClient();

  if (input.id) {
    const { error } = await supabase.rpc("update_appointment", {
      p_id: input.id,
      p_patient_id: input.patientId,
      p_provider_id: input.providerId || null,
      p_appointment_type_id: input.appointmentTypeId || null,
      p_start_at: input.startAt,
      p_end_at: input.endAt,
      p_notes: input.notes || null,
    });
    if (error) throw new Error(error.message);
  } else {
    const { error } = await supabase.rpc("add_appointment", {
      p_patient_id: input.patientId,
      p_provider_id: input.providerId || null,
      p_appointment_type_id: input.appointmentTypeId || null,
      p_start_at: input.startAt,
      p_end_at: input.endAt,
      p_notes: input.notes || null,
    });
    if (error) throw new Error(error.message);
  }
  revalidatePath("/dashboard/calendar");
}

export async function setAppointmentStatusAction(id: string, status: string, cancelReason?: string) {
  await requireClinicMember();
  const supabase = await createClient();
  const { error } = await supabase.rpc("set_appointment_status", {
    p_id: id,
    p_status: status,
    p_cancel_reason: cancelReason || null,
  });
  if (error) throw new Error(error.message);
  revalidatePath("/dashboard/calendar");
}
