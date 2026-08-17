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
