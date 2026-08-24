"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireClinicMember } from "@/lib/require-clinic-member";

// Lab Orders + Lab Results — every write here is a SECURITY DEFINER RPC
// (see task spec / migration that added lab_orders, lab_order_items,
// lab_results) that re-checks tenant membership itself, same
// RPC-gateway pattern as app/dashboard/patients/actions.ts. This file
// carries no elevated privilege of its own.

export type LabTestInput = { testName: string };

export async function addLabOrderAction(
  patientId: string,
  encounterId: string | null,
  priority: string,
  notes: string,
  tests: LabTestInput[]
): Promise<string> {
  await requireClinicMember();
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("add_lab_order", {
    p_patient_id: patientId,
    p_encounter_id: encounterId || null,
    p_priority: priority || "routine",
    p_notes: notes || null,
    p_tests: tests.filter((t) => t.testName.trim()).map((t) => ({ testName: t.testName.trim() })),
  });
  if (error) throw new Error(error.message);
  revalidatePath("/dashboard/orders");
  revalidatePath(`/dashboard/patients/${patientId}`);
  return data as string;
}

export async function setLabOrderStatusAction(id: string, patientId: string, status: string) {
  await requireClinicMember();
  const supabase = await createClient();
  const { error } = await supabase.rpc("set_lab_order_status", { p_id: id, p_status: status });
  if (error) throw new Error(error.message);
  revalidatePath("/dashboard/orders");
  revalidatePath(`/dashboard/patients/${patientId}`);
}

export async function addLabResultAction(labOrderId: string, patientId: string, resultSummary: string) {
  await requireClinicMember();
  const supabase = await createClient();
  // storage_path stays null for v1 — no "lab-results" Storage bucket exists
  // yet (checked live via the Supabase MCP against storage.buckets), so
  // results are text-only until a migration adds one. See lab-section.tsx.
  const { data, error } = await supabase.rpc("add_lab_result", {
    p_lab_order_id: labOrderId,
    p_result_summary: resultSummary || null,
    p_storage_path: null,
  });
  if (error) throw new Error(error.message);
  revalidatePath("/dashboard/orders");
  revalidatePath("/dashboard/results");
  revalidatePath(`/dashboard/patients/${patientId}`);
  return data as string;
}

export async function markLabResultReviewedAction(id: string, patientId: string) {
  await requireClinicMember();
  const supabase = await createClient();
  const { error } = await supabase.rpc("mark_lab_result_reviewed", { p_id: id });
  if (error) throw new Error(error.message);
  revalidatePath("/dashboard/results");
  revalidatePath(`/dashboard/patients/${patientId}`);
}
