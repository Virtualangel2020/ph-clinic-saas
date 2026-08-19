"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createQrPhPaymentIntent, getPaymentIntentStatus } from "@/lib/paymongo";

// The self-serve signup checkout: a signed-up, pre-tenant user picks a
// plan/add-ons here and pays with an in-app QR code. Mirrors the same
// trust-boundary pattern as app/dashboard/actions.ts (PayMongo's own
// "retrieve payment intent" status is the only thing that counts as
// "paid" — never anything the browser asserts), with one extra step at
// the end: once payment is confirmed, this calls
// provision_tenant_from_paid_request via the SERVICE-ROLE client. That
// function is deliberately not reachable by a normal authenticated
// session (see migration 025) — this Server Action is the only door to
// it, and it only opens that door after checking PayMongo itself.

type SelectionInput = {
  clinicName: string;
  contactPhone: string;
  planId: string;
  cycle: "monthly" | "yearly" | "one_time";
  addonIds: string[];
  promotionId: string | null;
};

async function computeTotal(
  supabase: Awaited<ReturnType<typeof createClient>>,
  planId: string,
  cycle: string,
  addonIds: string[],
  promotionId: string | null
) {
  const { data: plan } = await supabase
    .from("plans")
    .select("id, plan_prices(billing_cycle, price_php)")
    .eq("id", planId)
    .single();
  if (!plan) throw new Error("That plan isn't available anymore — please pick another.");

  const planPrice = (plan.plan_prices as any[])?.find((p) => p.billing_cycle === cycle)?.price_php;
  if (planPrice == null) throw new Error("That plan isn't offered on this billing cycle — please pick another.");

  let addonsTotal = 0;
  if (addonIds.length > 0) {
    const { data: addons } = await supabase
      .from("addons")
      .select("id, addon_prices(billing_cycle, price_php)")
      .in("id", addonIds);
    for (const a of addons ?? []) {
      const price = (a.addon_prices as any[])?.find((p: any) => p.billing_cycle === cycle)?.price_php;
      addonsTotal += price ? Number(price) : 0;
    }
  }

  const subtotal = Number(planPrice) + addonsTotal;

  let discount = 0;
  if (promotionId) {
    const { data: promo } = await supabase
      .from("promotions")
      .select("id, discount_percent, is_active, max_redemptions, redemptions_count, ends_at")
      .eq("id", promotionId)
      .single();
    const stillValid =
      promo &&
      promo.is_active &&
      (promo.max_redemptions === null || promo.redemptions_count < promo.max_redemptions) &&
      (!promo.ends_at || new Date(promo.ends_at).getTime() > Date.now());
    if (stillValid) {
      discount = Math.round(subtotal * (promo!.discount_percent / 100));
    }
  }

  return subtotal - discount;
}

// Creates (first visit) or updates (returning to change a selection) the
// applicant's own pending `requests` row, computes the total server-side
// (never trusts a client-supplied amount), and starts a QR Ph checkout
// for it.
export async function startSignupCheckoutAction(
  existingRequestId: string | null,
  selection: SelectionInput
): Promise<{ requestId: string; paymentIntentId: string; qrImage: string; amount: number }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not signed in.");

  let requestId = existingRequestId;

  if (requestId) {
    const { error } = await supabase.rpc("self_update_signup_request", {
      p_request_id: requestId,
      p_clinic_name: selection.clinicName,
      p_contact_phone: selection.contactPhone || null,
      p_requested_plan_id: selection.planId,
      p_requested_billing_cycle: selection.cycle,
      p_requested_addon_ids: selection.addonIds,
      p_promotion_id: selection.promotionId,
    });
    if (error) throw new Error(error.message);
  } else {
    const { data: inserted, error } = await supabase
      .from("requests")
      .insert({
        type: "new_signup",
        clinic_name: selection.clinicName,
        contact_name: user.user_metadata?.full_name ?? null,
        contact_email: user.email,
        contact_phone: selection.contactPhone || null,
        requested_plan_id: selection.planId,
        requested_billing_cycle: selection.cycle,
        requested_addon_ids: selection.addonIds,
        promotion_id: selection.promotionId,
        user_id: user.id,
      })
      .select("id")
      .single();
    if (error || !inserted) throw new Error(error?.message ?? "Couldn't save your selection — please try again.");
    requestId = inserted.id;
  }

  const total = await computeTotal(supabase, selection.planId, selection.cycle, selection.addonIds, selection.promotionId);
  if (total <= 0) throw new Error("This plan/add-on combination comes out to ₱0 — please check your selection.");

  const { paymentIntentId, qrImage } = await createQrPhPaymentIntent(
    total,
    `Angel Clinic signup — ${selection.clinicName}`
  );

  const { error: saveError } = await supabase.rpc("self_set_request_payment_intent", {
    p_request_id: requestId,
    p_payment_intent_id: paymentIntentId,
  });
  if (saveError) throw new Error(saveError.message);

  return { requestId: requestId!, paymentIntentId, qrImage, amount: total };
}

export async function checkSignupCheckoutStatusAction(
  requestId: string,
  paymentIntentId: string
): Promise<{ paid: boolean; status: string; tenantId?: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not signed in.");

  const { data: request, error: requestError } = await supabase
    .from("requests")
    .select("id, status, tenant_id, paymongo_payment_intent_id, user_id")
    .eq("id", requestId)
    .single();
  if (requestError || !request || request.user_id !== user.id) {
    throw new Error("Request not found, or it doesn't belong to you.");
  }
  if (request.paymongo_payment_intent_id !== paymentIntentId) {
    throw new Error("This QR code doesn't match your request anymore — refresh and try again.");
  }

  if (request.status === "approved") {
    // Already provisioned — either a previous poll tick did it, or (in
    // the unlikely event of a race) something else did.
    return { paid: true, status: "succeeded", tenantId: request.tenant_id ?? undefined };
  }

  const status = await getPaymentIntentStatus(paymentIntentId);
  if (status !== "succeeded") {
    return { paid: false, status };
  }

  // PayMongo itself confirms the money is in. Only now — via the
  // service-role client, the one place in this app allowed to call it —
  // do we provision the tenant and grant this user's account access to
  // it. resolved_by ends up NULL on this request, which is exactly how
  // /admin/requests distinguishes an auto-provisioned paid signup from
  // one a human admin actually approved.
  const admin = createAdminClient();
  const { data: tenantId, error: provisionError } = await admin.rpc("provision_tenant_from_paid_request", {
    p_request_id: requestId,
  });
  if (provisionError) throw new Error(provisionError.message);

  revalidatePath("/admin/requests");
  revalidatePath("/admin");

  return { paid: true, status: "succeeded", tenantId: tenantId ?? undefined };
}
