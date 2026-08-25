"use server";

import { revalidatePath } from "next/cache";
import { requireClinicMember } from "@/lib/require-clinic-member";

export async function sendPatientMessageAction(patientId: string, body: string) {
  const { supabase } = await requireClinicMember();
  const { error } = await supabase.rpc("staff_send_patient_message", { p_patient_id: patientId, p_body: body });
  if (error) throw new Error(error.message);
  revalidatePath(`/dashboard/patient-portal/${patientId}`);
  revalidatePath("/dashboard/patient-portal");
}

export async function markPatientThreadReadAction(patientId: string) {
  const { supabase } = await requireClinicMember();
  const { error } = await supabase.rpc("staff_mark_patient_thread_read", { p_patient_id: patientId });
  if (error) throw new Error(error.message);
}
