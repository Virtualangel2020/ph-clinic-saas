"use server";

import { revalidatePath } from "next/cache";
import { renderToBuffer } from "@react-pdf/renderer";
import { createClient } from "@/lib/supabase/server";
import { requireClinicMember } from "@/lib/require-clinic-member";
import { gatherEncounterPdfData } from "@/lib/pdf/gather-encounter-pdf-data";
import { EncounterExportDocument } from "@/lib/pdf/encounter-pdf-document";
import { savePatientAction, type PatientInput } from "../patients/actions";

// Internal provider-to-provider sharing (spec §7, §14-18) — NOT email.
// Sending generates the exact same combined PDF as the export feature
// (via the shared gatherEncounterPdfData helper) and stores it in the
// private records-exchange-transfers bucket, readable only by the two
// participants (storage RLS keyed off records_exchange_transfers rows —
// see migration care_coordination_and_records_exchange).

export async function sendRecordsTransferAction(patientId: string, encounterIds: string[], receivingProviderId: string): Promise<string> {
  const { supabase, profile } = await requireClinicMember();

  const { data: transferId, error } = await supabase.rpc("send_records_transfer", {
    p_patient_id: patientId,
    p_encounter_ids: encounterIds,
    p_receiving_provider_id: receivingProviderId,
  });
  if (error) throw new Error(error.message);

  const pdfData = await gatherEncounterPdfData(supabase, profile.tenant_id, encounterIds);
  const pdfBuffer = await renderToBuffer(EncounterExportDocument(pdfData));
  const { error: uploadError } = await supabase.storage
    .from("records-exchange-transfers")
    .upload(`${transferId}/record.pdf`, pdfBuffer as any, { contentType: "application/pdf" });
  if (uploadError) throw new Error(uploadError.message);

  revalidatePath(`/dashboard/patients/${patientId}`);
  revalidatePath("/dashboard/records-exchange");
  return transferId as string;
}

export async function acceptRecordsTransferAction(transferId: string) {
  const { supabase } = await requireClinicMember();
  const { error } = await supabase.rpc("accept_records_transfer", { p_transfer_id: transferId });
  if (error) throw new Error(error.message);
  revalidatePath("/dashboard/records-exchange");
}

export async function declineRecordsTransferAction(transferId: string, reason: string) {
  const { supabase } = await requireClinicMember();
  const { error } = await supabase.rpc("decline_records_transfer", { p_transfer_id: transferId, p_reason: reason || null });
  if (error) throw new Error(error.message);
  revalidatePath("/dashboard/records-exchange");
}

export async function getTransferPdfUrlAction(transferId: string): Promise<string> {
  const { supabase } = await requireClinicMember();
  const { data, error } = await supabase.storage.from("records-exchange-transfers").createSignedUrl(`${transferId}/record.pdf`, 300);
  if (error || !data?.signedUrl) throw new Error(error?.message || "Couldn't generate a link for this record.");
  return data.signedUrl;
}

// "Accept & File" (spec §15) — reuses the existing patient add/search flow
// (savePatientAction, same as the appointment form's inline "+ Add New
// Patient") to pick which of THIS clinic's patients the incoming record
// belongs under, copies the PDF into this tenant's own patient-documents
// bucket (same storage convention as every other document), and files it
// via the existing add_patient_document RPC labeled "External Record" so
// it's never confused with something originated in-house.
export async function fileRecordsTransferAction(
  transferId: string,
  targetPatientId: string | null,
  newPatient: PatientInput | null,
  sendingClinicName: string,
  sendingProviderName: string
): Promise<void> {
  const { supabase, profile } = await requireClinicMember();

  let patientId = targetPatientId;
  if (!patientId && newPatient) {
    patientId = await savePatientAction(newPatient);
  }
  if (!patientId) throw new Error("Select or create the patient this record belongs to.");

  const { data: signed, error: signError } = await supabase.storage.from("records-exchange-transfers").createSignedUrl(`${transferId}/record.pdf`, 120);
  if (signError || !signed?.signedUrl) throw new Error(signError?.message || "Couldn't read the incoming record.");
  const pdfRes = await fetch(signed.signedUrl);
  if (!pdfRes.ok) throw new Error("Couldn't download the incoming record.");
  const pdfBytes = new Uint8Array(await pdfRes.arrayBuffer());

  const storagePath = `${profile.tenant_id}/${patientId}/${Date.now()}-external-record.pdf`;
  const { error: uploadError } = await supabase.storage.from("patient-documents").upload(storagePath, pdfBytes, { contentType: "application/pdf" });
  if (uploadError) throw new Error(uploadError.message);

  const { data: docIdRaw, error: docError } = await supabase.rpc("add_patient_document", {
    p_patient_id: patientId,
    p_title: `External Record — from Dr. ${sendingProviderName} (${sendingClinicName})`,
    p_doc_type: "referrals",
    p_description: "Received via AngelClinic Records Exchange.",
    p_storage_path: storagePath,
    p_mime_type: "application/pdf",
    p_file_size_bytes: pdfBytes.byteLength,
  });
  if (docError) throw new Error(docError.message);

  // add_patient_document's return shape isn't guaranteed here (existing
  // callers elsewhere in the app never used its return value) — fall back
  // to looking the row up by its unique storage_path if the RPC didn't
  // hand back an id directly.
  let docId: string | null = typeof docIdRaw === "string" ? docIdRaw : null;
  if (!docId) {
    const { data: doc } = await supabase.from("patient_documents").select("id").eq("storage_path", storagePath).maybeSingle();
    docId = doc?.id ?? null;
  }

  const { error: markError } = await supabase.rpc("mark_records_transfer_filed", {
    p_transfer_id: transferId,
    p_filed_patient_id: patientId,
    p_filed_document_id: docId,
  });
  if (markError) throw new Error(markError.message);

  revalidatePath("/dashboard/records-exchange");
  revalidatePath(`/dashboard/patients/${patientId}`);
}
