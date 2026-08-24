import { NextRequest, NextResponse } from "next/server";
import { renderToBuffer } from "@react-pdf/renderer";
import { createClient } from "@/lib/supabase/server";
import { EncounterExportDocument, type EncounterEntry, type ProgressNoteEntry } from "@/lib/pdf/encounter-pdf-document";

export const runtime = "nodejs";
const MAX_ENCOUNTERS = 50;

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

// POST { encounterIds: string[] } -> application/pdf. Selected encounters
// must all belong to the SAME patient — combining two different patients'
// clinical content into one document would be a real PHI-mixing mistake,
// not just a UX inconvenience, so this is enforced server-side regardless
// of what the client already checked.
export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not authenticated." }, { status: 401 });

  const { data: profile } = await supabase.from("user_profiles").select("tenant_id, role").eq("id", user.id).maybeSingle();
  if (!profile?.tenant_id) return NextResponse.json({ error: "Not authorized." }, { status: 403 });

  let body: { encounterIds?: string[] };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }
  const encounterIds = Array.from(new Set((body.encounterIds ?? []).filter((x) => typeof x === "string" && x)));
  if (encounterIds.length === 0) return NextResponse.json({ error: "Select at least one encounter." }, { status: 400 });
  if (encounterIds.length > MAX_ENCOUNTERS) return NextResponse.json({ error: `Select ${MAX_ENCOUNTERS} encounters or fewer at a time.` }, { status: 400 });

  const { data: encountersRaw, error: encError } = await supabase
    .from("encounters")
    .select(
      "id, patient_id, provider_id, encounter_date, encounter_type, chief_complaint, signed_at, signed_by, " +
        "patients(first_name, middle_name, last_name, date_of_birth, sex), " +
        "provider:user_profiles!encounters_provider_id_fkey(full_name, title, prc_license, ptr_number), " +
        "signer:user_profiles!encounters_signed_by_fkey(full_name, title, prc_license, ptr_number)"
    )
    .eq("tenant_id", profile.tenant_id)
    .in("id", encounterIds)
    .order("encounter_date", { ascending: true });

  if (encError) return NextResponse.json({ error: encError.message }, { status: 500 });
  if (!encountersRaw || encountersRaw.length === 0) return NextResponse.json({ error: "No matching encounters found." }, { status: 404 });

  const patientIds = new Set(encountersRaw.map((e: any) => e.patient_id));
  if (patientIds.size > 1) {
    return NextResponse.json({ error: "Select encounters for a single patient — these span more than one patient." }, { status: 400 });
  }
  const patientRow: any = (encountersRaw[0] as any).patients;
  if (!patientRow) return NextResponse.json({ error: "Patient record not found." }, { status: 404 });

  const { data: notesRaw } = await supabase
    .from("patient_progress_notes")
    .select("id, note_date, chief_complaint, subjective, objective, assessment, plan, bp_systolic, bp_diastolic, pulse_rate, respiratory_rate, oxygen_saturation, temperature_c, weight_kg, height_cm, encounter_id, amends_note_id, amendment_reason, created_at, user_profiles(full_name)")
    .eq("tenant_id", profile.tenant_id)
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
    .eq("tenant_id", profile.tenant_id)
    .maybeSingle();

  let logoUrl: string | null = null;
  if (clinicSettings?.logo_path) {
    const { data } = supabase.storage.from("clinic-logos").getPublicUrl(clinicSettings.logo_path);
    logoUrl = data.publicUrl;
  }

  // Signature images live in a PRIVATE bucket — a short-lived signed URL,
  // fetched once per unique signer, is enough since the PDF is rendered
  // and returned in the same request.
  const signerIds = Array.from(new Set(encountersRaw.map((e: any) => e.signed_by).filter(Boolean)));
  const signatureUrlBySigner = new Map<string, string>();
  if (signerIds.length > 0) {
    const { data: sigs } = await supabase
      .from("provider_signatures")
      .select("user_id, signature_path, status, reviewed_at")
      .eq("tenant_id", profile.tenant_id)
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

  const pdfBuffer = await renderToBuffer(
    EncounterExportDocument({
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
    })
  );

  const filenameSafe = patientFullName.replace(/[^a-z0-9]+/gi, "-").toLowerCase();
  return new NextResponse(pdfBuffer as any, {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="${filenameSafe}-encounters.pdf"`,
      "Cache-Control": "no-store",
    },
  });
}
