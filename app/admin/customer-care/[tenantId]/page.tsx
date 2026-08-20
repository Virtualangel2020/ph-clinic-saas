import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/require-admin";
import { BackLink } from "@/components/back-link";
import { AdminSupportThread } from "./admin-support-thread";

export default async function AdminTenantSupportPage({ params }: { params: Promise<{ tenantId: string }> }) {
  const { tenantId } = await params;
  const { supabase } = await requireAdmin();

  const { data: tenant } = await supabase.from("tenants").select("id, name").eq("id", tenantId).maybeSingle();
  if (!tenant) notFound();

  const { data: messages } = await supabase
    .from("support_messages")
    .select("id, sender_type, sender_name, body, created_at, read_at")
    .eq("tenant_id", tenantId)
    .order("created_at", { ascending: true });

  return (
    <div style={{ maxWidth: 720 }}>
      <BackLink href="/admin/customer-care" label="Customer Care" />
      <h1 style={{ fontSize: 22, marginBottom: 4 }}>{tenant.name}</h1>
      <p style={{ color: "#666", fontSize: 13, marginBottom: 20 }}>Ongoing support thread with this clinic.</p>

      <AdminSupportThread tenantId={tenant.id} initialMessages={(messages as any) ?? []} />
    </div>
  );
}
