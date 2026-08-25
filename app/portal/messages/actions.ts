"use server";

import { revalidatePath } from "next/cache";
import { requirePatientPortal } from "@/lib/require-patient-portal";

export async function sendProviderMessageAction(providerId: string, body: string) {
  const { supabase } = await requirePatientPortal();
  const { data, error } = await supabase.rpc("portal_send_provider_message", { p_provider_id: providerId, p_body: body });
  if (error) throw new Error(error.message);
  revalidatePath(`/portal/messages/${providerId}`);
  revalidatePath("/portal/messages");
  return data;
}

export async function markProviderThreadReadAction(providerId: string) {
  const { supabase } = await requirePatientPortal();
  const { error } = await supabase.rpc("portal_mark_provider_thread_read", { p_provider_id: providerId });
  if (error) throw new Error(error.message);
}
