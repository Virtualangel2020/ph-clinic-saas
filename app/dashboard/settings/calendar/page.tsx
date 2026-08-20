import { requireClinicAdmin } from "@/lib/require-clinic-admin";
import { AppointmentTypesManager } from "./appointment-types-manager";
import { CalendarColorsForm } from "./calendar-colors-form";

const DEFAULT_STATUS_COLORS: Record<string, string> = {
  scheduled: "#8ea9db", confirmed: "#4a86e8", checked_in: "#93c47d", waiting: "#f6b26b",
  with_provider: "#c27ba0", completed: "#6aa84f", cancelled: "#999999", no_show: "#cc0000",
  walk_in: "#a64d79", late_cancellation: "#e69138",
};
const DEFAULT_AVAILABILITY_COLORS: Record<string, string> = { unavailable: "#4b5563", available: "#e5e7eb" };

// Part 39-40: Clinic-Admin-configurable appointment-type colors + calendar
// availability colors. The actual calendar view that CONSUMES these colors
// is Phase 3 (scheduling module) — not built yet, see /dashboard/calendar
// placeholder. This page only lets a clinic set up its color system ahead
// of time, same reasoning as the medical certificate template builder.
export default async function CalendarSettingsPage() {
  const { supabase, profile } = await requireClinicAdmin();

  const [{ data: appointmentTypes }, { data: clinicSettings }] = await Promise.all([
    supabase
      .from("appointment_types")
      .select("id, name, color, default_duration_minutes, description, is_active, sort_order")
      .eq("tenant_id", profile.tenant_id)
      .order("sort_order"),
    supabase.from("clinic_settings").select("appointment_status_colors, availability_colors").eq("tenant_id", profile.tenant_id).maybeSingle(),
  ]);

  return (
    <div style={{ maxWidth: 760, display: "grid", gap: 24 }}>
      <div>
        <h1 style={{ fontSize: 22, marginBottom: 4 }}>Calendar</h1>
        <p style={{ color: "#666", fontSize: 13 }}>
          Set up appointment types and colors now — the scheduling calendar itself is coming in a later phase, but
          your setup will already be in place when it ships.
        </p>
      </div>

      <AppointmentTypesManager initialTypes={(appointmentTypes as any) ?? []} />

      <CalendarColorsForm
        statusColors={{ ...DEFAULT_STATUS_COLORS, ...(clinicSettings?.appointment_status_colors ?? {}) }}
        availabilityColors={{ ...DEFAULT_AVAILABILITY_COLORS, ...(clinicSettings?.availability_colors ?? {}) }}
      />
    </div>
  );
}
