import { requireClinicAdmin } from "@/lib/require-clinic-admin";
import { BackLink } from "@/components/back-link";
import { BookingAccessManager } from "./booking-access-manager";
import { CLINIC_PATIENT_ACCESS_COLUMNS, CLINIC_PATIENT_ACCESS_DEFAULTS, ClinicPatientAccessRow, ProviderOverrideRow } from "../shared";

const PROVIDER_OVERRIDE_COLUMNS =
  "provider_id, booking_type, prioritize_scheduled, booking_cutoff_minutes, max_advance_booking_days, arrival_reminder_enabled, arrival_reminder_minutes, custom_instructions, accept_hmo, accept_yakap, messaging_enabled, messaging_audience, messaging_availability_mode, messaging_before_days, messaging_after_days, messaging_outside_hours_behavior, messaging_disclaimer";

// Booking, Availability & Appointment Instructions (spec §4-6, §35-38).
// Clinic-wide defaults live on clinic_settings; a provider only gets a row
// in provider_patient_access_settings once a clinic admin explicitly
// customizes something for them — group practices where every provider
// works the same way never write more than the clinic defaults once.
// This page always fetches (and passes through unchanged) the FULL
// defaults/override row, even though it only edits booking fields — the
// underlying RPCs save every field in one call, so a partial fetch here
// would silently blank out Messaging/HMO settings owned by other pages.
export default async function BookingAccessPage() {
  const { supabase, profile } = await requireClinicAdmin();
  const tenantId = profile.tenant_id;

  const [{ data: clinicSettings }, { data: providers }, { data: overrides }] = await Promise.all([
    supabase.from("clinic_settings").select(CLINIC_PATIENT_ACCESS_COLUMNS).eq("tenant_id", tenantId).maybeSingle(),
    supabase.from("user_profiles").select("id, full_name, title").eq("tenant_id", tenantId).eq("role", "doctor").eq("is_active", true).order("full_name"),
    supabase.from("provider_patient_access_settings").select(PROVIDER_OVERRIDE_COLUMNS).eq("tenant_id", tenantId),
  ]);

  return (
    <div style={{ maxWidth: 780 }}>
      <BackLink href="/dashboard/settings/patient-access" label="Patient Access & Payments" />
      <h1 style={{ fontSize: 22, marginBottom: 4 }}>Booking, Availability & Instructions</h1>
      <p style={{ color: "#666", fontSize: 13, marginBottom: 20 }}>
        How patients can reach a provider — walk in, book an appointment, or both — plus how much notice is needed,
        how far ahead they can book, arrival reminders, and any free-text instructions. Set this once for the
        clinic; only customize a provider whose practice genuinely works differently.
      </p>

      <BookingAccessManager
        clinicDefaults={((clinicSettings as ClinicPatientAccessRow) ?? CLINIC_PATIENT_ACCESS_DEFAULTS) as ClinicPatientAccessRow}
        providers={(providers as any) ?? []}
        overrides={(overrides as ProviderOverrideRow[]) ?? []}
      />
    </div>
  );
}
