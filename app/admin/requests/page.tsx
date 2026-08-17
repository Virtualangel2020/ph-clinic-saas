import { requireAdmin } from "@/lib/require-admin";
import { RequestRow } from "./request-row";

export default async function RequestsPage() {
  const { supabase } = await requireAdmin();

  const { data: requests } = await supabase
    .from("requests")
    .select("id, type, status, clinic_name, contact_name, contact_email, contact_phone, requested_plan_id, requested_billing_cycle, notes, created_at, resolved_at, plans:requested_plan_id(name)")
    .order("status", { ascending: true })
    .order("created_at", { ascending: false });

  return (
    <div>
      <h1 style={{ fontSize: 24, marginBottom: 4 }}>Requests</h1>
      <p style={{ color: "#666", marginBottom: 24 }}>
        Nothing self-provisions. A new signup, or an existing client asking to upgrade or add a module, lands here
        pending until you approve it.
      </p>

      {requests && requests.length > 0 ? (
        <div style={{ display: "grid", gap: 12 }}>
          {requests.map((r: any) => (
            <RequestRow key={r.id} request={r} />
          ))}
        </div>
      ) : (
        <div style={{ background: "white", border: "1px solid #e2e2e5", borderRadius: 12, padding: 24, color: "#888", fontSize: 13 }}>
          No requests yet — pending or resolved. This won't hide once one exists.
        </div>
      )}
    </div>
  );
}
