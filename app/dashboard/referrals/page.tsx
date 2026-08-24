import Link from "next/link";
import { requireClinicMember } from "@/lib/require-clinic-member";

const STATUS_STYLE: Record<string, { color: string; bg: string; border: string; label: string }> = {
  pending: { color: "#8a6100", bg: "#fff6e6", border: "#f0d998", label: "Pending" },
  accepted: { color: "var(--text-heading)", bg: "#f0f4ff", border: "#c7d4f5", label: "Accepted" },
  completed: { color: "#1a7f37", bg: "#eaf7ee", border: "#bfe6c9", label: "Completed" },
  declined: { color: "#a12a2a", bg: "#fbeaea", border: "#f0c9c9", label: "Declined" },
  cancelled: { color: "#888", bg: "#f2f2f2", border: "#ddd", label: "Cancelled" },
};

type ReferralListRow = {
  id: string;
  destination_type: "internal" | "external";
  specialty_requested: string | null;
  reason: string;
  urgency: "routine" | "urgent";
  status: string;
  created_at: string;
  external_destination_name: string | null;
  sending_tenant_id: string;
  receiving_tenant_id: string | null;
  patients: { id: string; first_name: string; last_name: string } | null;
  sending_provider: { full_name: string | null; title: string | null } | null;
  receiving_provider: { full_name: string | null; title: string | null } | null;
  external_providers: { full_name: string; clinic_name: string | null; specialty: string | null; city: string | null } | null;
};

function StatusPill({ status }: { status: string }) {
  const s = STATUS_STYLE[status] ?? STATUS_STYLE.pending;
  return (
    <span style={{ fontSize: 10.5, fontWeight: 700, color: s.color, background: s.bg, border: `1px solid ${s.border}`, borderRadius: 999, padding: "2px 8px" }}>
      {s.label}
    </span>
  );
}

function destinationLabel(r: ReferralListRow) {
  if (r.destination_type === "internal") {
    const rp = r.receiving_provider;
    return rp ? `${rp.title ? rp.title + " " : ""}${rp.full_name}` : "AngelClinic provider";
  }
  return r.external_providers?.full_name ?? r.external_destination_name ?? "External provider";
}

type SearchParams = { view?: string; status?: string; patient?: string; specialty?: string; from?: string; to?: string; tab?: string };

// Clinic-wide Referrals workspace (spec §22-25) — Incoming (this clinic is
// the destination), Outgoing (this clinic sent it), and status filters,
// across internal-AngelClinic and external destinations alike. Reads the
// SAME `referrals` rows the patient chart's Referrals tab reads and writes
// — placing/accepting/declining/completing a referral from either place
// lands in this one list, never a separate table.
export default async function ReferralsPage({ searchParams }: { searchParams: SearchParams }) {
  const { supabase, profile } = await requireClinicMember();
  const tenantId = profile.tenant_id;
  // Back-compat: the top-nav "R" jellybean links to the old ?tab=inbox
  // placeholder href — treated as "Incoming", same idea as the Results
  // page's ?tab=unreviewed alias.
  const view = searchParams.view || (searchParams.tab === "inbox" ? "incoming" : "");
  const statusFilter = searchParams.status || "";
  const patientQuery = (searchParams.patient || "").trim();
  const specialtyQuery = (searchParams.specialty || "").trim();
  const fromDate = searchParams.from || "";
  const toDate = searchParams.to || "";

  let query = supabase
    .from("referrals")
    .select(
      "id, destination_type, specialty_requested, reason, urgency, status, created_at, external_destination_name, sending_tenant_id, receiving_tenant_id, " +
        "patients(id, first_name, last_name), " +
        "sending_provider:user_profiles!referrals_sending_provider_id_fkey(full_name, title), " +
        "receiving_provider:user_profiles!referrals_receiving_provider_id_fkey(full_name, title), " +
        "external_providers(full_name, clinic_name, specialty, city)"
    )
    .order("created_at", { ascending: false });

  if (view === "incoming") query = query.eq("receiving_tenant_id", tenantId);
  if (view === "outgoing") query = query.eq("sending_tenant_id", tenantId);
  if (statusFilter) query = query.eq("status", statusFilter);
  if (fromDate) query = query.gte("created_at", fromDate);
  if (toDate) query = query.lte("created_at", `${toDate}T23:59:59`);

  const [{ data: referrals }, { count: pendingCount }] = await Promise.all([
    query,
    supabase.from("referrals").select("id", { count: "exact", head: true }).eq("status", "pending"),
  ]);

  let rows = (referrals as unknown as ReferralListRow[]) ?? [];
  if (patientQuery) {
    const q = patientQuery.toLowerCase();
    rows = rows.filter((r) => r.patients && `${r.patients.last_name}, ${r.patients.first_name}`.toLowerCase().includes(q));
  }
  if (specialtyQuery) {
    const q = specialtyQuery.toLowerCase();
    rows = rows.filter((r) => (r.specialty_requested ?? "").toLowerCase().includes(q));
  }

  const VIEW_FILTERS: { key: string; label: string }[] = [
    { key: "", label: "All" },
    { key: "incoming", label: "Incoming" },
    { key: "outgoing", label: "Outgoing" },
  ];
  const STATUS_FILTERS: { key: string; label: string }[] = [
    { key: "", label: "All statuses" },
    { key: "pending", label: "Pending" },
    { key: "accepted", label: "Accepted" },
    { key: "completed", label: "Completed" },
    { key: "declined", label: "Declined" },
    { key: "cancelled", label: "Cancelled" },
  ];

  const hasFilters = !!(view || statusFilter || patientQuery || specialtyQuery || fromDate || toDate);

  function withView(v: string) {
    const qs = new URLSearchParams();
    if (v) qs.set("view", v);
    if (statusFilter) qs.set("status", statusFilter);
    if (patientQuery) qs.set("patient", patientQuery);
    if (specialtyQuery) qs.set("specialty", specialtyQuery);
    if (fromDate) qs.set("from", fromDate);
    if (toDate) qs.set("to", toDate);
    const s = qs.toString();
    return s ? `/dashboard/referrals?${s}` : "/dashboard/referrals";
  }

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12, flexWrap: "wrap", marginBottom: 4 }}>
        <h1 style={{ fontSize: 24 }}>Referrals</h1>
        <Link
          href="/dashboard/referrals/new"
          style={{ background: "#0c1730", color: "#e6c66b", fontWeight: 700, fontSize: 12.5, padding: "9px 16px", borderRadius: 8, textDecoration: "none" }}
        >
          + New Referral
        </Link>
      </div>
      <p style={{ color: "#666", marginBottom: 16, fontSize: 13 }}>
        Every referral sent or received across your patients — to another AngelClinic provider or outside the platform.
        Filter below, or open a patient's chart to manage one in context.
      </p>

      <div style={{ display: "flex", gap: 10, marginBottom: 16 }}>
        <div style={{ background: "var(--card-bg)", border: "1px solid var(--card-border)", borderRadius: 10, padding: "10px 18px" }}>
          <div style={{ fontSize: 20, fontWeight: 700, color: "var(--text-heading)" }}>{pendingCount ?? 0}</div>
          <div style={{ fontSize: 11, color: "#888" }}>Pending across all referrals</div>
        </div>
      </div>

      <form
        action="/dashboard/referrals"
        method="get"
        style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "flex-end", marginBottom: 12, background: "var(--card-bg)", border: "1px solid var(--card-border)", borderRadius: 10, padding: 12 }}
      >
        <div>
          <div style={filterLabelStyle}>Patient</div>
          <input name="patient" defaultValue={patientQuery} placeholder="Search by name…" style={filterInputStyle} />
        </div>
        <div>
          <div style={filterLabelStyle}>Specialty</div>
          <input name="specialty" defaultValue={specialtyQuery} placeholder="e.g. Cardiology" style={filterInputStyle} />
        </div>
        <div>
          <div style={filterLabelStyle}>Status</div>
          <select name="status" defaultValue={statusFilter} style={filterInputStyle}>
            {STATUS_FILTERS.map((f) => (
              <option key={f.key} value={f.key}>
                {f.label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <div style={filterLabelStyle}>From</div>
          <input type="date" name="from" defaultValue={fromDate} style={filterInputStyle} />
        </div>
        <div>
          <div style={filterLabelStyle}>To</div>
          <input type="date" name="to" defaultValue={toDate} style={filterInputStyle} />
        </div>
        <input type="hidden" name="view" value={view} />
        <button type="submit" style={{ background: "#0c1730", color: "white", border: "none", borderRadius: 8, padding: "8px 16px", fontSize: 12.5, cursor: "pointer" }}>
          Apply
        </button>
        {hasFilters && (
          <Link href="/dashboard/referrals" style={{ fontSize: 12, color: "#999", textDecoration: "none", padding: "8px 4px" }}>
            Reset Filters
          </Link>
        )}
      </form>

      <div style={{ display: "flex", gap: 6, marginBottom: 14, flexWrap: "wrap" }}>
        {VIEW_FILTERS.map((f) => {
          const isActive = view === f.key;
          return (
            <Link
              key={f.key || "default"}
              href={withView(f.key)}
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
          No referrals match these filters.
        </div>
      ) : (
        <div style={{ display: "grid", gap: 8 }}>
          {rows.map((r) => {
            const incoming = r.receiving_tenant_id === tenantId;
            const outgoing = r.sending_tenant_id === tenantId;
            return (
              <Link
                key={r.id}
                href={`/dashboard/patients/${r.patients?.id ?? ""}?tab=referrals`}
                style={{ display: "flex", justifyContent: "space-between", alignItems: "center", background: "var(--card-bg)", border: "1px solid var(--card-border)", borderRadius: 10, padding: "12px 16px", textDecoration: "none", gap: 12 }}
              >
                <div>
                  <div style={{ fontWeight: 700, fontSize: 13.5, color: "var(--text-heading)" }}>
                    {r.patients ? `${r.patients.last_name}, ${r.patients.first_name}` : "Unknown patient"}
                    <span style={{ marginLeft: 8, display: "inline-flex", gap: 6, flexWrap: "wrap" }}>
                      {incoming && (
                        <span style={{ fontSize: 10.5, fontWeight: 700, color: "#555", background: "#f2f2f2", border: "1px solid #ddd", borderRadius: 999, padding: "2px 8px" }}>
                          Incoming
                        </span>
                      )}
                      {outgoing && (
                        <span style={{ fontSize: 10.5, fontWeight: 700, color: "#555", background: "#f2f2f2", border: "1px solid #ddd", borderRadius: 999, padding: "2px 8px" }}>
                          Outgoing
                        </span>
                      )}
                      <StatusPill status={r.status} />
                      {r.urgency === "urgent" && (
                        <span style={{ fontSize: 10.5, fontWeight: 700, color: "#a12a2a", background: "#fbeaea", border: "1px solid #f0c9c9", borderRadius: 999, padding: "2px 8px" }}>
                          Urgent
                        </span>
                      )}
                    </span>
                  </div>
                  <div style={{ fontSize: 12.5, color: "#333", marginTop: 2 }}>
                    To: {destinationLabel(r)}
                    {r.specialty_requested ? ` · ${r.specialty_requested}` : ""}
                  </div>
                  <div style={{ fontSize: 11.5, color: "#888", marginTop: 2 }}>{new Date(r.created_at).toLocaleDateString()}</div>
                </div>
                <div style={{ color: "#bbb", fontSize: 18 }}>›</div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}

const filterLabelStyle: React.CSSProperties = { fontSize: 10.5, fontWeight: 600, color: "#888", marginBottom: 3 };
const filterInputStyle: React.CSSProperties = { border: "1px solid var(--input-border)", borderRadius: 7, padding: "7px 9px", fontSize: 12.5, fontFamily: "inherit" };
