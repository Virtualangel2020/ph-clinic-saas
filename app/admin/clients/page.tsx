import Link from "next/link";
import { requireAdmin } from "@/lib/require-admin";
import { TestToggle } from "./test-toggle";
import { DeleteTenantButton } from "./delete-tenant-button";

export default async function ClientsPage() {
  const { supabase } = await requireAdmin();

  const { data: tenants } = await supabase
    .from("tenants")
    .select("id, name, status, is_test, created_at, subscriptions(plan_id, status, billing_cycle, plans(name))")
    .order("created_at", { ascending: false });

  return (
    <div>
      <h1 style={{ fontSize: 24, marginBottom: 4 }}>Clients</h1>
      <p style={{ color: "#666", marginBottom: 24 }}>
        Every clinic account on the platform. Open one to change its plan, toggle add-ons, or change its status —
        each client is independent of the others.
      </p>

      <div style={{ background: "white", border: "1px solid #e2e2e5", borderRadius: 12, overflow: "hidden" }}>
        {tenants && tenants.length > 0 ? (
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead>
              <tr style={{ background: "#fafafa", textAlign: "left" }}>
                {["Clinic", "Plan", "Billing", "Status", "Created", "", "", ""].map((h, i) => (
                  <th key={i} style={{ padding: "10px 16px", fontWeight: 600, color: "#555" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {tenants.map((t: any) => (
                <tr key={t.id} style={{ borderTop: "1px solid #eee" }}>
                  <td style={{ padding: "10px 16px", fontWeight: 600 }}>
                    {t.name}
                    {t.is_test && (
                      <span style={{ marginLeft: 8, fontSize: 10, fontWeight: 700, color: "#7a5c12", background: "#fff7e6", border: "1px solid #e6c66b", borderRadius: 999, padding: "2px 7px" }}>
                        TEST
                      </span>
                    )}
                  </td>
                  <td style={{ padding: "10px 16px" }}>{t.subscriptions?.[0]?.plans?.name ?? "—"}</td>
                  <td style={{ padding: "10px 16px" }}>{t.subscriptions?.[0]?.billing_cycle ?? "—"}</td>
                  <td style={{ padding: "10px 16px" }}>{t.status}</td>
                  <td style={{ padding: "10px 16px" }}>{new Date(t.created_at).toLocaleDateString()}</td>
                  <td style={{ padding: "10px 16px" }}>
                    <TestToggle tenantId={t.id} initialIsTest={!!t.is_test} />
                  </td>
                  <td style={{ padding: "10px 16px" }}>
                    <Link href={`/admin/clients/${t.id}`} style={{ color: "#2563eb" }}>Manage →</Link>
                  </td>
                  <td style={{ padding: "10px 16px" }}>
                    <DeleteTenantButton tenantId={t.id} tenantName={t.name} compact />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <div style={{ padding: 24, color: "#888", fontSize: 13 }}>
            No clients yet. Approve a request from the Requests inbox to create the first one.
          </div>
        )}
      </div>
    </div>
  );
}
