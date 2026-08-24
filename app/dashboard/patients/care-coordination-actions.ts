"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireClinicMember } from "@/lib/require-clinic-member";

// Primary/Family Doctor + progress-note sharing authorization (spec
// "ENCOUNTER HISTORY..." §8-11). Deliberately two separate concepts:
// picking a primary doctor never implies sharing authorization, and vice
// versa — see the two distinct RPCs below.

export type DirectoryProvider = {
  id: string;
  full_name: string;
  title: string | null;
  specialty: string | null;
  subspecialty: string | null;
  clinic_name: string | null;
  tenant_id: string;
};

// Searches ALL AngelClinic tenants — the one place this app crosses tenant
// boundaries, safe because it only returns name/title/specialty/clinic,
// never PHI. Used both for picking a Primary/Family Doctor and for a
// sharing-preference / "Send to AngelClinic Provider" target.
export async function searchAngelClinicProvidersAction(query: string): Promise<DirectoryProvider[]> {
  await requireClinicMember();
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("search_angelclinic_providers", { p_query: query || "" });
  if (error) throw new Error(error.message);
  return (data as any) ?? [];
}

export async function setPrimaryProviderAction(patientId: string, providerUserId: string | null, externalProviderId: string | null) {
  await requireClinicMember();
  const supabase = await createClient();
  const { error } = await supabase.rpc("set_primary_provider", {
    p_patient_id: patientId,
    p_provider_user_id: providerUserId,
    p_external_provider_id: externalProviderId,
  });
  if (error) throw new Error(error.message);
  revalidatePath(`/dashboard/patients/${patientId}`);
}

export async function setSharingPreferenceAction(patientId: string, providerUserId: string) {
  await requireClinicMember();
  const supabase = await createClient();
  const { error } = await supabase.rpc("set_sharing_preference", { p_patient_id: patientId, p_provider_user_id: providerUserId });
  if (error) throw new Error(error.message);
  revalidatePath(`/dashboard/patients/${patientId}`);
}

export type ExternalDirectoryProvider = { id: string; full_name: string; credentials: string | null; specialty: string | null; clinic_name: string | null; city: string | null };

// External providers (not AngelClinic users) — the curated directory
// already used by the public Find a Doctor page. Read-only here; never
// eligible as a sharing-preference target (spec §8 — no fake internal
// delivery to someone without an AngelClinic account).
export async function searchExternalProvidersAction(query: string): Promise<ExternalDirectoryProvider[]> {
  await requireClinicMember();
  const supabase = await createClient();
  let q = supabase
    .from("external_providers")
    .select("id, full_name, credentials, specialty, clinic_name, city")
    .eq("is_active", true)
    .order("full_name")
    .limit(25);
  if (query.trim()) q = q.ilike("full_name", `%${query.trim()}%`);
  const { data, error } = await q;
  if (error) throw new Error(error.message);
  return (data as any) ?? [];
}

// Used by the "Send to AngelClinic Provider" confirmation screen (spec
// §14) to show "authorization verified" before the user commits to
// sending — read-only, the send RPC re-checks this itself server-side.
export async function checkSharingAuthorizedAction(patientId: string, providerUserId: string): Promise<boolean> {
  await requireClinicMember();
  const supabase = await createClient();
  const { data } = await supabase
    .from("patient_sharing_preferences")
    .select("id")
    .eq("patient_id", patientId)
    .eq("provider_user_id", providerUserId)
    .eq("status", "active")
    .maybeSingle();
  return !!data;
}

export async function revokeSharingPreferenceAction(patientId: string) {
  await requireClinicMember();
  const supabase = await createClient();
  const { error } = await supabase.rpc("revoke_sharing_preference", { p_patient_id: patientId });
  if (error) throw new Error(error.message);
  revalidatePath(`/dashboard/patients/${patientId}`);
}
