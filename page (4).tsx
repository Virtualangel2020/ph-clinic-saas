import { createClient } from "@/lib/supabase/server";
import { BrandHeader } from "@/components/brand-header";
import { RequestAccessForm } from "@/components/request-access-form";

export default async function HomePage() {
  const supabase = await createClient();

  const [{ data: plans, error }, { data: addons }] = await Promise.all([
    supabase
      .from("plans")
      .select("id, name, slug, description, plan_prices(billing_cycle, price_php), plan_features(feature_key, features(label))")
      .eq("is_active", true)
      .order("name"),
    supabase
      .from("addons")
      .select("id, name, slug, addon_prices(billing_cycle, price_php)")
      .eq("is_active", true)
      .order("name"),
  ]);

  return (
    <main style={{ maxWidth: 1000, margin: "0 auto", padding: "32px 24px 80px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
        <BrandHeader subtitle="by Virtual Angel Systems" />
        <a href="/login" style={{ fontSize: 13, color: "#2563eb" }}>Staff / clinic admin sign in →</a>
      </div>
      <p style={{ color: "#666", margin: "24px 0 32px", maxWidth: 640 }}>
        Smart clinic. Better care. One platform, individually configured for every clinic — pick a plan, add only
        the modules you need, and request access below.
      </p>

      {error && <p style={{ color: "crimson" }}>Error loading plans: {error.message}</p>}

      <h2 style={{ fontSize: 15, color: "#888", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 12 }}>
        Plans (regular pricing)
      </h2>
      <div style={{ display: "grid", gap: 16, gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", marginBottom: 32 }}>
        {plans?.map((plan: any) => (
          <div key={plan.slug} style={{ background: "white", border: "1px solid #e2e2e5", borderRadius: 12, padding: 20 }}>
            <h3 style={{ fontSize: 18, marginTop: 0, marginBottom: 4 }}>{plan.name}</h3>
            <div style={{ fontSize: 13, color: "#888", marginBottom: 10 }}>
              {plan.plan_prices?.find((p: any) => p.billing_cycle === "monthly") && (
                <>₱{Number(plan.plan_prices.find((p: any) => p.billing_cycle === "monthly").price_php).toLocaleString()}/mo</>
              )}
            </div>
            <p style={{ color: "#666", fontSize: 13 }}>{plan.description}</p>
            <ul style={{ fontSize: 13, color: "#333", paddingLeft: 18, margin: 0 }}>
              {(plan.plan_features as any[])?.map((pf) => (
                <li key={pf.feature_key}>{pf.features?.label}</li>
              ))}
            </ul>
          </div>
        ))}
      </div>

      <h2 style={{ fontSize: 15, color: "#888", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 12 }}>
        Add-ons (separate pricing)
      </h2>
      <div style={{ display: "grid", gap: 10, gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", marginBottom: 40 }}>
        {addons?.map((a: any) => (
          <div key={a.id} style={{ background: "white", border: "1px solid #eee", borderRadius: 10, padding: "12px 14px", fontSize: 13 }}>
            <div style={{ fontWeight: 600 }}>{a.name}</div>
            <div style={{ color: "#888" }}>
              {a.addon_prices?.find((p: any) => p.billing_cycle === "monthly")
                ? `₱${Number(a.addon_prices.find((p: any) => p.billing_cycle === "monthly").price_php).toLocaleString()}/mo`
                : "—"}
            </div>
          </div>
        ))}
      </div>

      <RequestAccessForm plans={(plans as any) ?? []} addons={(addons as any) ?? []} />
    </main>
  );
}
