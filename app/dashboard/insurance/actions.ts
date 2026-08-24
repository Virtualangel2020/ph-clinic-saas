"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireClinicMember } from "@/lib/require-clinic-member";

// Insurance / HMO (Phase 2). Every write here just calls a SECURITY
// DEFINER Postgres function that re-checks tenant membership itself —
// same pattern as app/dashboard/patients/actions.ts. RLS on
// patient_insurance only grants SELECT, so writes have to go through
// these RPCs.

export type AddInsuranceInput = {
  patientId: string;
  providerName: string;
  memberNumber: string;
  planName: string;
  effectiveDate: string;
  expiryDate: string;
  isPrimary: boolean;
  principalOrDependent: "" | "principal" | "dependent";
  relationshipToPrincipal: string;
};

export async function addPatientInsuranceAction(input: AddInsuranceInput) {
  await requireClinicMember();
  const supabase = await createClient();
  const { error } = await supabase.rpc("add_patient_insurance", {
    p_patient_id: input.patientId,
    p_provider_name: input.providerName,
    p_member_number: input.memberNumber || null,
    p_plan_name: input.planName || null,
    p_effective_date: input.effectiveDate || null,
    p_expiry_date: input.expiryDate || null,
    p_is_primary: input.isPrimary,
    p_principal_or_dependent: input.principalOrDependent || null,
    p_relationship_to_principal: input.relationshipToPrincipal || null,
  });
  if (error) throw new Error(error.message);
  revalidatePath("/dashboard/insurance");
  revalidatePath(`/dashboard/patients/${input.patientId}`);
}

export async function setPatientInsuranceStatusAction(id: string, patientId: string, status: string) {
  await requireClinicMember();
  const supabase = await createClient();
  const { error } = await supabase.rpc("set_patient_insurance_status", { p_id: id, p_status: status });
  if (error) throw new Error(error.message);
  revalidatePath("/dashboard/insurance");
  revalidatePath(`/dashboard/patients/${patientId}`);
}

export async function setPatientInsurancePrimaryAction(id: string, patientId: string, isPrimary: boolean) {
  await requireClinicMember();
  const supabase = await createClient();
  const { error } = await supabase.rpc("set_patient_insurance_primary", { p_id: id, p_patient_id: patientId, p_is_primary: isPrimary });
  if (error) throw new Error(error.message);
  revalidatePath("/dashboard/insurance");
  revalidatePath(`/dashboard/patients/${patientId}`);
}

export async function setPatientPaymentTypeAction(patientId: string, paymentType: string) {
  await requireClinicMember();
  const supabase = await createClient();
  const { error } = await supabase.rpc("set_patient_payment_type", { p_patient_id: patientId, p_payment_type: paymentType });
  if (error) throw new Error(error.message);
  revalidatePath("/dashboard/insurance");
  revalidatePath(`/dashboard/patients/${patientId}`);
}
