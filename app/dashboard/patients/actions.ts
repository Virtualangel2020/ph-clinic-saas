"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { requireClinicMember } from "@/lib/require-clinic-member";
import { sendPortalEmail, sendPortalSms } from "@/lib/patient-portal/send";

async function siteOrigin() {
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host");
  const proto = h.get("x-forwarded-proto") ?? "https";
  return `${proto}://${host}`;
}

// Part 2 (Phase 2, patient chart foundation). Every write here just calls
// a SECURITY DEFINER Postgres function (see migration
// patient_chart_phase2_foundation) that re-checks tenant membership
// itself — this file carries no elevated privilege of its own, same
// pattern as app/dashboard/settings/actions.ts.

export type PatientInput = {
  id: string | null;
  firstName: string;
  middleName: string;
  lastName: string;
  suffix: string;
  dateOfBirth: string;
  sex: string;
  civilStatus: string;
  bloodType: string;
  mobilePhone: string;
  email: string;
  addressLine1: string;
  addressLine2: string;
  city: string;
  province: string;
  postalCode: string;
  emergencyContactName: string;
  emergencyContactRelationship: string;
  emergencyContactPhone: string;
  guardianName: string;
  guardianRelationship: string;
  guardianPhone: string;
  notes: string;
};

export async function savePatientAction(input: PatientInput): Promise<string> {
  await requireClinicMember();
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("set_patient", {
    p_id: input.id,
    p_first_name: input.firstName,
    p_middle_name: input.middleName || null,
    p_last_name: input.lastName,
    p_suffix: input.suffix || null,
    p_date_of_birth: input.dateOfBirth,
    p_sex: input.sex,
    p_civil_status: input.civilStatus || null,
    p_blood_type: input.bloodType || null,
    p_mobile_phone: input.mobilePhone || null,
    p_email: input.email || null,
    p_address_line1: input.addressLine1 || null,
    p_address_line2: input.addressLine2 || null,
    p_city: input.city || null,
    p_province: input.province || null,
    p_postal_code: input.postalCode || null,
    p_emergency_contact_name: input.emergencyContactName || null,
    p_emergency_contact_relationship: input.emergencyContactRelationship || null,
    p_emergency_contact_phone: input.emergencyContactPhone || null,
    p_guardian_name: input.guardianName || null,
    p_guardian_relationship: input.guardianRelationship || null,
    p_guardian_phone: input.guardianPhone || null,
    p_notes: input.notes || null,
  });
  if (error) throw new Error(error.message);
  revalidatePath("/dashboard/patients");
  if (input.id) revalidatePath(`/dashboard/patients/${input.id}`);
  return data as string;
}

export async function setPatientActiveAction(id: string, isActive: boolean) {
  await requireClinicMember();
  const supabase = await createClient();
  const { error } = await supabase.rpc("set_patient_active", { p_id: id, p_is_active: isActive });
  if (error) throw new Error(error.message);
  revalidatePath("/dashboard/patients");
  revalidatePath(`/dashboard/patients/${id}`);
}

export async function addAllergyAction(patientId: string, allergen: string, reaction: string, severity: string) {
  await requireClinicMember();
  const supabase = await createClient();
  const { error } = await supabase.rpc("add_patient_allergy", {
    p_patient_id: patientId,
    p_allergen: allergen,
    p_reaction: reaction || null,
    p_severity: severity || null,
  });
  if (error) throw new Error(error.message);
  revalidatePath(`/dashboard/patients/${patientId}`);
}

export async function removeAllergyAction(id: string, patientId: string) {
  await requireClinicMember();
  const supabase = await createClient();
  const { error } = await supabase.rpc("remove_patient_allergy", { p_id: id });
  if (error) throw new Error(error.message);
  revalidatePath(`/dashboard/patients/${patientId}`);
}

export async function addMedicationAction(
  patientId: string,
  medicationName: string,
  dosage: string,
  frequency: string,
  startedAt: string,
  notes: string
) {
  await requireClinicMember();
  const supabase = await createClient();
  const { error } = await supabase.rpc("add_patient_medication", {
    p_patient_id: patientId,
    p_medication_name: medicationName,
    p_dosage: dosage || null,
    p_frequency: frequency || null,
    p_started_at: startedAt || null,
    p_notes: notes || null,
  });
  if (error) throw new Error(error.message);
  revalidatePath(`/dashboard/patients/${patientId}`);
}

export async function setMedicationActiveAction(id: string, patientId: string, isActive: boolean) {
  await requireClinicMember();
  const supabase = await createClient();
  const { error } = await supabase.rpc("set_patient_medication_active", { p_id: id, p_is_active: isActive });
  if (error) throw new Error(error.message);
  revalidatePath(`/dashboard/patients/${patientId}`);
}

export async function removeMedicationAction(id: string, patientId: string) {
  await requireClinicMember();
  const supabase = await createClient();
  const { error } = await supabase.rpc("remove_patient_medication", { p_id: id });
  if (error) throw new Error(error.message);
  revalidatePath(`/dashboard/patients/${patientId}`);
}

const ALLOWED_DOC_MIME_TYPES = ["application/pdf", "image/jpeg", "image/png", "image/heic", "image/webp"];
const MAX_DOC_BYTES = 25 * 1024 * 1024; // 25MB — matches the DB-level check constraint

// Uploads the actual file to the private "patient-documents" Storage
// bucket (tenant-isolated by folder path, see migration
// patient_documents_storage_and_taxonomy) and only then records the
// metadata row via RPC — the RPC re-validates type/size/tenant itself,
// this is just the first line of defense with a friendlier error message.
export async function addDocumentAction(formData: FormData) {
  const { supabase, profile } = await requireClinicMember();
  const patientId = String(formData.get("patientId") || "");
  const title = String(formData.get("title") || "");
  const docType = String(formData.get("docType") || "other");
  const description = String(formData.get("description") || "");
  const file = formData.get("file") as File | null;

  if (!patientId) throw new Error("Missing patient.");
  if (!title.trim()) throw new Error("Title is required.");

  let storagePath: string | null = null;
  let mimeType: string | null = null;
  let fileSizeBytes: number | null = null;

  if (file && file.size > 0) {
    if (!ALLOWED_DOC_MIME_TYPES.includes(file.type)) {
      throw new Error("Unsupported file type — only PDF, JPEG, PNG, HEIC, or WEBP are allowed.");
    }
    if (file.size > MAX_DOC_BYTES) {
      throw new Error("File is too large — 25MB maximum.");
    }
    const safeName = file.name.replace(/[^a-zA-Z0-9_.-]/g, "_");
    storagePath = `${profile.tenant_id}/${patientId}/${Date.now()}-${safeName}`;
    const { error: uploadError } = await supabase.storage.from("patient-documents").upload(storagePath, file, { contentType: file.type });
    if (uploadError) throw new Error(uploadError.message);
    mimeType = file.type;
    fileSizeBytes = file.size;
  }

  const { error } = await supabase.rpc("add_patient_document", {
    p_patient_id: patientId,
    p_title: title,
    p_doc_type: docType,
    p_description: description || null,
    p_storage_path: storagePath,
    p_mime_type: mimeType,
    p_file_size_bytes: fileSizeBytes,
  });
  if (error) throw new Error(error.message);
  revalidatePath(`/dashboard/patients/${patientId}`);
  revalidatePath("/dashboard/documents");
}

// Get a short-lived signed URL to view/download a document — never expose
// the storage path directly, and never make the bucket public (this is
// PHI). RLS on storage.objects still gates this to the caller's own tenant.
export async function getDocumentSignedUrlAction(storagePath: string): Promise<string> {
  const { supabase } = await requireClinicMember();
  const { data, error } = await supabase.storage.from("patient-documents").createSignedUrl(storagePath, 300);
  if (error || !data?.signedUrl) throw new Error(error?.message || "Couldn't generate a link for this file.");
  return data.signedUrl;
}

// Replaces hard delete — clinical documents get a status/reason instead
// (Entered in Error, Duplicate, etc.), preserving the audit trail rather
// than destroying the record. See migration patient_documents_storage_and_taxonomy.
export async function setDocumentStatusAction(id: string, patientId: string, status: string, reason: string) {
  await requireClinicMember();
  const supabase = await createClient();
  const { error } = await supabase.rpc("set_patient_document_status", { p_id: id, p_status: status, p_reason: reason || null });
  if (error) throw new Error(error.message);
  revalidatePath(`/dashboard/patients/${patientId}`);
  revalidatePath("/dashboard/documents");
}

export type VitalsInput = {
  bpSystolic: string;
  bpDiastolic: string;
  pulseRate: string;
  respiratoryRate: string;
  oxygenSaturation: string;
  temperatureC: string;
  weightKg: string;
  heightCm: string;
};

// Empty-string form inputs -> null (not 0), so an unfilled vital field
// doesn't get recorded as a real reading.
function numOrNull(v: string | undefined | null) {
  if (v === undefined || v === null) return null;
  const t = v.trim();
  if (t === "") return null;
  const n = Number(t);
  return Number.isFinite(n) ? n : null;
}

export async function addProgressNoteAction(
  patientId: string,
  noteDate: string,
  chiefComplaint: string,
  subjective: string,
  objective: string,
  assessment: string,
  plan: string,
  vitals?: VitalsInput,
  encounterId?: string | null
) {
  await requireClinicMember();
  const supabase = await createClient();
  const { error } = await supabase.rpc("add_progress_note", {
    p_patient_id: patientId,
    p_note_date: noteDate || null,
    p_chief_complaint: chiefComplaint || null,
    p_subjective: subjective || null,
    p_objective: objective || null,
    p_assessment: assessment || null,
    p_plan: plan || null,
    p_bp_systolic: numOrNull(vitals?.bpSystolic),
    p_bp_diastolic: numOrNull(vitals?.bpDiastolic),
    p_pulse_rate: numOrNull(vitals?.pulseRate),
    p_respiratory_rate: numOrNull(vitals?.respiratoryRate),
    p_oxygen_saturation: numOrNull(vitals?.oxygenSaturation),
    p_temperature_c: numOrNull(vitals?.temperatureC),
    p_weight_kg: numOrNull(vitals?.weightKg),
    p_height_cm: numOrNull(vitals?.heightCm),
    p_encounter_id: encounterId || null,
  });
  if (error) throw new Error(error.message);
  revalidatePath(`/dashboard/patients/${patientId}`);
  if (encounterId) revalidatePath(`/dashboard/encounters/${encounterId}`);
}

export async function removeProgressNoteAction(id: string, patientId: string) {
  await requireClinicMember();
  const supabase = await createClient();
  const { error } = await supabase.rpc("remove_progress_note", { p_id: id });
  if (error) throw new Error(error.message);
  revalidatePath(`/dashboard/patients/${patientId}`);
}

// ── Patient Portal invites ──────────────────────────────────────────────
// The RPC (session-scoped, re-checks tenant + entitlement + a live
// platform provider) generates the secret and returns it once, raw, only
// to this server action — never to the browser. Sending the actual
// email/SMS happens right here using the service-role-backed helpers in
// lib/patient-portal/send.ts.
export async function invitePatientToPortalAction(patientId: string, channel: "email" | "sms" | "manual"): Promise<{ code?: string }> {
  const { supabase, profile } = await requireClinicMember();
  const origin = await siteOrigin();

  const { data: invite, error } = await supabase.rpc("invite_patient_to_portal", {
    p_patient_id: patientId,
    p_channel: channel,
  });
  if (error) throw new Error(error.message);

  const { data: clinic } = await supabase.from("clinic_settings").select("clinic_name").eq("tenant_id", profile.tenant_id).maybeSingle();
  const clinicName = clinic?.clinic_name || "AngelClinic";

  if (channel === "email") {
    const link = `${origin}/portal/activate?token=${invite.raw_token}`;
    await sendPortalEmail({
      toEmail: invite.contact_value,
      toName: invite.patient_name,
      subject: `Activate your ${clinicName} Patient Portal access`,
      html: `<p>Hi ${invite.patient_name},</p><p>${clinicName} has invited you to access your Patient Portal, where you can review and authorize record requests.</p><p><a href="${link}">Activate your account</a></p><p>This link expires in 24 hours. If you weren't expecting this, you can ignore this email.</p>`,
    });
  } else if (channel === "sms") {
    const link = `${origin}/portal/verify?a=${invite.account_id}`;
    await sendPortalSms({
      toPhone: invite.contact_value,
      message: `${clinicName}: Your Patient Portal code is ${invite.otp}. Activate here: ${link} (expires in 10 min)`,
    });
  }
  // "manual" sends nothing — the raw code is handed back below for staff
  // to show/read to the patient directly. No provider, no add-on needed.

  revalidatePath(`/dashboard/patients/${patientId}`);
  return channel === "manual" ? { code: invite.raw_token } : {};
}

export async function revokePatientPortalAccessAction(id: string, patientId: string) {
  await requireClinicMember();
  const supabase = await createClient();
  const { error } = await supabase.rpc("revoke_patient_portal_access", { p_id: id });
  if (error) throw new Error(error.message);
  revalidatePath(`/dashboard/patients/${patientId}`);
}
