import { requireAdmin } from "@/lib/require-admin";
import { PromotionForm } from "./promotion-form";
import { PromotionRow } from "./promotion-row";

// Deliberately unconditional, same as the rest of /admin: always shows the
// full list (active and inactive/expired) with an explicit empty state,
// never hides itself because there happen to be zero promotions yet.
export default async function PromotionsPage() {
  const { supabase } = await requireAdmin();

  const [{ data: promotions }, { data: plans }] = await Promise.all([
    supabase
      .from("promotions")
      .select("id, code, label, discount_percent, applies_to_plan_id, max_redemptions, redemptions_count, is_active, starts_at, ends_at, created_at, plans:applies_to_plan_id(name)")
      .order("created_at", { ascending: false }),
    supabase.from("plans").select("id, name").eq("is_active", true).order("sort_order"),
  ]);

  return (
    <div>
      <h1 style={{ fontSize: 24, marginBottom: 4 }}>Promotions</h1>
      <p style={{ color: "#666", marginBottom: 24 }}>
        Set an intro price or a limited-time discount. A promo with no redemption limit stays active until you turn
        it off; set a limit (e.g. 3) and it deactivates itself automatically once that many signups use it.
      </p>

      <div style={{ marginBottom: 32 }}>
        <PromotionForm plans={plans ?? []} />
      </div>

      <h2 style={{ fontSize: 16, marginBottom: 10 }}>All promotions</h2>
      {promotions && promotions.length > 0 ? (
        <div style={{ display: "grid", gap: 12 }}>
          {promotions.map((p: any) => (
            <PromotionRow key={p.id} promotion={p} />
          ))}
        </div>
      ) : (
        <div style={{ background: "white", border: "1px solid #e2e2e5", borderRadius: 12, padding: 24, color: "#888", fontSize: 13 }}>
          No promotions yet — create one above whenever you'd like to run an intro price or a limited discount.
        </div>
      )}
    </div>
  );
}
