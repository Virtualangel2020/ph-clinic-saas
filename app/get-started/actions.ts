"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createQrPhPaymentIntent, getPaymentIntentStatus } from "@/lib/paymongo";
import { previewCheckoutTotal, type CheckoutPreview, type BillingCycle } from "@/lib/billing/compute-promo";

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
//
// Pricing/discount math (Phase 1) is never computed here — it all goes
// through preview_checkout_total (see lib/billing/compute-promo.ts) so
// there's exactly one place that logic lives, shared with the client-side
// live preview via previewCheckoutAction below.

type SelectionInput = {
  clinicName: string;
  contactPhone: string;
  planId: string;
  cycle: BillingCycle;
  addonIds: string[];
  // Raw code the customer typed in, if any. The *resolved* promotion (its
  // id, whether it's even applicable) is never trusted from the client —
  // startSignupCheckoutAction re-resolves it itself via previewCheckoutTotal
  // below and stores whatever that resolves to.
  promoCode: string | null;
  // Agreement-before-payment (Phase A #7). The checkbox state itself is
  // just a UX gate — what actually blocks payment is that this action
  // refuses to create a PayMongo intent unless a real acceptance has been
  // recorded for this request (see record_agreement_acceptance below and
  // its belt-and-suspenders twin inside internal_provision_from_request).
  // When the request already carries an acceptance (a returning visitor
  // who accepted on a previous visit, then came back to tweak their plan),
  // these three fields are ignored and no new row is written.
  agreementAccepted: boolean;
  fullLegalName: string;
  roleTitle: string;
  clinicLegalName: string;
};

// Client-facing live preview — the get-started form calls this (debounced,
// as the customer changes plan/add-ons/cycle/code) purely to render numbers.
// It intentionally does not touch the `requests` table: startSignupCheckoutAction
// re-resolves the same numbers itself right before charging, so nothing this
// returns is ever trusted as the actual amount to charge.
export async function previewCheckoutAction(input: {
  planId: string;
  cycle: BillingCycle;
  addonIds: string[];
  promoCode: string | null;
}): Promise<CheckoutPreview> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not signed in.");

  return previewCheckoutTotal(supabase, {
    planId: input.planId,
    billingCycle: input.cycle,
    addonIds: input.addonIds,
    promoCode: input.promoCode,
    tenantId: null, // brand-new signup — no tenant exists yet
  });
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

  // Resolve pricing/promo server-side FIRST — never trust a client-supplied
  // promotion id. Whatever preview_checkout_total actually resolves (which
  // may be null, e.g. an expired/used-up/mistyped code) is what gets saved
  // on the request and what gets charged; the same resolution runs again at
  // redemption time (internal_provision_from_request → compute_promotion_discount)
  // once payment is confirmed, so a promo can never be recorded as applied
  // without actually passing validation.
  const preview = await previewCheckoutTotal(supabase, {
    planId: selection.planId,
    billingCycle: selection.cycle,
    addonIds: selection.addonIds,
    promoCode: selection.promoCode,
    tenantId: null,
  });
  const total = preview.total;
  const resolvedPromotionId = preview.promotion_id;

  if (requestId) {
    const { error } = await supabase.rpc("self_update_signup_request", {
      p_request_id: requestId,
      p_clinic_name: selection.clinicName,
      p_contact_phone: selection.contactPhone || null,
      p_requested_plan_id: selection.planId,
      p_requested_billing_cycle: selection.cycle,
      p_requested_addon_ids: selection.addonIds,
      p_promotion_id: resolvedPromotionId,
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
        promotion_id: resolvedPromotionId,
        user_id: user.id,
      })
      .select("id")
      .single();
    if (error || !inserted) throw new Error(error?.message ?? "Couldn't save your selection — please try again.");
    requestId = inserted.id;
  }

  // Agreement-before-payment: this request must carry a recorded
  // acceptance before we're willing to create a payment intent for it.
  // If a previous visit already recorded one, leave it alone — we never
  // overwrite an acceptance, and changing plan/add-ons afterward doesn't
  // require re-accepting the same agreement text.
  const { data: requestRow, error: requestFetchError } = await supabase
    .from("requests")
    .select("agreement_acceptance_id")
    .eq("id", requestId)
    .single();
  if (requestFetchError || !requestRow) throw new Error(requestFetchError?.message ?? "Couldn't load your request.");

  if (!requestRow.agreement_acceptance_id) {
    if (
      !selection.agreementAccepted ||
      !selection.fullLegalName.trim() ||
      !selection.roleTitle.trim() ||
      !selection.clinicLegalName.trim()
    ) {
      throw new Error("Please accept the Subscription & Services Agreement and fill in your name, role, and clinic's legal name before continuing.");
    }
    const { error: acceptError } = await supabase.rpc("record_agreement_acceptance", {
      p_request_id: requestId,
      p_full_legal_name: selection.fullLegalName.trim(),
      p_role_title: selection.roleTitle.trim(),
      p_clinic_legal_name: selection.clinicLegalName.trim(),
    });
    if (acceptError) throw new Error(acceptError.message);
  }

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
