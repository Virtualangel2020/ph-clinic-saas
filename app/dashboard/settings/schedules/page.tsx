import { requireClinicAdmin } from "@/lib/require-clinic-admin";
import { BackLink } from "@/components/back-link";
import { ProviderSchedulesManager } from "../calendar/provider-schedules-manager";
import { FlexibleAvailabilityManager } from "../calendar/flexible-availability-manager";
import { addDays, todayPh } from "../../calendar/date-utils";

// This used to be a "Phase 3" placeholder — provider working hours,
// breaks, and flexible/one-off availability actually shipped as part of
// the patient-bookable-availability work, but landed inside the
// Scheduling & Calendar settings page instead of here, leaving this page
// stale. Moved (not duplicated) out of ./calendar/page.tsx so each
// settings page matches what its own card on the Settings home actually
// says: Schedules = provider working hours and availability,
// Calendar = appointment types, colors, and booking rules.
export default async function SchedulesSettingsPage() {
  const { supabase, profile } = await requireClinicAdmin();

  const [{ data: providers }, { data: schedules }, { data: dateAvailability }] = await Promise.all([
    supabase
      .from("user_profiles")
      .select("id, full_name, title")
      .eq("tenant_id", profile.tenant_id)
      .eq("role", "doctor")
      .eq("is_active", true)
      .order("full_name"),
    supabase
      .from("provider_schedules")
      .select("id, provider_id, day_of_week, start_time, end_time, patient_bookable")
      .eq("tenant_id", profile.tenant_id),
    supabase
      .from("provider_date_availability")
      .select("id, provider_id, avail_date, start_time, end_time, patient_bookable")
      .eq("tenant_id", profile.tenant_id)
      .gte("avail_date", todayPh())
      .lt("avail_date", addDays(todayPh(), 60))
      .order("avail_date"),
  ]);

  return (
    <div style={{ maxWidth: 760, display: "grid", gap: 24 }}>
      <div>
        <BackLink href="/dashboard/settings" label="Settings" />
        <h1 style={{ fontSize: 22, marginBottom: 4 }}>Schedules</h1>
        <p style={{ color: "#666", fontSize: 13 }}>
          Each provider's recurring weekly working hours, breaks, and one-off flexible availability — and which of
          those hours patients are allowed to book themselves. Day-to-day blocks (a single day off, a holiday) are
          added straight from the Calendar's sidebar instead, since those come up in the moment rather than as setup.
        </p>
      </div>

      <ProviderSchedulesManager providers={(providers as any) ?? []} schedules={(schedules as any) ?? []} />

      <FlexibleAvailabilityManager providers={(providers as any) ?? []} entries={(dateAvailability as any) ?? []} />
    </div>
  );
}
