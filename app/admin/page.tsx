import Link from "next/link";
import { requireAdmin } from "@/lib/require-admin";

// Deliberately unconditional: every section below always renders, with
// an explicit empty state, rather than being hidden when there happen to
// be zero tenants or zero requests. The platform admin should always see
// the full shape of the system, not a dashboard that looks emptier than
// it is.
export default async function AdminDashboard() {
  const { supabase } = await requireAdmin();

  const [
    { count: tenantCount },
    { count: activeTenantCount },
    { count: testTenantCount },
    { count: pendingCount },
    { data: tenants },
    { data: pendingRequests },
    { data: autoProvisioned },
  ] = await Promise.all([
    // "Total clients" and "Active clinics" deliberately exclude test
    // clients (tenants.is_test) — they're real platform totals, and a
    // test client should never inflate them. Test clients still show up
    // individually in the table below, with a badge.
    supabase.from("tenants").select("*", { count: "exact", head: true }).eq("is_test", false),
    supabase.from("tenants").select("*", { count: "exact", head: true }).eq("is_test", false).eq("status", "active"),
    supabase.from("tenants").select("*", { count: "exact", head: true }).eq("is_test", true),
    supabase.from("requests").select("*", { count: "exact", head: true }).eq("status", "pending"),
    supabase
      .from("tenants")
      .select("id, name, status, is_test, created_at, subscriptions(plan_id, status, billing_cycle, plans(name))")
      .order("created_at", { ascending: false })
      .limit(10),
    supabase
      .from("requests")
      .select("id, type, clinic_name, contact_name, contact_email, created_at")
      .eq("status", "pending")
      .order("created_at", { ascending: false })
      .limit(10),
    // Self-serve signups that paid and provisioned themselves with no
    // admin click — resolved_by is null exactly when nobody approved it.
    // This is the "admin gets notified" surface for that flow (there's no
    // email/push wired up yet): it's the first thing on this page.
    supabase
      .from("requests")
      .select("id, clinic_name, contact_name, contact_email, contact_phone, resolved_at, plans:requested_plan_id(name)")
      .eq("type", "new_signup")
      .eq("status", "approved")
      .is("resolved_by", null)
      .not("user_id", "is", null)
      .order("resolved_at", { ascending: false })
      .limit(10),
  ]);

  return (
    <div>
      <h1 style={{ fontSize: 24, marginBottom: 4 }}>Platform overview</h1>
      <p style={{ color: "#666", marginBottom: 28 }}>
        Every client account and every pending request, always — nothing here hides itself when the numbers are zero.
      </p>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 16, marginBottom: 32 }}>
        <StatCard label="Total clients" value={tenantCount ?? 0} />
        <StatCard label="Active clinics" value={activeTenantCount ?? 0} />
        <StatCard label="Pending requests" value={pendingCount ?? 0} highlight={(pendingCount ?? 0) > 0} />
        <StatCard label="Test clients (excluded above)" value={testTenantCount ?? 0} />
      </div>

      {autoProvisioned && autoProvisioned.length > 0 && (
        <div style={{ marginBottom: 32 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
            <h2 style={{ fontSize: 16 }}>⚡ New self-serve signups (paid, auto-provisioned)</h2>
            <Link href="/admin/requests" style={{ fontSize: 13, color: "#2563eb" }}>View all →</Link>
          </div>
          <div style={{ background: "#f0f9f0", border: "1px solid #bfe3bf", borderRadius: 12, overflow: "hidden" }}>
            <Table
              headers={["Clinic", "Plan", "Email", "Phone", "Paid & unlocked"]}
              rows={autoProvisioned.map((r: any) => [
                r.clinic_name || r.contact_name || "—",
                r.plans?.name ?? "—",
                r.contact_email,
                r.contact_phone ?? "—",
                new Date(r.resolved_at).toLocaleString(),
              ])}
            />
          </div>
          <p style={{ fontSize: 12, color: "#888", marginTop: 8 }}>
            Nobody approved these — the client paid and their portal unlocked automatically. Nothing to do here
            unless something looks wrong.
          </p>
        </div>
      )}

      <Section title="Pending requests" action={<Link href="/admin/requests" style={{ fontSize: 13, color: "#2563eb" }}>View all →</Link>}>
        {pendingRequests && pendingRequests.length > 0 ? (
          <Table
            headers={["Type", "From", "Email", "Requested"]}
            rows={pendingRequests.map((r: any) => [
              r.type,
              r.clinic_name || r.contact_name || "—",
              r.contact_email,
              new Date(r.created_at).toLocaleString(),
            ])}
          />
        ) : (
          <EmptyState text="No pending requests right now. New signup requests and client upgrade/add-on requests will show up here." />
        )}
      </Section>

      <Section title="All clients" action={<Link href="/admin/clients" style={{ fontSize: 13, color: "#2563eb" }}>Manage all →</Link>}>
        {tenants && tenants.length > 0 ? (
          <Table
            headers={["Clinic", "Plan", "Billing", "Sub. status", "Tenant status", "Created"]}
            rows={tenants.map((t: any) => [
              t.is_test ? `${t.name} (TEST)` : t.name,
              t.subscriptions?.[0]?.plans?.name ?? "—",
              t.subscriptions?.[0]?.billing_cycle ?? "—",
              t.subscriptions?.[0]?.status ?? "—",
              t.status,
              new Date(t.created_at).toLocaleDateString(),
            ])}
          />
        ) : (
          <EmptyState text="No clinic clients yet. This table will list every client account you approve — it won't hide once you have one, and it isn't hiding anything now." />
        )}
      </Section>
    </div>
  );
}

function StatCard({ label, value, highlight }: { label: string; value: number; highlight?: boolean }) {
  return (
    <div
      style={{
        background: highlight ? "#fff7e6" : "white",
        border: `1px solid ${highlight ? "#e6c66b" : "#e2e2e5"}`,
        borderRadius: 12,
        padding: 20,
      }}
    >
      <div style={{ fontSize: 28, fontWeight: 700 }}>{value}</div>
      <div style={{ fontSize: 13, color: "#666" }}>{label}</div>
    </div>
  );
}

function Section({ title, action, children }: { title: string; action?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 32 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
        <h2 style={{ fontSize: 16 }}>{title}</h2>
        {action}
      </div>
      <div style={{ background: "white", border: "1px solid #e2e2e5", borderRadius: 12, overflow: "hidden" }}>
        {children}
      </div>
    </div>
  );
}

function EmptyState({ text }: { text: string }) {
  return <div style={{ padding: 24, color: "#888", fontSize: 13 }}>{text}</div>;
}

function Table({ headers, rows }: { headers: string[]; rows: (string | number)[][] }) {
  return (
    <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
      <thead>
        <tr style={{ background: "#fafafa", textAlign: "left" }}>
          {headers.map((h) => (
            <th key={h} style={{ padding: "10px 16px", fontWeight: 600, color: "#555" }}>{h}</th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((row, i) => (
          <tr key={i} style={{ borderTop: "1px solid #eee" }}>
            {row.map((cell, j) => (
              <td key={j} style={{ padding: "10px 16px" }}>{cell}</td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}
