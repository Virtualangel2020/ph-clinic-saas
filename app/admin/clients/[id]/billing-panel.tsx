"use client";

import { useState, useTransition } from "react";
import {
  assignTenantCarePlanAction,
  setTenantCarePlanStatusAction,
  createInvoiceAction,
  recordPaymentAction,
  createPaymentLinkAction,
} from "@/app/admin/actions";

type CarePlan = { id: string; name: string; kind: string; price_php: number | null; billing_cycle: string | null };
type TenantCarePlan = {
  id: string;
  status: string;
  start_date: string;
  next_billing_date: string | null;
  auto_renew: boolean;
  care_plans: { name: string; kind: string };
} | null;
type Invoice = {
  id: string;
  description: string;
  amount_php: number;
  discount_php: number;
  status: string;
  due_date: string | null;
  created_at: string;
  paymongo_checkout_url: string | null;
};
type Payment = {
  id: string;
  amount_php: number;
  method: string;
  reference: string | null;
  payment_date: string;
  invoice_id: string | null;
};

const CARE_STATUSES = ["active", "past_due", "grace_period", "suspended", "cancelled"];
const INVOICE_STATUS_COLOR: Record<string, string> = {
  pending: "#c99a2e",
  partially_paid: "#c99a2e",
  paid: "#1a7f37",
  overdue: "#a12a2a",
  refunded: "#888",
  partially_refunded: "#888",
  cancelled: "#888",
};

export function BillingPanel({
  tenantId,
  isOneTimeCustomer,
  carePlans,
  tenantCarePlan,
  invoices,
  payments,
}: {
  tenantId: string;
  isOneTimeCustomer: boolean;
  carePlans: CarePlan[];
  tenantCarePlan: TenantCarePlan;
  invoices: Invoice[];
  payments: Payment[];
}) {
  return (
    <div style={{ display: "grid", gap: 20 }}>
      <CarePlanCard tenantId={tenantId} isOneTimeCustomer={isOneTimeCustomer} carePlans={carePlans} tenantCarePlan={tenantCarePlan} />
      <InvoicesCard tenantId={tenantId} invoices={invoices} />
      <PaymentsCard tenantId={tenantId} payments={payments} invoices={invoices} />
    </div>
  );
}

function CarePlanCard({
  tenantId,
  isOneTimeCustomer,
  carePlans,
  tenantCarePlan,
}: {
  tenantId: string;
  isOneTimeCustomer: boolean;
  carePlans: CarePlan[];
  tenantCarePlan: TenantCarePlan;
}) {
  const [carePlanId, setCarePlanId] = useState(carePlans[0]?.id ?? "");
  const [nextBillingDate, setNextBillingDate] = useState("");
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);

  function assign() {
    startTransition(async () => {
      try {
        await assignTenantCarePlanAction(tenantId, carePlanId, nextBillingDate || null);
        setMessage("Care plan assigned.");
      } catch (e: any) {
        setMessage(`Error: ${e.message}`);
      }
    });
  }

  function changeStatus(status: string) {
    if (!tenantCarePlan) return;
    startTransition(async () => {
      try {
        await setTenantCarePlanStatusAction(tenantCarePlan.id, status, tenantId);
        setMessage("Status updated.");
      } catch (e: any) {
        setMessage(`Error: ${e.message}`);
      }
    });
  }

  return (
    <Card title="Care plan (hosting & maintenance)">
      {!isOneTimeCustomer && (
        <p style={{ fontSize: 12, color: "#888", marginBottom: 10 }}>
          This client is on a recurring subscription, which already includes hosting and maintenance — a care plan
          is normally only needed for one-time-payment clients after their warranty ends. You can still assign one
          if you'd like.
        </p>
      )}

      {tenantCarePlan ? (
        <div style={{ marginBottom: 12 }}>
          <div style={{ fontSize: 13 }}>
            Currently on <strong>{tenantCarePlan.care_plans.name}</strong>
          </div>
          <div style={{ fontSize: 12, color: "#888", marginTop: 4 }}>
            Started {new Date(tenantCarePlan.start_date).toLocaleDateString()}
            {tenantCarePlan.next_billing_date ? ` · next billing ${new Date(tenantCarePlan.next_billing_date).toLocaleDateString()}` : ""}
          </div>
          <select
            value={tenantCarePlan.status}
            onChange={(e) => changeStatus(e.target.value)}
            disabled={pending}
            style={{ ...selectStyle, marginTop: 8 }}
          >
            {CARE_STATUSES.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        </div>
      ) : (
        <p style={{ fontSize: 12, color: "#888", marginBottom: 10 }}>No care plan assigned yet.</p>
      )}

      <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
        <select value={carePlanId} onChange={(e) => setCarePlanId(e.target.value)} style={selectStyle}>
          {carePlans.map((cp) => (
            <option key={cp.id} value={cp.id}>
              {cp.name} {cp.price_php !== null ? `(₱${Number(cp.price_php).toLocaleString()}/${cp.billing_cycle})` : ""}
            </option>
          ))}
        </select>
        <input type="date" value={nextBillingDate} onChange={(e) => setNextBillingDate(e.target.value)} style={selectStyle} />
        <button onClick={assign} disabled={pending || !carePlanId} style={buttonStyle}>
          {tenantCarePlan ? "Replace care plan" : "Assign care plan"}
        </button>
      </div>
      {message && <div style={{ fontSize: 12, color: message.startsWith("Error") ? "crimson" : "#1a7f37", marginTop: 8 }}>{message}</div>}
    </Card>
  );
}

function InvoicesCard({ tenantId, invoices }: { tenantId: string; invoices: Invoice[] }) {
  const [showForm, setShowForm] = useState(false);
  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState("");
  const [discount, setDiscount] = useState("0");
  const [dueDate, setDueDate] = useState("");
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);
  const [linkPendingId, setLinkPendingId] = useState<string | null>(null);
  const [links, setLinks] = useState<Record<string, string>>({});
  const [autoCompleted, setAutoCompleted] = useState<Set<string>>(new Set());

  function getPaymentLink(invoiceId: string) {
    setLinkPendingId(invoiceId);
    setMessage(null);
    startTransition(async () => {
      try {
        const result = await createPaymentLinkAction(invoiceId);
        if (result.testMode) {
          setAutoCompleted((prev) => new Set(prev).add(invoiceId));
          setMessage("Test client — payment auto-completed, no real charge was made.");
        } else if (result.checkoutUrl) {
          setLinks((prev) => ({ ...prev, [invoiceId]: result.checkoutUrl! }));
        }
      } catch (e: any) {
        setMessage(`Error: ${e.message}`);
      } finally {
        setLinkPendingId(null);
      }
    });
  }

  function copy(url: string) {
    navigator.clipboard?.writeText(url);
    setMessage("Payment link copied — send it to the client via SMS, email, or Messenger.");
  }

  function create() {
    if (!description.trim() || !amount.trim()) {
      setMessage("Error: description and amount are required.");
      return;
    }
    startTransition(async () => {
      try {
        await createInvoiceAction({
          tenantId,
          description: description.trim(),
          amountPhp: Number(amount),
          discountPhp: Number(discount || 0),
          dueDate: dueDate || null,
        });
        setDescription("");
        setAmount("");
        setDiscount("0");
        setDueDate("");
        setShowForm(false);
        setMessage("Invoice created.");
      } catch (e: any) {
        setMessage(`Error: ${e.message}`);
      }
    });
  }

  return (
    <Card title="Invoices">
      {invoices.length > 0 ? (
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12, marginBottom: 12 }}>
          <thead>
            <tr style={{ textAlign: "left", color: "#888" }}>
              <th style={{ padding: "4px 8px" }}>Description</th>
              <th style={{ padding: "4px 8px" }}>Amount</th>
              <th style={{ padding: "4px 8px" }}>Discount</th>
              <th style={{ padding: "4px 8px" }}>Status</th>
              <th style={{ padding: "4px 8px" }}>Due</th>
              <th style={{ padding: "4px 8px" }}>Payment link</th>
            </tr>
          </thead>
          <tbody>
            {invoices.map((inv) => {
              const payable = inv.status === "pending" || inv.status === "partially_paid" || inv.status === "overdue";
              const url = links[inv.id] ?? inv.paymongo_checkout_url;
              return (
                <tr key={inv.id} style={{ borderTop: "1px solid #eee" }}>
                  <td style={{ padding: "6px 8px" }}>{inv.description}</td>
                  <td style={{ padding: "6px 8px" }}>₱{Number(inv.amount_php).toLocaleString()}</td>
                  <td style={{ padding: "6px 8px" }}>{inv.discount_php > 0 ? `₱${Number(inv.discount_php).toLocaleString()}` : "—"}</td>
                  <td style={{ padding: "6px 8px" }}>
                    <span style={{ color: INVOICE_STATUS_COLOR[inv.status] ?? "#666", fontWeight: 600 }}>{inv.status}</span>
                  </td>
                  <td style={{ padding: "6px 8px" }}>{inv.due_date ? new Date(inv.due_date).toLocaleDateString() : "—"}</td>
                  <td style={{ padding: "6px 8px" }}>
                    {autoCompleted.has(inv.id) ? (
                      <span style={{ color: "#1a7f37", fontWeight: 600 }}>Auto-completed (test)</span>
                    ) : !payable ? (
                      "—"
                    ) : url ? (
                      <button onClick={() => copy(url)} style={{ ...buttonStyle, padding: "5px 10px", fontSize: 11, background: "#1a7f37" }}>
                        Copy link
                      </button>
                    ) : (
                      <button
                        onClick={() => getPaymentLink(inv.id)}
                        disabled={pending && linkPendingId === inv.id}
                        style={{ ...buttonStyle, padding: "5px 10px", fontSize: 11 }}
                      >
                        {pending && linkPendingId === inv.id ? "Creating..." : "Get PayMongo link"}
                      </button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      ) : (
        <p style={{ fontSize: 12, color: "#888", marginBottom: 12 }}>No invoices yet.</p>
      )}

      {showForm ? (
        <div style={{ display: "grid", gap: 8 }}>
          <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr 1fr", gap: 8 }}>
            <input placeholder="Description" value={description} onChange={(e) => setDescription(e.target.value)} style={selectStyle} />
            <input type="number" min={0} placeholder="Amount ₱" value={amount} onChange={(e) => setAmount(e.target.value)} style={selectStyle} />
            <input type="number" min={0} placeholder="Discount ₱" value={discount} onChange={(e) => setDiscount(e.target.value)} style={selectStyle} />
            <input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} style={selectStyle} />
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <button onClick={create} disabled={pending} style={buttonStyle}>Create invoice</button>
            <button onClick={() => setShowForm(false)} style={{ ...buttonStyle, background: "#888" }}>Cancel</button>
          </div>
        </div>
      ) : (
        <button onClick={() => setShowForm(true)} style={{ ...buttonStyle, background: "white", color: "#2563eb", border: "1px solid #2563eb" }}>
          + New invoice
        </button>
      )}
      {message && <div style={{ fontSize: 12, color: message.startsWith("Error") ? "crimson" : "#1a7f37", marginTop: 8 }}>{message}</div>}
    </Card>
  );
}

function PaymentsCard({ tenantId, payments, invoices }: { tenantId: string; payments: Payment[]; invoices: Invoice[] }) {
  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState("cash");
  const [reference, setReference] = useState("");
  const [paymentDate, setPaymentDate] = useState(new Date().toISOString().slice(0, 10));
  const [invoiceId, setInvoiceId] = useState("");
  const [note, setNote] = useState("");
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);

  const unpaidInvoices = invoices.filter((i) => i.status === "pending" || i.status === "partially_paid" || i.status === "overdue");

  function record() {
    if (!amount.trim()) {
      setMessage("Error: amount is required.");
      return;
    }
    startTransition(async () => {
      try {
        await recordPaymentAction({
          tenantId,
          amountPhp: Number(amount),
          method,
          reference,
          paymentDate,
          note,
          invoiceId: invoiceId || null,
        });
        setAmount("");
        setReference("");
        setNote("");
        setMessage("Payment recorded.");
      } catch (e: any) {
        setMessage(`Error: ${e.message}`);
      }
    });
  }

  return (
    <Card title="Payments (manual entry — cash, bank transfer, GCash, etc.)">
      {payments.length > 0 ? (
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12, marginBottom: 12 }}>
          <thead>
            <tr style={{ textAlign: "left", color: "#888" }}>
              <th style={{ padding: "4px 8px" }}>Date</th>
              <th style={{ padding: "4px 8px" }}>Amount</th>
              <th style={{ padding: "4px 8px" }}>Method</th>
              <th style={{ padding: "4px 8px" }}>Reference</th>
            </tr>
          </thead>
          <tbody>
            {payments.map((p) => (
              <tr key={p.id} style={{ borderTop: "1px solid #eee" }}>
                <td style={{ padding: "6px 8px" }}>{new Date(p.payment_date).toLocaleDateString()}</td>
                <td style={{ padding: "6px 8px", color: "#1a7f37", fontWeight: 600 }}>₱{Number(p.amount_php).toLocaleString()}</td>
                <td style={{ padding: "6px 8px" }}>{p.method}</td>
                <td style={{ padding: "6px 8px" }}>{p.reference || "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <p style={{ fontSize: 12, color: "#888", marginBottom: 12 }}>No payments recorded yet.</p>
      )}

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 8, marginBottom: 8 }}>
        <input type="number" min={0} placeholder="Amount ₱" value={amount} onChange={(e) => setAmount(e.target.value)} style={selectStyle} />
        <select value={method} onChange={(e) => setMethod(e.target.value)} style={selectStyle}>
          <option value="cash">Cash</option>
          <option value="bank_transfer">Bank transfer</option>
          <option value="gcash">GCash</option>
          <option value="paymaya">PayMaya</option>
          <option value="card">Card</option>
          <option value="other">Other</option>
        </select>
        <input placeholder="Reference #" value={reference} onChange={(e) => setReference(e.target.value)} style={selectStyle} />
        <input type="date" value={paymentDate} onChange={(e) => setPaymentDate(e.target.value)} style={selectStyle} />
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 8, marginBottom: 10 }}>
        <select value={invoiceId} onChange={(e) => setInvoiceId(e.target.value)} style={selectStyle}>
          <option value="">Not tied to an invoice</option>
          {unpaidInvoices.map((inv) => (
            <option key={inv.id} value={inv.id}>
              {inv.description} — ₱{Number(inv.amount_php - inv.discount_php).toLocaleString()} owed
            </option>
          ))}
        </select>
        <input placeholder="Note (optional)" value={note} onChange={(e) => setNote(e.target.value)} style={selectStyle} />
      </div>
      <button onClick={record} disabled={pending} style={buttonStyle}>
        {pending ? "Recording..." : "Record payment"}
      </button>
      {message && <div style={{ fontSize: 12, color: message.startsWith("Error") ? "crimson" : "#1a7f37", marginTop: 8 }}>{message}</div>}
    </Card>
  );
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ background: "white", border: "1px solid #e2e2e5", borderRadius: 12, padding: 20 }}>
      <h3 style={{ fontSize: 15, marginTop: 0, marginBottom: 14 }}>{title}</h3>
      {children}
    </div>
  );
}

const selectStyle: React.CSSProperties = { padding: "8px 10px", borderRadius: 8, border: "1px solid #ccc", fontSize: 13 };
const buttonStyle: React.CSSProperties = {
  padding: "8px 14px",
  borderRadius: 8,
  border: "none",
  background: "#2563eb",
  color: "white",
  fontWeight: 600,
  fontSize: 13,
  cursor: "pointer",
};
