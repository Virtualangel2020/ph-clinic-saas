import { requireClinicAdmin } from "@/lib/require-clinic-admin";
import { BackLink } from "@/components/back-link";
import { CoverageManager } from "./coverage-manager";
import { CLINIC_PATIENT_ACCESS_COLUMNS, CLINIC_PATIENT_ACCESS_DEFAULTS, ClinicPatientAccessRow, ProviderOverrideRow } from "../shared";

const PROVIDER_OVERRIDE_COLUMNS =
  "provider_id, booking_type, prioritize_scheduled, booking_cutoff_minutes, max_advance_booking_days, arrival_reminder_enabled, arrival_reminder_minutes, custom_instructions, accept_hmo, accept_yakap, messaging_enabled, messaging_audience, messaging_availability_mode, messaging_before_days, messaging_after_days, messaging_outside_hours_behavior, messaging_disclaimer";

// HMO / YAKAP / Coverage (spec §22-28). Clinic admin curates which HMOs
// the clinic accepts at all (clinic_accepted_hmos); a provider only needs
// a row in provider_hmo_acceptance if they accept FEWER than the full
// active clinic list — absent rows means "accepts everything the clinic
// accepts" so a group practice where every doctor takes every HMO never
// has to enumerate anything per-provider. accept_hmo/accept_yakap
// themselves follow the same clinic-default + provider-override pattern
// as booking. Per §23, a provider's public profile must never show an
// HMO just because another provider in the clinic accepts it — that's
// enforced by this exact per-provider subset, not by anything UI-only.
export default async function CoveragePage() {
  const { supabase, profile } = await requireClinicAdmin();
  const tenantId = profile.tenant_id;

  const [{ data: clinicSettings }, { data: providers }, { data: overrides }, { data: hmos }, { data: providerHmoLinks }] = await Promise.all([
    supabase.from("clinic_settings").select(CLINIC_PATIENT_ACCESS_COLUMNS).eq("tenant_id", tenantId).maybeSingle(),
    supabase.from("user_profiles").select("id, full_name, title").eq("tenant_id", tenantId).eq("role", "doctor").eq("is_active", true).order("full_name"),
    supabase.from("provider_patient_access_settings").select(PROVIDER_OVERRIDE_COLUMNS).eq("tenant_id", tenantId),
    supabase
      .from("clinic_accepted_hmos")
      .select("id, hmo_name, is_active, verification_requirement, patient_instructions, notes")
      .eq("tenant_id", tenantId)
      .order("hmo_name"),
    supabase.from("provider_hmo_acceptance").select("provider_id, hmo_id").eq("tenant_id", tenantId),
  ]);

  return (
    <div style={{ maxWidth: 780 }}>
      <BackLink href="/dashboard/settings/patient-access" label="Patient Access & Payments" />
      <h1 style={{ fontSize: 22, marginBottom: 4 }}>HMO / YAKAP / Coverage</h1>
      <p style={{ color: "#666", fontSize: 13, marginBottom: 20 }}>
        Which HMOs your clinic accepts and what patients need to do to use them, plus YAKAP participation. Selecting
        an HMO here never claims coverage automatically — it only tells patients your clinic works with that HMO and
        what verification, if any, is required.
      </p>

      <CoverageManager
        clinicDefaults={((clinicSettings as ClinicPatientAccessRow) ?? CLINIC_PATIENT_ACCESS_DEFAULTS) as ClinicPatientAccessRow}
        providers={(providers as any) ?? []}
        overrides={(overrides as ProviderOverrideRow[]) ?? []}
        hmos={(hmos as any) ?? []}
        providerHmoLinks={(providerHmoLinks as any) ?? []}
      />
    </div>
  );
}
