import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/require-admin";
import { ClientEditor } from "./client-editor";
import { BillingPanel } from "./billing-panel";

export default async function ClientDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { supabase } = await requireAdmin();

  const [
    { data: tenant },
    { data: plans },
    { data: addons },
    { data: subscriptionAddons },
    { data: discount },
    { data: carePlans },
    { data: tenantCarePlan },
    { data: invoices },
    { data: payments },
  ] = await Promise.all([
    supabase
      .from("tenants")
      .select("id, name, slug, status, created_at, subscriptions(id, plan_id, billing_cycle, status, current_period_start)")
      .eq("id", id)
      .single(),
    supabase.from("plans").select("id, name, slug, plan_prices(billing_cycle, price_php)").eq("is_active", true).order("name"),
    supabase.from("addons").select("id, name, slug, feature_key, addon_prices(billing_cycle, price_php)").eq("is_active", true).order("name"),
    supabase
      .from("subscription_addons")
      .select("addon_id, status, billing_cycle, subscriptions!inner(tenant_id)")
      .eq("subscriptions.tenant_id", id)
      .eq("status", "active"),
    supabase
      .from("tenant_discounts")
      .select("id, discount_percent, note, created_at")
      .eq("tenant_id", id)
      .eq("is_active", true)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase.from("care_plans").select("id, name, kind, price_php, billing_cycle").eq("is_active", true).order("kind"),
    supabase
      .from("tenant_care_plans")
      .select("id, status, start_date, next_billing_date, auto_renew, care_plans(name, kind)")
      .eq("tenant_id", id)
      .neq("status", "cancelled")
      .maybeSingle(),
    supabase.from("invoices").select("*").eq("tenant_id", id).order("created_at", { ascending: false }),
    supabase.from("payments").select("*").eq("tenant_id", id).order("payment_date", { ascending: false }),
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
        activeDiscount={discount ?? null}
      />

      <div style={{ marginTop: 32 }}>
        <h2 style={{ fontSize: 18, marginBottom: 12 }}>Billing & maintenance</h2>
        <BillingPanel
          tenantId={tenant.id}
          isOneTimeCustomer={(subscriptionAddons ?? []).some((sa: any) => sa.billing_cycle === "one_time") || tenant.subscriptions?.[0]?.billing_cycle === "one_time"}
          carePlans={(carePlans as any) ?? []}
          tenantCarePlan={(tenantCarePlan as any) ?? null}
          invoices={(invoices as any) ?? []}
          payments={(payments as any) ?? []}
        />
      </div>
    </div>
  );
}
