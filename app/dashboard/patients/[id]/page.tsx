import { notFound } from "next/navigation";
import Link from "next/link";
import { requireClinicMember } from "@/lib/require-clinic-member";
import { BackLink } from "@/components/back-link";
import { ArchiveButton } from "./archive-button";
import { AllergiesSection } from "./allergies-section";
import { MedicationsSection } from "./medications-section";
import { DocumentsSection } from "./documents-section";
import { ProgressNotesSection } from "./progress-notes-section";
import { canViewClinicalContent } from "@/lib/permissions";
import { PortalSection } from "./portal-section";
import { PatientAlertsBanner } from "./patient-alerts-banner";
import { AppointmentHistorySection, type AppointmentRow } from "./appointment-history-section";
import { EncounterHistorySection } from "./encounter-history-section";
import { CareCoordinationSection } from "./care-coordination-section";
import { PrescriptionsSection, type PrescriptionRow } from "./prescriptions-section";
import { LabSection, type LabOrderRow } from "./lab-section";
import { InsurancePhilhealthSection, type InsurancePlanRow } from "./insurance-philhealth-section";
import { formatDayLabel, formatTime } from "../../calendar/date-utils";

const ENCOUNTER_PAGE_SIZE = 20;
const PAST_APPT_LIMIT = 10;
const UPCOMING_APPT_LIMIT = 5;

function age(dob: string) {
  const b = new Date(dob);
  const now = new Date();
  let a = now.getFullYear() - b.getFullYear();
  const m = now.getMonth() - b.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < b.getDate())) a--;
  return a;
}

export default async function PatientDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { supabase, profile, user } = await requireClinicMember();
  const canViewClinical = await canViewClinicalContent(supabase, user.id, profile.role);

  const { data: patient } = await supabase
    .from("patients")
    .select("*")
    .eq("id", id)
    .eq("tenant_id", profile.tenant_id)
    .maybeSingle();

  if (!patient) notFound();

  const nowIso = new Date().toISOString();

  const [
    { data: allergies },
    { data: medications },
    { data: documents },
    { data: notes },
    { data: encountersPage },
    { count: totalEncounters },
    { data: pastApptsRaw },
    { data: upcomingApptsRaw },
    { data: prescriptionsRaw },
    { data: labOrdersRaw },
    { data: insurancePlansRaw },
  ] = await Promise.all([
    supabase.from("patient_allergies").select("id, allergen, reaction, severity, noted_at").eq("patient_id", id).order("noted_at", { ascending: false }),
    supabase.from("patient_medications").select("id, medication_name, dosage, frequency, started_at, is_active, notes").eq("patient_id", id).order("created_at", { ascending: false }),
    supabase
      .from("patient_documents")
      .select("id, title, doc_type, description, created_at, storage_path, mime_type, file_size_bytes, status, status_reason")
      .eq("patient_id", id)
      .order("created_at", { ascending: false }),
    supabase
      .from("patient_progress_notes")
      .select("id, note_date, chief_complaint, subjective, objective, assessment, plan, bp_systolic, bp_diastolic, pulse_rate, respiratory_rate, oxygen_saturation, temperature_c, weight_kg, height_cm, created_at, amends_note_id, amendment_reason, user_profiles(full_name)")
      .eq("patient_id", id)
      .order("note_date", { ascending: false }),
    // Patient-chart Encounters: most recent first, ONE bounded page up
    // front — see searchPatientEncountersAction for how "Load more" fetches
    // the rest. Never pull a patient's whole encounter history just to
    // open their chart (spec's own performance requirement).
    supabase
      .from("encounters")
      .select("id, encounter_date, encounter_type, chief_complaint, status, signed_at, user_profiles!encounters_provider_id_fkey(full_name)")
      .eq("tenant_id", profile.tenant_id)
      .eq("patient_id", id)
      .order("encounter_date", { ascending: false })
      .order("created_at", { ascending: false })
      .range(0, ENCOUNTER_PAGE_SIZE - 1),
    supabase.from("encounters").select("id", { count: "exact", head: true }).eq("tenant_id", profile.tenant_id).eq("patient_id", id),
    // Past/upcoming appointments — THIS clinic's own records only (tenant_id
    // scoped), a small bounded window each rather than the patient's whole
    // appointment history.
    supabase
      .from("appointments")
      .select("id, start_at, status, notes, provider_id, user_profiles(full_name), appointment_types(name)")
      .eq("tenant_id", profile.tenant_id)
      .eq("patient_id", id)
      .lt("start_at", nowIso)
      .order("start_at", { ascending: false })
      .limit(PAST_APPT_LIMIT),
    supabase
      .from("appointments")
      .select("id, start_at, status, notes, provider_id, user_profiles(full_name), appointment_types(name)")
      .eq("tenant_id", profile.tenant_id)
      .eq("patient_id", id)
      .gte("start_at", nowIso)
      .neq("status", "cancelled")
      .order("start_at", { ascending: true })
      .limit(UPCOMING_APPT_LIMIT),
    supabase
      .from("prescriptions")
      .select(
        "id, status, notes, prescribed_at, user_profiles(full_name), prescription_items(id, drug_name, dosage, form, frequency, duration, quantity, instructions)"
      )
      .eq("tenant_id", profile.tenant_id)
      .eq("patient_id", id)
      .order("prescribed_at", { ascending: false }),
    supabase
      .from("lab_orders")
      .select(
        "id, status, priority, notes, ordered_at, user_profiles(full_name), lab_order_items(id, test_name), lab_results(id, result_summary, resulted_at, reviewed_at, user_profiles(full_name))"
      )
      .eq("tenant_id", profile.tenant_id)
      .eq("patient_id", id)
      .order("ordered_at", { ascending: false }),
    supabase
      .from("patient_insurance")
      .select("id, provider_name, member_number, plan_name, status, effective_date, expiry_date")
      .eq("patient_id", id)
      .order("created_at", { ascending: false }),
  ]);

  const [{ data: portalChannels }, { data: portalAccount }, { data: alerts }, { data: providers }, { data: appointmentTypes }] = await Promise.all([
    supabase.rpc("tenant_patient_portal_channels", { p_tenant_id: profile.tenant_id }),
    supabase
      .from("patient_portal_accounts")
      .select("id, channel, contact_value, status, invited_at, activated_at, revoked_at")
      .eq("patient_id", id)
      .maybeSingle(),
    supabase
      .from("patient_alerts")
      .select("id, category, message, created_at")
      .eq("patient_id", id)
      .eq("is_active", true)
      .order("created_at", { ascending: false }),
    // Filter option lists for the chart's own Encounter History section.
    supabase.from("user_profiles").select("id, full_name, title").eq("tenant_id", profile.tenant_id).eq("role", "doctor").eq("is_active", true).order("full_name"),
    supabase.from("appointment_types").select("id, name").eq("tenant_id", profile.tenant_id).eq("is_active", true).order("sort_order"),
  ]);

  // Clinic's default progress-note template, if any — relabels/reprompts
  // the note composer's fixed Subjective/Objective/Assessment/Plan fields.
  // No default template is the common case today; the composer falls back
  // to its standard hardcoded SOAP labels exactly as before when this is
  // null.
  const { data: defaultNoteTemplateRaw } = await supabase
    .from("note_templates")
    .select("sections")
    .eq("tenant_id", profile.tenant_id)
    .eq("is_default", true)
    .eq("is_active", true)
    .limit(1)
    .maybeSingle();
  const noteTemplateSections = (defaultNoteTemplateRaw as any)?.sections as
    | { key: string; label: string; placeholder: string }[]
    | undefined;
  const noteTemplate = noteTemplateSections
    ? Object.fromEntries(noteTemplateSections.map((s) => [s.key, { label: s.label, placeholder: s.placeholder }]))
    : null;

  // Which of the appointments we just fetched already have a documented
  // encounter behind them — scoped to just those appointment IDs, not the
  // patient's whole history, so this stays cheap regardless of how many
  // years of records exist.
  const apptIds = [...((pastApptsRaw as any[]) ?? []), ...((upcomingApptsRaw as any[]) ?? [])].map((a) => a.id);
  const { data: linkedEncounters } =
    apptIds.length > 0
      ? await supabase.from("encounters").select("id, appointment_id").eq("tenant_id", profile.tenant_id).in("appointment_id", apptIds)
      : { data: [] as any[] };
  const encounterIdByAppt = new Map<string, string>();
  for (const e of (linkedEncounters as any[]) ?? []) {
    if (e.appointment_id) encounterIdByAppt.set(e.appointment_id, e.id);
  }

  function toApptRow(a: any): AppointmentRow {
    return {
      id: a.id,
      start_at: a.start_at,
      status: a.status,
      notes: a.notes,
      provider_name: a.user_profiles?.full_name ?? null,
      appointment_type_name: a.appointment_types?.name ?? null,
      encounter_id: encounterIdByAppt.get(a.id) ?? null,
    };
  }
  const pastAppts: AppointmentRow[] = ((pastApptsRaw as any[]) ?? []).map(toApptRow);
  const upcomingAppts: AppointmentRow[] = ((upcomingApptsRaw as any[]) ?? []).map(toApptRow);

  const prescriptions: PrescriptionRow[] = ((prescriptionsRaw as any[]) ?? []).map((p) => ({
    id: p.id,
    status: p.status,
    notes: p.notes,
    prescribed_at: p.prescribed_at,
    prescriber_name: p.user_profiles?.full_name ?? null,
    items: p.prescription_items ?? [],
  }));

  const labOrders: LabOrderRow[] = ((labOrdersRaw as any[]) ?? []).map((o) => ({
    id: o.id,
    status: o.status,
    priority: o.priority,
    notes: o.notes,
    ordered_at: o.ordered_at,
    ordering_provider_name: o.user_profiles?.full_name ?? null,
    items: o.lab_order_items ?? [],
    results: (o.lab_results ?? []).map((r: any) => ({
      id: r.id,
      result_summary: r.result_summary,
      resulted_at: r.resulted_at,
      reviewed_at: r.reviewed_at,
      reviewed_by_name: r.user_profiles?.full_name ?? null,
    })),
  }));

  const insurancePlans: InsurancePlanRow[] = (insurancePlansRaw as any[]) ?? [];

  const encounters = (encountersPage as any[]) ?? [];
  const lastEncounter = encounters[0] ?? null;
  const nextAppt = upcomingAppts[0] ?? null;
  const initialEncounterHasMore = (totalEncounters ?? 0) > encounters.length;

  const fullName = `${patient.last_name}, ${patient.first_name}${patient.middle_name ? " " + patient.middle_name : ""}${patient.suffix ? " " + patient.suffix : ""}`;

  // Care Coordination — Primary/Family Doctor (either an AngelClinic
  // provider or a curated external one, never both) and the separate
  // sharing-authorization preference. Small, conditional lookups rather
  // than folded into the big Promise.all above since at most one of these
  // branches actually runs for a given patient.
  let primaryProvider: { kind: "angelclinic" | "external"; name: string; specialty: string | null; clinicName: string | null } | null = null;
  if (patient.primary_provider_user_id) {
    const { data: pp } = await supabase.from("user_profiles").select("full_name, title, specialty, tenant_id").eq("id", patient.primary_provider_user_id).maybeSingle();
    if (pp) {
      const { data: cs } = await supabase.from("clinic_settings").select("clinic_name").eq("tenant_id", pp.tenant_id).maybeSingle();
      primaryProvider = { kind: "angelclinic", name: `${pp.title ? pp.title + " " : ""}${pp.full_name}`, specialty: pp.specialty, clinicName: cs?.clinic_name ?? null };
    }
  } else if (patient.primary_provider_external_id) {
    const { data: ep } = await supabase.from("external_providers").select("full_name, specialty, clinic_name").eq("id", patient.primary_provider_external_id).maybeSingle();
    if (ep) primaryProvider = { kind: "external", name: ep.full_name, specialty: ep.specialty, clinicName: ep.clinic_name };
  }

  const { data: sharingPrefRaw } = await supabase
    .from("patient_sharing_preferences")
    .select("provider_user_id, authorized_at, user_profiles(full_name, title, tenant_id)")
    .eq("patient_id", patient.id)
    .eq("status", "active")
    .maybeSingle();
  let sharingPreference: { providerUserId: string; providerName: string; clinicName: string | null; authorizedAt: string } | null = null;
  if (sharingPrefRaw) {
    const sp: any = sharingPrefRaw;
    let clinicName: string | null = null;
    if (sp.user_profiles?.tenant_id) {
      const { data: cs } = await supabase.from("clinic_settings").select("clinic_name").eq("tenant_id", sp.user_profiles.tenant_id).maybeSingle();
      clinicName = cs?.clinic_name ?? null;
    }
    sharingPreference = {
      providerUserId: sp.provider_user_id,
      providerName: `${sp.user_profiles?.title ? sp.user_profiles.title + " " : ""}${sp.user_profiles?.full_name ?? "—"}`,
      clinicName,
      authorizedAt: sp.authorized_at,
    };
  }

  return (
    <div style={{ maxWidth: 820 }}>
      <BackLink href="/dashboard/patients" label="Patients" />
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 12, marginBottom: 4 }}>
        <div>
          <h1 style={{ fontSize: 22, marginBottom: 2 }}>
            {fullName}
            {!patient.is_active && <span style={{ marginLeft: 10, fontSize: 12, color: "#a12a2a", fontWeight: 600 }}>ARCHIVED</span>}
          </h1>
          <p style={{ color: "#666", fontSize: 13 }}>
            {age(patient.date_of_birth)} y/o {patient.sex} · Born {new Date(patient.date_of_birth).toLocaleDateString()}
            {patient.blood_type ? ` · Blood type ${patient.blood_type}` : ""}
          </p>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <Link
            href={`/dashboard/patients/${patient.id}/edit`}
            style={{ border: "1px solid var(--input-border)", borderRadius: 8, padding: "8px 14px", fontSize: 13, textDecoration: "none", color: "#333" }}
          >
            Edit
          </Link>
          <ArchiveButton patientId={patient.id} isActive={patient.is_active} />
        </div>
      </div>

      <div style={{ marginTop: 14 }}>
        <PatientAlertsBanner patientId={patient.id} alerts={(alerts as any) ?? []} />
      </div>

      <div style={{ background: "var(--card-bg)", border: "1px solid var(--card-border)", borderRadius: 12, padding: 18, marginTop: 16, display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 14, fontSize: 13 }}>
        <div>
          <div style={{ color: "#999", fontSize: 11, textTransform: "uppercase", marginBottom: 3 }}>Contact</div>
          <div>{patient.mobile_phone || "—"}</div>
          <div>{patient.email || "—"}</div>
        </div>
        <div>
          <div style={{ color: "#999", fontSize: 11, textTransform: "uppercase", marginBottom: 3 }}>Address</div>
          <div>{[patient.address_line1, patient.address_line2].filter(Boolean).join(", ") || "—"}</div>
          <div>{[patient.city, patient.province, patient.postal_code].filter(Boolean).join(", ")}</div>
        </div>
        <div>
          <div style={{ color: "#999", fontSize: 11, textTransform: "uppercase", marginBottom: 3 }}>Emergency contact</div>
          <div>{patient.emergency_contact_name || "—"} {patient.emergency_contact_relationship ? `(${patient.emergency_contact_relationship})` : ""}</div>
          <div>{patient.emergency_contact_phone || ""}</div>
        </div>
        <div>
          <div style={{ color: "#999", fontSize: 11, textTransform: "uppercase", marginBottom: 3 }}>Guardian</div>
          <div>{patient.guardian_name || "—"} {patient.guardian_relationship ? `(${patient.guardian_relationship})` : ""}</div>
          <div>{patient.guardian_phone || ""}</div>
        </div>
      </div>

      {patient.notes && (
        <div style={{ marginTop: 14, background: "#fff7e6", border: "1px solid #e6c66b", borderRadius: 10, padding: "10px 14px", fontSize: 12.5, color: "#7a5c12" }}>
          {patient.notes}
        </div>
      )}

      {/* Compact overview strip — answers "when was this patient last
          seen / who by / when do they come back / how many visits with
          us" without leaving the chart. Everything here is derived from
          THIS clinic's own records only (every query above is tenant_id
          scoped) — a patient shared across multiple AngelClinic clinics
          never bleeds another clinic's history into this number. */}
      <div style={{ background: "var(--card-bg)", border: "1px solid var(--card-border)", borderRadius: 12, padding: 18, marginTop: 14, display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 14, fontSize: 13 }}>
        <div>
          <div style={{ color: "#999", fontSize: 11, textTransform: "uppercase", marginBottom: 3 }}>Last seen</div>
          <div style={{ fontWeight: 700, color: "var(--text-heading)" }}>{lastEncounter ? formatDayLabel(lastEncounter.encounter_date) : "—"}</div>
        </div>
        <div>
          <div style={{ color: "#999", fontSize: 11, textTransform: "uppercase", marginBottom: 3 }}>Last provider</div>
          <div style={{ fontWeight: 700, color: "var(--text-heading)" }}>{lastEncounter?.user_profiles?.full_name ?? "—"}</div>
        </div>
        <div>
          <div style={{ color: "#999", fontSize: 11, textTransform: "uppercase", marginBottom: 3 }}>Next appointment</div>
          <div style={{ fontWeight: 700, color: "var(--text-heading)" }}>
            {nextAppt ? (
              <>
                {formatDayLabel(nextAppt.start_at.slice(0, 10))} · {formatTime(nextAppt.start_at)}
              </>
            ) : (
              "—"
            )}
          </div>
        </div>
        <div>
          <div style={{ color: "#999", fontSize: 11, textTransform: "uppercase", marginBottom: 3 }}>Total encounters with this clinic</div>
          <div style={{ fontWeight: 700, color: "var(--text-heading)" }}>{totalEncounters ?? 0}</div>
        </div>
      </div>

      <div style={{ marginTop: 14 }}>
        <InsurancePhilhealthSection
          patientId={patient.id}
          philhealthNumber={patient.philhealth_number}
          philhealthMemberType={patient.philhealth_member_type}
          insurancePlans={insurancePlans}
        />
      </div>

      <div style={{ marginTop: 14 }}>
        <CareCoordinationSection patientId={patient.id} primaryProvider={primaryProvider} sharingPreference={sharingPreference} />
      </div>

      <AppointmentHistorySection past={pastAppts} upcoming={upcomingAppts} />

      <AllergiesSection patientId={patient.id} allergies={(allergies as any) ?? []} />
      <MedicationsSection patientId={patient.id} medications={(medications as any) ?? []} />
      <PrescriptionsSection patientId={patient.id} prescriptions={prescriptions} />
      <LabSection patientId={patient.id} labOrders={labOrders} />
      <ProgressNotesSection patientId={patient.id} notes={(notes as any) ?? []} canViewClinical={canViewClinical} noteTemplate={noteTemplate} />
      <DocumentsSection patientId={patient.id} documents={(documents as any) ?? []} />
      <PortalSection
        patientId={patient.id}
        patientEmail={patient.email}
        patientMobile={patient.mobile_phone}
        channels={(portalChannels as any) ?? { email: false, sms: false }}
        account={(portalAccount as any) ?? null}
      />

      <EncounterHistorySection
        patientId={patient.id}
        initialRows={encounters.map((e: any) => ({
          id: e.id,
          encounter_date: e.encounter_date,
          encounter_type: e.encounter_type,
          chief_complaint: e.chief_complaint,
          status: e.status,
          signed_at: e.signed_at ?? null,
          provider_name: e.user_profiles?.full_name ?? null,
        }))}
        initialHasMore={initialEncounterHasMore}
        providers={(providers as any) ?? []}
        appointmentTypes={(appointmentTypes as any) ?? []}
      />
    </div>
  );
}
