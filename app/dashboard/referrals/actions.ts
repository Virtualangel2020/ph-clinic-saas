"use server";

import { revalidatePath } from "next/cache";
import { renderToBuffer } from "@react-pdf/renderer";
import { createClient } from "@/lib/supabase/server";
import { requireClinicMember } from "@/lib/require-clinic-member";
import { gatherReferralPdfData } from "@/lib/pdf/gather-referral-pdf-data";
import { ReferralLetterDocument } from "@/lib/pdf/referral-letter-document";

// Referrals module (spec §26-29). Every write is a SECURITY DEFINER RPC
// (migration referrals_module) that re-checks tenant membership itself —
// this file carries no elevated privilege of its own, same pattern as
// every other *-actions.ts in this app.

export type CreateReferralInput = {
  patientId: string;
  destinationType: "internal" | "external";
  receivingProviderId: string | null;
  externalProviderId: string | null;
  externalDestinationName: string;
  specialtyRequested: string;
  reason: string;
  clinicalSummary: string;
  urgency: "routine" | "urgent";
};

export async function createReferralAction(input: CreateReferralInput): Promise<string> {
  const { profile } = await requireClinicMember();
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("create_referral", {
    p_patient_id: input.patientId,
    p_destination_type: input.destinationType,
    p_receiving_provider_id: input.destinationType === "internal" ? input.receivingProviderId : null,
    p_external_provider_id: input.destinationType === "external" ? input.externalProviderId : null,
    p_external_destination_name: input.destinationType === "external" ? input.externalDestinationName : null,
    p_specialty_requested: input.specialtyRequested || null,
    p_reason: input.reason,
    p_clinical_summary: input.clinicalSummary || null,
    p_urgency: input.urgency,
  });
  if (error) throw new Error(error.message);

  // Generate the printable letter right away — for an external referral
  // it's the only artifact the destination gets; for internal it's an
  // optional printable copy. Best-effort: a PDF failure shouldn't undo an
  // otherwise-valid referral, so this never throws past this point.
  try {
    const pdfData = await gatherReferralPdfData(supabase, profile.tenant_id, data as string);
    const pdfBuffer = await renderToBuffer(ReferralLetterDocument({ data: pdfData }));
    await supabase.storage.from("referral-letters").upload(`${data}/referral-letter.pdf`, pdfBuffer as any, { contentType: "application/pdf" });
  } catch {
    // Letter can be regenerated/printed later; referral record stands either way.
  }

  revalidatePath("/dashboard/referrals");
  revalidatePath(`/dashboard/patients/${input.patientId}`);
  return data as string;
}

export async function acceptReferralAction(id: string, patientId: string) {
  await requireClinicMember();
  const supabase = await createClient();
  const { error } = await supabase.rpc("accept_referral", { p_id: id });
  if (error) throw new Error(error.message);
  revalidatePath("/dashboard/referrals");
  revalidatePath(`/dashboard/patients/${patientId}`);
}

export async function declineReferralAction(id: string, patientId: string, reason: string) {
  await requireClinicMember();
  const supabase = await createClient();
  const { error } = await supabase.rpc("decline_referral", { p_id: id, p_reason: reason || null });
  if (error) throw new Error(error.message);
  revalidatePath("/dashboard/referrals");
  revalidatePath(`/dashboard/patients/${patientId}`);
}

export async function completeReferralAction(id: string, patientId: string) {
  await requireClinicMember();
  const supabase = await createClient();
  const { error } = await supabase.rpc("complete_referral", { p_id: id });
  if (error) throw new Error(error.message);
  revalidatePath("/dashboard/referrals");
  revalidatePath(`/dashboard/patients/${patientId}`);
}

export async function cancelReferralAction(id: string, patientId: string) {
  await requireClinicMember();
  const supabase = await createClient();
  const { error } = await supabase.rpc("cancel_referral", { p_id: id });
  if (error) throw new Error(error.message);
  revalidatePath("/dashboard/referrals");
  revalidatePath(`/dashboard/patients/${patientId}`);
}

export async function getReferralLetterUrlAction(referralId: string): Promise<string> {
  await requireClinicMember();
  const supabase = await createClient();
  const { data, error } = await supabase.storage.from("referral-letters").createSignedUrl(`${referralId}/referral-letter.pdf`, 300);
  if (error || !data?.signedUrl) throw new Error("No printable letter is available for this referral yet.");
  return data.signedUrl;
}
