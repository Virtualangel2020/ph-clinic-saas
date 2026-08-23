import { requireClinicAdmin } from "@/lib/require-clinic-admin";
import { BackLink } from "@/components/back-link";
import { AppointmentTypesManager } from "./appointment-types-manager";
import { CalendarColorsForm } from "./calendar-colors-form";
import { CancellationReasonsManager } from "./cancellation-reasons-manager";
import { DoubleBookingToggle } from "./double-booking-toggle";
import { ProviderSchedulesManager } from "./provider-schedules-manager";
import { DEFAULT_AVAILABILITY_COLORS, DEFAULT_STATUS_COLORS } from "../../calendar/status-constants";

// Part 39-40 + Phase 1 (scheduling upgrade): Clinic-Admin-configurable
// appointment-type colors, status colors, cancellation reasons, and the
// double-booking policy — the single "Scheduling & Calendar" settings home
// the calendar module (app/dashboard/calendar) reads from.
export default async function CalendarSettingsPage() {
  const { supabase, profile } = await requireClinicAdmin();

  const [{ data: appointmentTypes }, { data: clinicSettings }, { data: cancellationReasons }, { data: providers }, { data: schedules }] = await Promise.all([
    supabase
      .from("appointment_types")
      .select("id, name, color, default_duration_minutes, description, is_active, sort_order")
      .eq("tenant_id", profile.tenant_id)
      .order("sort_order"),
    supabase.from("clinic_settings").select("appointment_status_colors, availability_colors, allow_double_booking").eq("tenant_id", profile.tenant_id).maybeSingle(),
    supabase
      .from("cancellation_reasons")
      .select("id, label, is_active, sort_order")
      .eq("tenant_id", profile.tenant_id)
      .order("sort_order"),
    supabase
      .from("user_profiles")
      .select("id, full_name, title")
      .eq("tenant_id", profile.tenant_id)
      .eq("role", "doctor")
      .eq("is_active", true)
      .order("full_name"),
    supabase
      .from("provider_schedules")
      .select("provider_id, day_of_week, start_time, end_time, is_active")
      .eq("tenant_id", profile.tenant_id),
  ]);

  return (
    <div style={{ maxWidth: 760, display: "grid", gap: 24 }}>
      <div>
        <BackLink href="/dashboard/settings" label="Settings" />
        <h1 style={{ fontSize: 22, marginBottom: 4 }}>Scheduling &amp; Calendar</h1>
        <p style={{ color: "#666", fontSize: 13 }}>
          Appointment types, status colors, cancellation reasons, and booking rules for your calendar.
        </p>
      </div>

      <AppointmentTypesManager initialTypes={(appointmentTypes as any) ?? []} />

      <CalendarColorsForm
        statusColors={{ ...DEFAULT_STATUS_COLORS, ...(clinicSettings?.appointment_status_colors ?? {}) }}
        availabilityColors={{ ...DEFAULT_AVAILABILITY_COLORS, ...(clinicSettings?.availability_colors ?? {}) }}
      />

      <CancellationReasonsManager initialReasons={(cancellationReasons as any) ?? []} />

      <DoubleBookingToggle initialEnabled={clinicSettings?.allow_double_booking ?? true} />

      <ProviderSchedulesManager providers={(providers as any) ?? []} schedules={(schedules as any) ?? []} />
    </div>
  );
}
