"use server";

import { requireClinicMember } from "@/lib/require-clinic-member";

// Backs the "Collect a Payment" widget on /dashboard/payments — once staff
// pick a patient (search reuses searchPatientsAction from
// app/dashboard/patients/actions.ts, same widget the rest of the app
// already uses), this loads that patient's open charges so staff can send a
// PayMongo payment link for one of them. Sending the link itself reuses
// startPatientChargeOnlinePaymentAction (app/dashboard/patients/actions.ts)
// unchanged — no new payment-creation path, just a new place to reach the
// existing one from.

export type OpenChargeRow = {
  id: string;
  description: string;
  amountPhp: number;
  remainingPhp: number;
  createdAt: string;
};

export async function getPatientOpenChargesAction(patientId: string): Promise<OpenChargeRow[]> {
  const { supabase, profile } = await requireClinicMember();

  const { data: charges, error } = await supabase
    .from("patient_charges")
    .select("id, description, amount_php, status, created_at")
    .eq("tenant_id", profile.tenant_id)
    .eq("patient_id", patientId)
    .eq("status", "open")
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);

  const chargeIds = ((charges as any[]) ?? []).map((c) => c.id);
  const { data: paymentRows } = chargeIds.length
    ? await supabase.from("patient_charge_payments").select("charge_id, amount_php").in("charge_id", chargeIds)
    : { data: [] as any[] };
  const paidByCharge = new Map<string, number>();
  for (const p of (paymentRows as any[]) ?? []) paidByCharge.set(p.charge_id, (paidByCharge.get(p.charge_id) ?? 0) + Number(p.amount_php));

  return ((charges as any[]) ?? [])
    .map((c) => ({
      id: c.id as string,
      description: c.description as string,
      amountPhp: Number(c.amount_php),
      remainingPhp: Number(c.amount_php) - (paidByCharge.get(c.id) ?? 0),
      createdAt: c.created_at as string,
    }))
    .filter((c) => c.remainingPhp > 0);
}
