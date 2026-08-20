import { requireAdmin } from "@/lib/require-admin";
import { DemoRequestRow } from "./demo-request-row";

export default async function DemoRequestsPage() {
  const { supabase } = await requireAdmin();

  const { data: requests } = await supabase
    .from("demo_requests")
    .select("*")
    .order("created_at", { ascending: false });

  const grouped = {
    new: (requests ?? []).filter((r: any) => r.status === "new"),
    contacted: (requests ?? []).filter((r: any) => r.status === "contacted"),
    scheduled: (requests ?? []).filter((r: any) => r.status === "scheduled"),
    closed: (requests ?? []).filter((r: any) => r.status === "closed" || r.status === "not_interested"),
  };

  return (
    <div>
      <h1 style={{ fontSize: 24, marginBottom: 4 }}>Demo Requests</h1>
      <p style={{ color: "#666", marginBottom: 24 }}>
        Leads from the public "Request a Demo" form — separate from the Master Demo account, which is always-on for
        showing prospects around.
      </p>

      {(!requests || requests.length === 0) && (
        <div style={{ background: "white", border: "1px solid #e2e2e5", borderRadius: 12, padding: 24, color: "#888", fontSize: 13 }}>
          No demo requests yet.
        </div>
      )}

      {(
        [
          ["new", "New", grouped.new],
          ["contacted", "Contacted", grouped.contacted],
          ["scheduled", "Scheduled", grouped.scheduled],
          ["closed", "Closed / Not Interested", grouped.closed],
        ] as const
      ).map(([, label, rows]) =>
        rows.length > 0 ? (
          <div key={label} style={{ marginBottom: 28 }}>
            <h2 style={{ fontSize: 14, color: "#888", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 10 }}>
              {label} ({rows.length})
            </h2>
            <div style={{ display: "grid", gap: 10 }}>
              {rows.map((r: any) => (
                <DemoRequestRow key={r.id} request={r} />
              ))}
            </div>
          </div>
        ) : null
      )}
    </div>
  );
}
