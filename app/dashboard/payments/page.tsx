import Link from "next/link";
import { requireClinicMember } from "@/lib/require-clinic-member";
import { getPaymentsData } from "@/lib/payments/get-payments-data";
import { CollectPaymentWidget } from "./collect-payment-widget";

// Patient Payments — replaces the old "Phase 7" placeholder. Everything
// here reads/writes the SAME PayMongo integration + billing tables the
// per-patient Billing tab and the Financial dashboard already use in
// production (see lib/patient-paymongo.ts and lib/payments/get-payments-data.ts) —
// this page adds a faster front-desk-facing way to reach that existing,
// already-working flow: check status, see today's/this-month's online
// collections at a glance, and send a patient a payment link without
// opening their full chart first.
export default async function PaymentsPage() {
  const { supabase, profile } = await requireClinicMember();
  const data = await getPaymentsData(supabase, profile.tenant_id as string);

  function peso(n: number) {
    return `₱${n.toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  }

  let statusLabel: string;
  let statusColor: { bg: string; border: string; fg: string };
  if (data.mode === "not_configured") {
    statusLabel = "Not Configured";
    statusColor = { bg: "#f2f2f2", border: "#ddd", fg: "#666" };
  } else if (!data.acceptOnline) {
    statusLabel = data.mode === "test" ? "PayMongo — Test Mode (off)" : "PayMongo — Live (off)";
    statusColor = { bg: "#f2f2f2", border: "#ddd", fg: "#666" };
  } else if (data.mode === "test") {
    statusLabel = "PayMongo — Test Mode";
    statusColor = { bg: "#fff7e6", border: "#e6c66b", fg: "#7a5c12" };
  } else {
    statusLabel = "PayMongo — Live";
    statusColor = { bg: "#eaf7ee", border: "#bfe6c9", fg: "#1a7f37" };
  }

  const STATUS_PILL: Record<string, { label: string; color: string }> = {
    pending: { label: "Pending", color: "#8a6100" },
    paid: { label: "Paid", color: "#1a7f37" },
    expired: { label: "Expired", color: "#999" },
    failed: { label: "Failed", color: "#a12a2a" },
    cancelled: { label: "Cancelled", color: "#999" },
  };

  return (
    <div style={{ maxWidth: 1100 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 12, marginBottom: 4 }}>
        <div>
          <h1 style={{ fontSize: 24, marginBottom: 4 }}>Payments</h1>
          <p style={{ color: "#666", fontSize: 13, marginBottom: 0 }}>
            Collect patient payments online through PayMongo — send a link from here, or from a patient's own Billing
            tab. This is separate from your AngelClinic subscription billing.
          </p>
        </div>
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", margin: "16px 0 20px" }}>
        <span style={{ fontSize: 12, fontWeight: 700, background: statusColor.bg, border: `1px solid ${statusColor.border}`, color: statusColor.fg, borderRadius: 999, padding: "4px 12px" }}>
          {statusLabel}
        </span>
        <Link href="/dashboard/settings/payments" style={{ fontSize: 12.5, color: "#2563eb" }}>
          Settings → Payments
        </Link>
      </div>

      {data.mode === "not_configured" && (
        <div style={{ background: "#fff7e6", border: "1px solid #e6c66b", borderRadius: 8, padding: "10px 14px", fontSize: 13, color: "#7a5c12", marginBottom: 20 }}>
          PayMongo isn&apos;t connected yet — reach out via Settings → Customer Care to get online payments enabled.
        </div>
      )}
      {data.mode !== "not_configured" && !data.acceptOnline && (
        <div style={{ background: "#f2f2f2", border: "1px solid #ddd", borderRadius: 8, padding: "10px 14px", fontSize: 13, color: "#666", marginBottom: 20 }}>
          Online Payments is turned off, so patients and staff can&apos;t start a new PayMongo payment right now. Turn
          it on under Settings → Payments.
        </div>
      )}

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 14, marginBottom: 24 }}>
        <StatCard label="Collected Online Today" value={peso(data.collectedOnlineToday)} color="#1a7f37" />
        <StatCard label="Collected Online This Month" value={peso(data.collectedOnlineThisMonth)} />
        <StatCard label="Pending Payment Links" value={String(data.pendingLinksCount)} />
        <StatCard label="Outstanding Balance" value={peso(data.outstandingTotal)} color={data.outstandingTotal > 0 ? "#a12a2a" : undefined} />
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr)", gap: 20, marginBottom: 24 }}>
        <CollectPaymentWidget acceptOnline={data.acceptOnline && data.mode !== "not_configured"} />
      </div>

      <Section title="Recent Online Payments">
        {data.recentPayments.length > 0 ? (
          <Table
            headers={["Date", "Patient", "Description", "Amount", "Status"]}
            rows={data.recentPayments.map((p) => [
              new Date(p.createdAt).toLocaleString("en-PH", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Manila" }),
              <Link key={p.id} href={`/dashboard/patients/${p.patientId}?tab=billing`} style={{ color: "var(--text-heading)", fontWeight: 600, textDecoration: "none" }}>
                {p.patientName}
              </Link>,
              p.description,
              peso(p.amountPhp),
              <StatusPill key={p.id} tone={STATUS_PILL[p.status]?.color ?? "#999"}>{STATUS_PILL[p.status]?.label ?? p.status}</StatusPill>,
            ])}
          />
        ) : (
          <EmptyState text="No online payments yet — links sent from here or from a patient's Billing tab will show up here." />
        )}
      </Section>
    </div>
  );
}

function StatCard({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div style={{ background: "var(--card-bg)", border: "1px solid var(--card-border)", borderRadius: 12, padding: 16 }}>
      <div style={{ fontSize: 20, fontWeight: 700, color: color ?? "var(--text-heading)" }}>{value}</div>
      <div style={{ fontSize: 12, color: "#888", marginTop: 2 }}>{label}</div>
    </div>
  );
}

function StatusPill({ children, tone }: { children: React.ReactNode; tone: string }) {
  return (
    <span style={{ fontSize: 10.5, fontWeight: 700, color: tone, background: `${tone}15`, border: `1px solid ${tone}40`, borderRadius: 999, padding: "3px 9px" }}>
      {children}
    </span>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 20 }}>
      <h2 style={{ fontSize: 14, fontWeight: 700, marginBottom: 8 }}>{title}</h2>
      <div style={{ background: "var(--card-bg)", border: "1px solid var(--card-border)", borderRadius: 12, overflow: "hidden" }}>{children}</div>
    </div>
  );
}

function EmptyState({ text }: { text: string }) {
  return <div style={{ padding: 16, color: "#888", fontSize: 13 }}>{text}</div>;
}

function Table({ headers, rows }: { headers: string[]; rows: (string | number | React.ReactNode)[][] }) {
  return (
    <div style={{ overflowX: "auto" }}>
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13, minWidth: 480 }}>
        <thead>
          <tr style={{ background: "#fafafa", textAlign: "left" }}>
            {headers.map((h) => (
              <th key={h} style={{ padding: "10px 16px", fontWeight: 600, color: "#555", whiteSpace: "nowrap" }}>
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i} style={{ borderTop: "1px solid #eee" }}>
              {row.map((cell, j) => (
                <td key={j} style={{ padding: "10px 16px", whiteSpace: j === 1 ? "normal" : "nowrap" }}>
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
