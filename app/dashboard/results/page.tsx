import Link from "next/link";
import { requireClinicMember } from "@/lib/require-clinic-member";
import { ResultStatusActions } from "./result-status-actions";

type LabResultRow = {
  id: string;
  result_summary: string | null;
  resulted_at: string;
  reviewed_at: string | null;
  status: string;
  released_at: string | null;
  patients: { id: string; first_name: string; last_name: string } | null;
  user_profiles: { full_name: string | null } | null;
  lab_orders: { id: string; ordering_provider_id: string | null; lab_order_items: { id: string; test_name: string }[] } | null;
};

const STATUS_STYLE: Record<string, { color: string; bg: string; border: string; label: string }> = {
  new: { color: "#8a6100", bg: "#fff6e6", border: "#f0d998", label: "New" },
  reviewed: { color: "var(--text-heading)", bg: "#f0f4ff", border: "#c7d4f5", label: "Reviewed" },
  released: { color: "#1a7f37", bg: "#eaf7ee", border: "#bfe6c9", label: "Released" },
  follow_up: { color: "#a12a2a", bg: "#fbeaea", border: "#f0c9c9", label: "Follow-up" },
};

function testSummary(items: { test_name: string }[] | undefined) {
  if (!items || items.length === 0) return "No items listed";
  const names = items.map((i) => i.test_name).filter(Boolean);
  if (names.length <= 3) return names.join(", ");
  return `${names.slice(0, 3).join(", ")} +${names.length - 3} more`;
}

function StatusPill({ status }: { status: string }) {
  const s = STATUS_STYLE[status] ?? STATUS_STYLE.new;
  return (
    <span style={{ fontSize: 10.5, fontWeight: 700, color: s.color, background: s.bg, border: `1px solid ${s.border}`, borderRadius: 999, padding: "2px 8px" }}>
      {s.label}
    </span>
  );
}

type SearchParams = { status?: string; provider?: string; patient?: string; from?: string; to?: string; tab?: string };

// Clinic-wide Results workspace (spec §20-21) — every lab/imaging/procedure
// result recorded across your patients, with a real New → Reviewed →
// Released (or → Follow-up) workflow. Same lab_results rows the patient
// chart's Orders & Results tab records and reviews from.
export default async function ResultsPage({ searchParams }: { searchParams: SearchParams }) {
  const { supabase, profile } = await requireClinicMember();
  // Back-compat: the old "?tab=unreviewed" jellybean link still works,
  // mapped onto the new status filter.
  const statusFilter = searchParams.status || (searchParams.tab === "unreviewed" ? "new" : "");
  const providerFilter = searchParams.provider || "";
  const patientQuery = (searchParams.patient || "").trim();
  const fromDate = searchParams.from || "";
  const toDate = searchParams.to || "";

  let query = supabase
    .from("lab_results")
    .select(
      "id, result_summary, resulted_at, reviewed_at, status, released_at, patients(id, first_name, last_name), user_profiles(full_name), lab_orders(id, ordering_provider_id, lab_order_items(id, test_name))"
    )
    .eq("tenant_id", profile.tenant_id)
    .order("resulted_at", { ascending: false });

  if (statusFilter) query = query.eq("status", statusFilter);
  if (fromDate) query = query.gte("resulted_at", fromDate);
  if (toDate) query = query.lte("resulted_at", `${toDate}T23:59:59`);

  const [{ data: results }, { count: newCount }, { data: providers }] = await Promise.all([
    query,
    supabase.from("lab_results").select("id", { count: "exact", head: true }).eq("tenant_id", profile.tenant_id).eq("status", "new"),
    supabase.from("user_profiles").select("id, full_name").eq("tenant_id", profile.tenant_id).eq("role", "doctor").eq("is_active", true).order("full_name"),
  ]);

  let rows = (results as unknown as LabResultRow[]) ?? [];
  if (providerFilter) rows = rows.filter((r) => r.lab_orders?.ordering_provider_id === providerFilter);
  if (patientQuery) {
    const q = patientQuery.toLowerCase();
    rows = rows.filter((r) => r.patients && `${r.patients.last_name}, ${r.patients.first_name}`.toLowerCase().includes(q));
  }

  const FILTERS: { key: string; label: string }[] = [
    { key: "", label: "All" },
    { key: "new", label: "New" },
    { key: "reviewed", label: "Reviewed" },
    { key: "released", label: "Released" },
    { key: "follow_up", label: "Follow-up" },
  ];

  const hasFilters = !!(statusFilter || providerFilter || patientQuery || fromDate || toDate);

  return (
    <div>
      <h1 style={{ fontSize: 24, marginBottom: 4 }}>Results</h1>
      <p style={{ color: "#666", marginBottom: 16, fontSize: 13 }}>
        Every result recorded across your patients. Add or manage one from a patient's own chart.
      </p>

      <div style={{ display: "flex", gap: 10, marginBottom: 16 }}>
        <div style={{ background: "var(--card-bg)", border: "1px solid var(--card-border)", borderRadius: 10, padding: "10px 18px" }}>
          <div style={{ fontSize: 20, fontWeight: 700, color: "var(--text-heading)" }}>{newCount ?? 0}</div>
          <div style={{ fontSize: 11, color: "#888" }}>New — awaiting review</div>
        </div>
      </div>

      <form
        action="/dashboard/results"
        method="get"
        style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "flex-end", marginBottom: 12, background: "var(--card-bg)", border: "1px solid var(--card-border)", borderRadius: 10, padding: 12 }}
      >
        <div>
          <div style={filterLabelStyle}>Patient</div>
          <input name="patient" defaultValue={patientQuery} placeholder="Search by name…" style={filterInputStyle} />
        </div>
        <div>
          <div style={filterLabelStyle}>Ordering Provider</div>
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
          <div style={filterLabelStyle}>Resulted from</div>
          <input type="date" name="from" defaultValue={fromDate} style={filterInputStyle} />
        </div>
        <div>
          <div style={filterLabelStyle}>Resulted to</div>
          <input type="date" name="to" defaultValue={toDate} style={filterInputStyle} />
        </div>
        <input type="hidden" name="status" value={statusFilter} />
        <button type="submit" style={{ background: "#0c1730", color: "white", border: "none", borderRadius: 8, padding: "8px 16px", fontSize: 12.5, cursor: "pointer" }}>
          Apply
        </button>
        {hasFilters && (
          <Link href="/dashboard/results" style={{ fontSize: 12, color: "#999", textDecoration: "none", padding: "8px 4px" }}>
            Reset Filters
          </Link>
        )}
      </form>

      <div style={{ display: "flex", gap: 6, marginBottom: 14, flexWrap: "wrap" }}>
        {FILTERS.map((f) => {
          const isActive = statusFilter === f.key;
          const qs = new URLSearchParams();
          if (f.key) qs.set("status", f.key);
          if (providerFilter) qs.set("provider", providerFilter);
          if (patientQuery) qs.set("patient", patientQuery);
          if (fromDate) qs.set("from", fromDate);
          if (toDate) qs.set("to", toDate);
          const s = qs.toString();
          return (
            <Link
              key={f.key || "default"}
              href={s ? `/dashboard/results?${s}` : "/dashboard/results"}
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
          No results match these filters.
        </div>
      ) : (
        <div style={{ display: "grid", gap: 8 }}>
          {rows.map((r) => (
            <div
              key={r.id}
              style={{ display: "flex", justifyContent: "space-between", alignItems: "center", background: "var(--card-bg)", border: "1px solid var(--card-border)", borderRadius: 10, padding: "12px 16px", gap: 12 }}
            >
              <Link href={`/dashboard/patients/${r.patients?.id ?? ""}?tab=orders_results`} style={{ textDecoration: "none", color: "inherit", flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 700, fontSize: 13.5, color: "var(--text-heading)" }}>
                  {r.patients ? `${r.patients.last_name}, ${r.patients.first_name}` : "Unknown patient"}
                  <span style={{ marginLeft: 8 }}>
                    <StatusPill status={r.status} />
                  </span>
                </div>
                <div style={{ fontSize: 12.5, color: "#333", marginTop: 2 }}>{testSummary(r.lab_orders?.lab_order_items)}</div>
                {r.result_summary && (
                  <div style={{ fontSize: 12, color: "#555", marginTop: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {r.result_summary}
                  </div>
                )}
                <div style={{ fontSize: 11.5, color: "#888", marginTop: 2 }}>
                  {r.reviewed_at ? `Reviewed by ${r.user_profiles?.full_name ?? "staff"}` : "Not yet reviewed"} · {new Date(r.resulted_at).toLocaleDateString()}
                </div>
              </Link>
              <ResultStatusActions id={r.id} patientId={r.patients?.id ?? ""} status={r.status} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

const filterLabelStyle: React.CSSProperties = { fontSize: 10.5, fontWeight: 600, color: "#888", marginBottom: 3 };
const filterInputStyle: React.CSSProperties = { border: "1px solid var(--input-border)", borderRadius: 7, padding: "7px 9px", fontSize: 12.5, fontFamily: "inherit" };
