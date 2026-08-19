"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAdmin } from "@/lib/require-admin";

// Every action here just calls the SECURITY DEFINER Postgres functions
// from migration 009 with the caller's own session — the functions
// themselves re-check is_platform_admin() before doing anything, so
// this file has no elevated privileges of its own.

export async function approveRequestAction(requestId: string) {
  const supabase = await createClient();
  const { error } = await supabase.rpc("admin_approve_request", { p_request_id: requestId });
  if (error) throw new Error(error.message);
  revalidatePath("/admin");
  revalidatePath("/admin/requests");
  revalidatePath("/admin/clients");
}

export async function rejectRequestAction(requestId: string, notes: string) {
  const supabase = await createClient();
  const { error } = await supabase.rpc("admin_reject_request", {
    p_request_id: requestId,
    p_notes: notes || null,
  });
  if (error) throw new Error(error.message);
  revalidatePath("/admin");
  revalidatePath("/admin/requests");
}

export async function setTenantPlanAction(
  tenantId: string,
  planId: string,
  billingCycle: "monthly" | "yearly" | "one_time"
) {
  const supabase = await createClient();
  const { error } = await supabase.rpc("admin_set_tenant_plan", {
    p_tenant_id: tenantId,
    p_plan_id: planId,
    p_billing_cycle: billingCycle,
  });
  if (error) throw new Error(error.message);
  revalidatePath(`/admin/clients/${tenantId}`);
  revalidatePath("/admin/clients");
}

export async function setTenantAddonAction(
  tenantId: string,
  addonId: string,
  enabled: boolean
) {
  const supabase = await createClient();
  const { error } = await supabase.rpc("admin_set_tenant_addon", {
    p_tenant_id: tenantId,
    p_addon_id: addonId,
    p_enabled: enabled,
  });
  if (error) throw new Error(error.message);
  revalidatePath(`/admin/clients/${tenantId}`);
}

export async function setTenantStatusAction(tenantId: string, status: string) {
  const supabase = await createClient();
  const { error } = await supabase.rpc("admin_set_tenant_status", {
    p_tenant_id: tenantId,
    p_status: status,
  });
  if (error) throw new Error(error.message);
  revalidatePath(`/admin/clients/${tenantId}`);
  revalidatePath("/admin/clients");
}

export async function setTenantTestFlagAction(tenantId: string, isTest: boolean) {
  const supabase = await createClient();
  const { error } = await supabase.rpc("admin_set_tenant_test_flag", {
    p_tenant_id: tenantId,
    p_is_test: isTest,
  });
  if (error) throw new Error(error.message);
  revalidatePath(`/admin/clients/${tenantId}`);
  revalidatePath("/admin/clients");
  revalidatePath("/admin");
}

export async function setTenantDiscountAction(
  tenantId: string,
  discountPercent: number | null,
  note: string
) {
  const supabase = await createClient();
  const { error } = await supabase.rpc("admin_set_tenant_discount", {
    p_tenant_id: tenantId,
    p_discount_percent: discountPercent,
    p_note: note || null,
  });
  if (error) throw new Error(error.message);
  revalidatePath(`/admin/clients/${tenantId}`);
}

export async function createPromotionAction(input: {
  label: string;
  discountPercent: number;
  planId: string | null;
  maxRedemptions: number | null;
  endsAt: string | null;
  code: string | null;
}) {
  const supabase = await createClient();
  const { error } = await supabase.rpc("admin_create_promotion", {
    p_label: input.label,
    p_discount_percent: input.discountPercent,
    p_plan_id: input.planId,
    p_max_redemptions: input.maxRedemptions,
    p_ends_at: input.endsAt,
    p_code: input.code,
  });
  if (error) throw new Error(error.message);
  revalidatePath("/admin/promotions");
  revalidatePath("/");
}

export async function setPromotionActiveAction(promotionId: string, isActive: boolean) {
  const supabase = await createClient();
  const { error } = await supabase.rpc("admin_set_promotion_active", {
    p_promotion_id: promotionId,
    p_is_active: isActive,
  });
  if (error) throw new Error(error.message);
  revalidatePath("/admin/promotions");
  revalidatePath("/");
}

// ── Pricing (Phase 1: payment-option foundations) ──────────────────────────

export async function upsertPlanPriceAction(planId: string, billingCycle: string, pricePhp: number) {
  const supabase = await createClient();
  const { error } = await supabase.rpc("admin_upsert_plan_price", {
    p_plan_id: planId,
    p_billing_cycle: billingCycle,
    p_price_php: pricePhp,
  });
  if (error) throw new Error(error.message);
  revalidatePath("/admin/pricing");
  revalidatePath("/");
}

export async function removePlanPriceAction(planId: string, billingCycle: string) {
  const supabase = await createClient();
  const { error } = await supabase.rpc("admin_remove_plan_price", {
    p_plan_id: planId,
    p_billing_cycle: billingCycle,
  });
  if (error) throw new Error(error.message);
  revalidatePath("/admin/pricing");
  revalidatePath("/");
}

export async function setPlanSortOrderAction(planId: string, sortOrder: number) {
  const supabase = await createClient();
  const { error } = await supabase.rpc("admin_set_plan_sort_order", {
    p_plan_id: planId,
    p_sort_order: sortOrder,
  });
  if (error) throw new Error(error.message);
  revalidatePath("/admin/pricing");
  revalidatePath("/");
}

export async function upsertAddonPriceAction(addonId: string, billingCycle: string, pricePhp: number) {
  const supabase = await createClient();
  const { error } = await supabase.rpc("admin_upsert_addon_price", {
    p_addon_id: addonId,
    p_billing_cycle: billingCycle,
    p_price_php: pricePhp,
  });
  if (error) throw new Error(error.message);
  revalidatePath("/admin/pricing");
  revalidatePath("/");
}

export async function removeAddonPriceAction(addonId: string, billingCycle: string) {
  const supabase = await createClient();
  const { error } = await supabase.rpc("admin_remove_addon_price", {
    p_addon_id: addonId,
    p_billing_cycle: billingCycle,
  });
  if (error) throw new Error(error.message);
  revalidatePath("/admin/pricing");
  revalidatePath("/");
}

export async function updateBillingSettingsAction(input: {
  gracePeriodDays: number;
  dataRetentionDays: number;
  defaultUpgradeCreditPolicy: string;
  reminderDaysBeforeBilling: number[];
  reminderDaysAfterFailedPayment: number;
}) {
  const supabase = await createClient();
  const { error } = await supabase.rpc("admin_update_billing_settings", {
    p_grace_period_days: input.gracePeriodDays,
    p_data_retention_days: input.dataRetentionDays,
    p_default_upgrade_credit_policy: input.defaultUpgradeCreditPolicy,
    p_reminder_days_before_billing: input.reminderDaysBeforeBilling,
    p_reminder_days_after_failed_payment: input.reminderDaysAfterFailedPayment,
  });
  if (error) throw new Error(error.message);
  revalidatePath("/admin/pricing");
}

// ── Care plans (for one-time-payment customers) ─────────────────────────────

export async function upsertCarePlanAction(input: {
  id: string | null;
  slug: string;
  name: string;
  kind: string;
  pricePhp: number | null;
  billingCycle: string | null;
  includesSupport: boolean;
  includesFeatureUpdates: boolean;
  requiresApproval: boolean;
  description: string;
}) {
  const supabase = await createClient();
  const { error } = await supabase.rpc("admin_upsert_care_plan", {
    p_id: input.id,
    p_slug: input.slug,
    p_name: input.name,
    p_kind: input.kind,
    p_price_php: input.pricePhp,
    p_billing_cycle: input.billingCycle,
    p_includes_support: input.includesSupport,
    p_includes_feature_updates: input.includesFeatureUpdates,
    p_requires_approval: input.requiresApproval,
    p_description: input.description || null,
  });
  if (error) throw new Error(error.message);
  revalidatePath("/admin/pricing");
}

export async function setCarePlanActiveAction(carePlanId: string, isActive: boolean) {
  const supabase = await createClient();
  const { error } = await supabase.rpc("admin_set_care_plan_active", {
    p_care_plan_id: carePlanId,
    p_is_active: isActive,
  });
  if (error) throw new Error(error.message);
  revalidatePath("/admin/pricing");
}

export async function assignTenantCarePlanAction(tenantId: string, carePlanId: string, nextBillingDate: string | null) {
  const supabase = await createClient();
  const { error } = await supabase.rpc("admin_assign_tenant_care_plan", {
    p_tenant_id: tenantId,
    p_care_plan_id: carePlanId,
    p_next_billing_date: nextBillingDate,
  });
  if (error) throw new Error(error.message);
  revalidatePath(`/admin/clients/${tenantId}`);
}

export async function setTenantCarePlanStatusAction(tenantCarePlanId: string, status: string, tenantId: string) {
  const supabase = await createClient();
  const { error } = await supabase.rpc("admin_set_tenant_care_plan_status", {
    p_tenant_care_plan_id: tenantCarePlanId,
    p_status: status,
  });
  if (error) throw new Error(error.message);
  revalidatePath(`/admin/clients/${tenantId}`);
}

// ── Invoices, payments, refunds ─────────────────────────────────────────────

export async function createInvoiceAction(input: {
  tenantId: string;
  description: string;
  amountPhp: number;
  discountPhp: number;
  dueDate: string | null;
}) {
  const supabase = await createClient();
  const { error } = await supabase.rpc("admin_create_invoice", {
    p_tenant_id: input.tenantId,
    p_description: input.description,
    p_amount_php: input.amountPhp,
    p_discount_php: input.discountPhp,
    p_due_date: input.dueDate,
  });
  if (error) throw new Error(error.message);
  revalidatePath(`/admin/clients/${input.tenantId}`);
}

export async function recordPaymentAction(input: {
  tenantId: string;
  amountPhp: number;
  method: string;
  reference: string;
  paymentDate: string;
  note: string;
  invoiceId: string | null;
}) {
  const supabase = await createClient();
  const { error } = await supabase.rpc("admin_record_payment", {
    p_tenant_id: input.tenantId,
    p_amount_php: input.amountPhp,
    p_method: input.method,
    p_reference: input.reference || null,
    p_payment_date: input.paymentDate,
    p_note: input.note || null,
    p_invoice_id: input.invoiceId,
  });
  if (error) throw new Error(error.message);
  revalidatePath(`/admin/clients/${input.tenantId}`);
}

export async function recordRefundAction(input: {
  tenantId: string;
  paymentId: string | null;
  amountPhp: number;
  reason: string;
}) {
  const supabase = await createClient();
  const { error } = await supabase.rpc("admin_record_refund", {
    p_tenant_id: input.tenantId,
    p_payment_id: input.paymentId,
    p_amount_php: input.amountPhp,
    p_reason: input.reason || null,
  });
  if (error) throw new Error(error.message);
  revalidatePath(`/admin/clients/${input.tenantId}`);
}

// Reconstructs this deploy's own origin from the incoming request headers
// instead of needing a hardcoded site-URL env var — works the same on
// preview and production Vercel deployments.
async function siteOrigin() {
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host");
  const proto = h.get("x-forwarded-proto") ?? "https";
  return `${proto}://${host}`;
}

// Creates the clinic staff member's login. Uses Supabase's own
// invite-by-email (see lib/supabase/admin.ts for why that needs the
// service-role key) — Supabase sends the email itself, so nothing here
// depends on us having our own email/SMS provider.
export async function inviteStaffAction(input: {
  tenantId: string;
  email: string;
  fullName: string;
  role: "clinic_admin" | "doctor" | "staff";
}) {
  const { supabase } = await requireAdmin();
  const origin = await siteOrigin();

  const admin = createAdminClient();
  const { data, error } = await admin.auth.admin.inviteUserByEmail(input.email, {
    redirectTo: `${origin}/auth/callback?next=/auth/set-password`,
    data: { full_name: input.fullName },
  });
  if (error) throw new Error(error.message);
  if (!data.user) throw new Error("Invite did not return a user — please try again.");

  const { error: profileError } = await supabase.rpc("admin_create_staff_profile", {
    p_user_id: data.user.id,
    p_tenant_id: input.tenantId,
    p_full_name: input.fullName,
    p_role: input.role,
  });
  if (profileError) throw new Error(profileError.message);

  revalidatePath(`/admin/clients/${input.tenantId}`);
}

// Creates a PayMongo Checkout Session for the remaining balance on an
// invoice and returns a hosted payment-page link. There's no automated
// email/SMS to deliver it yet, so the admin copies this link and sends it
// to the client themselves (same as everything else that isn't provisioned
// automatically in this system). Once the client pays, PayMongo calls our
// webhook (/api/webhooks/paymongo) which records the payment automatically.
//
// Test clients (tenants.is_test) skip PayMongo entirely — the "payment"
// auto-completes immediately via the same admin_record_payment path a
// manual cash/bank entry uses, so nothing is ever actually charged. This
// only exercises the invoice/payment/reporting side of things; it does
// NOT verify the PayMongo checkout+webhook wiring itself — that still
// needs one real (or PayMongo test-mode) payment to confirm.
export async function createPaymentLinkAction(invoiceId: string): Promise<{ testMode: boolean; checkoutUrl: string | null }> {
  const { supabase } = await requireAdmin();

  const { data: invoice, error: invoiceError } = await supabase
    .from("invoices")
    .select("id, tenant_id, description, amount_php, discount_php, paymongo_checkout_url, tenants(is_test)")
    .eq("id", invoiceId)
    .single();
  if (invoiceError || !invoice) throw new Error(invoiceError?.message ?? "Invoice not found");

  const { data: payments } = await supabase
    .from("payments")
    .select("amount_php")
    .eq("invoice_id", invoiceId);
  const alreadyPaid = (payments ?? []).reduce((sum, p: any) => sum + Number(p.amount_php), 0);
  const remaining = Number(invoice.amount_php) - Number(invoice.discount_php) - alreadyPaid;

  if (remaining <= 0) {
    throw new Error("This invoice is already fully paid.");
  }

  const isTestClient = (invoice as any).tenants?.is_test === true;
  if (isTestClient) {
    const { error: payError } = await supabase.rpc("admin_record_payment", {
      p_tenant_id: invoice.tenant_id,
      p_amount_php: remaining,
      p_method: "other",
      p_reference: "TEST CLIENT — auto-completed",
      p_payment_date: new Date().toISOString().slice(0, 10),
      p_note: "Test client — payment auto-completed, no real charge (PayMongo was not contacted).",
      p_invoice_id: invoiceId,
    });
    if (payError) throw new Error(payError.message);

    revalidatePath(`/admin/clients/${invoice.tenant_id}`);
    return { testMode: true, checkoutUrl: null };
  }

  const secretKey = process.env.PAYMONGO_SECRET_KEY;
  if (!secretKey) {
    throw new Error(
      "PAYMONGO_SECRET_KEY isn't set yet — add it as a server Environment Variable in Vercel (from your PayMongo dashboard's API keys page) and redeploy."
    );
  }

  const origin = await siteOrigin();
  const amountCentavos = Math.round(remaining * 100);

  const res = await fetch("https://api.paymongo.com/v1/checkout_sessions", {
    method: "POST",
    headers: {
      Authorization: `Basic ${Buffer.from(`${secretKey}:`).toString("base64")}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      data: {
        attributes: {
          send_email_receipt: false,
          show_line_items: true,
          description: `Angel Clinic — ${invoice.description}`,
          line_items: [
            {
              name: invoice.description,
              amount: amountCentavos,
              currency: "PHP",
              quantity: 1,
            },
          ],
          payment_method_types: ["gcash", "paymaya", "card", "grab_pay"],
          success_url: `${origin}/pay/success`,
        },
      },
    }),
  });

  const json = await res.json();
  if (!res.ok) {
    const message = json?.errors?.[0]?.detail ?? `PayMongo error (HTTP ${res.status})`;
    throw new Error(message);
  }

  const checkoutUrl: string = json.data.attributes.checkout_url;
  const sessionId: string = json.data.id;

  const { error: saveError } = await supabase.rpc("admin_set_invoice_checkout_session", {
    p_invoice_id: invoiceId,
    p_session_id: sessionId,
    p_checkout_url: checkoutUrl,
  });
  if (saveError) throw new Error(saveError.message);

  revalidatePath(`/admin/clients/${invoice.tenant_id}`);
  return { testMode: false, checkoutUrl };
}
