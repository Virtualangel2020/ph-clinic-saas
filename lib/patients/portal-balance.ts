// Shared "what does this patient owe" calculation — previously duplicated
// identically in app/portal/page.tsx and app/portal/billing/page.tsx (spec
// Part 33/Design #6: "same data everywhere," no drift between the two
// places a patient's balance is shown). Both read the exact same
// patient_charges / patient_charge_payments rows the clinic's own Billing
// tab uses, via the existing portal-read RLS policies — this file only
// centralizes the arithmetic, it doesn't change what's queried.

export type PortalCharge = {
  id: string;
  description: string;
  amount_php: number;
  bill_type: string | null;
  status: string;
  created_at: string;
  paidPhp: number;
  remainingPhp: number;
  isOpen: boolean;
};

export type PortalPayment = {
  id: string;
  charge_id: string | null;
  amount_php: number;
  method: string;
  reference: string | null;
  paid_at: string;
};

export type PortalBalanceSummary = {
  totalCharged: number;
  totalPaid: number;
  balance: number;
  charges: PortalCharge[];
  payments: PortalPayment[];
};

// `supabase` is typed loosely (any) to avoid importing the generated
// Database type into this shared helper — every call site already has a
// properly-typed client of its own.
export async function getPortalBalanceSummary(supabase: any, patientId: string): Promise<PortalBalanceSummary> {
  const [{ data: chargesRaw }, { data: paymentsRaw }] = await Promise.all([
    supabase
      .from("patient_charges")
      .select("id, description, amount_php, bill_type, status, created_at")
      .eq("patient_id", patientId)
      .order("created_at", { ascending: false }),
    supabase
      .from("patient_charge_payments")
      .select("id, charge_id, amount_php, method, reference, paid_at")
      .eq("patient_id", patientId)
      .order("paid_at", { ascending: false }),
  ]);

  const payments: PortalPayment[] = ((paymentsRaw as any[]) ?? []).map((p) => ({ ...p, amount_php: Number(p.amount_php) }));
  const paidByCharge = new Map<string, number>();
  for (const p of payments) {
    if (!p.charge_id) continue;
    paidByCharge.set(p.charge_id, (paidByCharge.get(p.charge_id) ?? 0) + p.amount_php);
  }

  const charges: PortalCharge[] = ((chargesRaw as any[]) ?? []).map((c) => {
    const amount_php = Number(c.amount_php);
    const paidPhp = paidByCharge.get(c.id) ?? 0;
    const remainingPhp = Math.max(0, amount_php - paidPhp);
    return { ...c, amount_php, paidPhp, remainingPhp, isOpen: c.status !== "void" && remainingPhp > 0 };
  });

  const totalCharged = charges.filter((c) => c.status !== "void").reduce((sum, c) => sum + c.amount_php, 0);
  const totalPaid = payments.reduce((sum, p) => sum + p.amount_php, 0);
  const balance = Math.max(0, totalCharged - totalPaid);

  return { totalCharged, totalPaid, balance, charges, payments };
}

export function pesoLabel(n: number): string {
  return `₱${n.toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}
