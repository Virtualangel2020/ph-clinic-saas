import type { SupabaseClient } from "@supabase/supabase-js";
import { todayPh, phDayStart, startOfMonth } from "@/app/dashboard/calendar/date-utils";
import { paymongoMode } from "@/lib/patient-paymongo";

// Data loader for /dashboard/payments — the "make it look/work like a real
// clinic feature" rebuild of what used to be a static Phase 7 placeholder.
// Everything here reads the SAME tables the per-patient Billing tab and the
// Financial dashboard already write to (patient_charges,
// patient_charge_payments, patient_charge_online_payments) — this page adds
// no new write path of its own beyond what startPatientChargeOnlinePaymentAction
// (app/dashboard/patients/actions.ts) already does. See lib/patient-paymongo.ts
// for why PayMongo is currently one shared merchant account across every
// clinic (incl. AngelClinic's own subscription billing) rather than
// per-tenant keys.

export type RecentOnlinePayment = {
  id: string;
  patientId: string;
  patientName: string;
  description: string;
  amountPhp: number;
  status: string; // "pending" | "paid" | "expired" | "failed" (whatever the checkout-session lifecycle uses)
  createdAt: string;
  paidAt: string | null;
  checkoutUrl: string | null;
};

export type PaymentsData = {
  mode: "not_configured" | "test" | "live";
  acceptOnline: boolean;
  today: string;
  collectedOnlineToday: number;
  collectedOnlineThisMonth: number;
  pendingLinksCount: number;
  outstandingTotal: number;
  openChargesCount: number;
  recentPayments: RecentOnlinePayment[];
};

export async function getPaymentsData(supabase: SupabaseClient, tenantId: string): Promise<PaymentsData> {
  const today = todayPh();
  const todayStart = phDayStart(today);
  const monthStart = phDayStart(startOfMonth(today));

  const mode = paymongoMode();

  const [{ data: clinicSettings }, { data: onlinePaymentRows }, { data: openChargeRows }, { data: allPaymentRows }] = await Promise.all([
    supabase.from("clinic_settings").select("accept_online_payments").eq("tenant_id", tenantId).maybeSingle(),
    // Recent activity feed + the today/month collected stats are both
    // derived from this same 60-row pull (newest first) — plenty for a
    // demo/clinic-scale tenant; a heavier clinic can get pagination later.
    supabase
      .from("patient_charge_online_payments")
      .select("id, patient_id, charge_id, amount_php, status, created_at, paid_at, checkout_url, patients(first_name,last_name), patient_charges(description)")
      .eq("tenant_id", tenantId)
      .order("created_at", { ascending: false })
      .limit(60),
    supabase.from("patient_charges").select("patient_id, amount_php, status").eq("tenant_id", tenantId).neq("status", "void"),
    supabase.from("patient_charge_payments").select("patient_id, amount_php").eq("tenant_id", tenantId),
  ]);

  const acceptOnline = clinicSettings?.accept_online_payments ?? false;

  const onlinePayments = ((onlinePaymentRows as any[]) ?? []).map((r) => ({
    id: r.id as string,
    patientId: r.patient_id as string,
    patientName: r.patients ? `${r.patients.last_name}, ${r.patients.first_name}` : "Unknown patient",
    description: r.patient_charges?.description ?? "Payment",
    amountPhp: Number(r.amount_php),
    status: r.status as string,
    createdAt: r.created_at as string,
    paidAt: r.paid_at as string | null,
    checkoutUrl: r.checkout_url as string | null,
  }));

  const collectedOnlineToday = onlinePayments
    .filter((p) => p.status === "paid" && p.paidAt && p.paidAt >= todayStart)
    .reduce((s, p) => s + p.amountPhp, 0);
  const collectedOnlineThisMonth = onlinePayments
    .filter((p) => p.status === "paid" && p.paidAt && p.paidAt >= monthStart)
    .reduce((s, p) => s + p.amountPhp, 0);
  const pendingLinksCount = onlinePayments.filter((p) => p.status === "pending").length;

  // Outstanding balance — clinic-wide, all-time "owed right now" snapshot,
  // same computation as app/dashboard/financials/page.tsx so the two pages
  // never disagree with each other.
  const chargedByPatient = new Map<string, number>();
  for (const c of (openChargeRows as any[]) ?? []) chargedByPatient.set(c.patient_id, (chargedByPatient.get(c.patient_id) ?? 0) + Number(c.amount_php));
  const paidByPatient = new Map<string, number>();
  for (const p of (allPaymentRows as any[]) ?? []) paidByPatient.set(p.patient_id, (paidByPatient.get(p.patient_id) ?? 0) + Number(p.amount_php));
  const outstandingTotal = Array.from(chargedByPatient.entries()).reduce((sum, [pid, charged]) => sum + Math.max(0, charged - (paidByPatient.get(pid) ?? 0)), 0);
  const openChargesCount = ((openChargeRows as any[]) ?? []).filter((c) => c.status === "open").length;

  return {
    mode,
    acceptOnline,
    today,
    collectedOnlineToday,
    collectedOnlineThisMonth,
    pendingLinksCount,
    outstandingTotal,
    openChargesCount,
    recentPayments: onlinePayments.slice(0, 20),
  };
}
