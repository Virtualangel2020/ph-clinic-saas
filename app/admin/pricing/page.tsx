import { requireAdmin } from "@/lib/require-admin";
import { PriceGrid } from "./price-grid";
import { CarePlanManager } from "./care-plan-manager";
import { BillingSettingsForm } from "./billing-settings-form";
import { PlanContentEditor, AddonContentEditor, FeatureDescriptionEditor } from "./catalog-content-editor";

// Everything an administrator can configure per Section 11/12 of the
// payment-options spec: what each package/add-on costs under each billing
// option, the care plans one-time-payment customers can buy afterward, and
// the global grace-period / upgrade-credit defaults.
export default async function PricingPage() {
  const { supabase } = await requireAdmin();

  const [{ data: plans }, { data: addons }, { data: carePlans }, { data: billingSettings }, { data: features }] = await Promise.all([
    supabase
      .from("plans")
      .select("id, name, sort_order, tagline, description, plan_prices(billing_cycle, price_php)")
      .order("sort_order"),
    supabase
      .from("addons")
      .select("id, name, description, recommended_for, addon_prices(billing_cycle, price_php)")
      .order("name"),
    supabase.from("care_plans").select("*").order("kind"),
    supabase.from("billing_settings").select("*").single(),
    supabase.from("features").select("feature_key, label, description").order("label"),
  ]);

  return (
    <div>
      <h1 style={{ fontSize: 24, marginBottom: 4 }}>Pricing</h1>
      <p style={{ color: "#666", marginBottom: 24 }}>
        Set what every package and add-on costs under each billing option, manage the care plans one-time-payment
        clients can buy after their warranty ends, and the platform-wide billing defaults.
      </p>

      <div style={{ marginBottom: 32 }}>
        <h2 style={{ fontSize: 16, marginBottom: 10 }}>Plan prices</h2>
        <p style={{ color: "#888", fontSize: 12, marginBottom: 10 }}>
          "Order" controls the sequence plans appear in on the public pricing page (lowest number first) — it
          doesn't have to match price order.
        </p>
        <PriceGrid kind="plan" items={(plans as any) ?? []} />
      </div>

      <div style={{ marginBottom: 32 }}>
        <h2 style={{ fontSize: 16, marginBottom: 10 }}>Package details</h2>
        <p style={{ color: "#888", fontSize: 12, marginBottom: 10 }}>
          The tagline and description customers see on the public pricing page and when they expand a package's
          details. Saves automatically when you click away from a field.
        </p>
        <PlanContentEditor plans={(plans as any) ?? []} />
      </div>

      <div style={{ marginBottom: 32 }}>
        <h2 style={{ fontSize: 16, marginBottom: 10 }}>Add-on prices</h2>
        <p style={{ color: "#888", fontSize: 12, marginBottom: 10 }}>
          Leave a billing option blank (no price) if that add-on shouldn't be offered that way — for example,
          priority support or hosting usually shouldn't be a one-time purchase.
        </p>
        <PriceGrid kind="addon" items={(addons as any) ?? []} />
      </div>

      <div style={{ marginBottom: 32 }}>
        <h2 style={{ fontSize: 16, marginBottom: 10 }}>Add-on details</h2>
        <p style={{ color: "#888", fontSize: 12, marginBottom: 10 }}>
          What each add-on does and who it's for — shown in the add-on's "Learn More" panel so customers understand
          what they're buying without asking you.
        </p>
        <AddonContentEditor addons={(addons as any) ?? []} />
      </div>

      <div style={{ marginBottom: 32 }}>
        <h2 style={{ fontSize: 16, marginBottom: 10 }}>Feature descriptions</h2>
        <p style={{ color: "#888", fontSize: 12, marginBottom: 10 }}>
          A plain-language explanation for every included feature, shown under it on the pricing page (e.g.
          "Prescription Generator — create organized printable prescriptions for patients").
        </p>
        <FeatureDescriptionEditor features={(features as any) ?? []} />
      </div>

      <div style={{ marginBottom: 32 }}>
        <h2 style={{ fontSize: 16, marginBottom: 10 }}>Care plans (for one-time-payment clients)</h2>
        <p style={{ color: "#888", fontSize: 12, marginBottom: 10 }}>
          After a one-time-payment client's 90-day warranty ends, these are the ongoing hosting/maintenance options
          they can be put on.
        </p>
        <CarePlanManager carePlans={(carePlans as any) ?? []} />
      </div>

      <div>
        <h2 style={{ fontSize: 16, marginBottom: 10 }}>Billing defaults</h2>
        <BillingSettingsForm settings={billingSettings as any} />
      </div>
    </div>
  );
}
