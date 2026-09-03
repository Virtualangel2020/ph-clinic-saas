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

  const [{ data: plans }, { data: addons }, { count: codePromoCount }, { data: existingRequest }, { data: commerceSettings }, { data: agreement }] = await Promise.all([
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
    // Only used to decide whether to show the promo-code field at all —
    // actual matching/eligibility is resolved server-side per-selection by
    // preview_checkout_total (see lib/billing/compute-promo.ts), not here.
    supabase
      .from("promotions")
      .select("id", { count: "exact", head: true })
      .eq("is_active", true)
      .eq("requires_code", true),
    supabase
      .from("requests")
      .select(
        "id, clinic_name, contact_phone, requested_plan_id, requested_billing_cycle, requested_addon_ids, paymongo_payment_intent_id, status, agreement_acceptance_id"
      )
      .eq("user_id", user!.id)
      .eq("status", "pending")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase.from("commerce_settings").select("offer_monthly, offer_yearly, offer_one_time").eq("id", true).maybeSingle(),
    // The active Subscription & Services Agreement text — must be shown and
    // accepted before payment can proceed (see migration
    // agreement_before_payment). Readable even signed-in-but-no-tenant-yet
    // via the "read_active" RLS policy.
    supabase.from("legal_agreements").select("id, version, title, body_markdown").eq("slug", "subscription_services_agreement").eq("is_active", true).maybeSingle(),
  ]);

  const enabledCycles = {
    monthly: commerceSettings?.offer_monthly ?? true,
    yearly: commerceSettings?.offer_yearly ?? true,
    one_time: commerceSettings?.offer_one_time ?? true,
  };

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
        hasCodePromotions={(codePromoCount ?? 0) > 0}
        defaultClinicName={(user!.user_metadata as any)?.clinic_name ?? ""}
        defaultPhone={(user!.user_metadata as any)?.phone ?? ""}
        existingRequest={existingRequest ?? null}
        initialPlanId={planParam ?? null}
        initialCycle={cycleParam ?? null}
        enabledCycles={enabledCycles}
        agreement={agreement ?? null}
        defaultClinicLegalName={(user!.user_metadata as any)?.clinic_name ?? ""}
        defaultFullLegalName={(user!.user_metadata as any)?.full_name ?? ""}
      />
      <WhatsappButton />
    </main>
  );
}
