import type { SupabaseClient } from "@supabase/supabase-js";
import type { ClinicInfo, PatientInfo, EncounterEntry, ProgressNoteEntry } from "./encounter-pdf-document";

// Shared by both the encounter export Route Handler
// (app/api/encounters/export-pdf/route.ts) and the Records Exchange "send"
// action (app/dashboard/encounters/records-exchange-actions.ts) — both
// build the exact same combined-PDF payload for a same-patient set of
// encounters, and this is the one place that logic lives so a fix in one
// path can't silently drift from the other.
//
// Enforces the same single-patient rule both callers rely on: throws if
// the selected encounters span more than one patient.

function formatDatePretty(iso: string) {
  return new Date(`${iso}T00:00:00`).toLocaleDateString("en-PH", { year: "numeric", month: "long", day: "numeric" });
}
function formatDateTimePretty(iso: string) {
  return new Date(iso).toLocaleString("en-PH", { year: "numeric", month: "long", day: "numeric", hour: "numeric", minute: "2-digit" });
}
function providerCredentials(prcLicense: string | null, ptrNumber: string | null) {
  const parts: string[] = [];
  if (prcLicense) parts.push(`PRC ${prcLicense}`);
  if (ptrNumber) parts.push(`PTR ${ptrNumber}`);
  return parts.length > 0 ? parts.join(" · ") : null;
}
function providerName(title: string | null, fullName: string | null) {
  if (!fullName) return null;
  return title ? `${title} ${fullName}` : fullName;
}
function vitalsFor(n: any): { label: string; value: string }[] {
  const vitals: { label: string; value: string }[] = [];
  if (n.bp_systolic && n.bp_diastolic) vitals.push({ label: "BP", value: `${n.bp_systolic}/${n.bp_diastolic}` });
  if (n.pulse_rate) vitals.push({ label: "Pulse", value: `${n.pulse_rate} bpm` });
  if (n.respiratory_rate) vitals.push({ label: "RR", value: `${n.respiratory_rate}/min` });
  if (n.oxygen_saturation) vitals.push({ label: "SpO2", value: `${n.oxygen_saturation}%` });
  if (n.temperature_c) vitals.push({ label: "Temp", value: `${n.temperature_c}°C` });
  if (n.weight_kg) vitals.push({ label: "Weight", value: `${n.weight_kg} kg` });
  if (n.height_cm) vitals.push({ label: "Height", value: `${n.height_cm} cm` });
  return vitals;
}

export async function gatherEncounterPdfData(
  supabase: SupabaseClient,
  tenantId: string,
  encounterIds: string[]
): Promise<{ clinic: ClinicInfo; patient: PatientInfo; encounters: EncounterEntry[]; generatedAt: string }> {
  const { data: encountersRaw, error: encError } = await supabase
    .from("encounters")
    .select(
      "id, patient_id, provider_id, encounter_date, encounter_type, chief_complaint, signed_at, signed_by, " +
        "patients(first_name, middle_name, last_name, date_of_birth, sex), " +
        "provider:user_profiles!encounters_provider_id_fkey(full_name, title, prc_license, ptr_number), " +
        "signer:user_profiles!encounters_signed_by_fkey(full_name, title, prc_license, ptr_number)"
    )
    .eq("tenant_id", tenantId)
    .in("id", encounterIds)
    .order("encounter_date", { ascending: true });

  if (encError) throw new Error(encError.message);
  if (!encountersRaw || encountersRaw.length === 0) throw new Error("No matching encounters found.");

  const patientIds = new Set(encountersRaw.map((e: any) => e.patient_id));
  if (patientIds.size > 1) throw new Error("Select encounters for a single patient — these span more than one patient.");

  const patientRow: any = (encountersRaw[0] as any).patients;
  if (!patientRow) throw new Error("Patient record not found.");

  const { data: notesRaw } = await supabase
    .from("patient_progress_notes")
    .select(
      "id, note_date, chief_complaint, subjective, objective, assessment, plan, bp_systolic, bp_diastolic, pulse_rate, respiratory_rate, oxygen_saturation, temperature_c, weight_kg, height_cm, encounter_id, amends_note_id, amendment_reason, created_at, user_profiles(full_name)"
    )
    .eq("tenant_id", tenantId)
    .in("encounter_id", encounterIds)
    .order("created_at", { ascending: true });

  const notesByEncounter = new Map<string, any[]>();
  for (const n of notesRaw ?? []) {
    if (!n.encounter_id) continue;
    if (!notesByEncounter.has(n.encounter_id)) notesByEncounter.set(n.encounter_id, []);
    notesByEncounter.get(n.encounter_id)!.push(n);
  }

  const { data: clinicSettings } = await supabase
    .from("clinic_settings")
    .select("clinic_name, logo_path, address_line1, address_line2, city, province, postal_code, phone, mobile, email, website")
    .eq("tenant_id", tenantId)
    .maybeSingle();

  let logoUrl: string | null = null;
  if (clinicSettings?.logo_path) {
    const { data } = supabase.storage.from("clinic-logos").getPublicUrl(clinicSettings.logo_path);
    logoUrl = data.publicUrl;
  }

  const signerIds = Array.from(new Set(encountersRaw.map((e: any) => e.signed_by).filter(Boolean)));
  const signatureUrlBySigner = new Map<string, string>();
  if (signerIds.length > 0) {
    const { data: sigs } = await supabase
      .from("provider_signatures")
      .select("user_id, signature_path, status, reviewed_at")
      .eq("tenant_id", tenantId)
      .in("user_id", signerIds)
      .eq("status", "approved")
      .order("reviewed_at", { ascending: false });
    const seen = new Set<string>();
    for (const s of sigs ?? []) {
      if (seen.has(s.user_id)) continue;
      seen.add(s.user_id);
      const { data: signed } = await supabase.storage.from("provider-signatures").createSignedUrl(s.signature_path, 300);
      if (signed?.signedUrl) signatureUrlBySigner.set(s.user_id, signed.signedUrl);
    }
  }

  const encounters: EncounterEntry[] = encountersRaw.map((e: any) => {
    const rawNotes: any[] = notesByEncounter.get(e.id) ?? [];
    const notes: ProgressNoteEntry[] = rawNotes.map((n) => ({
      id: n.id,
      noteDate: n.note_date,
      chiefComplaint: n.chief_complaint,
      subjective: n.subjective,
      objective: n.objective,
      assessment: n.assessment,
      plan: n.plan,
      authorName: n.user_profiles?.full_name ?? null,
      isAmendment: !!n.amends_note_id,
      amendmentReason: n.amendment_reason,
      vitals: vitalsFor(n),
    }));

    return {
      id: e.id,
      encounterDate: formatDatePretty(e.encounter_date),
      encounterType: e.encounter_type,
      chiefComplaint: e.chief_complaint,
      providerName: providerName(e.provider?.title ?? null, e.provider?.full_name ?? null),
      providerCredentials: providerCredentials(e.provider?.prc_license ?? null, e.provider?.ptr_number ?? null),
      signedAt: e.signed_at ? formatDateTimePretty(e.signed_at) : null,
      signedByName: e.signer ? providerName(e.signer.title ?? null, e.signer.full_name ?? null) : null,
      signedByCredentials: e.signer ? providerCredentials(e.signer.prc_license ?? null, e.signer.ptr_number ?? null) : null,
      signatureImageUrl: e.signed_by ? signatureUrlBySigner.get(e.signed_by) ?? null : null,
      notes,
    };
  });

  const patientFullName = `${patientRow.last_name}, ${patientRow.first_name}${patientRow.middle_name ? " " + patientRow.middle_name : ""}`;

  return {
    clinic: {
      name: clinicSettings?.clinic_name ?? "AngelClinic",
      logoUrl,
      addressLine1: clinicSettings?.address_line1 ?? null,
      addressLine2: clinicSettings?.address_line2 ?? null,
      city: clinicSettings?.city ?? null,
      province: clinicSettings?.province ?? null,
      postalCode: clinicSettings?.postal_code ?? null,
      phone: clinicSettings?.phone ?? null,
      mobile: clinicSettings?.mobile ?? null,
      email: clinicSettings?.email ?? null,
      website: clinicSettings?.website ?? null,
    },
    patient: {
      fullName: patientFullName,
      dateOfBirth: formatDatePretty(patientRow.date_of_birth),
      sex: patientRow.sex,
    },
    encounters,
    generatedAt: formatDateTimePretty(new Date().toISOString()),
  };
}
