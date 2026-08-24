import { notFound } from "next/navigation";
import Link from "next/link";
import { requireClinicMember } from "@/lib/require-clinic-member";
import { BackLink } from "@/components/back-link";
import { ProgressNotesSection } from "../../patients/[id]/progress-notes-section";
import { EncounterHeader } from "./encounter-header";
import { SignEncounterButton } from "./sign-encounter-button";
import { ShareOfferPrompt } from "./share-offer-prompt";
import { canViewClinicalContent } from "@/lib/permissions";

export default async function EncounterDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { supabase, profile, user } = await requireClinicMember();
  const canViewClinical = await canViewClinicalContent(supabase, user.id, profile.role);

  const { data: encounterRaw } = await supabase
    .from("encounters")
    .select(
      "id, patient_id, provider_id, appointment_id, encounter_date, encounter_type, chief_complaint, status, signed_at, signed_by, created_at, " +
        "patients(id, first_name, last_name), " +
        "user_profiles!encounters_provider_id_fkey(full_name), " +
        "signer:user_profiles!encounters_signed_by_fkey(full_name, title)"
    )
    .eq("id", id)
    .eq("tenant_id", profile.tenant_id)
    .maybeSingle();

  if (!encounterRaw) notFound();
  // The two-FK-to-user_profiles select above (provider + signer, both
  // disambiguated) is beyond what the generated Supabase types can parse
  // precisely — cast once here rather than sprinkling `as any` everywhere
  // below.
  const encounter = encounterRaw as any;

  const [{ data: notes }, { data: providers }, { data: appointmentTypes }, { data: canSignRaw }] = await Promise.all([
    supabase
      .from("patient_progress_notes")
      .select(
        "id, note_date, chief_complaint, subjective, objective, assessment, plan, bp_systolic, bp_diastolic, pulse_rate, respiratory_rate, oxygen_saturation, temperature_c, weight_kg, height_cm, created_at, amends_note_id, amendment_reason, user_profiles(full_name)"
      )
      .eq("encounter_id", id)
      .order("created_at", { ascending: false }),
    supabase.from("user_profiles").select("id, full_name, title").eq("tenant_id", profile.tenant_id).eq("role", "doctor").eq("is_active", true).order("full_name"),
    supabase.from("appointment_types").select("id, name").eq("tenant_id", profile.tenant_id).eq("is_active", true).order("sort_order"),
    supabase.rpc("user_has_permission", { p_user_id: user.id, p_key: "encounters.sign" }),
  ]);

  const patient = (encounter as any).patients;
  const isSigned = !!(encounter as any).signed_at;
  const signer = (encounter as any).signer;
  const canSign = !!canSignRaw;
  const isCompleted = isSigned || encounter.status === "closed";

  // Encounter-completion share offer (spec §12-13) — only when the patient
  // has an active sharing preference AND this specific encounter hasn't
  // already gone through Records Exchange to that same provider.
  let shareOffer: { providerId: string; providerName: string } | null = null;
  if (isCompleted) {
    const { data: pref } = await supabase
      .from("patient_sharing_preferences")
      .select("provider_user_id, user_profiles(full_name, title)")
      .eq("patient_id", encounter.patient_id)
      .eq("status", "active")
      .maybeSingle();
    if (pref) {
      const { data: alreadySent } = await supabase
        .from("records_exchange_transfer_items")
        .select("transfer_id, records_exchange_transfers!inner(receiving_provider_id)")
        .eq("encounter_id", id)
        .eq("records_exchange_transfers.receiving_provider_id", (pref as any).provider_user_id)
        .limit(1)
        .maybeSingle();
      if (!alreadySent) {
        const up: any = (pref as any).user_profiles;
        shareOffer = { providerId: (pref as any).provider_user_id, providerName: `${up?.title ? up.title + " " : ""}${up?.full_name ?? "—"}` };
      }
    }
  }

  return (
    <div style={{ maxWidth: 820 }}>
      <BackLink href="/dashboard/encounters" label="Encounters" />

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 12, marginBottom: 4 }}>
        <div>
          <h1 style={{ fontSize: 22, marginBottom: 2 }}>
            {patient ? (
              <Link href={`/dashboard/patients/${patient.id}`} style={{ color: "#0c1730", textDecoration: "none" }}>
                {patient.last_name}, {patient.first_name}
              </Link>
            ) : (
              "Unknown patient"
            )}
          </h1>
          <p style={{ color: "#666", fontSize: 13 }}>
            {new Date(encounter.encounter_date).toLocaleDateString()}
            {encounter.appointment_id && (
              <>
                {" · "}
                <Link href="/dashboard/calendar" style={{ color: "#0c1730" }}>
                  from a booked appointment
                </Link>
              </>
            )}
          </p>
        </div>
      </div>

      <EncounterHeader
        encounterId={encounter.id}
        patientId={encounter.patient_id}
        status={encounter.status}
        providerId={encounter.provider_id}
        encounterType={encounter.encounter_type}
        chiefComplaint={encounter.chief_complaint}
        providers={(providers as any) ?? []}
        appointmentTypes={(appointmentTypes as any) ?? []}
        isSigned={isSigned}
      />

      <div style={{ background: "white", border: "1px solid #e2e2e5", borderRadius: 12, padding: 16, marginBottom: 20 }}>
        {isSigned ? (
          <div>
            <span style={{ fontSize: 11, fontWeight: 700, color: "#0c1730", background: "#eef1fb", border: "1px solid #c7d4f5", borderRadius: 999, padding: "3px 10px" }}>
              ✓ Signed
            </span>
            <p style={{ fontSize: 12.5, color: "#666", margin: "8px 0 0" }}>
              Signed by {signer ? `${signer.title ? signer.title + " " : ""}${signer.full_name}` : "—"} on{" "}
              {new Date((encounter as any).signed_at).toLocaleString()}. Documentation is locked — further corrections
              must be recorded as amendments below.
            </p>
          </div>
        ) : canSign ? (
          <SignEncounterButton encounterId={encounter.id} patientId={encounter.patient_id} hasNotes={((notes as any[]) ?? []).length > 0} />
        ) : (
          <p style={{ fontSize: 12, color: "#999", margin: 0 }}>This encounter hasn't been signed yet.</p>
        )}
      </div>

      {shareOffer && (
        <ShareOfferPrompt patientId={encounter.patient_id} encounterId={encounter.id} providerId={shareOffer.providerId} providerName={shareOffer.providerName} />
      )}

      <ProgressNotesSection patientId={encounter.patient_id} notes={(notes as any) ?? []} encounterId={encounter.id} isSignedEncounter={isSigned} canViewClinical={canViewClinical} />
    </div>
  );
}
