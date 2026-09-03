"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requireClinicMember } from "@/lib/require-clinic-member";

export async function startEncounterAction(input: {
  patientId: string;
  providerId: string;
  appointmentId: string;
  encounterType: string;
  chiefComplaint: string;
}) {
  await requireClinicMember();
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("start_encounter", {
    p_patient_id: input.patientId,
    p_provider_id: input.providerId || null,
    p_appointment_id: input.appointmentId || null,
    p_encounter_type: input.encounterType || null,
    p_chief_complaint: input.chiefComplaint || null,
  });
  if (error) throw new Error(error.message);
  revalidatePath("/dashboard/encounters");
  revalidatePath(`/dashboard/patients/${input.patientId}`);
  redirect(`/dashboard/encounters/${data}`);
}

export async function updateEncounterAction(id: string, patientId: string, providerId: string, encounterType: string, chiefComplaint: string) {
  await requireClinicMember();
  const supabase = await createClient();
  const { error } = await supabase.rpc("update_encounter", {
    p_id: id,
    p_provider_id: providerId || null,
    p_encounter_type: encounterType || null,
    p_chief_complaint: chiefComplaint || null,
  });
  if (error) throw new Error(error.message);
  revalidatePath(`/dashboard/encounters/${id}`);
  revalidatePath(`/dashboard/patients/${patientId}`);
}

export async function setEncounterStatusAction(id: string, patientId: string, status: string) {
  await requireClinicMember();
  const supabase = await createClient();
  const { error } = await supabase.rpc("set_encounter_status", { p_id: id, p_status: status });
  if (error) throw new Error(error.message);
  revalidatePath(`/dashboard/encounters/${id}`);
  revalidatePath("/dashboard/encounters");
  revalidatePath(`/dashboard/patients/${patientId}`);
}

// ── Search Encounters (spec: "ADD ... ENCOUNTER HISTORY" §20-21) ──────────
// Clinic-wide search across older notes by date range / provider / type —
// deliberately separate from the date-organized default view, and always
// paginated. Never fetches the whole tenant's encounter history at once.

export type EncounterSearchFilter = {
  from: string; // "" = no lower bound
  to: string; // "" = no upper bound
  providerId: string; // "" = all providers
  encounterType: string; // "" = all types
  status: string; // "" = all statuses ("open" | "closed")
  offset: number;
  limit: number;
};

export type EncounterSearchRow = {
  id: string;
  patient_id: string;
  encounter_date: string;
  encounter_type: string | null;
  chief_complaint: string | null;
  status: string;
  signed_at: string | null;
  patient_name: string | null;
  provider_name: string | null;
};

const SEARCH_PAGE_SIZE = 25;

export async function searchEncountersAction(filter: EncounterSearchFilter): Promise<{ rows: EncounterSearchRow[]; hasMore: boolean }> {
  const { supabase, profile } = await requireClinicMember();
  const limit = filter.limit || SEARCH_PAGE_SIZE;

  let query = supabase
    .from("encounters")
    .select(
      "id, patient_id, encounter_date, encounter_type, chief_complaint, status, signed_at, patients(first_name, last_name), user_profiles!encounters_provider_id_fkey(full_name)",
      { count: "exact" }
    )
    .eq("tenant_id", profile.tenant_id)
    .order("encounter_date", { ascending: false })
    .order("created_at", { ascending: false })
    .range(filter.offset, filter.offset + limit - 1);

  if (filter.from) query = query.gte("encounter_date", filter.from);
  if (filter.to) query = query.lte("encounter_date", filter.to);
  if (filter.providerId) query = query.eq("provider_id", filter.providerId);
  if (filter.encounterType) query = query.eq("encounter_type", filter.encounterType);
  if (filter.status) query = query.eq("status", filter.status);

  const { data, error, count } = await query;
  if (error) throw new Error(error.message);

  const rows: EncounterSearchRow[] = ((data as any[]) ?? []).map((e) => ({
    id: e.id,
    patient_id: e.patient_id,
    encounter_date: e.encounter_date,
    encounter_type: e.encounter_type,
    chief_complaint: e.chief_complaint,
    status: e.status,
    signed_at: e.signed_at ?? null,
    patient_name: e.patients ? `${e.patients.last_name}, ${e.patients.first_name}` : null,
    provider_name: e.user_profiles?.full_name ?? null,
  }));
  const hasMore = filter.offset + rows.length < (count ?? 0);
  return { rows, hasMore };
}

// ── Signing & amendments (spec §4, §16-18) ─────────────────────────────────
// Signing is one-way (no unsign RPC) — enforcement lives in DB triggers
// (encounter_signing_and_amendments migration) so every insert/delete path
// is covered, not just this action.

export async function signEncounterAction(id: string, patientId: string) {
  await requireClinicMember();
  const supabase = await createClient();
  const { error } = await supabase.rpc("sign_encounter", { p_id: id });
  if (error) throw new Error(error.message);
  revalidatePath(`/dashboard/encounters/${id}`);
  revalidatePath("/dashboard/encounters");
  revalidatePath(`/dashboard/patients/${patientId}`);
}

export type AmendmentVitals = {
  bpSystolic?: string;
  bpDiastolic?: string;
  pulseRate?: string;
  respiratoryRate?: string;
  oxygenSaturation?: string;
  temperatureC?: string;
  weightKg?: string;
  heightCm?: string;
};

function numOrNull(v: string | undefined | null) {
  if (v === undefined || v === null) return null;
  const t = v.trim();
  if (t === "") return null;
  const n = Number(t);
  return Number.isFinite(n) ? n : null;
}

export async function addEncounterAmendmentAction(
  patientId: string,
  encounterId: string,
  amendsNoteId: string,
  amendmentReason: string,
  noteDate: string,
  chiefComplaint: string,
  subjective: string,
  objective: string,
  assessment: string,
  plan: string,
  vitals?: AmendmentVitals,
  followUpDate?: string | null,
  followUpReason?: string | null
) {
  await requireClinicMember();
  const supabase = await createClient();
  const { error } = await supabase.rpc("add_progress_note_amendment", {
    p_patient_id: patientId,
    p_encounter_id: encounterId,
    p_amends_note_id: amendsNoteId,
    p_amendment_reason: amendmentReason,
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
    p_follow_up_date: followUpDate || null,
    p_follow_up_reason: followUpReason || null,
  });
  if (error) throw new Error(error.message);
  revalidatePath(`/dashboard/encounters/${encounterId}`);
  revalidatePath(`/dashboard/patients/${patientId}`);
  revalidatePath(`/dashboard`);
}
