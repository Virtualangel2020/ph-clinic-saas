import Link from "next/link";
import { requireClinicMember } from "@/lib/require-clinic-member";

const STATUS_FILTERS = ["active", "inactive", "expired", "all"] as const;
type StatusFilter = (typeof STATUS_FILTERS)[number];

const STATUS_STYLE: Record<string, { bg: string; border: string; color: string }> = {
  active: { bg: "#eaf7ee", border: "#bfe6c9", color: "#1a7f37" },
  inactive: { bg: "#f2f2f2", border: "#ddd", color: "#666" },
  expired: { bg: "#fbebeb", border: "#eec7c7", color: "#a12a2a" },
};

function StatusPill({ status }: { status: string }) {
  const s = STATUS_STYLE[status] ?? STATUS_STYLE.inactive;
  return (
    <span style={{ fontSize: 10.5, fontWeight: 700, color: s.color, background: s.bg, border: `1px solid ${s.border}`, borderRadius: 999, padding: "2px 8px", textTransform: "capitalize" }}>
      {status}
    </span>
  );
}

// Clinic-wide view across every patient's insurance/HMO plans (see
// /dashboard/patients/[id]'s Coverage tab where plans actually live and
// get added, via coverage-section.tsx). Writes go through the RPCs in
// ./actions.ts — this page only reads, same pattern as
// /dashboard/documents.
export default async function InsurancePage({ searchParams }: { searchParams: Promise<{ status?: string }> }) {
  const { supabase, profile } = await requireClinicMember();
  const { status } = await searchParams;
  const filter: StatusFilter = (STATUS_FILTERS as readonly string[]).includes(status ?? "") ? (status as StatusFilter) : "active";

  let query = supabase
    .from("patient_insurance")
    .select("id, provider_name, member_number, plan_name, status, effective_date, expiry_date, patient_id, patients(id, first_name, last_name)")
    .eq("tenant_id", profile.tenant_id);

  if (filter !== "all") query = query.eq("status", filter);

  const { data: plansRaw } = await query;
  const plans = ((plansRaw as any[]) ?? []).sort((a, b) => (a.patients?.last_name ?? "").localeCompare(b.patients?.last_name ?? ""));

  const todayIso = new Date().toISOString().slice(0, 10);
  const activeCount = plans.filter((p) => p.status === "active").length;

  return (
    <div>
      <h1 style={{ fontSize: 24, marginBottom: 4 }}>Insurance / HMO</h1>
      <p style={{ color: "#666", marginBottom: 12, fontSize: 13 }}>
        Every insurance/HMO plan on file across your patients. Add or update a plan from a patient's own chart.
      </p>

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16, flexWrap: "wrap", gap: 10 }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: "var(--text-heading)" }}>
          {activeCount} active plan{activeCount === 1 ? "" : "s"}
        </div>
        <div style={{ display: "flex", gap: 6 }}>
          {STATUS_FILTERS.map((s) => (
            <Link
              key={s}
              href={s === "active" ? "/dashboard/insurance" : `/dashboard/insurance?status=${s}`}
              style={{
                fontSize: 11.5,
                fontWeight: 600,
                textTransform: "capitalize",
                textDecoration: "none",
                padding: "4px 10px",
                borderRadius: 999,
                border: `1px solid ${filter === s ? "#0c1730" : "#ddd"}`,
                background: filter === s ? "#0c1730" : "white",
                color: filter === s ? "white" : "#555",
              }}
            >
              {s}
            </Link>
          ))}
        </div>
      </div>

      {plans.length === 0 ? (
        <div style={{ background: "var(--card-bg)", border: "1px solid var(--card-border)", borderRadius: 12, padding: 24, color: "#888", fontSize: 13 }}>
          No {filter === "all" ? "" : filter} insurance plans on file — open a patient's chart to add one.
        </div>
      ) : (
        <div style={{ display: "grid", gap: 8 }}>
          {plans.map((p) => {
            const isPastExpiry = !!p.expiry_date && p.expiry_date < todayIso;
            return (
              <Link
                key={p.id}
                href={`/dashboard/patients/${p.patients?.id}`}
                style={{ display: "flex", justifyContent: "space-between", alignItems: "center", background: "var(--card-bg)", border: "1px solid var(--card-border)", borderRadius: 10, padding: "12px 16px", textDecoration: "none", gap: 12, flexWrap: "wrap" }}
              >
                <div>
                  <div style={{ fontWeight: 700, fontSize: 13.5, color: "var(--text-heading)" }}>
                    {p.patients ? `${p.patients.last_name}, ${p.patients.first_name}` : "Unknown patient"}
                    <span style={{ marginLeft: 8 }}>
                      <StatusPill status={p.status} />
                    </span>
                  </div>
                  <div style={{ fontSize: 12, color: "#888" }}>
                    {p.provider_name}
                    {p.plan_name ? ` — ${p.plan_name}` : ""}
                    {p.member_number ? ` · #${p.member_number}` : ""}
                  </div>
                </div>
                <div style={{ fontSize: 11.5, color: isPastExpiry ? "#a12a2a" : "#999", fontWeight: isPastExpiry ? 700 : 400, textAlign: "right" }}>
                  {p.expiry_date ? (
                    <>
                      {isPastExpiry ? "Expired " : "Expires "}
                      {new Date(p.expiry_date).toLocaleDateString()}
                    </>
                  ) : (
                    "No expiry on file"
                  )}
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
