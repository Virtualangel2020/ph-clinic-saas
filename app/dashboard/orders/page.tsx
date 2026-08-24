import Link from "next/link";
import { requireClinicMember } from "@/lib/require-clinic-member";

const STATUS_STYLE: Record<string, { color: string; bg: string; border: string; label: string }> = {
  ordered: { color: "#8a6100", bg: "#fff6e6", border: "#f0d998", label: "Ordered" },
  collected: { color: "var(--text-heading)", bg: "#f0f4ff", border: "#c7d4f5", label: "Collected" },
  completed: { color: "#1a7f37", bg: "#eaf7ee", border: "#bfe6c9", label: "Completed" },
  cancelled: { color: "#a12a2a", bg: "#fbeaea", border: "#f0c9c9", label: "Cancelled" },
};

const ORDER_TYPE_LABEL: Record<string, string> = {
  lab: "Lab",
  imaging: "Imaging",
  procedure: "Procedure",
  referral_related: "Referral-related",
  other: "Other",
};

type LabOrderItem = { id: string; test_name: string };

type LabOrderRow = {
  id: string;
  status: string;
  priority: string;
  order_type: string;
  notes: string | null;
  ordered_at: string;
  patients: { id: string; first_name: string; last_name: string } | null;
  user_profiles: { id: string; full_name: string | null } | null;
  lab_order_items: LabOrderItem[];
};

function StatusPill({ status }: { status: string }) {
  const s = STATUS_STYLE[status] ?? STATUS_STYLE.ordered;
  return (
    <span style={{ fontSize: 10.5, fontWeight: 700, color: s.color, background: s.bg, border: `1px solid ${s.border}`, borderRadius: 999, padding: "2px 8px" }}>
      {s.label}
    </span>
  );
}

function PriorityPill({ priority }: { priority: string }) {
  const stat = priority === "stat";
  return (
    <span
      style={{
        fontSize: 10.5,
        fontWeight: 700,
        color: stat ? "#a12a2a" : "#666",
        background: stat ? "#fbeaea" : "#f2f2f2",
        border: `1px solid ${stat ? "#f0c9c9" : "#ddd"}`,
        borderRadius: 999,
        padding: "2px 8px",
      }}
    >
      {stat ? "STAT" : "Routine"}
    </span>
  );
}

function testSummary(items: LabOrderItem[]) {
  if (!items || items.length === 0) return "No items listed";
  const names = items.map((i) => i.test_name).filter(Boolean);
  if (names.length <= 3) return names.join(", ");
  return `${names.slice(0, 3).join(", ")} +${names.length - 3} more`;
}

type SearchParams = { status?: string; type?: string; provider?: string; patient?: string; from?: string; to?: string };

// Clinic-wide Orders workspace (spec §16-19) across every patient and
// order type — lab, imaging, procedure, referral-related, other — all
// backed by the SAME lab_orders/lab_order_items rows the patient chart's
// Orders & Results tab reads and writes; placing an order here (via
// "+ New Order" → search-patient-first) or from a chart lands in this one
// list either way, never a separate table.
export default async function OrdersPage({ searchParams }: { searchParams: SearchParams }) {
  const { supabase, profile } = await requireClinicMember();
  const statusFilter = searchParams.status || "";
  const typeFilter = searchParams.type || "";
  const providerFilter = searchParams.provider || "";
  const patientQuery = (searchParams.patient || "").trim();
  const fromDate = searchParams.from || "";
  const toDate = searchParams.to || "";

  let query = supabase
    .from("lab_orders")
    .select(
      "id, status, priority, order_type, notes, ordered_at, patients(id, first_name, last_name), user_profiles(id, full_name), lab_order_items(id, test_name)"
    )
    .eq("tenant_id", profile.tenant_id)
    .order("ordered_at", { ascending: false });

  if (statusFilter) query = query.eq("status", statusFilter);
  else query = query.neq("status", "cancelled");
  if (typeFilter) query = query.eq("order_type", typeFilter);
  if (providerFilter) query = query.eq("ordering_provider_id", providerFilter);
  if (fromDate) query = query.gte("ordered_at", fromDate);
  if (toDate) query = query.lte("ordered_at", `${toDate}T23:59:59`);

  const [{ data: orders }, { count: openCount }, { data: providers }] = await Promise.all([
    query,
    supabase.from("lab_orders").select("id", { count: "exact", head: true }).eq("tenant_id", profile.tenant_id).in("status", ["ordered", "collected"]),
    supabase.from("user_profiles").select("id, full_name").eq("tenant_id", profile.tenant_id).eq("role", "doctor").eq("is_active", true).order("full_name"),
  ]);

  let rows = (orders as unknown as LabOrderRow[]) ?? [];
  if (patientQuery) {
    const q = patientQuery.toLowerCase();
    rows = rows.filter((o) => o.patients && `${o.patients.last_name}, ${o.patients.first_name}`.toLowerCase().includes(q));
  }

  const FILTERS: { key: string; label: string }[] = [
    { key: "", label: "All open" },
    { key: "ordered", label: "Ordered" },
    { key: "collected", label: "Collected" },
    { key: "completed", label: "Completed" },
    { key: "cancelled", label: "Cancelled" },
  ];

  const hasFilters = !!(statusFilter || typeFilter || providerFilter || patientQuery || fromDate || toDate);

  function withParams(overrides: Partial<SearchParams>) {
    const merged = { ...searchParams, ...overrides };
    const qs = new URLSearchParams();
    if (merged.status) qs.set("status", merged.status);
    if (merged.type) qs.set("type", merged.type);
    if (merged.provider) qs.set("provider", merged.provider);
    if (merged.patient) qs.set("patient", merged.patient);
    if (merged.from) qs.set("from", merged.from);
    if (merged.to) qs.set("to", merged.to);
    const s = qs.toString();
    return s ? `/dashboard/orders?${s}` : "/dashboard/orders";
  }

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12, flexWrap: "wrap", marginBottom: 4 }}>
        <h1 style={{ fontSize: 24 }}>Orders</h1>
        <Link
          href="/dashboard/orders/new"
          style={{ background: "#0c1730", color: "#e6c66b", fontWeight: 700, fontSize: 12.5, padding: "9px 16px", borderRadius: 8, textDecoration: "none" }}
        >
          + New Order
        </Link>
      </div>
      <p style={{ color: "#666", marginBottom: 16, fontSize: 13 }}>
        Every order placed across your patients — lab, imaging, procedures, and more. Filter below, or open a patient's
        chart to manage one in context.
      </p>

      <div style={{ display: "flex", gap: 10, marginBottom: 16 }}>
        <div style={{ background: "var(--card-bg)", border: "1px solid var(--card-border)", borderRadius: 10, padding: "10px 18px" }}>
          <div style={{ fontSize: 20, fontWeight: 700, color: "var(--text-heading)" }}>{openCount ?? 0}</div>
          <div style={{ fontSize: 11, color: "#888" }}>Awaiting collection/results</div>
        </div>
      </div>

      <form
        action="/dashboard/orders"
        method="get"
        style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "flex-end", marginBottom: 12, background: "var(--card-bg)", border: "1px solid var(--card-border)", borderRadius: 10, padding: 12 }}
      >
        <div>
          <div style={filterLabelStyle}>Patient</div>
          <input name="patient" defaultValue={patientQuery} placeholder="Search by name…" style={filterInputStyle} />
        </div>
        <div>
          <div style={filterLabelStyle}>Provider</div>
          <select name="provider" defaultValue={providerFilter} style={filterInputStyle}>
            <option value="">All providers</option>
            {(providers as any[])?.map((p) => (
              <option key={p.id} value={p.id}>
                {p.full_name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <div style={filterLabelStyle}>Order Type</div>
          <select name="type" defaultValue={typeFilter} style={filterInputStyle}>
            <option value="">All types</option>
            {Object.entries(ORDER_TYPE_LABEL).map(([k, l]) => (
              <option key={k} value={k}>
                {l}
              </option>
            ))}
          </select>
        </div>
        <div>
          <div style={filterLabelStyle}>Ordered from</div>
          <input type="date" name="from" defaultValue={fromDate} style={filterInputStyle} />
        </div>
        <div>
          <div style={filterLabelStyle}>Ordered to</div>
          <input type="date" name="to" defaultValue={toDate} style={filterInputStyle} />
        </div>
        <input type="hidden" name="status" value={statusFilter} />
        <button type="submit" style={{ background: "#0c1730", color: "white", border: "none", borderRadius: 8, padding: "8px 16px", fontSize: 12.5, cursor: "pointer" }}>
          Apply
        </button>
        {hasFilters && (
          <Link href="/dashboard/orders" style={{ fontSize: 12, color: "#999", textDecoration: "none", padding: "8px 4px" }}>
            Reset Filters
          </Link>
        )}
      </form>

      <div style={{ display: "flex", gap: 6, marginBottom: 14, flexWrap: "wrap" }}>
        {FILTERS.map((f) => {
          const isActive = statusFilter === f.key;
          return (
            <Link
              key={f.key || "default"}
              href={withParams({ status: f.key || undefined })}
              style={{
                fontSize: 12,
                fontWeight: 600,
                padding: "5px 12px",
                borderRadius: 999,
                textDecoration: "none",
                border: `1px solid ${isActive ? "#0c1730" : "#ddd"}`,
                color: isActive ? "white" : "#555",
                background: isActive ? "#0c1730" : "white",
              }}
            >
              {f.label}
            </Link>
          );
        })}
      </div>

      {rows.length === 0 ? (
        <div style={{ background: "var(--card-bg)", border: "1px solid var(--card-border)", borderRadius: 12, padding: 24, color: "#888", fontSize: 13 }}>
          No orders match these filters.
        </div>
      ) : (
        <div style={{ display: "grid", gap: 8 }}>
          {rows.map((o) => (
            <Link
              key={o.id}
              href={`/dashboard/patients/${o.patients?.id ?? ""}?tab=orders_results`}
              style={{ display: "flex", justifyContent: "space-between", alignItems: "center", background: "var(--card-bg)", border: "1px solid var(--card-border)", borderRadius: 10, padding: "12px 16px", textDecoration: "none", gap: 12 }}
            >
              <div>
                <div style={{ fontWeight: 700, fontSize: 13.5, color: "var(--text-heading)" }}>
                  {o.patients ? `${o.patients.last_name}, ${o.patients.first_name}` : "Unknown patient"}
                  <span style={{ marginLeft: 8, display: "inline-flex", gap: 6, flexWrap: "wrap" }}>
                    <span style={{ fontSize: 10.5, fontWeight: 700, color: "#555", background: "#f2f2f2", border: "1px solid #ddd", borderRadius: 999, padding: "2px 8px" }}>
                      {ORDER_TYPE_LABEL[o.order_type] ?? o.order_type}
                    </span>
                    <PriorityPill priority={o.priority} />
                    <StatusPill status={o.status} />
                  </span>
                </div>
                <div style={{ fontSize: 12.5, color: "#333", marginTop: 2 }}>{testSummary(o.lab_order_items)}</div>
                <div style={{ fontSize: 11.5, color: "#888", marginTop: 2 }}>
                  {o.user_profiles?.full_name ?? "Unknown provider"} · {new Date(o.ordered_at).toLocaleDateString()}
                </div>
              </div>
              <div style={{ color: "#bbb", fontSize: 18 }}>›</div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

const filterLabelStyle: React.CSSProperties = { fontSize: 10.5, fontWeight: 600, color: "#888", marginBottom: 3 };
const filterInputStyle: React.CSSProperties = { border: "1px solid var(--input-border)", borderRadius: 7, padding: "7px 9px", fontSize: 12.5, fontFamily: "inherit" };
