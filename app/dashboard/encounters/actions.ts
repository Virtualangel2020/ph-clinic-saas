"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requireClinicMember } from "@/lib/require-clinic-member";

export async function startEncounterAction(input: {
  patientId: string;
  providerId: string;
  appointmentId: string;
  encounterType: string;
  chiefComplaint: string;
}) {
  await requireClinicMember();
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("start_encounter", {
    p_patient_id: input.patientId,
    p_provider_id: input.providerId || null,
    p_appointment_id: input.appointmentId || null,
    p_encounter_type: input.encounterType || null,
    p_chief_complaint: input.chiefComplaint || null,
  });
  if (error) throw new Error(error.message);
  revalidatePath("/dashboard/encounters");
  revalidatePath(`/dashboard/patients/${input.patientId}`);
  redirect(`/dashboard/encounters/${data}`);
}

export async function updateEncounterAction(id: string, patientId: string, providerId: string, encounterType: string, chiefComplaint: string) {
  await requireClinicMember();
  const supabase = await createClient();
  const { error } = await supabase.rpc("update_encounter", {
    p_id: id,
    p_provider_id: providerId || null,
    p_encounter_type: encounterType || null,
    p_chief_complaint: chiefComplaint || null,
  });
  if (error) throw new Error(error.message);
  revalidatePath(`/dashboard/encounters/${id}`);
  revalidatePath(`/dashboard/patients/${patientId}`);
}

export async function setEncounterStatusAction(id: string, patientId: string, status: string) {
  await requireClinicMember();
  const supabase = await createClient();
  const { error } = await supabase.rpc("set_encounter_status", { p_id: id, p_status: status });
  if (error) throw new Error(error.message);
  revalidatePath(`/dashboard/encounters/${id}`);
  revalidatePath("/dashboard/encounters");
  revalidatePath(`/dashboard/patients/${patientId}`);
}
