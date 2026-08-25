import { requirePatientPortal } from "@/lib/require-patient-portal";
import { PortalShell } from "@/components/portal-shell";
import { paymongoMode } from "@/lib/patient-paymongo";
import { PayNowButton } from "./pay-now-button";

const METHOD_LABEL: Record<string, string> = {
  cash: "Cash",
  hmo: "HMO",
  philhealth: "PhilHealth",
  yakap: "YAKAP",
  paymongo: "PayMongo (Online)",
  other: "Other",
};

function peso(n: number) {
  return `₱${n.toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

// My Billing (spec §16, §38-40) — the SAME patient_charges /
// patient_charge_payments rows the clinic's own Billing tab reads (portal
// read RLS), plus "Pay Now" for any open charge once the clinic has
// turned online payments on. Never shows Paid until the verified webhook
// records it — this page just displays whatever's actually in the ledger.
export default async function PortalBillingPage() {
  const { supabase, account } = await requirePatientPortal();
  const patientId = (account as any).patient_id;
  const tenantId = (account as any).tenant_id;

  const [{ data: chargesRaw }, { data: paymentsRaw }, { data: clinicSettings }] = await Promise.all([
    supabase.from("patient_charges").select("id, description, amount_php, bill_type, status, created_at").eq("patient_id", patientId).order("created_at", { ascending: false }),
    supabase.from("patient_charge_payments").select("id, charge_id, amount_php, method, reference, paid_at").eq("patient_id", patientId).order("paid_at", { ascending: false }),
    supabase.from("clinic_settings").select("accept_online_payments, clinic_name").eq("tenant_id", tenantId).maybeSingle(),
  ]);

  const charges = ((chargesRaw as any[]) ?? []).map((c) => ({ ...c, amount_php: Number(c.amount_php) }));
  const payments = ((paymentsRaw as any[]) ?? []).map((p) => ({ ...p, amount_php: Number(p.amount_php) }));
  const paidByCharge = new Map<string, number>();
  for (const p of payments) {
    if (!p.charge_id) continue;
    paidByCharge.set(p.charge_id, (paidByCharge.get(p.charge_id) ?? 0) + p.amount_php);
  }

  const totalCharged = charges.filter((c) => c.status !== "void").reduce((sum, c) => sum + c.amount_php, 0);
  const totalPaid = payments.reduce((sum, p) => sum + p.amount_php, 0);
  const balance = Math.max(0, totalCharged - totalPaid);

  const mode = paymongoMode();
  const onlinePaymentsAvailable = !!clinicSettings?.accept_online_payments && mode !== "not_configured";
  const openCharges = charges.filter((c) => c.status !== "void" && (paidByCharge.get(c.id) ?? 0) < c.amount_php);

  return (
    <PortalShell>
      <h1 style={{ fontSize: 20, marginBottom: 4 }}>My Billing</h1>
      <p style={{ color: "#666", fontSize: 13, marginBottom: 16 }}>Charges and payments from {clinicSettings?.clinic_name ?? "your clinic"}.</p>

      {onlinePaymentsAvailable && mode === "test" && (
        <div style={{ background: "#fff7e6", border: "1px solid #e6c66b", borderRadius: 10, padding: "10px 14px", marginBottom: 16, fontSize: 12.5, color: "#7a5c12", fontWeight: 600 }}>
          🧪 PAYMONGO TEST MODE — no real charge will be made. Payments made here use PayMongo&apos;s test environment only.
        </div>
      )}

      <div style={{ background: "white", border: "1px solid #eee", borderRadius: 12, padding: 18, marginBottom: 20 }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: "#888", textTransform: "uppercase", letterSpacing: 0.4 }}>Balance</div>
        <div style={{ fontSize: 26, fontWeight: 700, color: balance > 0 ? "#a12a2a" : "#1a7f37", marginTop: 2 }}>{peso(balance)}</div>
        <div style={{ display: "flex", gap: 18, fontSize: 12.5, color: "#666", marginTop: 10 }}>
          <div>
            Total charged
            <div style={{ fontWeight: 700, color: "var(--text-heading)" }}>{peso(totalCharged)}</div>
          </div>
          <div>
            Total paid
            <div style={{ fontWeight: 700, color: "var(--text-heading)" }}>{peso(totalPaid)}</div>
          </div>
        </div>
      </div>

      <h2 style={{ fontSize: 13.5, color: "#888", textTransform: "uppercase", letterSpacing: 0.4, marginBottom: 8 }}>Charges</h2>
      {charges.length === 0 ? (
        <p style={{ color: "#999", fontSize: 12.5 }}>No charges on file.</p>
      ) : (
        <div style={{ display: "grid", gap: 8, marginBottom: 20 }}>
          {charges.map((c) => {
            const paid = paidByCharge.get(c.id) ?? 0;
            const remaining = Math.max(0, c.amount_php - paid);
            const isOpen = c.status !== "void" && remaining > 0;
            return (
              <div key={c.id} style={{ background: "white", border: "1px solid #eee", borderRadius: 10, padding: "12px 14px", opacity: c.status === "void" ? 0.5 : 1 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 8 }}>
                  <div>
                    <div style={{ fontSize: 13.5, fontWeight: 700 }}>{c.description}</div>
                    <div style={{ fontSize: 11.5, color: "#888", marginTop: 2 }}>
                      {new Date(c.created_at).toLocaleDateString()}
                      {c.status === "void" ? " · Voided" : remaining === 0 ? " · Paid in full" : paid > 0 ? " · Partially paid" : " · Unpaid"}
                    </div>
                  </div>
                  <div style={{ fontSize: 15, fontWeight: 700 }}>{peso(c.amount_php)}</div>
                </div>
                {isOpen && onlinePaymentsAvailable && (
                  <div style={{ marginTop: 10 }}>
                    <PayNowButton chargeId={c.id} />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      <h2 style={{ fontSize: 13.5, color: "#888", textTransform: "uppercase", letterSpacing: 0.4, marginBottom: 8 }}>Payment History</h2>
      {payments.length === 0 ? (
        <p style={{ color: "#999", fontSize: 12.5 }}>No payments recorded yet.</p>
      ) : (
        <div style={{ display: "grid", gap: 8 }}>
          {payments.map((p) => (
            <div key={p.id} style={{ background: "#f5faf6", border: "1px solid #e6f0e9", borderRadius: 10, padding: "12px 14px", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8 }}>
              <div>
                <div style={{ fontSize: 13, fontWeight: 700, color: "#1a7f37" }}>{peso(p.amount_php)} paid</div>
                <div style={{ fontSize: 11.5, color: "#888", marginTop: 2 }}>
                  {METHOD_LABEL[p.method] ?? p.method} · {new Date(p.paid_at).toLocaleDateString()}
                  {p.reference ? ` · Ref ${p.reference}` : ""}
                </div>
              </div>
              <a
                href={`/api/billing/receipt-pdf?paymentId=${p.id}`}
                target="_blank"
                rel="noopener noreferrer"
                style={{ fontSize: 12, fontWeight: 600, color: "var(--text-heading, #0c1730)", textDecoration: "none", border: "1px solid var(--input-border, #ddd)", borderRadius: 8, padding: "6px 12px" }}
              >
                View / Download Receipt
              </a>
            </div>
          ))}
        </div>
      )}
    </PortalShell>
  );
}
