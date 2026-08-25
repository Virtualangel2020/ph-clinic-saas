import Link from "next/link";
import { requireClinicMember } from "@/lib/require-clinic-member";
import { resolveFinancialRange, type FinancialRangeKey } from "./date-range";

// Clinic Financial dashboard — clinic-wide roll-up of the patient billing
// ledger (patient_charges / patient_charge_payments, the same tables the
// per-patient Billing tab already writes to). This is DELIBERATELY not the
// same thing as Settings → Reports' "Revenue" section, which reports the
// clinic's own SaaS-subscription invoices/payments (what the clinic owes
// AngelClinic) — this page is what the clinic's PATIENTS owe the clinic.
// Nothing here writes; every charge/payment is still recorded from the
// patient chart (or, once configured, via PayMongo — see Settings →
// Payments), and shows up here automatically since it's the same rows.
//
// "Only show categories that have applicable data" (spec §23) is handled
// by simply omitting a stat/section whose total is zero — see the `cards`
// array below and the `.length > 0` guards on each breakdown section.

type SearchParams = {
  range?: string;
  month?: string;
  year?: string;
  from?: string;
  to?: string;
  patient?: string;
  provider?: string;
  method?: string;
};

const METHOD_LABEL: Record<string, string> = {
  cash: "Cash",
  hmo: "HMO",
  philhealth: "PhilHealth",
  yakap: "YAKAP",
  paymongo: "PayMongo",
  other: "Other",
};

const RANGE_PRESETS: { key: FinancialRangeKey; label: string }[] = [
  { key: "today", label: "Today" },
  { key: "week", label: "This Week" },
  { key: "month", label: "This Month" },
  { key: "last_month", label: "Last Month" },
];

function peso(n: number) {
  return `₱${n.toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export default async function FinancialsPage({ searchParams }: { searchParams: SearchParams }) {
  const { supabase, profile } = await requireClinicMember();
  const tenantId = profile.tenant_id as string;

  const range = resolveFinancialRange(searchParams);
  const patientQuery = (searchParams.patient ?? "").trim();
  const providerFilter = searchParams.provider ?? "";
  const methodFilter = searchParams.method ?? "";
  const hasFilters = !!(patientQuery || providerFilter || methodFilter || searchParams.range || searchParams.month || searchParams.year || searchParams.from);

  const [{ data: chargeRows }, { data: paymentRows }, { data: providers }] = await Promise.all([
    supabase
      .from("patient_charges")
      .select(
        "id, patient_id, description, amount_php, bill_type, status, provider_id, created_at, patients(first_name, last_name), user_profiles!patient_charges_provider_id_fkey(full_name, title)"
      )
      .eq("tenant_id", tenantId)
      .gte("created_at", range.from)
      .lt("created_at", range.toExclusive)
      .order("created_at", { ascending: false }),
    supabase
      .from("patient_charge_payments")
      .select("id, patient_id, charge_id, amount_php, method, reference, paid_at, created_at, patients(first_name, last_name)")
      .eq("tenant_id", tenantId)
      .gte("paid_at", range.from)
      .lt("paid_at", range.toExclusive)
      .order("paid_at", { ascending: false }),
    supabase.from("user_profiles").select("id, full_name, title").eq("tenant_id", tenantId).eq("role", "doctor").eq("is_active", true).order("full_name"),
  ]);

  type Charge = {
    id: string;
    patient_id: string;
    description: string;
    amount_php: number;
    bill_type: string;
    status: string;
    provider_id: string | null;
    created_at: string;
    patient_name: string;
    provider_name: string | null;
  };
  type Payment = {
    id: string;
    patient_id: string;
    charge_id: string | null;
    amount_php: number;
    method: string;
    reference: string | null;
    paid_at: string;
    patient_name: string;
  };

  let charges: Charge[] = ((chargeRows as any[]) ?? []).map((c) => ({
    id: c.id,
    patient_id: c.patient_id,
    description: c.description,
    amount_php: Number(c.amount_php),
    bill_type: c.bill_type,
    status: c.status,
    provider_id: c.provider_id,
    created_at: c.created_at,
    patient_name: c.patients ? `${c.patients.last_name}, ${c.patients.first_name}` : "Unknown patient",
    provider_name: c.user_profiles ? `${c.user_profiles.title ? c.user_profiles.title + " " : ""}${c.user_profiles.full_name}` : null,
  }));
  let payments: Payment[] = ((paymentRows as any[]) ?? []).map((p) => ({
    id: p.id,
    patient_id: p.patient_id,
    charge_id: p.charge_id,
    amount_php: Number(p.amount_php),
    method: p.method,
    reference: p.reference,
    paid_at: p.paid_at,
    patient_name: p.patients ? `${p.patients.last_name}, ${p.patients.first_name}` : "Unknown patient",
  }));

  if (patientQuery) {
    const q = patientQuery.toLowerCase();
    charges = charges.filter((c) => c.patient_name.toLowerCase().includes(q));
    payments = payments.filter((p) => p.patient_name.toLowerCase().includes(q));
  }
  if (providerFilter) {
    charges = charges.filter((c) => c.provider_id === providerFilter);
    // Payments don't carry their own provider — attribute via the charge
    // they were applied to when there is one; a generic "overall balance"
    // payment (charge_id null) has no provider to filter on and drops out.
    const chargeIdsForProvider = new Set(charges.map((c) => c.id));
    payments = payments.filter((p) => p.charge_id && chargeIdsForProvider.has(p.charge_id));
  }
  if (methodFilter) {
    payments = payments.filter((p) => p.method === methodFilter);
  }

  // ── Summary cards (§23) — only rendered when the category has data ────
  const openCharges = charges.filter((c) => c.status !== "void");
  const totalBilled = openCharges.reduce((s, c) => s + c.amount_php, 0);
  const totalCollected = payments.reduce((s, p) => s + p.amount_php, 0);

  const byMethodMap = new Map<string, { amount: number; count: number }>();
  for (const p of payments) {
    const b = byMethodMap.get(p.method) ?? { amount: 0, count: 0 };
    b.amount += p.amount_php;
    b.count += 1;
    byMethodMap.set(p.method, b);
  }
  const byMethodRows = Array.from(byMethodMap.entries())
    .map(([method, v]) => ({ method, ...v }))
    .sort((a, b) => b.amount - a.amount);

  // Outstanding balance is a CURRENT snapshot (all-time, not range-scoped)
  // — matching the same "owed right now" logic as the patient chart's own
  // Billing tab, so the two never disagree. Computed via a second,
  // unfiltered-by-date query below.
  const { data: allOpenChargeRows } = await supabase.from("patient_charges").select("patient_id, amount_php, status").eq("tenant_id", tenantId).neq("status", "void");
  const { data: allPaymentRows } = await supabase.from("patient_charge_payments").select("patient_id, amount_php").eq("tenant_id", tenantId);
  const chargedByPatient = new Map<string, number>();
  for (const c of (allOpenChargeRows as any[]) ?? []) chargedByPatient.set(c.patient_id, (chargedByPatient.get(c.patient_id) ?? 0) + Number(c.amount_php));
  const paidByPatient = new Map<string, number>();
  for (const p of (allPaymentRows as any[]) ?? []) paidByPatient.set(p.patient_id, (paidByPatient.get(p.patient_id) ?? 0) + Number(p.amount_php));
  const outstandingTotal = Array.from(chargedByPatient.entries()).reduce((sum, [pid, charged]) => sum + Math.max(0, charged - (paidByPatient.get(pid) ?? 0)), 0);

  const cards: { label: string; value: string; color?: string }[] = [
    { label: "Total Billed", value: peso(totalBilled) },
    { label: "Total Collected", value: peso(totalCollected), color: "#1a7f37" },
  ];
  if (outstandingTotal > 0) cards.push({ label: "Outstanding Balance", value: peso(outstandingTotal), color: "#a12a2a" });
  for (const key of ["paymongo", "cash", "hmo", "philhealth", "yakap", "other"]) {
    const row = byMethodRows.find((r) => r.method === key);
    if (row && row.amount > 0) cards.push({ label: `${METHOD_LABEL[key] ?? key} Collections`, value: peso(row.amount) });
  }

  // ── Revenue by provider / patient balances / recent transactions ──────
  const byProviderMap = new Map<string, number>();
  for (const c of openCharges) byProviderMap.set(c.provider_name ?? "Unassigned", (byProviderMap.get(c.provider_name ?? "Unassigned") ?? 0) + c.amount_php);
  const byProviderRows = Array.from(byProviderMap.entries()).map(([provider, amount]) => ({ provider, amount })).sort((a, b) => b.amount - a.amount);

  const byServiceMap = new Map<string, { amount: number; count: number }>();
  for (const c of openCharges) {
    const b = byServiceMap.get(c.description) ?? { amount: 0, count: 0 };
    b.amount += c.amount_php;
    b.count += 1;
    byServiceMap.set(c.description, b);
  }
  const byServiceRows = Array.from(byServiceMap.entries()).map(([service, v]) => ({ service, ...v })).sort((a, b) => b.amount - a.amount).slice(0, 15);

  const patientBalanceRows = Array.from(chargedByPatient.entries())
    .map(([pid, charged]) => ({ patient_id: pid, balance: Math.max(0, charged - (paidByPatient.get(pid) ?? 0)) }))
    .filter((r) => r.balance > 0)
    .sort((a, b) => b.balance - a.balance)
    .slice(0, 25);
  // Patient names for the balance list — pulled once, only for the ids we need.
  const balancePatientIds = patientBalanceRows.map((r) => r.patient_id);
  const { data: balancePatients } = balancePatientIds.length
    ? await supabase.from("patients").select("id, first_name, last_name").in("id", balancePatientIds)
    : { data: [] as any[] };
  const patientNameById = new Map(((balancePatients as any[]) ?? []).map((p) => [p.id, `${p.last_name}, ${p.first_name}`]));

  const outstandingChargeRows = openCharges.filter((c) => c.status === "open").slice(0, 25);

  const recentTransactions = [
    ...charges.map((c) => ({ kind: "charge" as const, id: c.id, date: c.created_at, patient: c.patient_name, label: c.description, amount: c.amount_php, method: c.bill_type })),
    ...payments.map((p) => ({ kind: "payment" as const, id: p.id, date: p.paid_at, patient: p.patient_name, label: "Payment received", amount: p.amount_php, method: p.method })),
  ]
    .sort((a, b) => (a.date < b.date ? 1 : -1))
    .slice(0, 30);

  function withParams(overrides: Record<string, string | undefined>) {
    const qs = new URLSearchParams();
    const merged = { ...searchParams, ...overrides };
    Object.entries(merged).forEach(([k, v]) => {
      if (v) qs.set(k, v);
    });
    const s = qs.toString();
    return s ? `/dashboard/financials?${s}` : "/dashboard/financials";
  }

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 12, marginBottom: 4 }}>
        <div>
          <h1 style={{ fontSize: 24, marginBottom: 4 }}>Financial</h1>
          <p style={{ color: "#666", fontSize: 13, marginBottom: 0 }}>
            What your patients owe and have paid — billed, collected, and outstanding across the clinic. This is
            separate from your own AngelClinic subscription billing (see Settings → Billing).
          </p>
        </div>
      </div>

      {/* ── Date controls (§22) ─────────────────────────────────────────── */}
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center", margin: "16px 0" }}>
        <div style={{ display: "flex", gap: 4, border: "1px solid var(--card-border)", borderRadius: 8, padding: 3, background: "var(--card-bg)", flexWrap: "wrap" }}>
          {RANGE_PRESETS.map((r) => (
            <Link
              key={r.key}
              href={`/dashboard/financials?range=${r.key}${providerFilter ? `&provider=${providerFilter}` : ""}${patientQuery ? `&patient=${encodeURIComponent(patientQuery)}` : ""}${methodFilter ? `&method=${methodFilter}` : ""}`}
              style={{
                padding: "6px 12px",
                fontSize: 12.5,
                fontWeight: 600,
                borderRadius: 6,
                textDecoration: "none",
                whiteSpace: "nowrap",
                color: range.key === r.key ? "white" : "#666",
                background: range.key === r.key ? "#0c1730" : "transparent",
              }}
            >
              {r.label}
            </Link>
          ))}
        </div>

        <form action="/dashboard/financials" method="get" style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}>
          <select name="month" defaultValue="" style={filterInputStyle}>
            <option value="">Month…</option>
            {monthOptions().map((m) => (
              <option key={m.value} value={m.value}>
                {m.label}
              </option>
            ))}
          </select>
          <select name="year" defaultValue="" style={filterInputStyle}>
            <option value="">Year…</option>
            {yearOptions().map((y) => (
              <option key={y} value={y}>
                {y}
              </option>
            ))}
          </select>
          <span style={{ fontSize: 11.5, color: "#999" }}>or</span>
          <input type="date" name="from" style={filterInputStyle} />
          <span style={{ fontSize: 11.5, color: "#999" }}>to</span>
          <input type="date" name="to" style={filterInputStyle} />
          <button type="submit" style={{ background: "#0c1730", color: "white", border: "none", borderRadius: 8, padding: "7px 14px", fontSize: 12.5, cursor: "pointer" }}>
            Go
          </button>
        </form>
      </div>
      <p style={{ color: "#999", fontSize: 12, margin: "0 0 20px" }}>Showing {range.label}, unless noted otherwise.</p>

      {/* ── Filters (§25) ───────────────────────────────────────────────── */}
      <form
        action="/dashboard/financials"
        method="get"
        style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "flex-end", marginBottom: 20, background: "var(--card-bg)", border: "1px solid var(--card-border)", borderRadius: 10, padding: 12 }}
      >
        <input type="hidden" name="range" value={searchParams.range ?? ""} />
        <input type="hidden" name="month" value={searchParams.month ?? ""} />
        <input type="hidden" name="year" value={searchParams.year ?? ""} />
        <input type="hidden" name="from" value={searchParams.from ?? ""} />
        <input type="hidden" name="to" value={searchParams.to ?? ""} />
        <div>
          <div style={filterLabelStyle}>Patient</div>
          <input name="patient" defaultValue={patientQuery} placeholder="Search by name…" style={filterInputStyle} />
        </div>
        <div>
          <div style={filterLabelStyle}>Provider</div>
          <select name="provider" defaultValue={providerFilter} style={filterInputStyle}>
            <option value="">All providers</option>
            {((providers as any[]) ?? []).map((p) => (
              <option key={p.id} value={p.id}>
                {p.title ? `${p.title} ` : ""}
                {p.full_name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <div style={filterLabelStyle}>Payment method</div>
          <select name="method" defaultValue={methodFilter} style={filterInputStyle}>
            <option value="">All methods</option>
            {Object.entries(METHOD_LABEL).map(([k, l]) => (
              <option key={k} value={k}>
                {l}
              </option>
            ))}
          </select>
        </div>
        <button type="submit" style={{ background: "#0c1730", color: "white", border: "none", borderRadius: 8, padding: "8px 16px", fontSize: 12.5, cursor: "pointer" }}>
          Apply
        </button>
        {hasFilters && (
          <Link href="/dashboard/financials" style={{ fontSize: 12, color: "#999", textDecoration: "none", padding: "8px 4px" }}>
            Reset Filters
          </Link>
        )}
      </form>

      {/* ── Summary cards ───────────────────────────────────────────────── */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 14, marginBottom: 28 }}>
        {cards.map((c) => (
          <StatCard key={c.label} label={c.label} value={c.value} color={c.color} />
        ))}
      </div>

      {/* ── Revenue by provider / service / method ──────────────────────── */}
      <div className="financial-breakdown-grid" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20, marginBottom: 28 }}>
        <Section title="Revenue by Provider">
          {byProviderRows.length > 0 ? (
            <Table headers={["Provider", "Billed"]} rows={byProviderRows.map((r) => [r.provider, peso(r.amount)])} />
          ) : (
            <EmptyState text="No charges recorded in this range." />
          )}
        </Section>
        <Section title="Revenue by Payment Method">
          {byMethodRows.length > 0 ? (
            <Table headers={["Method", "Amount", "Payments"]} rows={byMethodRows.map((r) => [METHOD_LABEL[r.method] ?? r.method, peso(r.amount), r.count])} />
          ) : (
            <EmptyState text="No payments recorded in this range." />
          )}
        </Section>
      </div>

      <Section title="Revenue by Service">
        {byServiceRows.length > 0 ? (
          <Table headers={["Service / Item", "Billed", "Count"]} rows={byServiceRows.map((r) => [r.service, peso(r.amount), r.count])} />
        ) : (
          <EmptyState text="No charges recorded in this range." />
        )}
      </Section>

      <div style={{ height: 8 }} />

      {patientBalanceRows.length > 0 && (
        <Section title="Patient Balances (all-time, current)">
          <Table
            headers={["Patient", "Balance"]}
            rows={patientBalanceRows.map((r) => [
              <Link key={r.patient_id} href={`/dashboard/patients/${r.patient_id}?tab=billing`} style={{ color: "var(--text-heading)", fontWeight: 600, textDecoration: "none" }}>
                {patientNameById.get(r.patient_id) ?? "Unknown patient"}
              </Link>,
              peso(r.balance),
            ])}
          />
        </Section>
      )}

      {outstandingChargeRows.length > 0 && (
        <Section title="Outstanding Invoices">
          <Table
            headers={["Patient", "Description", "Provider", "Date", "Amount"]}
            rows={outstandingChargeRows.map((c) => [
              <Link key={c.id} href={`/dashboard/patients/${c.patient_id}?tab=billing`} style={{ color: "var(--text-heading)", fontWeight: 600, textDecoration: "none" }}>
                {c.patient_name}
              </Link>,
              c.description,
              c.provider_name ?? "—",
              new Date(c.created_at).toLocaleDateString(),
              peso(c.amount_php),
            ])}
          />
        </Section>
      )}

      <Section title="Recent Transactions">
        {recentTransactions.length > 0 ? (
          <Table
            headers={["Date", "Patient", "Description", "Method", "Amount"]}
            rows={recentTransactions.map((t) => [
              new Date(t.date).toLocaleDateString(),
              t.patient,
              t.label,
              METHOD_LABEL[t.method] ?? t.method,
              <span key={t.id} style={{ color: t.kind === "payment" ? "#1a7f37" : undefined, fontWeight: t.kind === "payment" ? 700 : 400 }}>
                {t.kind === "payment" ? "+" : ""}
                {peso(t.amount)}
              </span>,
            ])}
          />
        ) : (
          <EmptyState text="No billing activity in this range." />
        )}
      </Section>

      <style>{`
        @media (max-width: 760px) {
          .financial-breakdown-grid { grid-template-columns: 1fr !important; }
        }
      `}</style>
    </div>
  );
}

function monthOptions(): { value: string; label: string }[] {
  const out: { value: string; label: string }[] = [];
  const now = new Date();
  for (let i = 0; i < 18; i++) {
    const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i, 1));
    const value = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
    out.push({ value, label: d.toLocaleDateString("en-PH", { year: "numeric", month: "long", timeZone: "UTC" }) });
  }
  return out;
}

function yearOptions(): number[] {
  const y = new Date().getUTCFullYear();
  return [y, y - 1, y - 2];
}

const filterLabelStyle: React.CSSProperties = { fontSize: 10.5, fontWeight: 600, color: "#888", marginBottom: 3 };
const filterInputStyle: React.CSSProperties = { border: "1px solid var(--input-border)", borderRadius: 7, padding: "7px 9px", fontSize: 12.5, fontFamily: "inherit" };

function StatCard({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div style={{ background: "var(--card-bg)", border: "1px solid var(--card-border)", borderRadius: 12, padding: 16 }}>
      <div style={{ fontSize: 20, fontWeight: 700, color: color ?? "var(--text-heading)" }}>{value}</div>
      <div style={{ fontSize: 12, color: "#888", marginTop: 2 }}>{label}</div>
    </div>
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
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13, minWidth: 420 }}>
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
