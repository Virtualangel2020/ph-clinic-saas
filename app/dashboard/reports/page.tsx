import { requireClinicMember } from "@/lib/require-clinic-member";
import { todayPh, addDays, phDayStart, formatDayLabel } from "../calendar/date-utils";

// Phase 6 — core operational reports. Everything below is a plain, read-only
// aggregation over existing tables (no reporting RPCs, no migrations) scoped
// to the current clinic via tenant_id, same as every other page in this app.
// RLS is the backstop; the explicit .eq("tenant_id", ...) filters mirror the
// rest of the codebase's convention, not a substitute for it.

const RANGE_OPTIONS: { key: string; label: string; days: number }[] = [
  { key: "30d", label: "Last 30 days", days: 30 },
  { key: "3m", label: "Last 3 months", days: 90 },
  { key: "6m", label: "Last 6 months", days: 180 },
  { key: "1y", label: "Last 1 year", days: 365 },
];

const APPT_NOSHOW_STATUSES = new Set(["no_show"]);
const APPT_CANCELLED_STATUSES = new Set(["cancelled", "late_cancellation"]);

const PAYMENT_METHOD_LABEL: Record<string, string> = {
  cash: "Cash",
  bank_transfer: "Bank transfer",
  gcash: "GCash",
  paymaya: "PayMaya",
  card: "Card",
  grab_pay: "GrabPay",
  other: "Other",
};

const MAX_DAY_ROWS = 31;

function peso(n: number) {
  return `₱${n.toLocaleString("en-PH", { maximumFractionDigits: 0 })}`;
}

function pct(numerator: number, denominator: number): string {
  if (denominator <= 0) return "—";
  return `${Math.round((numerator / denominator) * 100)}%`;
}

export default async function ReportsPage({ searchParams }: { searchParams: { range?: string } }) {
  const { supabase, profile } = await requireClinicMember();
  const tenantId = profile.tenant_id as string;

  const activeRange = RANGE_OPTIONS.find((r) => r.key === searchParams.range) ?? RANGE_OPTIONS[0];
  const today = todayPh();
  const fromDate = addDays(today, -activeRange.days);
  const toDateExclusive = addDays(today, 1); // tomorrow — makes "today" inclusive
  const fromInstant = phDayStart(fromDate);
  const toInstantExclusive = phDayStart(toDateExclusive);

  const [
    { count: activePatientCount },
    { count: newPatientCount },
    { data: encounterRows },
    { data: appointmentRows },
    { data: invoiceRows },
    { data: paymentRows },
    { data: outstandingInvoiceRows },
    { count: sentTransferCount },
    { count: receivedTransferCount },
    { count: awaitingReviewCount },
  ] = await Promise.all([
    supabase.from("patients").select("id", { count: "exact", head: true }).eq("tenant_id", tenantId).eq("is_active", true),
    supabase
      .from("patients")
      .select("id", { count: "exact", head: true })
      .eq("tenant_id", tenantId)
      .gte("created_at", fromInstant)
      .lt("created_at", toInstantExclusive),
    supabase
      .from("encounters")
      .select("id, encounter_date, signed_at, user_profiles!encounters_provider_id_fkey(full_name)")
      .eq("tenant_id", tenantId)
      .gte("encounter_date", fromDate)
      .lt("encounter_date", toDateExclusive),
    supabase
      .from("appointments")
      .select("id, status, start_at")
      .eq("tenant_id", tenantId)
      .gte("start_at", fromInstant)
      .lt("start_at", toInstantExclusive),
    supabase
      .from("invoices")
      .select("id, amount_php, discount_php, created_at")
      .eq("tenant_id", tenantId)
      .gte("created_at", fromInstant)
      .lt("created_at", toInstantExclusive),
    supabase
      .from("payments")
      .select("id, amount_php, method, payment_date")
      .eq("tenant_id", tenantId)
      .gte("payment_date", fromDate)
      .lt("payment_date", toDateExclusive),
    // Outstanding balance is a current, not range-scoped, snapshot — same
    // "amount minus discount, unpaid statuses" logic as the client's own
    // Billing page (app/dashboard/billing/page.tsx).
    supabase
      .from("invoices")
      .select("amount_php, discount_php, status")
      .eq("tenant_id", tenantId)
      .in("status", ["pending", "partially_paid", "overdue"]),
    supabase
      .from("records_exchange_transfers")
      .select("id", { count: "exact", head: true })
      .eq("sending_tenant_id", tenantId)
      .gte("sent_at", fromInstant)
      .lt("sent_at", toInstantExclusive),
    supabase
      .from("records_exchange_transfers")
      .select("id", { count: "exact", head: true })
      .eq("receiving_tenant_id", tenantId)
      .gte("sent_at", fromInstant)
      .lt("sent_at", toInstantExclusive),
    // Backlog awaiting review is also a current snapshot, not range-scoped —
    // it answers "how much is sitting unfiled right now", same idea as the
    // admin dashboard's pendingCount.
    supabase.from("records_exchange_transfers").select("id", { count: "exact", head: true }).eq("receiving_tenant_id", tenantId).eq("status", "sent"),
  ]);

  const encounters = (encounterRows as any[]) ?? [];
  const appointments = (appointmentRows as any[]) ?? [];
  const invoices = (invoiceRows as any[]) ?? [];
  const payments = (paymentRows as any[]) ?? [];
  const outstandingInvoices = (outstandingInvoiceRows as any[]) ?? [];

  // ── Encounters: volume + documentation completion ──────────────────────
  const totalEncounters = encounters.length;
  const signedEncounters = encounters.filter((e) => e.signed_at).length;

  const byProviderMap = new Map<string, { visits: number; signed: number }>();
  const byDayMap = new Map<string, number>();
  for (const e of encounters) {
    const providerName = e.user_profiles?.full_name ?? "Unassigned";
    const bucket = byProviderMap.get(providerName) ?? { visits: 0, signed: 0 };
    bucket.visits += 1;
    if (e.signed_at) bucket.signed += 1;
    byProviderMap.set(providerName, bucket);

    byDayMap.set(e.encounter_date, (byDayMap.get(e.encounter_date) ?? 0) + 1);
  }
  const byProviderRows = Array.from(byProviderMap.entries())
    .map(([provider, v]) => ({ provider, ...v }))
    .sort((a, b) => b.visits - a.visits);
  const byDayRowsAll = Array.from(byDayMap.entries())
    .map(([date, visits]) => ({ date, visits }))
    .sort((a, b) => (a.date < b.date ? 1 : -1));
  const byDayRows = byDayRowsAll.slice(0, MAX_DAY_ROWS);
  const byDayTruncated = byDayRowsAll.length - byDayRows.length;

  // ── Appointments ─────────────────────────────────────────────────────
  const totalAppointments = appointments.length;
  const noShowCount = appointments.filter((a) => APPT_NOSHOW_STATUSES.has(a.status)).length;
  const cancelledCount = appointments.filter((a) => APPT_CANCELLED_STATUSES.has(a.status)).length;

  // ── Revenue (this clinic's own billing — subscription invoices/payments,
  // the same tables and "owed = amount - discount" logic as the client
  // Billing page) ─────────────────────────────────────────────────────────
  const invoicedTotal = invoices.reduce((sum, inv) => sum + (Number(inv.amount_php) - Number(inv.discount_php)), 0);
  const collectedTotal = payments.reduce((sum, p) => sum + Number(p.amount_php), 0);
  const outstandingTotal = outstandingInvoices.reduce((sum, inv) => sum + (Number(inv.amount_php) - Number(inv.discount_php)), 0);

  const byMethodMap = new Map<string, { amount: number; count: number }>();
  for (const p of payments) {
    const key = p.method || "other";
    const bucket = byMethodMap.get(key) ?? { amount: 0, count: 0 };
    bucket.amount += Number(p.amount_php);
    bucket.count += 1;
    byMethodMap.set(key, bucket);
  }
  const byMethodRows = Array.from(byMethodMap.entries())
    .map(([method, v]) => ({ method, ...v }))
    .sort((a, b) => b.amount - a.amount);

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 12, marginBottom: 4 }}>
        <div>
          <h1 style={{ fontSize: 24, marginBottom: 4 }}>Reports</h1>
          <p style={{ color: "#666", fontSize: 13, marginBottom: 0 }}>
            Core operational numbers for your clinic — visits, documentation, billing, and Records Exchange activity.
          </p>
        </div>
        <RangeTabs activeKey={activeRange.key} />
      </div>

      <p style={{ color: "#999", fontSize: 12, margin: "10px 0 20px" }}>
        Showing {activeRange.label.toLowerCase()} ({formatDayLabel(fromDate)} – {formatDayLabel(today)}), unless noted otherwise.
      </p>

      {/* ── Stat tiles ─────────────────────────────────────────────────── */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 16, marginBottom: 32 }}>
        <StatCard label="Active patients" value={activePatientCount ?? 0} />
        <StatCard label="New patients" value={newPatientCount ?? 0} />
        <StatCard label="Encounters" value={totalEncounters} />
        <StatCard
          label="Appointments"
          value={totalAppointments}
          sub={totalAppointments > 0 ? `${noShowCount} no-show · ${cancelledCount} cancelled` : undefined}
        />
        <StatCard
          label="Documentation completion"
          value={pct(signedEncounters, totalEncounters)}
          sub={totalEncounters > 0 ? `${signedEncounters} of ${totalEncounters} encounters signed` : "No encounters in range"}
        />
      </div>

      {/* ── Visit volume ───────────────────────────────────────────────── */}
      <Section title="Visit volume">
        <div style={{ display: "grid", gridTemplateColumns: "1.2fr 1fr", gap: 20, alignItems: "start" }}>
          <div>
            <SubHeading>By provider</SubHeading>
            {byProviderRows.length > 0 ? (
              <Table
                headers={["Provider", "Visits", "Signed", "Completion"]}
                rows={byProviderRows.map((r) => [r.provider, r.visits, r.signed, pct(r.signed, r.visits)])}
              />
            ) : (
              <EmptyState text="No encounters recorded in this range yet." />
            )}
          </div>
          <div>
            <SubHeading>By day</SubHeading>
            {byDayRows.length > 0 ? (
              <>
                <Table headers={["Date", "Visits"]} rows={byDayRows.map((r) => [formatDayLabel(r.date), r.visits])} />
                {byDayTruncated > 0 && (
                  <p style={{ fontSize: 11.5, color: "#999", padding: "8px 4px 0" }}>
                    +{byDayTruncated} earlier day{byDayTruncated === 1 ? "" : "s"} not shown.
                  </p>
                )}
              </>
            ) : (
              <EmptyState text="No encounters recorded in this range yet." />
            )}
          </div>
        </div>
      </Section>

      {/* ── Revenue ────────────────────────────────────────────────────── */}
      <Section title="Revenue">
        <div style={{ padding: "18px 20px 4px" }}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 16, marginBottom: 20 }}>
            <StatCard label="Invoiced" value={peso(invoicedTotal)} compact />
            <StatCard label="Collected" value={peso(collectedTotal)} compact valueColor="#1a7f37" />
            <StatCard label="Outstanding (current)" value={peso(outstandingTotal)} compact valueColor={outstandingTotal > 0 ? "#a12a2a" : undefined} />
          </div>
        </div>
        <div style={{ padding: "0 20px 20px" }}>
          <SubHeading>Collected by payment method</SubHeading>
          {byMethodRows.length > 0 ? (
            <Table
              headers={["Method", "Amount", "Payments"]}
              rows={byMethodRows.map((r) => [PAYMENT_METHOD_LABEL[r.method] ?? r.method, peso(r.amount), r.count])}
            />
          ) : (
            <EmptyState text="No payments recorded in this range." />
          )}
        </div>
      </Section>

      {/* ── Records Exchange ───────────────────────────────────────────── */}
      <Section title="Records Exchange">
        <div style={{ padding: 20, display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 16 }}>
          <StatCard label="Sent" value={sentTransferCount ?? 0} compact />
          <StatCard label="Received" value={receivedTransferCount ?? 0} compact />
          <StatCard
            label="Awaiting review (current)"
            value={awaitingReviewCount ?? 0}
            compact
            highlight={(awaitingReviewCount ?? 0) > 0}
          />
        </div>
      </Section>
    </div>
  );
}

function RangeTabs({ activeKey }: { activeKey: string }) {
  return (
    <div style={{ display: "flex", gap: 4, border: "1px solid #e2e2e5", borderRadius: 8, padding: 3, background: "white" }}>
      {RANGE_OPTIONS.map((r) => {
        const active = r.key === activeKey;
        return (
          <a
            key={r.key}
            href={`/dashboard/reports?range=${r.key}`}
            style={{
              padding: "6px 12px",
              fontSize: 12.5,
              fontWeight: 600,
              borderRadius: 6,
              textDecoration: "none",
              color: active ? "white" : "#666",
              background: active ? "#0c1730" : "transparent",
              whiteSpace: "nowrap",
            }}
          >
            {r.label}
          </a>
        );
      })}
    </div>
  );
}

function StatCard({
  label,
  value,
  sub,
  compact,
  highlight,
  valueColor,
}: {
  label: string;
  value: number | string;
  sub?: string;
  compact?: boolean;
  highlight?: boolean;
  valueColor?: string;
}) {
  return (
    <div
      style={{
        background: highlight ? "#fff7e6" : "white",
        border: `1px solid ${highlight ? "#e6c66b" : "#e2e2e5"}`,
        borderRadius: 12,
        padding: compact ? 16 : 18,
      }}
    >
      <div style={{ fontSize: compact ? 22 : 26, fontWeight: 700, color: valueColor ?? "#0c1730" }}>{value}</div>
      <div style={{ fontSize: 12.5, color: "#666", marginTop: 2 }}>{label}</div>
      {sub && <div style={{ fontSize: 11.5, color: "#999", marginTop: 4 }}>{sub}</div>}
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 32 }}>
      <h2 style={{ fontSize: 15, marginBottom: 10 }}>{title}</h2>
      <div style={{ background: "white", border: "1px solid #e2e2e5", borderRadius: 12, overflow: "hidden" }}>{children}</div>
    </div>
  );
}

function SubHeading({ children }: { children: React.ReactNode }) {
  return <div style={{ fontSize: 12, fontWeight: 600, color: "#888", textTransform: "uppercase", padding: "14px 16px 0" }}>{children}</div>;
}

function EmptyState({ text }: { text: string }) {
  return <div style={{ padding: "16px", color: "#888", fontSize: 13 }}>{text}</div>;
}

function Table({ headers, rows }: { headers: string[]; rows: (string | number)[][] }) {
  return (
    <div style={{ overflowX: "auto" }}>
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
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
                <td key={j} style={{ padding: "10px 16px", whiteSpace: "nowrap" }}>
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
