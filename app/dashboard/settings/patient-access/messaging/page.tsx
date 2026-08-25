import { requireClinicAdmin } from "@/lib/require-clinic-admin";
import { BackLink } from "@/components/back-link";
import { MessagingManager } from "./messaging-manager";
import { CLINIC_PATIENT_ACCESS_COLUMNS, CLINIC_PATIENT_ACCESS_DEFAULTS, ClinicPatientAccessRow, ProviderOverrideRow } from "../shared";

const PROVIDER_OVERRIDE_COLUMNS =
  "provider_id, booking_type, prioritize_scheduled, booking_cutoff_minutes, max_advance_booking_days, arrival_reminder_enabled, arrival_reminder_minutes, custom_instructions, accept_hmo, accept_yakap, messaging_enabled, messaging_audience, messaging_availability_mode, messaging_before_days, messaging_after_days, messaging_outside_hours_behavior, messaging_disclaimer";

// Patient Portal Messaging (spec §29-34). OFF by default until a provider
// turns it on — turning it off never removes it from the subscription,
// it just disables that provider's "Send a Message" button (still shown,
// visibly locked — see the provider-profile work in Phase 4, which reads
// this same effective-messaging-enabled value).
export default async function MessagingPage() {
  const { supabase, profile } = await requireClinicAdmin();
  const tenantId = profile.tenant_id;

  const [{ data: clinicSettings }, { data: providers }, { data: overrides }, { data: hours }, { data: allowedPatients }, { data: patients }] = await Promise.all([
    supabase.from("clinic_settings").select(CLINIC_PATIENT_ACCESS_COLUMNS).eq("tenant_id", tenantId).maybeSingle(),
    supabase.from("user_profiles").select("id, full_name, title").eq("tenant_id", tenantId).eq("role", "doctor").eq("is_active", true).order("full_name"),
    supabase.from("provider_patient_access_settings").select(PROVIDER_OVERRIDE_COLUMNS).eq("tenant_id", tenantId),
    supabase.from("provider_messaging_hours").select("provider_id, day_of_week, start_time, end_time").eq("tenant_id", tenantId),
    supabase.from("provider_messaging_allowed_patients").select("provider_id, patient_id").eq("tenant_id", tenantId),
    supabase.from("patients").select("id, first_name, last_name").eq("tenant_id", tenantId).order("last_name").limit(300),
  ]);

  return (
    <div style={{ maxWidth: 780 }}>
      <BackLink href="/dashboard/settings/patient-access" label="Patient Access & Payments" />
      <h1 style={{ fontSize: 22, marginBottom: 4 }}>Patient Messaging</h1>
      <p style={{ color: "#666", fontSize: 13, marginBottom: 20 }}>
        Whether patients can message a provider through the Patient Portal, who can message them, and when. Off by
        default for every provider until you turn it on — this never affects your subscription, only whether
        patients see a working &quot;Send a Message&quot; button for that provider.
      </p>

      <MessagingManager
        clinicDefaults={((clinicSettings as ClinicPatientAccessRow) ?? CLINIC_PATIENT_ACCESS_DEFAULTS) as ClinicPatientAccessRow}
        providers={(providers as any) ?? []}
        overrides={(overrides as ProviderOverrideRow[]) ?? []}
        hours={(hours as any) ?? []}
        allowedPatients={(allowedPatients as any) ?? []}
        patients={(patients as any) ?? []}
      />
    </div>
  );
}
