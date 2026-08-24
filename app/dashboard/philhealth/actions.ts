"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireClinicMember } from "@/lib/require-clinic-member";

// PhilHealth (Phase 2). philhealth_number / philhealth_member_type are
// plain columns on patients — set_philhealth follows the same
// SECURITY DEFINER convention as set_patient in
// app/dashboard/patients/actions.ts, just scoped to these two columns.

export async function setPhilhealthAction(patientId: string, number: string, memberType: string) {
  await requireClinicMember();
  const supabase = await createClient();
  const { error } = await supabase.rpc("set_philhealth", {
    p_patient_id: patientId,
    p_number: number || null,
    p_member_type: memberType || null,
  });
  if (error) throw new Error(error.message);
  revalidatePath("/dashboard/philhealth");
  revalidatePath(`/dashboard/patients/${patientId}`);
}
