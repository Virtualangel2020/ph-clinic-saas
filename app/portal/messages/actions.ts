"use server";

import { revalidatePath } from "next/cache";
import { requirePatientPortal } from "@/lib/require-patient-portal";

// Family Profiles Phase 1.8: pass the currently-active profile through as
// p_for_account_id so a manager viewing a dependent's portal sends/reads
// messages AS that dependent, never silently as themselves — the RPC
// re-validates the id against is_my_mycaredesk_account_or_managed
// regardless of what this passes, so a null (no MyCareDesk identity yet)
// falls back to exactly the pre-Phase-1 self-only behavior.
export async function sendProviderMessageAction(providerId: string, body: string) {
  const { supabase, activeAccountId } = await requirePatientPortal();
  const { data, error } = await supabase.rpc("portal_send_provider_message", { p_provider_id: providerId, p_body: body, p_for_account_id: activeAccountId });
  if (error) throw new Error(error.message);
  revalidatePath(`/portal/messages/${providerId}`);
  revalidatePath("/portal/messages");
  return data;
}

export async function markProviderThreadReadAction(providerId: string) {
  const { supabase, activeAccountId } = await requirePatientPortal();
  const { error } = await supabase.rpc("portal_mark_provider_thread_read", { p_provider_id: providerId, p_for_account_id: activeAccountId });
  if (error) throw new Error(error.message);
}
