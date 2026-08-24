"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { requireClinicMember } from "@/lib/require-clinic-member";
import { sendPortalEmail, sendPortalSms } from "@/lib/patient-portal/send";
import { parseFlexibleDate } from "@/lib/dates/parse-flexible-date";

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

export type PatientSearchResult = {
  id: string;
  first_name: string;
  middle_name: string | null;
  last_name: string;
  date_of_birth: string;
  sex: string;
  mobile_phone: string | null;
  patient_code: string | null;
  is_active: boolean;
};

const SEARCH_COLUMNS = "id, first_name, middle_name, last_name, date_of_birth, sex, mobile_phone, patient_code, is_active";

// Backs the global search box in the top nav (components/emr/global-search)
// AND the master-detail Patients list. A plain .select() scoped by
// tenant_id, same as every other list read in this app — RLS is the
// backstop, this filter is just for relevance. PostgREST's .or() filter
// string treats "," and ")" as syntax, so those are stripped from the raw
// query before building it.
//
// Matches on: first/last/full name (substring), mobile number (substring),
// Patient ID (substring — works whether staff type "AC-1048" or just
// "1048"), and date of birth. DOB search matters specifically because
// names get misspelled or collide (two "Maria Santos") — parseFlexibleDate
// accepts MM/DD/YYYY, ISO, and "Month D, YYYY" so staff don't have to
// remember one exact format.
export async function searchPatientsAction(query: string): Promise<PatientSearchResult[]> {
  const { supabase, profile } = await requireClinicMember();
  const q = query.trim().replace(/[,()]/g, "").slice(0, 60);
  if (!q) return [];

  const dob = parseFlexibleDate(q);
  const orParts = [
    `first_name.ilike.%${q}%`,
    `middle_name.ilike.%${q}%`,
    `last_name.ilike.%${q}%`,
    `mobile_phone.ilike.%${q}%`,
    `patient_code.ilike.%${q}%`,
  ];
  if (dob) orParts.push(`date_of_birth.eq.${dob}`);

  // A full "First Last" query needs its own AND'd pair — a single-token
  // ilike above won't match "maria santos" against separate first/last
  // columns, so run that as a second query and merge, deduped by id.
  const tokens = q.split(/\s+/).filter(Boolean);
  const fullNamePromise =
    tokens.length >= 2
      ? supabase
          .from("patients")
          .select(SEARCH_COLUMNS)
          .eq("tenant_id", profile.tenant_id)
          .or(
            [
              `and(first_name.ilike.%${tokens[0]}%,last_name.ilike.%${tokens.slice(1).join(" ")}%)`,
              `and(last_name.ilike.%${tokens[0]}%,first_name.ilike.%${tokens.slice(1).join(" ")}%)`,
            ].join(",")
          )
          .limit(8)
      : Promise.resolve({ data: [] as any[], error: null });

  const [{ data, error }, { data: fullNameData, error: fullNameError }] = await Promise.all([
    supabase.from("patients").select(SEARCH_COLUMNS).eq("tenant_id", profile.tenant_id).or(orParts.join(",")).order("last_name").limit(8),
    fullNamePromise,
  ]);

  if (error) throw new Error(error.message);
  if (fullNameError) throw new Error(fullNameError.message);

  const merged = new Map<string, PatientSearchResult>();
  for (const row of [...((data as any[]) ?? []), ...((fullNameData as any[]) ?? [])]) merged.set(row.id, row);
  return Array.from(merged.values()).slice(0, 12);
}

// Recent Patients — the list-page default before any search term is
// typed. Most-recently-active-in-this-clinic ordering (last updated, e.g.
// via a chart edit) reads better here than alphabetical for a "who have I
// been seeing" glance; falls back to newest-created for ties.
export async function recentPatientsAction(limit = 15): Promise<PatientSearchResult[]> {
  const { supabase, profile } = await requireClinicMember();
  const { data, error } = await supabase
    .from("patients")
    .select(SEARCH_COLUMNS)
    .eq("tenant_id", profile.tenant_id)
    .eq("is_active", true)
    .order("updated_at", { ascending: false })
    .limit(limit);
  if (error) throw new Error(error.message);
  return (data as any) ?? [];
}

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
  occupation: string;
  employerName: string;
  employerPosition: string;
  employerContact: string;
  employerAddress: string;
  employmentStatus: string;
  referredByNote: string;
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
    p_occupation: input.occupation || null,
    p_employer_name: input.employerName || null,
    p_employer_position: input.employerPosition || null,
    p_employer_contact: input.employerContact || null,
    p_employer_address: input.employerAddress || null,
    p_employment_status: input.employmentStatus || null,
    p_referred_by_note: input.referredByNote || null,
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
  const documentDate = String(formData.get("documentDate") || "");
  const source = String(formData.get("source") || "");
  const providerId = String(formData.get("providerId") || "");
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
    p_document_date: documentDate || null,
    p_source: source || null,
    p_provider_id: providerId || null,
  });
  if (error) throw new Error(error.message);
  revalidatePath(`/dashboard/patients/${patientId}`);
  revalidatePath("/dashboard/documents");
}

// Custom document folder (spec follow-up: "provider can add more folders
// depends on what they need to organize") — tenant-wide, so a folder added
// from one patient's Documents tab shows up for every patient.
export async function addDocumentFolderAction(label: string) {
  const { supabase } = await requireClinicMember();
  const { error } = await supabase.rpc("add_document_folder", { p_label: label });
  if (error) throw new Error(error.message);
  revalidatePath("/dashboard/patients", "layout");
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

// ── Patient-chart alerts (ECW-style sticky notes) ────────────────────────
// Created and managed from within the patient's own chart, never a global
// list — see migration patient_alerts_and_appointment_requests_shell.
// Dismissing one (the X) is handled entirely client-side in
// patient-alerts-banner.tsx and never calls this action; only "Remove"
// (deactivate) does.

// kind defaults to "alert" so every pre-existing call site (the sticky-note
// banner's original 3-arg call) keeps working unchanged; the banner UI now
// also offers "note" explicitly — see patient-alerts-banner.tsx.
export async function addPatientAlertAction(patientId: string, category: "red" | "yellow" | "blue", message: string, kind: "alert" | "note" = "alert") {
  await requireClinicMember();
  const supabase = await createClient();
  const { error } = await supabase.rpc("add_patient_alert", {
    p_patient_id: patientId,
    p_kind: kind,
    p_category: category,
    p_message: message,
  });
  if (error) throw new Error(error.message);
  revalidatePath(`/dashboard/patients/${patientId}`);
}

export async function deactivatePatientAlertAction(id: string, patientId: string) {
  await requireClinicMember();
  const supabase = await createClient();
  const { error } = await supabase.rpc("deactivate_patient_alert", { p_id: id });
  if (error) throw new Error(error.message);
  revalidatePath(`/dashboard/patients/${patientId}`);
}

// ── Patient chart > Encounter History (paginated) ───────────────────────
// The chart's own encounter list is patient-specific and chronological
// (most recent first), separate from the main date-organized Encounters
// module. Deliberately NOT "select *, no limit" — a clinic with years of
// history for one patient shouldn't pull every encounter just to open
// their chart. Page size is small and the client asks for more on demand.

export type EncounterHistoryFilter = {
  patientId: string;
  rangeKey: "all" | "30d" | "3m" | "6m" | "1y";
  providerId: string; // "" = all providers
  encounterType: string; // "" = all types
  offset: number;
  limit: number;
};

export type EncounterHistoryRow = {
  id: string;
  encounter_date: string;
  encounter_type: string | null;
  chief_complaint: string | null;
  status: string;
  signed_at: string | null;
  provider_name: string | null;
};

const RANGE_DAYS: Record<string, number> = { "30d": 30, "3m": 90, "6m": 180, "1y": 365 };

export async function searchPatientEncountersAction(filter: EncounterHistoryFilter): Promise<{ rows: EncounterHistoryRow[]; hasMore: boolean }> {
  const { supabase, profile } = await requireClinicMember();

  let query = supabase
    .from("encounters")
    .select("id, encounter_date, encounter_type, chief_complaint, status, signed_at, provider_id, user_profiles!encounters_provider_id_fkey(full_name)", { count: "exact" })
    .eq("tenant_id", profile.tenant_id)
    .eq("patient_id", filter.patientId)
    .order("encounter_date", { ascending: false })
    .order("created_at", { ascending: false })
    .range(filter.offset, filter.offset + filter.limit - 1);

  if (filter.providerId) query = query.eq("provider_id", filter.providerId);
  if (filter.encounterType) query = query.eq("encounter_type", filter.encounterType);
  if (filter.rangeKey !== "all") {
    const days = RANGE_DAYS[filter.rangeKey] ?? 0;
    const cutoff = new Date(Date.now() - days * 86400000).toISOString().slice(0, 10);
    query = query.gte("encounter_date", cutoff);
  }

  const { data, error, count } = await query;
  if (error) throw new Error(error.message);

  const rows: EncounterHistoryRow[] = ((data as any[]) ?? []).map((e) => ({
    id: e.id,
    encounter_date: e.encounter_date,
    encounter_type: e.encounter_type,
    chief_complaint: e.chief_complaint,
    status: e.status,
    signed_at: e.signed_at ?? null,
    provider_name: e.user_profiles?.full_name ?? null,
  }));
  const hasMore = filter.offset + rows.length < (count ?? 0);
  return { rows, hasMore };
}

// ── Patient Forms (spec §13-14) ───────────────────────────────────────────
// Assign/complete/retire a form INSTANCE for one patient. The template
// library itself (create/duplicate/edit/activate) lives in
// app/dashboard/settings/forms — these three just call the patient_forms
// RPCs from migration patient_forms_addon_templates_and_instances. Nothing
// here duplicates the template system; assign_form_to_patient snapshots the
// template server-side.

export async function assignFormToPatientAction(patientId: string, templateId: string, isRequired?: boolean) {
  const { supabase } = await requireClinicMember();
  const { error } = await supabase.rpc("assign_form_to_patient", {
    p_patient_id: patientId,
    p_template_id: templateId,
    p_is_required: isRequired ?? null,
  });
  if (error) throw new Error(error.message);
  revalidatePath(`/dashboard/patients/${patientId}`);
  revalidatePath("/dashboard/patients");
}

export async function completePatientFormAction(formId: string, patientId: string, responses: Record<string, any>, signatureName?: string) {
  const { supabase } = await requireClinicMember();
  const { error } = await supabase.rpc("complete_patient_form", {
    p_id: formId,
    p_responses: responses,
    p_signature_name: signatureName || null,
  });
  if (error) throw new Error(error.message);
  revalidatePath(`/dashboard/patients/${patientId}`);
}

export async function expirePatientFormAction(formId: string, patientId: string) {
  const { supabase } = await requireClinicMember();
  const { error } = await supabase.rpc("expire_patient_form", { p_id: formId });
  if (error) throw new Error(error.message);
  revalidatePath(`/dashboard/patients/${patientId}`);
}

// Bill types — a multi-select (Cash / HMO / PhilHealth / YAKAP, any
// combination) replacing the old single-select payment_type on the
// Billing tab. Existing PhilHealth/HMO detail (philhealth_* columns,
// patient_insurance rows) is untouched — bill_types just records which
// payer categories apply to this patient's billing.
export async function setPatientBillTypesAction(patientId: string, billTypes: string[]) {
  await requireClinicMember();
  const supabase = await createClient();
  const { error } = await supabase.rpc("set_patient_bill_types", { p_patient_id: patientId, p_bill_types: billTypes });
  if (error) throw new Error(error.message);
  revalidatePath(`/dashboard/patients/${patientId}`);
}

// Active Problems (Clinical tab) — a longitudinal problem list distinct
// from any single encounter's assessment.
export async function addPatientProblemAction(patientId: string, description: string, onsetDate: string, notes: string) {
  await requireClinicMember();
  const supabase = await createClient();
  const { error } = await supabase.rpc("add_patient_problem", {
    p_patient_id: patientId,
    p_description: description,
    p_onset_date: onsetDate || null,
    p_notes: notes || null,
  });
  if (error) throw new Error(error.message);
  revalidatePath(`/dashboard/patients/${patientId}`);
}

export async function setPatientProblemStatusAction(id: string, patientId: string, status: "active" | "resolved") {
  await requireClinicMember();
  const supabase = await createClient();
  const { error } = await supabase.rpc("set_patient_problem_status", { p_id: id, p_status: status });
  if (error) throw new Error(error.message);
  revalidatePath(`/dashboard/patients/${patientId}`);
}

// Patient billing ledger (Billing tab) — manual charges + payments, not
// an online payment gateway (that stays a later "Payments" add-on). Powers
// the balance-owed display here AND on the Patient Portal (same rows,
// portal-read RLS policy — see migration patient_billing_charges_and_payments).
export async function addPatientChargeAction(
  patientId: string,
  description: string,
  amountPhp: number,
  billType: string,
  providerId: string,
  encounterId: string
) {
  await requireClinicMember();
  const supabase = await createClient();
  const { error } = await supabase.rpc("add_patient_charge", {
    p_patient_id: patientId,
    p_description: description,
    p_amount_php: amountPhp,
    p_bill_type: billType,
    p_provider_id: providerId || null,
    p_encounter_id: encounterId || null,
  });
  if (error) throw new Error(error.message);
  revalidatePath(`/dashboard/patients/${patientId}`);
}

export async function voidPatientChargeAction(id: string, patientId: string) {
  await requireClinicMember();
  const supabase = await createClient();
  const { error } = await supabase.rpc("void_patient_charge", { p_id: id });
  if (error) throw new Error(error.message);
  revalidatePath(`/dashboard/patients/${patientId}`);
}

export async function recordPatientChargePaymentAction(
  patientId: string,
  chargeId: string | null,
  amountPhp: number,
  method: string,
  reference: string,
  paidAt: string
) {
  await requireClinicMember();
  const supabase = await createClient();
  const { error } = await supabase.rpc("record_patient_charge_payment", {
    p_patient_id: patientId,
    p_charge_id: chargeId || null,
    p_amount_php: amountPhp,
    p_method: method,
    p_reference: reference || null,
    p_paid_at: paidAt || null,
  });
  if (error) throw new Error(error.message);
  revalidatePath(`/dashboard/patients/${patientId}`);
}
