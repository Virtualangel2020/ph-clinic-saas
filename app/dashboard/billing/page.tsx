import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { BrandHeader } from "@/components/brand-header";
import { QrCheckout } from "../qr-checkout";

const STATUS_COLOR: Record<string, string> = {
  pending: "#c99a2e",
  partially_paid: "#c99a2e",
  paid: "#1a7f37",
  overdue: "#a12a2a",
  refunded: "#888",
  partially_refunded: "#888",
  cancelled: "#888",
};

// Client-facing billing page — the clinic's own logged-in staff see and pay
// their own invoices here (RLS scopes everything to current_tenant_id()).
// This is separate from /admin/clients/[id], which is the platform admin's
// view of the same data across every clinic.
export default async function DashboardBillingPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/dashboard/billing");

  // Pre-purchase customers (no tenant yet) have nothing to bill — send them
  // to /dashboard, which already shows the "choose a plan" next step, rather
  // than showing them an empty, disconnected "No invoices yet" page here.
  const { data: profile } = await supabase
    .from("user_profiles")
    .select("tenant_id, role")
    .eq("id", user!.id)
    .maybeSingle();

  if (profile?.role === "platform_admin") {
    redirect("/admin");
  }
  if (!profile?.tenant_id) {
    redirect("/dashboard");
  }

  const { data: invoices } = await supabase
    .from("invoices")
    .select("id, description, amount_php, discount_php, status, due_date, created_at")
    .order("created_at", { ascending: false });

  const { data: payments } = await supabase
    .from("payments")
    .select("id, amount_php, method, payment_date, invoice_id")
    .order("payment_date", { ascending: false });

  return (
    <main style={{ maxWidth: 720, margin: "0 auto", padding: "48px 24px" }}>
      <div style={{ marginBottom: 24 }}>
        <BrandHeader subtitle="Billing" />
      </div>
      <Link
        href="/dashboard"
        style={{ display: "inline-block", fontSize: 13, color: "#888", textDecoration: "none", marginBottom: 16 }}
      >
        ← Dashboard
      </Link>
      <h1 style={{ fontSize: 24, marginBottom: 4 }}>Your invoices</h1>
      <p style={{ color: "#666", marginBottom: 28, fontSize: 13 }}>
        Every invoice for your clinic. Pay one directly with a QR code — scan it with GCash, Maya, or your banking
        app, and it updates automatically once received.
      </p>

      {invoices && invoices.length > 0 ? (
        <div style={{ display: "grid", gap: 16 }}>
          {invoices.map((inv: any) => {
            const owed = Number(inv.amount_php) - Number(inv.discount_php);
            const payable = inv.status === "pending" || inv.status === "partially_paid" || inv.status === "overdue";
            return (
              <div key={inv.id} style={{ background: "white", border: "1px solid #e2e2e5", borderRadius: 12, padding: 20 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 10 }}>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: 15 }}>{inv.description}</div>
                    <div style={{ fontSize: 12, color: "#888", marginTop: 2 }}>
                      {inv.due_date ? `Due ${new Date(inv.due_date).toLocaleDateString()}` : "No due date set"}
                    </div>
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <div style={{ fontWeight: 700, fontSize: 16 }}>₱{owed.toLocaleString()}</div>
                    <div style={{ fontSize: 11, fontWeight: 600, color: STATUS_COLOR[inv.status] ?? "#666" }}>{inv.status}</div>
                  </div>
                </div>
                {payable && <QrCheckout invoiceId={inv.id} />}
              </div>
            );
          })}
        </div>
      ) : (
        <div style={{ background: "white", border: "1px solid #e2e2e5", borderRadius: 12, padding: 24, color: "#888", fontSize: 13 }}>
          No invoices yet.
        </div>
      )}

      {payments && payments.length > 0 && (
        <div style={{ marginTop: 32 }}>
          <h2 style={{ fontSize: 16, marginBottom: 12 }}>Payment history</h2>
          <div style={{ background: "white", border: "1px solid #e2e2e5", borderRadius: 12, overflow: "hidden" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
              <thead>
                <tr style={{ background: "#fafafa", textAlign: "left" }}>
                  <th style={{ padding: "10px 16px", fontWeight: 600, color: "#555" }}>Date</th>
                  <th style={{ padding: "10px 16px", fontWeight: 600, color: "#555" }}>Amount</th>
                  <th style={{ padding: "10px 16px", fontWeight: 600, color: "#555" }}>Method</th>
                </tr>
              </thead>
              <tbody>
                {payments.map((p: any) => (
                  <tr key={p.id} style={{ borderTop: "1px solid #eee" }}>
                    <td style={{ padding: "10px 16px" }}>{new Date(p.payment_date).toLocaleDateString()}</td>
                    <td style={{ padding: "10px 16px", color: "#1a7f37", fontWeight: 600 }}>₱{Number(p.amount_php).toLocaleString()}</td>
                    <td style={{ padding: "10px 16px" }}>{p.method}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </main>
  );
}
