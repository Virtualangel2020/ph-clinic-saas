import Link from "next/link";
import { requireClinicMember } from "@/lib/require-clinic-member";

const STATUS_STYLE: Record<string, { color: string; bg: string; border: string; label: string }> = {
  ordered: { color: "#8a6100", bg: "#fff6e6", border: "#f0d998", label: "Ordered" },
  collected: { color: "var(--text-heading)", bg: "#f0f4ff", border: "#c7d4f5", label: "Collected" },
  completed: { color: "#1a7f37", bg: "#eaf7ee", border: "#bfe6c9", label: "Completed" },
  cancelled: { color: "#a12a2a", bg: "#fbeaea", border: "#f0c9c9", label: "Cancelled" },
};

type LabOrderItem = { id: string; test_name: string };

type LabOrderRow = {
  id: string;
  status: string;
  priority: string;
  notes: string | null;
  ordered_at: string;
  patients: { id: string; first_name: string; last_name: string } | null;
  user_profiles: { full_name: string | null } | null;
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
  if (!items || items.length === 0) return "No tests listed";
  const names = items.map((i) => i.test_name).filter(Boolean);
  if (names.length <= 3) return names.join(", ");
  return `${names.slice(0, 3).join(", ")} +${names.length - 3} more`;
}

// Clinic-wide view across every patient's lab orders (see
// /dashboard/patients/[id] where orders actually get placed, from the
// chart's own Lab Orders & Results section). Default view shows every
// non-cancelled order; ?status= narrows to a single status.
export default async function OrdersPage({ searchParams }: { searchParams: { status?: string } }) {
  const { supabase, profile } = await requireClinicMember();
  const statusFilter = searchParams.status || "";

  let query = supabase
    .from("lab_orders")
    .select(
      "id, status, priority, notes, ordered_at, patients(id, first_name, last_name), user_profiles(full_name), lab_order_items(id, test_name)"
    )
    .eq("tenant_id", profile.tenant_id)
    .order("ordered_at", { ascending: false });

  if (statusFilter) {
    query = query.eq("status", statusFilter);
  } else {
    query = query.neq("status", "cancelled");
  }

  const { data: orders } = await query;
  const rows = (orders as unknown as LabOrderRow[]) ?? [];

  const { count: openCount } = await supabase
    .from("lab_orders")
    .select("id", { count: "exact", head: true })
    .eq("tenant_id", profile.tenant_id)
    .in("status", ["ordered", "collected"]);

  const FILTERS: { key: string; label: string }[] = [
    { key: "", label: "All open" },
    { key: "ordered", label: "Ordered" },
    { key: "collected", label: "Collected" },
    { key: "completed", label: "Completed" },
    { key: "cancelled", label: "Cancelled" },
  ];

  return (
    <div>
      <h1 style={{ fontSize: 24, marginBottom: 4 }}>Orders</h1>
      <p style={{ color: "#666", marginBottom: 16, fontSize: 13 }}>
        Every lab order placed across your patients. Add or manage one from a patient's own chart.
      </p>

      <div style={{ display: "flex", gap: 10, marginBottom: 16 }}>
        <div style={{ background: "var(--card-bg)", border: "1px solid var(--card-border)", borderRadius: 10, padding: "10px 18px" }}>
          <div style={{ fontSize: 20, fontWeight: 700, color: "var(--text-heading)" }}>{openCount ?? 0}</div>
          <div style={{ fontSize: 11, color: "#888" }}>Awaiting collection/results</div>
        </div>
      </div>

      <div style={{ display: "flex", gap: 6, marginBottom: 14, flexWrap: "wrap" }}>
        {FILTERS.map((f) => {
          const isActive = statusFilter === f.key;
          return (
            <Link
              key={f.key || "default"}
              href={f.key ? `/dashboard/orders?status=${f.key}` : "/dashboard/orders"}
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
          No lab orders found — open a patient's chart to place one.
        </div>
      ) : (
        <div style={{ display: "grid", gap: 8 }}>
          {rows.map((o) => (
            <Link
              key={o.id}
              href={`/dashboard/patients/${o.patients?.id ?? ""}`}
              style={{ display: "flex", justifyContent: "space-between", alignItems: "center", background: "var(--card-bg)", border: "1px solid var(--card-border)", borderRadius: 10, padding: "12px 16px", textDecoration: "none", gap: 12 }}
            >
              <div>
                <div style={{ fontWeight: 700, fontSize: 13.5, color: "var(--text-heading)" }}>
                  {o.patients ? `${o.patients.last_name}, ${o.patients.first_name}` : "Unknown patient"}
                  <span style={{ marginLeft: 8, display: "inline-flex", gap: 6 }}>
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
