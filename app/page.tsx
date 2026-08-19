import { createClient } from "@/lib/supabase/server";
import { BrandHeader } from "@/components/brand-header";
import { PricingSection } from "@/components/pricing-section";
import { FaqSection } from "@/components/faq-section";
import { WhatsappButton } from "@/components/whatsapp-button";

export default async function HomePage() {
  const supabase = await createClient();

  const [{ data: plans, error }, { data: addons }, { data: promotions }, { data: faqs }] = await Promise.all([
    supabase
      .from("plans")
      .select("id, name, slug, description, tagline, sort_order, plan_prices(billing_cycle, price_php), plan_features(feature_key, features(label, description))")
      .eq("is_active", true)
      .order("sort_order"),
    supabase
      .from("addons")
      .select("id, name, slug, description, recommended_for, addon_prices(billing_cycle, price_php)")
      .eq("is_active", true)
      .order("name"),
    supabase
      .from("promotions")
      .select("id, code, label, discount_percent, applies_to_plan_id, max_redemptions, redemptions_count, ends_at")
      .eq("is_active", true),
    supabase
      .from("faqs")
      .select("id, question, answer")
      .eq("is_active", true)
      .order("sort_order"),
  ]);

  const now = Date.now();
  const validPromotions = (promotions ?? []).filter((p: any) => {
    const capped = p.max_redemptions !== null && p.redemptions_count >= p.max_redemptions;
    const expired = p.ends_at ? new Date(p.ends_at).getTime() < now : false;
    return !capped && !expired;
  });

  return (
    <main style={{ maxWidth: 1000, margin: "0 auto", padding: "32px 24px 80px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
        <BrandHeader subtitle="by Virtual Angel Systems" />
        <a href="/login" style={{ fontSize: 13, color: "#2563eb" }}>Staff / clinic admin sign in →</a>
      </div>
      <p style={{ color: "#666", margin: "24px 0 8px", maxWidth: 640 }}>
        Smart clinic. Better care. One platform, individually configured for every clinic — pick a plan, add only
        the modules you need, and get started below.
      </p>
      <p style={{ color: "#7a5c12", background: "#fff7e6", border: "1px solid #e6c66b", borderRadius: 8, padding: "8px 14px", fontSize: 13, maxWidth: 640, marginBottom: 32 }}>
        Start with what you need today. You can add more features anytime as your clinic grows.
      </p>

      {error && <p style={{ color: "crimson" }}>Error loading plans: {error.message}</p>}

      <PricingSection
        plans={(plans as any) ?? []}
        addons={(addons as any) ?? []}
        promotions={(validPromotions as any) ?? []}
      />

      <FaqSection faqs={(faqs as any) ?? []} />
      <WhatsappButton />
    </main>
  );
}
