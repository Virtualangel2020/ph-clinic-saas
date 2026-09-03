import type { SupabaseClient } from "@supabase/supabase-js";

// Single source of truth for checkout math (Phase 1 of the promotions
// redesign). Both the Server Action that actually starts a paid checkout
// (app/get-started/actions.ts's startSignupCheckoutAction) and the
// client-side live preview (get-started-form.tsx, via
// previewCheckoutAction in app/get-started/actions.ts) call through this
// same wrapper around the preview_checkout_total Postgres RPC — so there
// is exactly one place plan/add-on/seat pricing and promo-discount logic
// lives, instead of duplicated JS math on the client and in the server
// action (the pre-Phase-1 state). preview_checkout_total in turn calls
// compute_promotion_discount, which is the one place that reads
// discount_type/duration_type/billing_cycle_scope etc. and enforces the
// "a promo never stacks on top of an existing manual tenant_discounts
// row" rule. See migration promotions_phase1.

export type BillingCycle = "monthly" | "yearly" | "one_time";

export type CheckoutPromoResult = {
  applicable: boolean;
  reason?: string;
  discount_php?: number;
  discount_type?: "percent" | "fixed_amount";
  duration_type?: "one_payment" | "billing_cycles" | "months" | "until_date" | "ongoing";
  duration_value?: number | null;
  ends_at_date?: string | null;
  ends_at_cycle_number?: number | null;
  promotion_label?: string;
};

export type CheckoutPreview = {
  subtotal: number;
  discount_php: number;
  total: number;
  promotion_id: string | null;
  promotion: CheckoutPromoResult;
};

export async function previewCheckoutTotal(
  supabase: SupabaseClient,
  params: {
    planId: string;
    billingCycle: BillingCycle;
    addonIds?: string[];
    seats?: number;
    // Explicit code the customer typed in. Leave both promoCode and
    // promotionId unset to let the RPC auto-apply the best no-code,
    // untargeted promotion for this plan (if any) — same behavior as
    // pre-Phase-1's client-side findAutoPromo(), just resolved server-side.
    promoCode?: string | null;
    promotionId?: string | null;
    // Only meaningful for an existing tenant (upgrade/downgrade flows,
    // not yet wired up in Phase 1) — lets compute_promotion_discount
    // check whether that tenant already has an active manual discount
    // and refuse to stack a promo on top of it. Leave null for a brand
    // new signup, which has no tenant yet.
    tenantId?: string | null;
  }
): Promise<CheckoutPreview> {
  const { data, error } = await supabase.rpc("preview_checkout_total", {
    p_plan_id: params.planId,
    p_billing_cycle: params.billingCycle,
    p_addon_ids: params.addonIds ?? [],
    p_seats: params.seats ?? 1,
    p_promo_code: params.promoCode?.trim() || null,
    p_promotion_id: params.promotionId || null,
    p_tenant_id: params.tenantId || null,
  });
  if (error) throw new Error(error.message);
  return data as CheckoutPreview;
}

// Friendly text for why a promo code/auto-promo didn't apply. `reason` is
// whatever compute_promotion_discount returned; `hadCode` distinguishes "no
// code was typed" (nothing to say) from "a code was typed but it didn't
// resolve to any promotion at all" (both cases surface as reason
// 'no_promotion', since the DB can't tell "no code" and "unrecognized code"
// apart once no promotion id was found).
export function describePromoRejection(reason: string | undefined, hadCode: boolean): string | null {
  switch (reason) {
    case "no_promotion":
      return hadCode ? "That code isn't recognized, or it's no longer active." : null;
    case "not_found_or_inactive":
      return "That code isn't valid.";
    case "redemption_cap_reached":
      return "That promo has reached its redemption limit.";
    case "expired":
      return "That promo has expired.";
    case "wrong_billing_cycle":
      return "That promo doesn't apply to this billing cycle.";
    case "wrong_plan":
      return "That promo doesn't apply to the plan you've selected.";
    case "duration_requires_monthly":
      return "That promo only applies to monthly billing.";
    case "tenant_has_manual_discount":
      return "That promo can't be combined with an existing discount on this account.";
    default:
      return null;
  }
}

// A short, customer-facing note about how long a promo's discount lasts —
// used underneath the "🎉 discount applied" banner on the get-started form.
// Returns null when there's nothing worth saying (e.g. an ongoing discount
// with no end condition).
export function describePromoDuration(promo: CheckoutPromoResult): string | null {
  if (!promo.applicable) return null;
  switch (promo.duration_type) {
    case "one_payment":
      return "on this payment only";
    case "billing_cycles":
    case "months": {
      const n = promo.duration_value ?? 1;
      const unit = promo.duration_type === "months" ? "month" : "billing cycle";
      return `for your first ${n} ${unit}${n === 1 ? "" : "s"}`;
    }
    case "until_date":
      return promo.ends_at_date ? `until ${new Date(promo.ends_at_date).toLocaleDateString()}` : null;
    default:
      return null;
  }
}
