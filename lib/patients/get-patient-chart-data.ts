import type { SupabaseClient } from "@supabase/supabase-js";
import { formatDayLabel, formatTime } from "@/app/dashboard/calendar/date-utils";
import type { AppointmentRow } from "@/app/dashboard/patients/[id]/appointment-history-section";
import type { PrescriptionRow } from "@/app/dashboard/patients/[id]/prescriptions-section";
import type { LabOrderRow } from "@/app/dashboard/patients/[id]/lab-section";
import type { InsurancePlanRow } from "@/app/dashboard/patients/[id]/coverage-section";
import type { ReferralRow } from "@/app/dashboard/patients/[id]/referrals-section";

// Single source of truth for "everything about one patient's chart."
// Extracted from patients/[id]/page.tsx so the standalone chart route AND
// the master-detail patient list (app/dashboard/patients/page.tsx, right
// pane) fetch this exactly the same way — one query set, two places that
// render it. Do not fork this logic; add fields here if a tab needs more.

const ENCOUNTER_PAGE_SIZE = 20;
const PAST_APPT_LIMIT = 10;
const UPCOMING_APPT_LIMIT = 5;

export function age(dob: string) {
  const b = new Date(dob);
  const now = new Date();
  let a = now.getFullYear() - b.getFullYear();
  const m = now.getMonth() - b.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < b.getDate())) a--;
  return a;
}

export type PatientChartData = NonNullable<Awaited<ReturnType<typeof getPatientChartData>>>;

export async function getPatientChartData(supabase: SupabaseClient, tenantId: string, patientId: string) {
  const { data: patient } = await supabase
    .from("patients")
    .select("*")
    .eq("id", patientId)
    .eq("tenant_id", tenantId)
    .maybeSingle();

  if (!patient) return null;

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
    { data: patientFormsRaw },
    { data: activeFormTemplatesRaw },
    { data: formsEntitlementRaw },
    { data: referralsRaw },
  ] = await Promise.all([
    supabase.from("patient_allergies").select("id, allergen, reaction, severity, noted_at").eq("patient_id", patientId).order("noted_at", { ascending: false }),
    supabase.from("patient_medications").select("id, medication_name, dosage, frequency, started_at, is_active, notes").eq("patient_id", patientId).order("created_at", { ascending: false }),
    supabase
      .from("patient_documents")
      .select(
        "id, title, doc_type, description, created_at, storage_path, mime_type, file_size_bytes, status, status_reason, document_date, source, user_profiles(full_name)"
      )
      .eq("patient_id", patientId)
      .order("created_at", { ascending: false }),
    supabase
      .from("patient_progress_notes")
      .select("id, note_date, chief_complaint, subjective, objective, assessment, plan, bp_systolic, bp_diastolic, pulse_rate, respiratory_rate, oxygen_saturation, temperature_c, weight_kg, height_cm, created_at, amends_note_id, amendment_reason, user_profiles(full_name)")
      .eq("patient_id", patientId)
      .order("note_date", { ascending: false }),
    supabase
      .from("encounters")
      .select("id, encounter_date, encounter_type, chief_complaint, status, signed_at, user_profiles!encounters_provider_id_fkey(full_name)")
      .eq("tenant_id", tenantId)
      .eq("patient_id", patientId)
      .order("encounter_date", { ascending: false })
      .order("created_at", { ascending: false })
      .range(0, ENCOUNTER_PAGE_SIZE - 1),
    supabase.from("encounters").select("id", { count: "exact", head: true }).eq("tenant_id", tenantId).eq("patient_id", patientId),
    supabase
      .from("appointments")
      .select("id, start_at, status, notes, provider_id, user_profiles(full_name), appointment_types(name)")
      .eq("tenant_id", tenantId)
      .eq("patient_id", patientId)
      .lt("start_at", nowIso)
      .order("start_at", { ascending: false })
      .limit(PAST_APPT_LIMIT),
    supabase
      .from("appointments")
      .select("id, start_at, status, notes, provider_id, user_profiles(full_name), appointment_types(name)")
      .eq("tenant_id", tenantId)
      .eq("patient_id", patientId)
      .gte("start_at", nowIso)
      .neq("status", "cancelled")
      .order("start_at", { ascending: true })
      .limit(UPCOMING_APPT_LIMIT),
    supabase
      .from("prescriptions")
      .select(
        "id, status, notes, prescribed_at, renewal_type, refill_count, refill_due_at, reminder_days_before, start_date, end_date, user_profiles(full_name), prescription_items(id, drug_name, dosage, form, frequency, duration, quantity, instructions)"
      )
      .eq("tenant_id", tenantId)
      .eq("patient_id", patientId)
      .order("prescribed_at", { ascending: false }),
    supabase
      .from("lab_orders")
      .select(
        "id, status, priority, order_type, notes, ordered_at, user_profiles(full_name), lab_order_items(id, test_name), lab_results(id, result_summary, resulted_at, reviewed_at, status, released_at, user_profiles(full_name))"
      )
      .eq("tenant_id", tenantId)
      .eq("patient_id", patientId)
      .order("ordered_at", { ascending: false }),
    supabase
      .from("patient_insurance")
      .select("id, provider_name, member_number, plan_name, status, effective_date, expiry_date, is_primary, principal_or_dependent, relationship_to_principal")
      .eq("patient_id", patientId)
      .order("is_primary", { ascending: false })
      .order("created_at", { ascending: false }),
    // Patient Forms add-on (spec §13-14): assigned/completed form instances
    // for this one patient — the same rows the Patient Portal's "My Forms"
    // page reads, filtered instead by patient_portal_accounts. Nothing here
    // is duplicated from intake_form_templates; fields_config_snapshot was
    // captured once at assignment time.
    supabase.from("patient_forms").select("*").eq("patient_id", patientId).order("assigned_at", { ascending: false }),
    supabase.from("intake_form_templates").select("id, name, category, is_required").eq("tenant_id", tenantId).eq("is_active", true).order("name"),
    supabase.from("tenant_entitlements").select("feature_key").eq("tenant_id", tenantId).eq("feature_key", "forms_acknowledgements").eq("status", "active").maybeSingle(),
    // Referrals (spec §22-25): every referral about this patient, both sent
    // BY this clinic and — for the same-tenant colleague-to-colleague case —
    // received BY this clinic. Same `referrals` rows the global Referrals
    // workspace and the referral-letter PDFs read; nothing patient-specific
    // is duplicated here.
    supabase
      .from("referrals")
      .select(
        "id, destination_type, specialty_requested, reason, clinical_summary, urgency, status, created_at, external_destination_name, sending_tenant_id, receiving_tenant_id, " +
          "sending_provider:user_profiles!referrals_sending_provider_id_fkey(full_name, title), " +
          "receiving_provider:user_profiles!referrals_receiving_provider_id_fkey(full_name, title), " +
          "external_providers(full_name, credentials, clinic_name, city)"
      )
      .eq("patient_id", patientId)
      .order("created_at", { ascending: false }),
  ]);

  const [{ data: portalChannels }, { data: portalAccount }, { data: alerts }, { data: providers }, { data: appointmentTypes }] = await Promise.all([
    supabase.rpc("tenant_patient_portal_channels", { p_tenant_id: tenantId }),
    supabase
      .from("patient_portal_accounts")
      .select("id, channel, contact_value, status, invited_at, activated_at, revoked_at")
      .eq("patient_id", patientId)
      .maybeSingle(),
    supabase.from("patient_alerts").select("id, category, message, created_at").eq("patient_id", patientId).eq("is_active", true).order("created_at", { ascending: false }),
    supabase.from("user_profiles").select("id, full_name, title").eq("tenant_id", tenantId).eq("role", "doctor").eq("is_active", true).order("full_name"),
    supabase.from("appointment_types").select("id, name").eq("tenant_id", tenantId).eq("is_active", true).order("sort_order"),
  ]);

  const { data: defaultNoteTemplateRaw } = await supabase
    .from("note_templates")
    .select("sections")
    .eq("tenant_id", tenantId)
    .eq("is_default", true)
    .eq("is_active", true)
    .limit(1)
    .maybeSingle();
  const noteTemplateSections = (defaultNoteTemplateRaw as any)?.sections as { key: string; label: string; placeholder: string }[] | undefined;
  const noteTemplate = noteTemplateSections
    ? Object.fromEntries(noteTemplateSections.map((s) => [s.key, { label: s.label, placeholder: s.placeholder }]))
    : null;

  const apptIds = [...((pastApptsRaw as any[]) ?? []), ...((upcomingApptsRaw as any[]) ?? [])].map((a) => a.id);
  const { data: linkedEncounters } =
    apptIds.length > 0
      ? await supabase.from("encounters").select("id, appointment_id").eq("tenant_id", tenantId).in("appointment_id", apptIds)
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
    renewal_type: p.renewal_type ?? "one_time",
    refill_count: p.refill_count ?? null,
    refill_due_at: p.refill_due_at ?? null,
    reminder_days_before: p.reminder_days_before ?? null,
    start_date: p.start_date ?? null,
    end_date: p.end_date ?? null,
  }));

  const labOrders: LabOrderRow[] = ((labOrdersRaw as any[]) ?? []).map((o) => ({
    id: o.id,
    status: o.status,
    priority: o.priority,
    order_type: o.order_type ?? "lab",
    notes: o.notes,
    ordered_at: o.ordered_at,
    ordering_provider_name: o.user_profiles?.full_name ?? null,
    items: o.lab_order_items ?? [],
    results: (o.lab_results ?? []).map((r: any) => ({
      id: r.id,
      result_summary: r.result_summary,
      resulted_at: r.resulted_at,
      reviewed_at: r.reviewed_at,
      status: r.status ?? (r.reviewed_at ? "reviewed" : "new"),
      released_at: r.released_at ?? null,
      reviewed_by_name: r.user_profiles?.full_name ?? null,
    })),
  }));

  const insurancePlans: InsurancePlanRow[] = (insurancePlansRaw as any[]) ?? [];
  const referrals: ReferralRow[] = ((referralsRaw as any[]) ?? []).map((r) => ({
    id: r.id,
    destination_type: r.destination_type,
    specialty_requested: r.specialty_requested,
    reason: r.reason,
    clinical_summary: r.clinical_summary,
    urgency: r.urgency,
    status: r.status,
    created_at: r.created_at,
    external_destination_name: r.external_destination_name,
    sending_provider_name: r.sending_provider ? `${r.sending_provider.title ? r.sending_provider.title + " " : ""}${r.sending_provider.full_name}` : null,
    receiving_provider_name: r.receiving_provider ? `${r.receiving_provider.title ? r.receiving_provider.title + " " : ""}${r.receiving_provider.full_name}` : null,
    external_provider_name: r.external_providers?.full_name ?? null,
    external_provider_detail: r.external_providers ? [r.external_providers.credentials, r.external_providers.clinic_name, r.external_providers.city].filter(Boolean).join(", ") || null : null,
    isIncoming: r.receiving_tenant_id === tenantId,
    isOutgoing: r.sending_tenant_id === tenantId,
  }));
  const encounters = (encountersPage as any[]) ?? [];
  const lastEncounter = encounters[0] ?? null;
  const nextAppt = upcomingAppts[0] ?? null;
  const initialEncounterHasMore = (totalEncounters ?? 0) > encounters.length;
  const fullName = `${patient.last_name}, ${patient.first_name}${patient.middle_name ? " " + patient.middle_name : ""}${patient.suffix ? " " + patient.suffix : ""}`;

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

  return {
    patient,
    fullName,
    allergies: (allergies as any[]) ?? [],
    medications: (medications as any[]) ?? [],
    documents: (documents as any[]) ?? [],
    notes: (notes as any[]) ?? [],
    encounters,
    totalEncounters: totalEncounters ?? 0,
    initialEncounterHasMore,
    pastAppts,
    upcomingAppts,
    prescriptions,
    labOrders,
    insurancePlans,
    portalChannels: (portalChannels as any) ?? { email: false, sms: false },
    portalAccount: (portalAccount as any) ?? null,
    alerts: (alerts as any[]) ?? [],
    providers: (providers as any[]) ?? [],
    appointmentTypes: (appointmentTypes as any[]) ?? [],
    noteTemplate,
    lastEncounter,
    nextAppt,
    primaryProvider,
    sharingPreference,
    patientForms: (patientFormsRaw as any[]) ?? [],
    activeFormTemplates: (activeFormTemplatesRaw as any[]) ?? [],
    formsEntitled: !!formsEntitlementRaw,
    referrals,
  };
}
