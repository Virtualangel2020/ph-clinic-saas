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

export type RenewalInput = {
  renewalType: "one_time" | "renewable";
  refillCount: string; // "" = not tracked
  refillDueAt: string; // "" = none
  reminderDaysBefore: string; // "" = default
  startDate: string;
  endDate: string;
};

export async function addPrescriptionAction(
  patientId: string,
  encounterId: string | null,
  notes: string,
  items: PrescriptionItemInput[],
  renewal?: RenewalInput
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
    p_renewal_type: renewal?.renewalType || "one_time",
    p_refill_count: renewal?.refillCount ? Number(renewal.refillCount) : null,
    p_refill_due_at: renewal?.refillDueAt || null,
    p_reminder_days_before: renewal?.reminderDaysBefore ? Number(renewal.reminderDaysBefore) : null,
    p_start_date: renewal?.startDate || null,
    p_end_date: renewal?.endDate || null,
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

// Refills queue (spec §25) — recording a refill against a renewable
// prescription. Same prescriptions row the chart's Prescriptions section
// shows; this just advances refill_count/refill_due_at.
export async function recordPrescriptionRefillAction(id: string, patientId: string, nextDueAt: string) {
  await requireClinicMember();
  const supabase = await createClient();
  const { error } = await supabase.rpc("record_prescription_refill", { p_id: id, p_next_due_at: nextDueAt });
  if (error) throw new Error(error.message);
  revalidatePath("/dashboard/prescriptions");
  revalidatePath(`/dashboard/patients/${patientId}`);
}
