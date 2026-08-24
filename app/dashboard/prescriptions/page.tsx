import Link from "next/link";
import { requireClinicMember } from "@/lib/require-clinic-member";

const STATUS_STYLE: Record<string, { color: string; bg: string; border: string; label: string }> = {
  active: { color: "#1a7f37", bg: "#eaf7ee", border: "#bfe6c9", label: "Active" },
  completed: { color: "#0c1730", bg: "#f0f4ff", border: "#c7d4f5", label: "Completed" },
  cancelled: { color: "#a12a2a", bg: "#fbeaea", border: "#f0c9c9", label: "Cancelled" },
};

type PrescriptionItem = { id: string; drug_name: string; dosage: string | null; form: string | null; frequency: string | null };

type PrescriptionRow = {
  id: string;
  status: string;
  notes: string | null;
  prescribed_at: string;
  patients: { id: string; first_name: string; last_name: string } | null;
  user_profiles: { full_name: string | null } | null;
  prescription_items: PrescriptionItem[];
};

function StatusPill({ status }: { status: string }) {
  const s = STATUS_STYLE[status] ?? STATUS_STYLE.active;
  return (
    <span style={{ fontSize: 10.5, fontWeight: 700, color: s.color, background: s.bg, border: `1px solid ${s.border}`, borderRadius: 999, padding: "2px 8px" }}>
      {s.label}
    </span>
  );
}

function drugSummary(items: PrescriptionItem[]) {
  if (!items || items.length === 0) return "No items";
  const names = items.map((i) => i.drug_name).filter(Boolean);
  if (names.length <= 2) return names.join(", ");
  return `${names.slice(0, 2).join(", ")} +${names.length - 2} more`;
}

// Clinic-wide view across every patient's prescriptions (see
// /dashboard/patients/[id] where prescriptions actually get written, from
// the chart's own Prescriptions section). Default view shows active +
// completed; ?status=cancelled (or any single status) narrows to just that.
export default async function PrescriptionsPage({ searchParams }: { searchParams: { status?: string } }) {
  const { supabase, profile } = await requireClinicMember();
  const statusFilter = searchParams.status || "";

  let query = supabase
    .from("prescriptions")
    .select(
      "id, status, notes, prescribed_at, patients(id, first_name, last_name), user_profiles(full_name), prescription_items(id, drug_name, dosage, form, frequency)"
    )
    .eq("tenant_id", profile.tenant_id)
    .order("prescribed_at", { ascending: false });

  if (statusFilter) {
    query = query.eq("status", statusFilter);
  } else {
    query = query.in("status", ["active", "completed"]);
  }

  const { data: prescriptions } = await query;
  const rows = (prescriptions as unknown as PrescriptionRow[]) ?? [];

  const { count: activeCount } = await supabase
    .from("prescriptions")
    .select("id", { count: "exact", head: true })
    .eq("tenant_id", profile.tenant_id)
    .eq("status", "active");

  const FILTERS: { key: string; label: string }[] = [
    { key: "", label: "Active + Completed" },
    { key: "active", label: "Active" },
    { key: "completed", label: "Completed" },
    { key: "cancelled", label: "Cancelled" },
  ];

  return (
    <div>
      <h1 style={{ fontSize: 24, marginBottom: 4 }}>Prescriptions</h1>
      <p style={{ color: "#666", marginBottom: 16, fontSize: 13 }}>
        Every prescription written across your patients. Add or manage one from a patient's own chart.
      </p>

      <div style={{ display: "flex", gap: 10, marginBottom: 16 }}>
        <div style={{ background: "white", border: "1px solid #e2e2e5", borderRadius: 10, padding: "10px 18px" }}>
          <div style={{ fontSize: 20, fontWeight: 700, color: "#0c1730" }}>{activeCount ?? 0}</div>
          <div style={{ fontSize: 11, color: "#888" }}>Active prescriptions</div>
        </div>
      </div>

      <div style={{ display: "flex", gap: 6, marginBottom: 14 }}>
        {FILTERS.map((f) => {
          const isActive = statusFilter === f.key;
          return (
            <Link
              key={f.key || "default"}
              href={f.key ? `/dashboard/prescriptions?status=${f.key}` : "/dashboard/prescriptions"}
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
        <div style={{ background: "white", border: "1px solid #e2e2e5", borderRadius: 12, padding: 24, color: "#888", fontSize: 13 }}>
          No prescriptions found — open a patient's chart to write one.
        </div>
      ) : (
        <div style={{ display: "grid", gap: 8 }}>
          {rows.map((p) => (
            <Link
              key={p.id}
              href={`/dashboard/patients/${p.patients?.id ?? ""}`}
              style={{ display: "flex", justifyContent: "space-between", alignItems: "center", background: "white", border: "1px solid #e2e2e5", borderRadius: 10, padding: "12px 16px", textDecoration: "none", gap: 12 }}
            >
              <div>
                <div style={{ fontWeight: 700, fontSize: 13.5, color: "#0c1730" }}>
                  {p.patients ? `${p.patients.last_name}, ${p.patients.first_name}` : "Unknown patient"}
                  <span style={{ marginLeft: 8 }}>
                    <StatusPill status={p.status} />
                  </span>
                </div>
                <div style={{ fontSize: 12.5, color: "#333", marginTop: 2 }}>{drugSummary(p.prescription_items)}</div>
                <div style={{ fontSize: 11.5, color: "#888", marginTop: 2 }}>
                  {p.user_profiles?.full_name ?? "Unknown prescriber"} · {new Date(p.prescribed_at).toLocaleDateString()}
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
