import Link from "next/link";
import { requireAdmin } from "@/lib/require-admin";

// One row per tenant that has ever sent/received a support message,
// newest activity first, each with its own unread badge — the Superadmin
// equivalent of a Messenger inbox list. Tenants with zero messages simply
// don't show up here yet (nothing to triage).
export default async function AdminCustomerCarePage() {
  const { supabase } = await requireAdmin();

  const { data: messages } = await supabase
    .from("support_messages")
    .select("id, tenant_id, sender_type, sender_name, body, created_at, read_at, tenants(name)")
    .order("created_at", { ascending: false });

  const byTenant = new Map<
    string,
    { tenantId: string; tenantName: string; lastMessage: any; unreadCount: number }
  >();

  for (const m of (messages as any[]) ?? []) {
    const tenantId = m.tenant_id;
    const tenantName = m.tenants?.name ?? "Unknown clinic";
    if (!byTenant.has(tenantId)) {
      byTenant.set(tenantId, { tenantId, tenantName, lastMessage: m, unreadCount: 0 });
    }
    if (m.sender_type === "clinic" && !m.read_at) {
      byTenant.get(tenantId)!.unreadCount += 1;
    }
  }

  const conversations = Array.from(byTenant.values()).sort(
    (a, b) => new Date(b.lastMessage.created_at).getTime() - new Date(a.lastMessage.created_at).getTime()
  );

  return (
    <div>
      <h1 style={{ fontSize: 24, marginBottom: 4 }}>Customer Care</h1>
      <p style={{ color: "#666", marginBottom: 24, fontSize: 13 }}>
        Ongoing support threads with each clinic that has Customer Care on their plan.
      </p>

      {conversations.length === 0 ? (
        <p style={{ color: "#888", fontSize: 13.5 }}>No conversations yet.</p>
      ) : (
        <div style={{ display: "grid", gap: 10 }}>
          {conversations.map((c) => (
            <Link
              key={c.tenantId}
              href={`/admin/customer-care/${c.tenantId}`}
              style={{
                position: "relative",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                gap: 16,
                background: "white",
                border: c.unreadCount > 0 ? "1px solid #e6c66b" : "1px solid #e2e2e5",
                borderRadius: 10,
                padding: "14px 18px",
                textDecoration: "none",
              }}
            >
              <div style={{ minWidth: 0 }}>
                <div style={{ fontWeight: 700, fontSize: 14.5, color: "#0c1730" }}>{c.tenantName}</div>
                <div style={{ fontSize: 12.5, color: "#888", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: 480 }}>
                  {c.lastMessage.sender_type === "platform" ? "You: " : ""}
                  {c.lastMessage.body}
                </div>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 12, flexShrink: 0 }}>
                <div style={{ fontSize: 11.5, color: "#999" }}>{new Date(c.lastMessage.created_at).toLocaleDateString()}</div>
                {c.unreadCount > 0 && (
                  <span
                    style={{
                      minWidth: 22,
                      height: 22,
                      padding: "0 6px",
                      borderRadius: 999,
                      background: "#c0392b",
                      color: "white",
                      fontSize: 12,
                      fontWeight: 700,
                      display: "inline-flex",
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    {c.unreadCount > 99 ? "99+" : c.unreadCount}
                  </span>
                )}
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
