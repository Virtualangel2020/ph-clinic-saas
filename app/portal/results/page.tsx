import { requirePatientPortal } from "@/lib/require-patient-portal";
import { PortalShell } from "@/components/portal-shell";

// My Results (spec §15) — read-only view of this patient's own lab_orders
// / lab_results, the same rows the chart's Orders & Results tab and the
// global Results tab work from. Only results that have actually been
// released show anything beyond "in progress," matching the global
// Results workflow's New/Reviewed/Released statuses.
export default async function PortalResultsPage() {
  const { supabase, account } = await requirePatientPortal();
  const patientId = (account as any).patient_id;

  const { data: orders } = await supabase
    .from("lab_orders")
    .select("id, status, ordered_at, lab_order_items(test_name), lab_results(id, result_summary, resulted_at, status, released_at)")
    .eq("patient_id", patientId)
    .order("ordered_at", { ascending: false });

  return (
    <PortalShell>
      <h1 style={{ fontSize: 20, marginBottom: 4 }}>My Results</h1>
      <p style={{ color: "#666", fontSize: 13, marginBottom: 16 }}>Lab and diagnostic results your clinic has released to you.</p>

      <div style={{ display: "grid", gap: 8 }}>
        {(!orders || orders.length === 0) && <p style={{ color: "#999", fontSize: 12.5 }}>No results on file yet.</p>}
        {(orders as any[])?.map((o) => {
          const released = (o.lab_results ?? []).filter((r: any) => r.status === "released");
          return (
            <div key={o.id} style={{ background: "white", border: "1px solid #eee", borderRadius: 10, padding: "12px 14px" }}>
              <div style={{ fontSize: 13.5, fontWeight: 600 }}>
                {(o.lab_order_items ?? []).map((i: any) => i.test_name).join(", ") || "Lab Order"}
              </div>
              <div style={{ color: "#888", fontSize: 11.5, marginTop: 3 }}>Ordered {new Date(o.ordered_at).toLocaleDateString()}</div>
              {released.length > 0 ? (
                <div style={{ marginTop: 8, display: "grid", gap: 6 }}>
                  {released.map((r: any) => (
                    <div key={r.id} style={{ background: "#f7f7f9", borderRadius: 8, padding: "8px 10px", fontSize: 12.5 }}>
                      <div style={{ color: "#666", fontSize: 11 }}>Resulted {r.resulted_at ? new Date(r.resulted_at).toLocaleDateString() : "—"}</div>
                      <div style={{ marginTop: 3 }}>{r.result_summary || "See attached report."}</div>
                    </div>
                  ))}
                </div>
              ) : (
                <div style={{ marginTop: 8, fontSize: 12, color: "#7a5c12", background: "#fff7e6", border: "1px solid #e6c66b", borderRadius: 8, padding: "6px 10px", display: "inline-block" }}>
                  In progress — not yet released
                </div>
              )}
            </div>
          );
        })}
      </div>
    </PortalShell>
  );
}
