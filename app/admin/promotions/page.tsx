import { requireAdmin } from "@/lib/require-admin";
import { PromotionForm } from "./promotion-form";
import { PromotionRow } from "./promotion-row";

// Deliberately unconditional, same as the rest of /admin: always shows the
// full list (active and inactive/expired) with an explicit empty state,
// never hides itself because there happen to be zero promotions yet.
//
// Phase 1 (promotions redesign): the form/row below now expose the full
// column set — discount_type/fixed_amount_php/duration_type/duration_value
// (+ monthly/yearly variants)/billing_cycle_scope/requires_code/target_tenant_id
// — instead of just discount_percent. Creation goes exclusively through
// admin_create_targeted_promotion now (see app/admin/actions.ts).
export default async function PromotionsPage() {
  const { supabase } = await requireAdmin();

  const [{ data: promotions }, { data: plans }, { data: addons }, { data: tenants }] = await Promise.all([
    supabase
      .from("promotions")
      .select(
        "id, code, requires_code, label, description, discount_type, discount_percent, fixed_amount_php, duration_type, duration_value, duration_value_monthly, duration_value_yearly, billing_cycle_scope, applies_to_plan_id, applies_to_seats, applies_to_addon_ids, max_redemptions, redemptions_count, is_active, starts_at, ends_at, created_at, plans:applies_to_plan_id(name), target_tenant_id, tenants:target_tenant_id(name), trial_duration_days, follow_on_promotion_id"
      )
      .order("created_at", { ascending: false }),
    // plan_prices is only used by the promotion form's "introductory price"
    // calculator (it needs a plan's current price to work out the fixed
    // discount that gets that plan down to the intro price).
    supabase
      .from("plans")
      .select("id, name, plan_prices(billing_cycle, price_php)")
      .eq("is_active", true)
      .order("sort_order"),
    supabase.from("addons").select("id, name").eq("is_active", true).order("name"),
    supabase.from("tenants").select("id, name").order("name"),
  ]);

  return (
    <div>
      <h1 style={{ fontSize: 24, marginBottom: 4 }}>Promotions</h1>
      <p style={{ color: "#666", marginBottom: 24 }}>
        Set an intro price or a limited-time discount. A promo with no redemption limit stays active until you turn
        it off; set a limit (e.g. 3) and it deactivates itself automatically once that many signups use it.
      </p>

      <div style={{ marginBottom: 32 }}>
        <PromotionForm plans={(plans ?? []) as any} addons={addons ?? []} tenants={tenants ?? []} existingPromotions={(promotions ?? []) as any} />
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
