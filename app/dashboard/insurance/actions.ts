"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireClinicMember } from "@/lib/require-clinic-member";

// Insurance / HMO (Phase 2). Every write here just calls a SECURITY
// DEFINER Postgres function that re-checks tenant membership itself —
// same pattern as app/dashboard/patients/actions.ts. RLS on
// patient_insurance only grants SELECT, so writes have to go through
// these RPCs.

export async function addPatientInsuranceAction(
  patientId: string,
  providerName: string,
  memberNumber: string,
  planName: string,
  effectiveDate: string,
  expiryDate: string
) {
  await requireClinicMember();
  const supabase = await createClient();
  const { error } = await supabase.rpc("add_patient_insurance", {
    p_patient_id: patientId,
    p_provider_name: providerName,
    p_member_number: memberNumber || null,
    p_plan_name: planName || null,
    p_effective_date: effectiveDate || null,
    p_expiry_date: expiryDate || null,
  });
  if (error) throw new Error(error.message);
  revalidatePath("/dashboard/insurance");
  revalidatePath(`/dashboard/patients/${patientId}`);
}

export async function setPatientInsuranceStatusAction(id: string, patientId: string, status: string) {
  await requireClinicMember();
  const supabase = await createClient();
  const { error } = await supabase.rpc("set_patient_insurance_status", { p_id: id, p_status: status });
  if (error) throw new Error(error.message);
  revalidatePath("/dashboard/insurance");
  revalidatePath(`/dashboard/patients/${patientId}`);
}
