"use server";

import { revalidatePath } from "next/cache";
import { requirePatientPortal } from "@/lib/require-patient-portal";

// Family Profiles Phase 2 (first slice): adult-to-adult household linking
// + per-dependent access grants. Every action here operates as the
// SIGNED-IN LOGIN itself (never the currently-active viewed profile) — a
// dependent can't have its own login, so "link my account to my
// husband's" and "share Kid with him" are always things the real person
// behind the login does, regardless of which profile the chooser currently
// has active. The RPCs resolve identity from auth.uid() directly rather
// than trusting any id from the client, so these actions just forward
// inputs and let the database enforce the real rules (linked-before-grant,
// dependent-only sharing, at-least-one-manager, etc.).

export type FoundAccount = { id: string; first_name: string; last_name: string; already_linked: boolean; request_pending: boolean };

export async function lookupAccountByPatientNumberAction(patientNumber: string): Promise<FoundAccount | null> {
  const { supabase } = await requirePatientPortal();
  const { data, error } = await supabase.rpc("find_mycaredesk_account_by_patient_number", { p_patient_number: patientNumber });
  if (error) throw new Error(error.message);
  const rows = (data as FoundAccount[]) ?? [];
  return rows[0] ?? null;
}

export async function requestAdultLinkAction(recipientAccountId: string) {
  const { supabase } = await requirePatientPortal();
  const { error } = await supabase.rpc("request_mycaredesk_adult_link", { p_recipient_account_id: recipientAccountId });
  if (error) throw new Error(error.message);
  revalidatePath("/portal/family");
}

export async function respondToAdultLinkRequestAction(requestId: string, approve: boolean) {
  const { supabase } = await requirePatientPortal();
  const { error } = await supabase.rpc("respond_to_mycaredesk_adult_link_request", { p_request_id: requestId, p_approve: approve });
  if (error) throw new Error(error.message);
  revalidatePath("/portal/family");
}

export async function cancelAdultLinkRequestAction(requestId: string) {
  const { supabase } = await requirePatientPortal();
  const { error } = await supabase.rpc("cancel_mycaredesk_adult_link_request", { p_request_id: requestId });
  if (error) throw new Error(error.message);
  revalidatePath("/portal/family");
}

export async function unlinkAdultAction(linkId: string) {
  const { supabase } = await requirePatientPortal();
  const { error } = await supabase.rpc("unlink_mycaredesk_adult", { p_link_id: linkId });
  if (error) throw new Error(error.message);
  revalidatePath("/portal/family");
}

export async function grantFamilyAccessAction(accountId: string, managerAccountId: string, relationship: string, relationshipOtherDescription: string | null) {
  const { supabase } = await requirePatientPortal();
  const { error } = await supabase.rpc("grant_mycaredesk_account_access", {
    p_account_id: accountId,
    p_manager_account_id: managerAccountId,
    p_relationship: relationship,
    p_relationship_other_description: relationshipOtherDescription,
  });
  if (error) throw new Error(error.message);
  revalidatePath("/portal/family");
}

export async function grantFamilyAccessAllAction(managerAccountId: string, relationship: string, relationshipOtherDescription: string | null): Promise<number> {
  const { supabase } = await requirePatientPortal();
  const { data, error } = await supabase.rpc("grant_mycaredesk_account_access_all", {
    p_manager_account_id: managerAccountId,
    p_relationship: relationship,
    p_relationship_other_description: relationshipOtherDescription,
  });
  if (error) throw new Error(error.message);
  revalidatePath("/portal/family");
  return (data as number) ?? 0;
}

export async function revokeFamilyAccessAction(accountId: string, managerAccountId: string) {
  const { supabase } = await requirePatientPortal();
  const { error } = await supabase.rpc("revoke_mycaredesk_account_access", { p_account_id: accountId, p_manager_account_id: managerAccountId });
  if (error) throw new Error(error.message);
  revalidatePath("/portal/family");
}
