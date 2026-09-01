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

// --- Document attachments (Documents-tab "Send to provider") -------------
// Sibling to the encounter-PDF flow above, sharing the exact same
// cross-tenant transfer/authorization/accept-decline machinery
// (records_exchange_transfers, search_angelclinic_providers,
// patient_sharing_preferences) but carrying individual patient_documents
// files instead of one generated PDF — see migration
// records_exchange_document_attachments. Used from documents-section.tsx's
// "Send to provider" modal.

export type TransferDocumentAttachment = {
  id: string;
  source_document_id: string | null;
  title: string;
  doc_type: string | null;
  description: string | null;
  document_date: string | null;
  storage_path: string | null;
  mime_type: string | null;
  file_size_bytes: number | null;
  filed_document_id: string | null;
};

// Two-phase send: the RPC creates the transfer + one attachment row per
// document (validating tenant/patient ownership and returning each
// attachment's SOURCE storage_path), then this action copies the actual
// file bytes from the sender's patient-documents path into the shared
// records-exchange-transfers bucket and records where each one landed.
// Postgres can't move Storage object bytes on its own — only the RPC-gated
// metadata — which is why this can't be a single database call.
export async function sendDocumentRecordsTransferAction(patientId: string, documentIds: string[], receivingProviderId: string, note: string): Promise<string> {
  const { supabase } = await requireClinicMember();

  const { data, error } = await supabase.rpc("send_document_records_transfer", {
    p_patient_id: patientId,
    p_document_ids: documentIds,
    p_receiving_provider_id: receivingProviderId,
    p_note: note || null,
  });
  if (error) throw new Error(error.message);

  const result = data as { transfer_id: string; items: { attachment_id: string; source_document_id: string; source_storage_path: string }[] };
  const transferId = result.transfer_id;

  for (const item of result.items) {
    const { data: signed, error: signError } = await supabase.storage.from("patient-documents").createSignedUrl(item.source_storage_path, 120);
    if (signError || !signed?.signedUrl) throw new Error(signError?.message || "Couldn't read one of the selected documents.");
    const fileRes = await fetch(signed.signedUrl);
    if (!fileRes.ok) throw new Error("Couldn't read one of the selected documents.");
    const bytes = new Uint8Array(await fileRes.arrayBuffer());
    const contentType = fileRes.headers.get("content-type") || "application/octet-stream";
    const safeName = item.source_storage_path.split("/").pop() || "file";
    const destPath = `${transferId}/${item.attachment_id}-${safeName}`;

    const { error: uploadError } = await supabase.storage.from("records-exchange-transfers").upload(destPath, bytes, { contentType });
    if (uploadError) throw new Error(uploadError.message);

    const { error: pathError } = await supabase.rpc("set_transfer_document_storage_path", {
      p_attachment_id: item.attachment_id,
      p_storage_path: destPath,
      p_mime_type: contentType,
      p_file_size_bytes: bytes.byteLength,
    });
    if (pathError) throw new Error(pathError.message);
  }

  revalidatePath(`/dashboard/patients/${patientId}`);
  revalidatePath("/dashboard/patients", "layout");
  revalidatePath("/dashboard/documents");
  revalidatePath("/dashboard/records-exchange");
  return transferId;
}

// Short-lived preview URL for one attachment — used by the Records
// Exchange inbox's inline preview pane, same pattern as
// getDocumentSignedUrlAction in app/dashboard/patients/actions.ts, just
// against the records-exchange-transfers bucket. Storage RLS on that
// bucket only allows the transfer's own sender or recipient to read it.
export async function getTransferDocumentPreviewUrlAction(storagePath: string): Promise<string> {
  const { supabase } = await requireClinicMember();
  const { data, error } = await supabase.storage.from("records-exchange-transfers").createSignedUrl(storagePath, 300);
  if (error || !data?.signedUrl) throw new Error(error?.message || "Couldn't generate a preview link for this file.");
  return data.signedUrl;
}

// "File to Patient" for a documents-source transfer — files ONE attachment
// at a time (the receiver can put different attachments from the same
// transfer into different folders, e.g. an ID vs a lab report), reusing
// the exact same copy-then-add_patient_document pattern
// fileRecordsTransferAction already uses for the single combined PDF.
export async function fileTransferDocumentAction(
  transferId: string,
  attachment: { id: string; storagePath: string; title: string; docType: string; description: string | null; documentDate: string | null; mimeType: string | null },
  targetPatientId: string | null,
  newPatient: PatientInput | null
): Promise<void> {
  const { supabase, profile } = await requireClinicMember();

  let patientId = targetPatientId;
  if (!patientId && newPatient) {
    patientId = await savePatientAction(newPatient);
  }
  if (!patientId) throw new Error("Select or create the patient this record belongs to.");
  if (!attachment.title.trim()) throw new Error("Give this record a title before filing it.");

  const { data: signed, error: signError } = await supabase.storage.from("records-exchange-transfers").createSignedUrl(attachment.storagePath, 120);
  if (signError || !signed?.signedUrl) throw new Error(signError?.message || "Couldn't read the incoming file.");
  const fileRes = await fetch(signed.signedUrl);
  if (!fileRes.ok) throw new Error("Couldn't download the incoming file.");
  const bytes = new Uint8Array(await fileRes.arrayBuffer());

  const safeName = attachment.storagePath.split("/").pop() || "file";
  const storagePath = `${profile.tenant_id}/${patientId}/${Date.now()}-${safeName}`;
  const { error: uploadError } = await supabase.storage.from("patient-documents").upload(storagePath, bytes, { contentType: attachment.mimeType || "application/octet-stream" });
  if (uploadError) throw new Error(uploadError.message);

  // Title, folder (doc_type), and description are exactly what the
  // receiving staff member set in the filing form — no forced "Received
  // from Dr. X via Records Exchange" boilerplate. Provenance (who sent it)
  // still lives on the transfer record itself, visible in the Records
  // Exchange inbox, so nothing is actually lost by not stamping it into
  // every filed document's description too.
  const { data: docIdRaw, error: docError } = await supabase.rpc("add_patient_document", {
    p_patient_id: patientId,
    p_title: attachment.title.trim(),
    p_doc_type: attachment.docType,
    p_description: attachment.description || null,
    p_storage_path: storagePath,
    p_mime_type: attachment.mimeType,
    p_file_size_bytes: bytes.byteLength,
    p_document_date: attachment.documentDate || null,
  });
  if (docError) throw new Error(docError.message);

  let docId: string | null = typeof docIdRaw === "string" ? docIdRaw : null;
  if (!docId) {
    const { data: doc } = await supabase.from("patient_documents").select("id").eq("storage_path", storagePath).maybeSingle();
    docId = doc?.id ?? null;
  }

  const { error: markError } = await supabase.rpc("mark_transfer_document_filed", {
    p_transfer_id: transferId,
    p_attachment_id: attachment.id,
    p_filed_document_id: docId,
  });
  if (markError) throw new Error(markError.message);

  // Keep the transfer-level filed_patient_id/filed_document_id (used by
  // the "Filed" badge and the old single-PDF flow) pointed at this patient
  // too — harmless to call once per attachment; every attachment in one
  // transfer is always filed to the same patient.
  await supabase.rpc("mark_records_transfer_filed", { p_transfer_id: transferId, p_filed_patient_id: patientId, p_filed_document_id: docId });

  revalidatePath("/dashboard/records-exchange");
  revalidatePath(`/dashboard/patients/${patientId}`);
}

// "Accept & File" (spec §15) — reuses the existing patient add/search flow
// (savePatientAction, same as the appointment form's inline "+ Add New
// Patient") to pick which of THIS clinic's patients the incoming record
// belongs under, copies the PDF into this tenant's own patient-documents
// bucket (same storage convention as every other document), and files it
// via the existing add_patient_document RPC — title and destination folder
// are whatever the receiving staff member chose in the filing form.
export async function fileRecordsTransferAction(
  transferId: string,
  targetPatientId: string | null,
  newPatient: PatientInput | null,
  title: string,
  docType: string
): Promise<void> {
  const { supabase, profile } = await requireClinicMember();

  let patientId = targetPatientId;
  if (!patientId && newPatient) {
    patientId = await savePatientAction(newPatient);
  }
  if (!patientId) throw new Error("Select or create the patient this record belongs to.");
  if (!title.trim()) throw new Error("Give this record a title before filing it.");

  const { data: signed, error: signError } = await supabase.storage.from("records-exchange-transfers").createSignedUrl(`${transferId}/record.pdf`, 120);
  if (signError || !signed?.signedUrl) throw new Error(signError?.message || "Couldn't read the incoming record.");
  const pdfRes = await fetch(signed.signedUrl);
  if (!pdfRes.ok) throw new Error("Couldn't download the incoming record.");
  const pdfBytes = new Uint8Array(await pdfRes.arrayBuffer());

  const storagePath = `${profile.tenant_id}/${patientId}/${Date.now()}-external-record.pdf`;
  const { error: uploadError } = await supabase.storage.from("patient-documents").upload(storagePath, pdfBytes, { contentType: "application/pdf" });
  if (uploadError) throw new Error(uploadError.message);

  // Title and folder come straight from what the receiving staff member
  // set in the filing form — no forced boilerplate description. Provenance
  // still lives on the transfer record, visible in the Records Exchange
  // inbox itself.
  const { data: docIdRaw, error: docError } = await supabase.rpc("add_patient_document", {
    p_patient_id: patientId,
    p_title: title.trim(),
    p_doc_type: docType,
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
