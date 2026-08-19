import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { BrandHeader } from "@/components/brand-header";
import { WhatsappButton } from "@/components/whatsapp-button";
import { GetStartedForm } from "./get-started-form";

// Step 2 of self-serve signup (step 1 is /signup — create the account).
// Pick a plan/add-ons, pay, and the tenant provisions automatically —
// no admin click required. See migration 025_self_serve_signup.
export default async function GetStartedPage({
  searchParams,
}: {
  searchParams: Promise<{ plan?: string; cycle?: string }>;
}) {
  const { plan: planParam, cycle: cycleParam } = await searchParams;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    redirect(`/signup${planParam ? `?plan=${planParam}${cycleParam ? `&cycle=${cycleParam}` : ""}` : ""}`);
  }

  // If this account already has a tenant (either this exact flow already
  // finished, or they're existing staff), send them straight to their
  // dashboard instead of showing the plan picker again.
  const { data: profile } = await supabase
    .from("user_profiles")
    .select("tenant_id")
    .eq("id", user!.id)
    .maybeSingle();
  if (profile?.tenant_id) {
    redirect("/dashboard");
  }

  const [{ data: plans }, { data: addons }, { data: promotions }, { data: existingRequest }, { data: commerceSettings }] = await Promise.all([
    supabase
      .from("plans")
      .select("id, name, slug, description, sort_order, plan_prices(billing_cycle, price_php), plan_features(feature_key, features(label))")
      .eq("is_active", true)
      .order("sort_order"),
    supabase
      .from("addons")
      .select("id, name, slug, addon_prices(billing_cycle, price_php)")
      .eq("is_active", true)
      .order("name"),
    supabase
      .from("promotions")
      .select("id, code, label, discount_percent, applies_to_plan_id, max_redemptions, redemptions_count, ends_at")
      .eq("is_active", true),
    supabase
      .from("requests")
      .select("id, clinic_name, contact_phone, requested_plan_id, requested_billing_cycle, requested_addon_ids, promotion_id, paymongo_payment_intent_id, status")
      .eq("user_id", user!.id)
      .eq("status", "pending")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase.from("commerce_settings").select("offer_monthly, offer_yearly, offer_one_time").eq("id", true).maybeSingle(),
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
    <main style={{ maxWidth: 720, margin: "0 auto", padding: "32px 24px 80px" }}>
      <div style={{ marginBottom: 8 }}>
        <BrandHeader subtitle="Get started" />
      </div>
      <p style={{ color: "#666", margin: "16px 0 28px" }}>
        Signed in as {user!.email}. Pick your plan and add-ons, then pay — your clinic's portal unlocks the moment
        payment is received, no waiting on us.
      </p>

      <GetStartedForm
        plans={(plans as any) ?? []}
        addons={(addons as any) ?? []}
        promotions={(validPromotions as any) ?? []}
        defaultClinicName={(user!.user_metadata as any)?.clinic_name ?? ""}
        defaultPhone={(user!.user_metadata as any)?.phone ?? ""}
        existingRequest={existingRequest ?? null}
        initialPlanId={planParam ?? null}
        initialCycle={cycleParam ?? null}
        enabledCycles={enabledCycles}
      />
      <WhatsappButton />
    </main>
  );
}
