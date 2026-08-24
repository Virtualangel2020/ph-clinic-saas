import Link from "next/link";
import { requireClinicMember } from "@/lib/require-clinic-member";
import { MarkReviewedButton } from "./mark-reviewed-button";

type LabResultRow = {
  id: string;
  result_summary: string | null;
  resulted_at: string;
  reviewed_at: string | null;
  patients: { id: string; first_name: string; last_name: string } | null;
  user_profiles: { full_name: string | null } | null;
  lab_orders: { id: string; lab_order_items: { id: string; test_name: string }[] } | null;
};

function testSummary(items: { test_name: string }[] | undefined) {
  if (!items || items.length === 0) return "No tests listed";
  const names = items.map((i) => i.test_name).filter(Boolean);
  if (names.length <= 3) return names.join(", ");
  return `${names.slice(0, 3).join(", ")} +${names.length - 3} more`;
}

function ReviewedPill({ reviewedAt }: { reviewedAt: string | null }) {
  if (reviewedAt) {
    return (
      <span style={{ fontSize: 10.5, fontWeight: 700, color: "#1a7f37", background: "#eaf7ee", border: "1px solid #bfe6c9", borderRadius: 999, padding: "2px 8px" }}>
        Reviewed
      </span>
    );
  }
  return (
    <span style={{ fontSize: 10.5, fontWeight: 700, color: "#8a6100", background: "#fff6e6", border: "1px solid #f0d998", borderRadius: 999, padding: "2px 8px" }}>
      Unreviewed
    </span>
  );
}

// Clinic-wide view across every patient's lab results (see
// /dashboard/patients/[id] where results actually get recorded, from the
// chart's own Lab Orders & Results section). The top-nav "D" jellybean
// (components/emr/emr-shell.tsx) links here with ?tab=unreviewed — that
// filters to reviewed_at is null, same query-param-driven pattern as
// every other filtered list page in this app, no client state involved.
export default async function ResultsPage({ searchParams }: { searchParams: { tab?: string } }) {
  const { supabase, profile } = await requireClinicMember();
  const unreviewedOnly = searchParams.tab === "unreviewed";

  let query = supabase
    .from("lab_results")
    .select(
      "id, result_summary, resulted_at, reviewed_at, patients(id, first_name, last_name), user_profiles(full_name), lab_orders(id, lab_order_items(id, test_name))"
    )
    .eq("tenant_id", profile.tenant_id)
    .order("resulted_at", { ascending: false });

  if (unreviewedOnly) {
    query = query.is("reviewed_at", null);
  }

  const { data: results } = await query;
  const rows = (results as unknown as LabResultRow[]) ?? [];

  const { count: unreviewedCount } = await supabase
    .from("lab_results")
    .select("id", { count: "exact", head: true })
    .eq("tenant_id", profile.tenant_id)
    .is("reviewed_at", null);

  return (
    <div>
      <h1 style={{ fontSize: 24, marginBottom: 4 }}>Results</h1>
      <p style={{ color: "#666", marginBottom: 16, fontSize: 13 }}>
        Every lab result recorded across your patients. Add or manage one from a patient's own chart.
      </p>

      <div style={{ display: "flex", gap: 10, marginBottom: 16 }}>
        <div style={{ background: "white", border: "1px solid #e2e2e5", borderRadius: 10, padding: "10px 18px" }}>
          <div style={{ fontSize: 20, fontWeight: 700, color: "#0c1730" }}>{unreviewedCount ?? 0}</div>
          <div style={{ fontSize: 11, color: "#888" }}>Awaiting review</div>
        </div>
      </div>

      <div style={{ display: "flex", gap: 6, marginBottom: 14, flexWrap: "wrap" }}>
        <Link
          href="/dashboard/results"
          style={{
            fontSize: 12,
            fontWeight: 600,
            padding: "5px 12px",
            borderRadius: 999,
            textDecoration: "none",
            border: `1px solid ${!unreviewedOnly ? "#0c1730" : "#ddd"}`,
            color: !unreviewedOnly ? "white" : "#555",
            background: !unreviewedOnly ? "#0c1730" : "white",
          }}
        >
          All results
        </Link>
        <Link
          href="/dashboard/results?tab=unreviewed"
          style={{
            fontSize: 12,
            fontWeight: 600,
            padding: "5px 12px",
            borderRadius: 999,
            textDecoration: "none",
            border: `1px solid ${unreviewedOnly ? "#0c1730" : "#ddd"}`,
            color: unreviewedOnly ? "white" : "#555",
            background: unreviewedOnly ? "#0c1730" : "white",
          }}
        >
          Unreviewed
        </Link>
      </div>

      {rows.length === 0 ? (
        <div style={{ background: "white", border: "1px solid #e2e2e5", borderRadius: 12, padding: 24, color: "#888", fontSize: 13 }}>
          {unreviewedOnly ? "Nothing awaiting review." : "No lab results found — open a patient's chart to record one."}
        </div>
      ) : (
        <div style={{ display: "grid", gap: 8 }}>
          {rows.map((r) => (
            <div
              key={r.id}
              style={{ display: "flex", justifyContent: "space-between", alignItems: "center", background: "white", border: "1px solid #e2e2e5", borderRadius: 10, padding: "12px 16px", gap: 12 }}
            >
              <Link
                href={`/dashboard/patients/${r.patients?.id ?? ""}`}
                style={{ textDecoration: "none", color: "inherit", flex: 1, minWidth: 0 }}
              >
                <div style={{ fontWeight: 700, fontSize: 13.5, color: "#0c1730" }}>
                  {r.patients ? `${r.patients.last_name}, ${r.patients.first_name}` : "Unknown patient"}
                  <span style={{ marginLeft: 8 }}>
                    <ReviewedPill reviewedAt={r.reviewed_at} />
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
              {!r.reviewed_at && <MarkReviewedButton id={r.id} patientId={r.patients?.id ?? ""} />}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
