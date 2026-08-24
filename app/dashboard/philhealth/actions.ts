"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireClinicMember } from "@/lib/require-clinic-member";

// PhilHealth (Phase 2). philhealth_number / philhealth_member_type are
// plain columns on patients — set_philhealth follows the same
// SECURITY DEFINER convention as set_patient in
// app/dashboard/patients/actions.ts, just scoped to these two columns.

export type SetPhilhealthInput = {
  patientId: string;
  number: string;
  memberType: string;
  status: "" | "active" | "inactive" | "unknown";
  principalOrDependent: "" | "principal" | "dependent";
  relationshipToPrincipal: string;
};

export async function setPhilhealthAction(input: SetPhilhealthInput) {
  await requireClinicMember();
  const supabase = await createClient();
  const { error } = await supabase.rpc("set_philhealth", {
    p_patient_id: input.patientId,
    p_number: input.number || null,
    p_member_type: input.memberType || null,
    p_status: input.status || null,
    p_principal_or_dependent: input.principalOrDependent || null,
    p_relationship_to_principal: input.relationshipToPrincipal || null,
  });
  if (error) throw new Error(error.message);
  revalidatePath("/dashboard/philhealth");
  revalidatePath(`/dashboard/patients/${input.patientId}`);
}
