"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireClinicMember } from "@/lib/require-clinic-member";

// Prescriptions module. Every write here just calls a SECURITY DEFINER
// Postgres RPC (add_prescription / set_prescription_status) that re-checks
// tenant membership itself — this file carries no elevated privilege of
// its own, same pattern as app/dashboard/patients/actions.ts.

export type PrescriptionItemInput = {
  drugName: string;
  dosage: string;
  form: string;
  frequency: string;
  duration: string;
  quantity: string;
  instructions: string;
};

export async function addPrescriptionAction(
  patientId: string,
  encounterId: string | null,
  notes: string,
  items: PrescriptionItemInput[]
): Promise<string> {
  await requireClinicMember();
  const supabase = await createClient();

  const p_items = items
    .filter((i) => i.drugName.trim())
    .map((i) => ({
      drugName: i.drugName,
      dosage: i.dosage || null,
      form: i.form || null,
      frequency: i.frequency || null,
      duration: i.duration || null,
      quantity: i.quantity || null,
      instructions: i.instructions || null,
    }));

  const { data, error } = await supabase.rpc("add_prescription", {
    p_patient_id: patientId,
    p_encounter_id: encounterId || null,
    p_notes: notes || null,
    p_items,
  });
  if (error) throw new Error(error.message);
  revalidatePath("/dashboard/prescriptions");
  revalidatePath(`/dashboard/patients/${patientId}`);
  return data as string;
}

export async function setPrescriptionStatusAction(id: string, patientId: string, status: string) {
  await requireClinicMember();
  const supabase = await createClient();
  const { error } = await supabase.rpc("set_prescription_status", { p_id: id, p_status: status });
  if (error) throw new Error(error.message);
  revalidatePath("/dashboard/prescriptions");
  revalidatePath(`/dashboard/patients/${patientId}`);
}
