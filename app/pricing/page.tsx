import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { SiteNav } from "@/components/public/site-nav";
import { SiteFooter } from "@/components/public/site-footer";
import { WhatsappButton } from "@/components/whatsapp-button";
import { PricingSection } from "@/components/pricing-section";
import { FaqSection } from "@/components/faq-section";

const NAVY = "#0c1730";
const GOLD = "#e6c66b";

// Part 58-61: the dedicated public pricing page. One AngelClinic Core plan
// (Basic/Professional/Premium are retired, see migration
// angelclinic_core_addon_restructure) + provider-seat add-on pricing +
// optional add-ons + Enterprise contact for large practices. Every number
// here comes from the plans/addons/plan_prices tables — nothing is
// hardcoded, so editing prices in Superadmin → Pricing updates this page
// immediately (Part 60: "central pricing source").
export default async function PricingPage() {
  const supabase = await createClient();

  const [{ data: plans }, { data: addons }, { data: promotions }, { data: commerceSettings }, { data: faqs }] =
    await Promise.all([
      supabase
        .from("plans")
        .select(
          "id, name, slug, description, tagline, sort_order, included_provider_seats, additional_seat_price_monthly, additional_seat_price_yearly, plan_prices(billing_cycle, price_php), plan_features(feature_key, features(label, description))"
        )
        .eq("is_active", true)
        .order("sort_order"),
      supabase
        .from("addons")
        .select("id, name, slug, description, recommended_for, addon_prices(billing_cycle, price_php)")
        .eq("is_active", true)
        .order("name"),
      supabase
        .from("promotions")
        .select(
          "id, code, label, discount_percent, applies_to_plan_id, discount_type, fixed_amount_php, duration_type, duration_value, max_redemptions, redemptions_count, ends_at, target_tenant_id"
        )
        .eq("is_active", true)
        .is("code", null)
        .is("target_tenant_id", null),
      supabase.from("commerce_settings").select("offer_monthly, offer_yearly, offer_one_time").eq("id", true).maybeSingle(),
      supabase.from("faqs").select("id, question, answer").eq("is_active", true).order("sort_order").order("created_at"),
    ]);

  const enabledCycles = {
    monthly: commerceSettings?.offer_monthly ?? true,
    yearly: commerceSettings?.offer_yearly ?? true,
    one_time: commerceSettings?.offer_one_time ?? true,
  };

  const now = Date.now();
  const validPromotions = (promotions ?? []).filter((p: any) => {
    const capped = p.max_redemptions !== null && p.redemptions_count >= p.max_redemptions;
    const expired = p.ends_at ? new Date(p.ends_at).getTime() < now : false;
    return !capped && !expired;
  });

  return (
    <div style={{ background: "#faf9f6" }}>
      <SiteNav />

      <section style={{ background: `linear-gradient(180deg, ${NAVY} 0%, #14213f 100%)`, color: "#f4f5f7", padding: "56px 24px 44px", textAlign: "center" }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: GOLD, letterSpacing: 0.5, textTransform: "uppercase", marginBottom: 10 }}>
          Pricing
        </div>
        <h1 style={{ fontSize: 34, margin: "0 0 12px" }}>One Plan. Everything Your Clinic Needs.</h1>
        <p style={{ color: "rgba(244,245,247,0.8)", fontSize: 15, maxWidth: 560, margin: "0 auto" }}>
          AngelClinic Core includes patient records, scheduling, encounters, prescriptions, referrals, HMO/PhilHealth,
          branding, and more — no tiers to compare, no features locked behind a higher plan.
        </p>
      </section>

      <main style={{ maxWidth: 1000, margin: "0 auto", padding: "44px 24px 40px" }}>
        <PricingSection
          plans={(plans as any) ?? []}
          addons={(addons as any) ?? []}
          promotions={(validPromotions as any) ?? []}
          enabledCycles={enabledCycles}
        />

        <div style={{ background: NAVY, borderRadius: 14, padding: "32px 28px", textAlign: "center", marginBottom: 40 }}>
          <h2 style={{ color: "white", fontSize: 20, marginTop: 0, marginBottom: 8 }}>Large Practice or Multiple Providers?</h2>
          <p style={{ color: "rgba(244,245,247,0.75)", fontSize: 13.5, maxWidth: 520, margin: "0 auto 18px" }}>
            Clinics with many providers, multiple branches, or custom onboarding needs — let's talk about what fits
            your practice.
          </p>
          <Link
            href="/request-demo"
            style={{ display: "inline-block", background: GOLD, color: NAVY, fontWeight: 700, fontSize: 14, padding: "11px 24px", borderRadius: 8, textDecoration: "none" }}
          >
            Contact Us →
          </Link>
        </div>

        <FaqSection faqs={(faqs as any) ?? []} />
      </main>

      <SiteFooter />
      <WhatsappButton />
    </div>
  );
}
