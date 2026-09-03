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

// Cancelling Online Payments (patient_payments) needs one extra decision
// when Financial (financial_tracker) is only active because Online
// Payments bundled it in (spec §16) — "Would you like to continue using
// Financial?" p_keepFinancial answers that; it's ignored (harmlessly) if
// Financial wasn't bundle-only to begin with. Financial ledger data is
// never touched either way — this only ever changes entitlement rows.
export async function cancelOnlinePaymentsAddonAction(tenantId: string, keepFinancial: boolean) {
  const supabase = await createClient();
  const { error } = await supabase.rpc("admin_cancel_online_payments_addon", {
    p_tenant_id: tenantId,
    p_keep_financial: keepFinancial,
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

// ── Customer-facing content (Phase 1 of the self-service redesign) ─────────
// Everything here edits copy the public pricing page and customer portal
// display — package taglines/descriptions, add-on descriptions, feature
// descriptions, FAQ, and WhatsApp support settings — so none of it needs a
// developer to change later.

export async function setPlanContentAction(planId: string, description: string, tagline: string) {
  const supabase = await createClient();
  const { error } = await supabase.rpc("admin_set_plan_content", {
    p_plan_id: planId,
    p_description: description || null,
    p_tagline: tagline || null,
  });
  if (error) throw new Error(error.message);
  revalidatePath("/admin/pricing");
  revalidatePath("/");
}

export async function setAddonContentAction(addonId: string, description: string, recommendedFor: string) {
  const supabase = await createClient();
  const { error } = await supabase.rpc("admin_set_addon_content", {
    p_addon_id: addonId,
    p_description: description || null,
    p_recommended_for: recommendedFor || null,
  });
  if (error) throw new Error(error.message);
  revalidatePath("/admin/pricing");
  revalidatePath("/");
}

export async function setFeatureDescriptionAction(featureKey: string, description: string) {
  const supabase = await createClient();
  const { error } = await supabase.rpc("admin_set_feature_description", {
    p_feature_key: featureKey,
    p_description: description || null,
  });
  if (error) throw new Error(error.message);
  revalidatePath("/admin/pricing");
  revalidatePath("/");
}

export async function upsertFaqAction(input: { id: string | null; question: string; answer: string; sortOrder: number; isActive: boolean }) {
  const supabase = await createClient();
  const { error } = await supabase.rpc("admin_upsert_faq", {
    p_id: input.id,
    p_question: input.question,
    p_answer: input.answer,
    p_sort_order: input.sortOrder,
    p_is_active: input.isActive,
  });
  if (error) throw new Error(error.message);
  revalidatePath("/admin/faqs");
  revalidatePath("/");
}

export async function deleteFaqAction(id: string) {
  const supabase = await createClient();
  const { error } = await supabase.rpc("admin_delete_faq", { p_id: id });
  if (error) throw new Error(error.message);
  revalidatePath("/admin/faqs");
  revalidatePath("/");
}

export async function setWhatsappSettingsAction(input: { phoneNumber: string; defaultMessage: string; isEnabled: boolean }) {
  const supabase = await createClient();
  const { error } = await supabase.rpc("admin_set_whatsapp_settings", {
    p_phone_number: input.phoneNumber || null,
    p_default_message: input.defaultMessage,
    p_is_enabled: input.isEnabled,
  });
  if (error) throw new Error(error.message);
  revalidatePath("/admin/settings");
  revalidatePath("/");
}

// Which billing cycles (monthly/yearly/lifetime) are offered to customers —
// a Superadmin-editable toggle instead of hardcoding it into the pricing
// page and checkout. See migration 028_admin_advanced_controls.
export async function setCommerceSettingsAction(input: { offerMonthly: boolean; offerYearly: boolean; offerOneTime: boolean }) {
  const supabase = await createClient();
  const { error } = await supabase.rpc("admin_set_commerce_settings", {
    p_offer_monthly: input.offerMonthly,
    p_offer_yearly: input.offerYearly,
    p_offer_one_time: input.offerOneTime,
  });
  if (error) throw new Error(error.message);
  revalidatePath("/admin/settings");
  revalidatePath("/");
  revalidatePath("/get-started");
}

export async function updateBillingSettingsAction(input: {
  gracePeriodDays: number;
  dataRetentionDays: number;
  defaultUpgradeCreditPolicy: string;
  reminderDaysBeforeBilling: number[];
  reminderDaysAfterFailedPayment: number;
  providerVolumeDiscountThreshold: number;
  providerVolumeDiscountPercent: number;
}) {
  const supabase = await createClient();
  const { error } = await supabase.rpc("admin_update_billing_settings", {
    p_grace_period_days: input.gracePeriodDays,
    p_data_retention_days: input.dataRetentionDays,
    p_default_upgrade_credit_policy: input.defaultUpgradeCreditPolicy,
    p_reminder_days_before_billing: input.reminderDaysBeforeBilling,
    p_reminder_days_after_failed_payment: input.reminderDaysAfterFailedPayment,
    p_provider_volume_discount_threshold: input.providerVolumeDiscountThreshold,
    p_provider_volume_discount_percent: input.providerVolumeDiscountPercent,
  });
  if (error) throw new Error(error.message);
  revalidatePath("/admin/pricing");
  revalidatePath("/get-started");
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

// ── Public site content (Part 68-70) ────────────────────────────────────
// A lightweight CMS for the public marketing site's editable copy — hero,
// warm welcome, promo banner (tied to a real active Promotion, never a
// standalone claim), demo CTA, About, and Security intro. See migration
// public_site_and_commercial_v2 for the site_content singleton table.

export async function setSiteContentAction(input: {
  heroHeading: string;
  heroSubheading: string;
  welcomeHeading: string;
  welcomeBody: string;
  promoBannerEnabled: boolean;
  promoBannerText: string;
  promoBannerCtaLabel: string;
  promoBannerPromotionId: string | null;
  demoCtaHeading: string;
  demoCtaBody: string;
  aboutBody: string;
  securityIntro: string;
}) {
  const supabase = await createClient();
  const { error } = await supabase.rpc("admin_set_site_content", {
    p_hero_heading: input.heroHeading,
    p_hero_subheading: input.heroSubheading,
    p_welcome_heading: input.welcomeHeading,
    p_welcome_body: input.welcomeBody,
    p_promo_banner_enabled: input.promoBannerEnabled,
    p_promo_banner_text: input.promoBannerText,
    p_promo_banner_cta_label: input.promoBannerCtaLabel,
    p_promo_banner_promotion_id: input.promoBannerPromotionId,
    p_demo_cta_heading: input.demoCtaHeading,
    p_demo_cta_body: input.demoCtaBody,
    p_about_body: input.aboutBody,
    p_security_intro: input.securityIntro,
  });
  if (error) throw new Error(error.message);
  revalidatePath("/admin/site-content");
  revalidatePath("/");
  revalidatePath("/about");
  revalidatePath("/security");
}

// ── Demo request leads (Part 46) ────────────────────────────────────────

export async function setDemoRequestStatusAction(id: string, status: string) {
  const supabase = await createClient();
  const { error } = await supabase.rpc("admin_set_demo_request_status", { p_id: id, p_status: status });
  if (error) throw new Error(error.message);
  revalidatePath("/admin/demo-requests");
}

// ── Targeted / special-offer promotions (Part 41-43, Phase 1 promotions) ─
// admin_create_targeted_promotion is now the single creation path for every
// promotion the Superadmin UI makes (percentage / fixed amount /
// introductory price / free period), replacing createPromotionAction's
// narrower discount-percent-only admin_create_promotion RPC below — that
// legacy action is kept only for any external/API caller still on it, the
// UI no longer uses it.

export async function createTargetedPromotionAction(input: {
  label: string;
  description: string;
  discountType: "percent" | "fixed_amount" | "free_trial";
  discountPercent: number | null;
  fixedAmountPhp: number | null;
  durationType: "billing_cycles" | "months" | "until_date" | "ongoing";
  durationValue: number | null;
  durationValueMonthly: number | null;
  durationValueYearly: number | null;
  appliesToPlanId: string | null;
  appliesToSeats: boolean;
  appliesToAddonIds: string[];
  billingCycleScope: "monthly" | "yearly" | "both" | null;
  applyToFutureAdditions: boolean;
  targetTenantId: string | null;
  code: string | null;
  requiresCode: boolean;
  maxRedemptions: number | null;
  endsAt: string | null;
  // Free Trial promotions only — see promotions_free_trial_and_scope
  // migration. A free trial is always Core-only (enforced at the DB level
  // too): appliesToSeats/appliesToAddonIds must be false/empty when
  // discountType is 'free_trial'.
  trialDurationDays: number | null;
  followOnPromotionId: string | null;
}) {
  const supabase = await createClient();
  const { error } = await supabase.rpc("admin_create_targeted_promotion", {
    p_label: input.label,
    p_description: input.description || null,
    p_discount_type: input.discountType,
    p_discount_percent: input.discountPercent,
    p_fixed_amount_php: input.fixedAmountPhp,
    p_duration_type: input.durationType,
    p_duration_value: input.durationValue,
    p_applies_to_seats: input.appliesToSeats,
    p_applies_to_addon_ids: input.appliesToAddonIds,
    p_billing_cycle_scope: input.billingCycleScope,
    p_apply_to_future_additions: input.applyToFutureAdditions,
    p_target_tenant_id: input.targetTenantId,
    p_code: input.code,
    p_requires_code: input.requiresCode,
    p_max_redemptions: input.maxRedemptions,
    p_ends_at: input.endsAt,
    p_duration_value_monthly: input.durationValueMonthly,
    p_duration_value_yearly: input.durationValueYearly,
    p_applies_to_plan_id: input.appliesToPlanId,
    p_trial_duration_days: input.trialDurationDays,
    p_follow_on_promotion_id: input.followOnPromotionId,
  });
  if (error) throw new Error(error.message);
  revalidatePath("/admin/promotions");
  if (input.targetTenantId) revalidatePath(`/admin/clients/${input.targetTenantId}`);
}

// ── Provider seats (Part 44-45) ─────────────────────────────────────────

export async function setTenantProviderSeatsAction(tenantId: string, seats: number) {
  const supabase = await createClient();
  const { error } = await supabase.rpc("admin_set_tenant_provider_seats", { p_tenant_id: tenantId, p_seats: seats });
  if (error) throw new Error(error.message);
  revalidatePath(`/admin/clients/${tenantId}`);
}

// ── External Providers directory (Find-a-Doctor "Other Providers") ──────
// Manually curated by Virtual Angel Systems staff — never scraped or
// auto-generated (see external_providers table comment). This is the tool
// that actually lets someone here enter a real, verified provider's info.

export async function upsertExternalProviderAction(input: {
  id: string | null;
  fullName: string;
  credentials: string;
  specialty: string;
  subspecialty: string;
  clinicName: string;
  hospital: string;
  address: string;
  city: string;
  contactNumber: string;
  photoPath: string | null;
  scheduleText: string;
  source: string;
  sourceUrl: string;
  verified: boolean;
  isActive: boolean;
}) {
  const { supabase } = await requireAdmin();
  const { data, error } = await supabase.rpc("admin_upsert_external_provider", {
    p_id: input.id,
    p_full_name: input.fullName,
    p_credentials: input.credentials || null,
    p_specialty: input.specialty || null,
    p_subspecialty: input.subspecialty || null,
    p_clinic_name: input.clinicName || null,
    p_hospital: input.hospital || null,
    p_address: input.address || null,
    p_city: input.city || null,
    p_contact_number: input.contactNumber || null,
    p_photo_path: input.photoPath,
    p_schedule_text: input.scheduleText || null,
    p_source: input.source || null,
    p_source_url: input.sourceUrl || null,
    p_verified: input.verified,
    p_is_active: input.isActive,
  });
  if (error) throw new Error(error.message);
  revalidatePath("/admin/providers-directory");
  revalidatePath("/find-a-doctor");
  return data as string;
}

export async function deleteExternalProviderAction(id: string) {
  const { supabase } = await requireAdmin();
  const { error } = await supabase.rpc("admin_delete_external_provider", { p_id: id });
  if (error) throw new Error(error.message);
  revalidatePath("/admin/providers-directory");
  revalidatePath("/find-a-doctor");
}

export async function uploadExternalProviderPhotoAction(formData: FormData) {
  const { supabase } = await requireAdmin();
  const file = formData.get("file") as File | null;
  if (!file || file.size === 0) throw new Error("Choose a photo first.");
  if (!["image/png", "image/jpeg", "image/webp"].includes(file.type)) {
    throw new Error("Photo must be a PNG, JPG, or WEBP image.");
  }
  if (file.size > 3 * 1024 * 1024) throw new Error("Photo must be under 3MB.");

  const ext = file.name.split(".").pop() || "jpg";
  const path = `${crypto.randomUUID()}.${ext}`;
  const { error } = await supabase.storage.from("external-provider-photos").upload(path, file);
  if (error) throw new Error(error.message);
  return path;
}

// ── Deleting a client (Superadmin only, irreversible) ────────────────────
// tenants(id) cascades to every dependent table (subscriptions, invoices,
// payments, entitlements, discounts, user_profiles, etc. — verified against
// the actual FK constraints before writing this), so deleting the tenant
// row cleans up everything EXCEPT the staff's auth.users login records,
// since those aren't reachable via cascade (user_profiles.id references
// auth.users, not the other way around). We grab their ids first, delete
// the tenant, then remove each login with the service-role admin client so
// no orphaned "no tenant" accounts are left behind.
export async function deleteTenantAction(tenantId: string) {
  const { supabase, profile } = await requireAdmin();

  const { data: staff } = await supabase.from("user_profiles").select("id").eq("tenant_id", tenantId);
  const staffIds = (staff ?? []).map((s) => s.id);

  const { error } = await supabase.from("tenants").delete().eq("id", tenantId);
  if (error) throw new Error(error.message);

  const admin = createAdminClient();
  for (const id of staffIds) {
    // Best-effort: the tenant is already gone at this point regardless of
    // whether a given login cleanup succeeds, so one failure here doesn't
    // roll anything back — just log-and-continue rather than throw.
    await admin.auth.admin.deleteUser(id).catch(() => {});
  }

  await supabase.from("audit_logs").insert({
    actor_user_id: profile.id,
    action: "tenant_deleted",
    entity_type: "tenants",
    entity_id: tenantId,
  });

  revalidatePath("/admin/clients");
  revalidatePath("/admin");
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

  const invited = await admin.auth.admin.inviteUserByEmail(input.email, {
    redirectTo: `${origin}/auth/callback?next=/auth/set-password`,
    data: { full_name: input.fullName },
  });

  let userId: string;
  const alreadyExists =
    !!invited.error && (invited.error.status === 422 || /already.*regist|already exist/i.test(invited.error.message));

  if (invited.error && !alreadyExists) {
    throw new Error(invited.error.message);
  }

  if (alreadyExists) {
    // No hard limit on who can be added — this email already has an
    // account somewhere (an earlier invite, or someone who self-signed-up
    // as a customer at /signup). Supabase's invite endpoint refuses to
    // "invite" an already-registered email, but that shouldn't block
    // adding them here: look their existing account up and grant them
    // access to THIS clinic directly, then send a password-set link
    // instead of a duplicate invite email.
    const { data: existingId, error: lookupError } = await supabase.rpc("admin_lookup_user_id_by_email", {
      p_email: input.email,
    });
    if (lookupError || !existingId) throw new Error("That email already has an account, but it couldn't be looked up — please try again.");
    userId = existingId;
  } else {
    if (!invited.data?.user) throw new Error("Invite did not return a user — please try again.");
    userId = invited.data.user.id;
  }

  // Note: user_profiles.tenant_id is a single value today, so if this
  // email already had staff access at a DIFFERENT clinic, granting access
  // here moves them into this one instead of adding a second membership.
  const { error: profileError } = await supabase.rpc("admin_create_staff_profile", {
    p_user_id: userId,
    p_tenant_id: input.tenantId,
    p_full_name: input.fullName,
    p_role: input.role,
  });
  if (profileError) throw new Error(profileError.message);

  if (alreadyExists) {
    // They already had an account, so no invite email went out above —
    // this works whether or not they already know a password: if they
    // do, they can ignore it and just sign in; if they don't (e.g. an
    // earlier invite never got completed), this is how they set one.
    await supabase.auth.resetPasswordForEmail(input.email, {
      redirectTo: `${origin}/auth/callback?next=/auth/set-password`,
    });
  }

  revalidatePath(`/admin/clients/${input.tenantId}`);
}

// Re-sends access to someone who already has an account but never
// completed set-password — most commonly because the first email link
// died on a broken redirect (see components/auth-error-banner.tsx).
// Always uses the password-reset flow rather than inviteUserByEmail,
// since by definition a "resend" target already has an account, and
// Supabase's invite endpoint refuses already-registered emails.
export async function resendStaffInviteAction(userId: string, tenantId: string) {
  const { supabase } = await requireAdmin();
  const origin = await siteOrigin();
  const admin = createAdminClient();

  const { data: authUser, error: authError } = await admin.auth.admin.getUserById(userId);
  if (authError || !authUser.user?.email) throw new Error("Couldn't find that person's account.");

  const { data: profile, error: profileFetchError } = await supabase
    .from("user_profiles")
    .select("full_name, role")
    .eq("id", userId)
    .single();
  if (profileFetchError || !profile) throw new Error("Couldn't find that person's staff record.");

  const { error } = await supabase.auth.resetPasswordForEmail(authUser.user.email, {
    redirectTo: `${origin}/auth/callback?next=/auth/set-password`,
  });
  if (error) throw new Error(error.message);

  const { error: profileError } = await supabase.rpc("admin_create_staff_profile", {
    p_user_id: userId,
    p_tenant_id: tenantId,
    p_full_name: profile.full_name,
    p_role: profile.role,
  });
  if (profileError) throw new Error(profileError.message);

  revalidatePath(`/admin/clients/${tenantId}`);
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

// ── Customer Care (persistent per-clinic support thread) ────────────────

export async function adminSendSupportMessageAction(tenantId: string, body: string) {
  const { supabase } = await requireAdmin();
  const { error } = await supabase.rpc("admin_send_support_message", { p_tenant_id: tenantId, p_body: body });
  if (error) throw new Error(error.message);
  revalidatePath(`/admin/customer-care/${tenantId}`);
  revalidatePath("/admin/customer-care");
}

export async function adminMarkSupportReadAction(tenantId: string) {
  const { supabase } = await requireAdmin();
  const { error } = await supabase.rpc("admin_mark_support_read", { p_tenant_id: tenantId });
  if (error) throw new Error(error.message);
  revalidatePath(`/admin/customer-care/${tenantId}`);
  revalidatePath("/admin/customer-care");
}

// Wipes and re-seeds a TEST tenant's demo content (patients, appointment
// types, cert template, clinic branding, demo doctors' credentials, one
// pending credential request) back to a fixed baseline — see migration
// admin_reset_demo_tenant. The RPC itself refuses to run against any
// tenant that isn't flagged is_test, so this can't touch a real clinic.
export async function resetDemoTenantAction(tenantId: string) {
  const { supabase } = await requireAdmin();
  const { error } = await supabase.rpc("admin_reset_demo_tenant", { p_tenant_id: tenantId });
  if (error) throw new Error(error.message);
  revalidatePath(`/admin/clients/${tenantId}`);
}

// ── Communication provider integrations (the "activation spot") ─────────
// Plugging in a real email/SMS provider here is what turns the
// email_communications/sms_messaging add-ons from an entitlement flag
// into something that actually sends. A blank apiKey means "leave the
// currently-saved key as-is" — the form never round-trips the real value.

export async function setEmailProviderSettingsAction(input: {
  provider: string;
  apiKey: string;
  fromEmail: string;
  fromName: string;
  isEnabled: boolean;
}) {
  const { supabase } = await requireAdmin();
  const { error } = await supabase.rpc("admin_set_email_provider_settings", {
    p_provider: input.provider,
    p_api_key: input.apiKey || null,
    p_from_email: input.fromEmail,
    p_from_name: input.fromName,
    p_is_enabled: input.isEnabled,
  });
  if (error) throw new Error(error.message);
  revalidatePath("/admin/settings");
}

export async function setSmsProviderSettingsAction(input: {
  provider: string;
  apiKey: string;
  senderId: string;
  isEnabled: boolean;
}) {
  const { supabase } = await requireAdmin();
  const { error } = await supabase.rpc("admin_set_sms_provider_settings", {
    p_provider: input.provider,
    p_api_key: input.apiKey || null,
    p_sender_id: input.senderId,
    p_is_enabled: input.isEnabled,
  });
  if (error) throw new Error(error.message);
  revalidatePath("/admin/settings");
}
