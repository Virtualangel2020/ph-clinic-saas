import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/require-admin";
import { ClientEditor } from "./client-editor";

export default async function ClientDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { supabase } = await requireAdmin();

  const [{ data: tenant }, { data: plans }, { data: addons }, { data: subscriptionAddons }] = await Promise.all([
    supabase
      .from("tenants")
      .select("id, name, slug, status, created_at, subscriptions(id, plan_id, billing_cycle, status, current_period_start)")
      .eq("id", id)
      .single(),
    supabase.from("plans").select("id, name, slug, plan_prices(billing_cycle, price_php)").eq("is_active", true).order("name"),
    supabase.from("addons").select("id, name, slug, feature_key, addon_prices(billing_cycle, price_php)").eq("is_active", true).order("name"),
    supabase
      .from("subscription_addons")
      .select("addon_id, status, subscriptions!inner(tenant_id)")
      .eq("subscriptions.tenant_id", id)
      .eq("status", "active"),
  ]);

  if (!tenant) notFound();

  return (
    <div>
      <h1 style={{ fontSize: 24, marginBottom: 4 }}>{tenant.name}</h1>
      <p style={{ color: "#666", marginBottom: 24, fontSize: 13 }}>
        {tenant.slug} · created {new Date(tenant.created_at).toLocaleDateString()}
      </p>

      <ClientEditor
        tenant={tenant as any}
        plans={plans ?? []}
        addons={addons ?? []}
        activeAddonIds={(subscriptionAddons ?? []).map((sa: any) => sa.addon_id)}
      />
    </div>
  );
}
