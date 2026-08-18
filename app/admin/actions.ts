"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

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
