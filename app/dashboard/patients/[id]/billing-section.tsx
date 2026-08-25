"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  setPatientBillTypesAction,
  addPatientChargeAction,
  voidPatientChargeAction,
  recordPatientChargePaymentAction,
  startPatientChargeOnlinePaymentAction,
} from "../actions";
import { CoverageSection, type InsurancePlanRow } from "./coverage-section";

export type ChargeRow = {
  id: string;
  description: string;
  amount_php: number;
  bill_type: string;
  status: "open" | "void";
  created_at: string;
  provider_name: string | null;
};
export type PaymentRow = {
  id: string;
  charge_id: string | null;
  amount_php: number;
  method: string;
  reference: string | null;
  paid_at: string;
  created_at: string;
};
export type BillingData = {
  charges: ChargeRow[];
  payments: PaymentRow[];
  totalCharged: number;
  totalPaid: number;
  balance: number;
  status: "no_charges" | "unpaid" | "partial" | "paid";
};

const BILL_TYPE_OPTIONS: { value: string; label: string }[] = [
  { value: "cash", label: "Cash" },
  { value: "hmo", label: "HMO" },
  { value: "philhealth", label: "PhilHealth" },
  { value: "yakap", label: "YAKAP" },
  { value: "other", label: "Other" },
];

const CARD: React.CSSProperties = { background: "var(--card-bg)", border: "1px solid var(--card-border)", borderRadius: 12, padding: 16 };
const FIELD_STYLE: React.CSSProperties = { border: "1px solid var(--input-border)", borderRadius: 8, padding: "8px 10px", fontSize: 13, fontFamily: "inherit", width: "100%", boxSizing: "border-box" };

function peso(n: number) {
  return `₱${n.toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

const STATUS_STYLE: Record<BillingData["status"], { bg: string; border: string; color: string; label: string }> = {
  paid: { bg: "#eaf7ee", border: "#bfe6c9", color: "#1a7f37", label: "Paid in full" },
  partial: { bg: "#fff6e6", border: "#f0d998", color: "#8a6100", label: "Partial balance" },
  unpaid: { bg: "#fbeaea", border: "#f0c9c9", color: "#a12a2a", label: "Unpaid" },
  no_charges: { bg: "#f2f2f2", border: "#ddd", color: "#666", label: "No charges" },
};

// Billing tab (formerly Coverage). Two layers: (1) which payer categories
// apply to this patient at all — Cash / HMO / PhilHealth / YAKAP, any
// combination, replacing the old single-select payment_type — and (2) an
// actual manual charge/payment ledger with a running balance, especially
// relevant for surgeons and procedures with partial payment. The same
// charges/payments rows also power the balance shown on the Patient
// Portal (portal-read RLS — see migration
// patient_billing_charges_and_payments). This is NOT an online payment
// gateway — staff record what was charged and what was received, same
// manual-entry pattern as every other clinical write in this app.
export function BillingSection({
  patientId,
  billTypes,
  billing,
  providers,
  paymentType,
  philhealthNumber,
  philhealthMemberType,
  philhealthStatus,
  philhealthPrincipalOrDependent,
  philhealthRelationshipToPrincipal,
  insurancePlans,
  onlinePaymentsAvailable,
}: {
  patientId: string;
  billTypes: string[];
  billing: BillingData;
  providers: { id: string; full_name: string; title: string | null }[];
  paymentType: string;
  philhealthNumber: string | null;
  philhealthMemberType: string | null;
  philhealthStatus: string | null;
  philhealthPrincipalOrDependent: string | null;
  philhealthRelationshipToPrincipal: string | null;
  insurancePlans: InsurancePlanRow[];
  onlinePaymentsAvailable: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [selected, setSelected] = useState<string[]>(billTypes);

  function toggleBillType(value: string) {
    const next = selected.includes(value) ? selected.filter((v) => v !== value) : [...selected, value];
    setSelected(next);
    startTransition(async () => {
      await setPatientBillTypesAction(patientId, next);
      router.refresh();
    });
  }

  const s = STATUS_STYLE[billing.status];

  return (
    <div style={{ display: "grid", gap: 16 }}>
      <div style={CARD}>
        <div style={{ fontSize: 12, fontWeight: 700, color: "#666", marginBottom: 8 }}>Bill Type</div>
        <p style={{ fontSize: 11.5, color: "#888", marginTop: -2, marginBottom: 8 }}>Choose every payer that applies — a patient can have HMO, PhilHealth, and YAKAP all at once.</p>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {BILL_TYPE_OPTIONS.map((opt) => {
            const active = selected.includes(opt.value);
            return (
              <button
                key={opt.value}
                onClick={() => toggleBillType(opt.value)}
                disabled={pending}
                style={{
                  border: `1px solid ${active ? "#0c1730" : "var(--input-border)"}`,
                  background: active ? "#0c1730" : "transparent",
                  color: active ? "#e6c66b" : "#555",
                  borderRadius: 999,
                  padding: "6px 14px",
                  fontSize: 12.5,
                  fontWeight: 600,
                  cursor: "pointer",
                }}
              >
                {active ? "✓ " : ""}
                {opt.label}
              </button>
            );
          })}
        </div>
      </div>

      <div style={CARD}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 10 }}>
          <div>
            <div style={{ fontSize: 12, fontWeight: 700, color: "#666" }}>Balance</div>
            <div style={{ fontSize: 24, fontWeight: 700, color: billing.balance > 0 ? "#a12a2a" : "var(--text-heading)" }}>{peso(billing.balance)}</div>
          </div>
          <span style={{ fontSize: 11, fontWeight: 700, color: s.color, background: s.bg, border: `1px solid ${s.border}`, borderRadius: 999, padding: "3px 10px" }}>{s.label}</span>
          <div style={{ display: "flex", gap: 18, fontSize: 12.5, color: "#666" }}>
            <div>
              Total charged
              <div style={{ fontWeight: 700, color: "var(--text-heading)" }}>{peso(billing.totalCharged)}</div>
            </div>
            <div>
              Total paid
              <div style={{ fontWeight: 700, color: "var(--text-heading)" }}>{peso(billing.totalPaid)}</div>
            </div>
          </div>
        </div>
      </div>

      <BillingLedger patientId={patientId} billing={billing} providers={providers} onlinePaymentsAvailable={onlinePaymentsAvailable} />

      <PhilhealthAndHmo
        patientId={patientId}
        paymentType={paymentType}
        philhealthNumber={philhealthNumber}
        philhealthMemberType={philhealthMemberType}
        philhealthStatus={philhealthStatus}
        philhealthPrincipalOrDependent={philhealthPrincipalOrDependent}
        philhealthRelationshipToPrincipal={philhealthRelationshipToPrincipal}
        insurancePlans={insurancePlans}
      />
    </div>
  );
}

// Kept as its own reusable piece — same PhilHealth/HMO detail cards this
// tab has always had, unchanged; only the tab's name and the ledger above
// are new.
function PhilhealthAndHmo(props: React.ComponentProps<typeof CoverageSection>) {
  return <CoverageSection {...props} />;
}

const EMPTY_CHARGE = { description: "", amount: "", billType: "cash", providerId: "" };
const EMPTY_PAYMENT = { chargeId: "", amount: "", method: "cash", reference: "", paidAt: "" };

function BillingLedger({
  patientId,
  billing,
  providers,
  onlinePaymentsAvailable,
}: {
  patientId: string;
  billing: BillingData;
  providers: { id: string; full_name: string; title: string | null }[];
  onlinePaymentsAvailable: boolean;
}) {
  const router = useRouter();
  const [addingCharge, setAddingCharge] = useState(false);
  const [addingPayment, setAddingPayment] = useState(false);
  const [charge, setCharge] = useState(EMPTY_CHARGE);
  const [payment, setPayment] = useState(EMPTY_PAYMENT);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [payOnlineBusyId, setPayOnlineBusyId] = useState<string | null>(null);

  // Opens PayMongo Checkout in a new tab for staff to show/send to the
  // patient. Never marks anything Paid here — only the verified webhook
  // (app/api/webhooks/paymongo/route.ts) does that once PayMongo confirms.
  function payOnline(chargeId: string) {
    setError(null);
    setPayOnlineBusyId(chargeId);
    startTransition(async () => {
      try {
        const url = await startPatientChargeOnlinePaymentAction(chargeId, patientId);
        window.open(url, "_blank", "noopener,noreferrer");
      } catch (e: any) {
        setError(e.message || "Couldn't start an online payment for this charge.");
      } finally {
        setPayOnlineBusyId(null);
      }
    });
  }

  function saveCharge() {
    const amount = Number(charge.description.trim() ? charge.amount : NaN);
    if (!charge.description.trim() || !Number.isFinite(amount) || amount <= 0) {
      setError("Enter a description and a valid amount.");
      return;
    }
    setError(null);
    startTransition(async () => {
      try {
        await addPatientChargeAction(patientId, charge.description.trim(), amount, charge.billType, charge.providerId, "");
        setCharge(EMPTY_CHARGE);
        setAddingCharge(false);
        router.refresh();
      } catch (e: any) {
        setError(e.message || "Couldn't save that charge.");
      }
    });
  }

  function savePayment() {
    const amount = Number(payment.amount);
    if (!Number.isFinite(amount) || amount <= 0) {
      setError("Enter a valid payment amount.");
      return;
    }
    setError(null);
    startTransition(async () => {
      try {
        await recordPatientChargePaymentAction(patientId, payment.chargeId || null, amount, payment.method, payment.reference, payment.paidAt);
        setPayment(EMPTY_PAYMENT);
        setAddingPayment(false);
        router.refresh();
      } catch (e: any) {
        setError(e.message || "Couldn't record that payment.");
      }
    });
  }

  function voidCharge(id: string) {
    if (!confirm("Void this charge? It will no longer count toward the balance.")) return;
    setBusyId(id);
    startTransition(async () => {
      try {
        await voidPatientChargeAction(id, patientId);
        router.refresh();
      } finally {
        setBusyId(null);
      }
    });
  }

  const openCharges = billing.charges.filter((c) => c.status !== "void");

  return (
    <div style={CARD}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10, flexWrap: "wrap", gap: 8 }}>
        <h3 style={{ fontSize: 14, fontWeight: 700 }}>Charges &amp; Payments</h3>
        <div style={{ display: "flex", gap: 14 }}>
          <button onClick={() => setAddingCharge((v) => !v)} style={{ fontSize: 12, color: "var(--text-heading)", background: "none", border: "none", cursor: "pointer", fontWeight: 600 }}>
            {addingCharge ? "Cancel" : "+ Add charge"}
          </button>
          <button onClick={() => setAddingPayment((v) => !v)} style={{ fontSize: 12, color: "var(--text-heading)", background: "none", border: "none", cursor: "pointer", fontWeight: 600 }}>
            {addingPayment ? "Cancel" : "+ Record payment"}
          </button>
        </div>
      </div>

      {error && <p style={{ fontSize: 12, color: "#a12a2a", marginBottom: 8 }}>{error}</p>}

      {addingCharge && (
        <div style={{ background: "#f7f7f9", border: "1px solid #eee", borderRadius: 8, padding: 12, marginBottom: 10, display: "grid", gap: 8 }}>
          <input placeholder="Description (e.g. Surgery fee — appendectomy)" value={charge.description} onChange={(e) => setCharge({ ...charge, description: e.target.value })} style={FIELD_STYLE} />
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}>
            <input type="number" min={0} step="0.01" placeholder="Amount (₱)" value={charge.amount} onChange={(e) => setCharge({ ...charge, amount: e.target.value })} style={FIELD_STYLE} />
            <select value={charge.billType} onChange={(e) => setCharge({ ...charge, billType: e.target.value })} style={FIELD_STYLE}>
              {BILL_TYPE_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
            <select value={charge.providerId} onChange={(e) => setCharge({ ...charge, providerId: e.target.value })} style={FIELD_STYLE}>
              <option value="">Provider (optional)</option>
              {providers.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.title ? `${p.title} ` : ""}
                  {p.full_name}
                </option>
              ))}
            </select>
          </div>
          <button onClick={saveCharge} disabled={pending} style={{ background: "#0c1730", color: "white", border: "none", borderRadius: 8, padding: "8px 14px", fontSize: 12.5, cursor: "pointer", justifySelf: "start" }}>
            {pending ? "Saving…" : "Save charge"}
          </button>
        </div>
      )}

      {addingPayment && (
        <div style={{ background: "#f7f7f9", border: "1px solid #eee", borderRadius: 8, padding: 12, marginBottom: 10, display: "grid", gap: 8 }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
            <input type="number" min={0} step="0.01" placeholder="Amount received (₱)" value={payment.amount} onChange={(e) => setPayment({ ...payment, amount: e.target.value })} style={FIELD_STYLE} />
            <select value={payment.method} onChange={(e) => setPayment({ ...payment, method: e.target.value })} style={FIELD_STYLE}>
              {BILL_TYPE_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
            <select value={payment.chargeId} onChange={(e) => setPayment({ ...payment, chargeId: e.target.value })} style={FIELD_STYLE}>
              <option value="">Apply to overall balance</option>
              {openCharges.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.description} ({peso(c.amount_php)})
                </option>
              ))}
            </select>
            <input type="date" value={payment.paidAt} onChange={(e) => setPayment({ ...payment, paidAt: e.target.value })} style={FIELD_STYLE} />
          </div>
          <input placeholder="Reference / OR number (optional)" value={payment.reference} onChange={(e) => setPayment({ ...payment, reference: e.target.value })} style={FIELD_STYLE} />
          <button onClick={savePayment} disabled={pending} style={{ background: "#0c1730", color: "white", border: "none", borderRadius: 8, padding: "8px 14px", fontSize: 12.5, cursor: "pointer", justifySelf: "start" }}>
            {pending ? "Saving…" : "Save payment"}
          </button>
        </div>
      )}

      {billing.charges.length === 0 && billing.payments.length === 0 ? (
        <p style={{ color: "#999", fontSize: 12.5, margin: 0 }}>No charges or payments recorded yet.</p>
      ) : (
        <div style={{ display: "grid", gap: 6 }}>
          {billing.charges.map((c) => (
            <div key={c.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", border: "1px solid #eee", borderRadius: 8, padding: "8px 10px", fontSize: 12.5, opacity: c.status === "void" ? 0.5 : 1 }}>
              <div>
                <span style={{ fontWeight: 700 }}>{c.description}</span>
                <span style={{ color: "#888", marginLeft: 6 }}>
                  {BILL_TYPE_OPTIONS.find((o) => o.value === c.bill_type)?.label ?? c.bill_type}
                  {c.provider_name ? ` · ${c.provider_name}` : ""} · {new Date(c.created_at).toLocaleDateString()}
                  {c.status === "void" ? " · Voided" : ""}
                </span>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <span style={{ fontWeight: 700 }}>{peso(c.amount_php)}</span>
                {c.status !== "void" && onlinePaymentsAvailable && (
                  <button
                    onClick={() => payOnline(c.id)}
                    disabled={pending && payOnlineBusyId === c.id}
                    style={{ background: "#0c1730", color: "#e6c66b", border: "none", borderRadius: 6, padding: "4px 10px", cursor: "pointer", fontSize: 11.5, fontWeight: 600 }}
                  >
                    {pending && payOnlineBusyId === c.id ? "Opening…" : "Pay Online"}
                  </button>
                )}
                {c.status !== "void" && (
                  <button onClick={() => voidCharge(c.id)} disabled={pending && busyId === c.id} style={{ background: "none", border: "none", color: "#a12a2a", cursor: "pointer", fontSize: 11.5 }}>
                    Void
                  </button>
                )}
              </div>
            </div>
          ))}
          {billing.payments.map((p) => (
            <div key={p.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", border: "1px solid #e6f0e9", background: "#f5faf6", borderRadius: 8, padding: "8px 10px", fontSize: 12.5 }}>
              <div>
                <span style={{ fontWeight: 700, color: "#1a7f37" }}>Payment received</span>
                <span style={{ color: "#888", marginLeft: 6 }}>
                  {BILL_TYPE_OPTIONS.find((o) => o.value === p.method)?.label ?? p.method}
                  {p.reference ? ` · Ref ${p.reference}` : ""} · {new Date(p.paid_at).toLocaleDateString()}
                </span>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <span style={{ fontWeight: 700, color: "#1a7f37" }}>{peso(p.amount_php)}</span>
                <a
                  href={`/api/billing/receipt-pdf?paymentId=${p.id}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{ fontSize: 11, fontWeight: 600, color: "#1a7f37", textDecoration: "none" }}
                >
                  Receipt
                </a>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
