// Shared "last completed visit" lookup — used by both the patient
// dashboard's Recent Care card and /portal/care's Last Visit summary
// (spec Part 33/Design #6: "same data everywhere," single source rather
// than two copies of this query). Only ever returns a CLOSED (completed)
// encounter, and only the patient-safe fields: date, provider, visit
// type, and the patient's own stated reason for the visit. It never reads
// progress_notes/SOAP content — there is no patient_visible flag on that
// table to safely gate what a patient may read from a note, so app code
// simply never queries it for the portal.
export type LastVisit = {
  id: string;
  encounter_date: string;
  encounter_type: string | null;
  chief_complaint: string | null;
  provider_name: string | null;
};

export async function getLastCompletedEncounter(supabase: any, patientId: string): Promise<LastVisit | null> {
  const { data } = await supabase
    .from("encounters")
    .select("id, encounter_date, encounter_type, chief_complaint, user_profiles!encounters_provider_id_fkey(full_name, title)")
    .eq("patient_id", patientId)
    .eq("status", "closed")
    .order("encounter_date", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!data) return null;
  const provider = (data as any).user_profiles;
  return {
    id: (data as any).id,
    encounter_date: (data as any).encounter_date,
    encounter_type: (data as any).encounter_type,
    chief_complaint: (data as any).chief_complaint,
    provider_name: provider ? `${provider.title ? provider.title + " " : ""}${provider.full_name}` : null,
  };
}
