import { requireClinicMember } from "@/lib/require-clinic-member";
import { CalendarView } from "./calendar-view";
import { addDays, monthGridEnd, monthGridStart, phDayStart, startOfWeek, todayPh } from "./date-utils";
import { DEFAULT_AVAILABILITY_COLORS, DEFAULT_STATUS_COLORS } from "./status-constants";
import { buildAvailability } from "./availability";

type View = "day" | "week" | "month";

export default async function CalendarPage({
  searchParams,
}: {
  searchParams: { view?: string; date?: string };
}) {
  const { supabase, profile } = await requireClinicMember();

  const view: View = searchParams.view === "week" || searchParams.view === "month" ? (searchParams.view as View) : "day";
  const anchor = searchParams.date && /^\d{4}-\d{2}-\d{2}$/.test(searchParams.date) ? searchParams.date : todayPh();

  const rangeStart = view === "day" ? anchor : view === "week" ? startOfWeek(anchor) : monthGridStart(anchor);
  const rangeEndExclusive = view === "day" ? addDays(anchor, 1) : view === "week" ? addDays(startOfWeek(anchor), 7) : monthGridEnd(anchor);

  const [
    { data: providers },
    { data: appointmentTypes },
    { data: patients },
    { data: appointments },
    { data: clinicSettings },
    { data: cancellationReasons },
    { data: schedules },
    { data: timeBlocksRaw },
  ] = await Promise.all([
    supabase
      .from("user_profiles")
      .select("id, full_name, title")
      .eq("tenant_id", profile.tenant_id)
      .eq("role", "doctor")
      .eq("is_active", true)
      .order("full_name"),
    supabase
      .from("appointment_types")
      .select("id, name, color, default_duration_minutes")
      .eq("tenant_id", profile.tenant_id)
      .eq("is_active", true)
      .order("sort_order"),
    supabase
      .from("patients")
      .select("id, first_name, middle_name, last_name, mobile_phone")
      .eq("tenant_id", profile.tenant_id)
      .eq("is_active", true)
      .order("last_name")
      .order("first_name"),
    supabase
      .from("appointments")
      .select("id, patient_id, provider_id, appointment_type_id, start_at, end_at, status, notes, patients(first_name,last_name,mobile_phone), user_profiles(full_name), appointment_types(name,color)")
      .eq("tenant_id", profile.tenant_id)
      .gte("start_at", phDayStart(rangeStart))
      .lt("start_at", phDayStart(rangeEndExclusive))
      .order("start_at"),
    supabase.from("clinic_settings").select("appointment_status_colors, availability_colors, allow_double_booking").eq("tenant_id", profile.tenant_id).maybeSingle(),
    supabase
      .from("cancellation_reasons")
      .select("id, label")
      .eq("tenant_id", profile.tenant_id)
      .eq("is_active", true)
      .order("sort_order"),
    // Weekly working-hours templates — small table, fetched whole (not
    // range-scoped, there's nothing to range-scope: it's a recurring
    // template, not dated rows).
    supabase.from("provider_schedules").select("provider_id, day_of_week, start_time, end_time, is_active").eq("tenant_id", profile.tenant_id),
    // One-off exceptions ARE dated, so these stay range-scoped like
    // appointments — no full-history loads.
    supabase
      .from("provider_time_blocks")
      .select("id, provider_id, block_date, start_time, end_time, reason, user_profiles(full_name)")
      .eq("tenant_id", profile.tenant_id)
      .gte("block_date", rangeStart)
      .lt("block_date", rangeEndExclusive)
      .order("block_date"),
  ]);

  const statusColors = { ...DEFAULT_STATUS_COLORS, ...(clinicSettings?.appointment_status_colors ?? {}) };
  const allowDoubleBooking = clinicSettings?.allow_double_booking ?? true;

  const visibleDates: string[] =
    view === "day" ? [anchor] : view === "week" ? Array.from({ length: 7 }, (_, i) => addDays(startOfWeek(anchor), i)) : [];
  const providerIds = ((providers as any) ?? []).map((p: any) => p.id);
  const availability = buildAvailability(providerIds, visibleDates, (schedules as any) ?? [], (timeBlocksRaw as any) ?? []);
  const timeBlocks = ((timeBlocksRaw as any) ?? []).map((b: any) => ({
    id: b.id,
    provider_id: b.provider_id,
    providerName: b.user_profiles?.full_name ?? "Unknown provider",
    block_date: b.block_date,
    start_time: b.start_time,
    end_time: b.end_time,
    reason: b.reason,
  }));

  return (
    <div>
      <h1 style={{ fontSize: 24, marginBottom: 4 }}>Calendar</h1>
      <p style={{ color: "#666", marginBottom: 20, fontSize: 13 }}>
        Book and manage appointments across your providers. Set each provider's working hours under Settings →
        Scheduling &amp; Calendar to see availability shaded on the grid below.
      </p>

      <CalendarView
        view={view}
        anchor={anchor}
        providers={(providers as any) ?? []}
        appointmentTypes={(appointmentTypes as any) ?? []}
        patients={(patients as any) ?? []}
        appointments={(appointments as any) ?? []}
        statusColors={statusColors}
        allowDoubleBooking={allowDoubleBooking}
        cancellationReasons={(cancellationReasons as any) ?? []}
        availabilityColors={{ ...DEFAULT_AVAILABILITY_COLORS, ...(clinicSettings as any)?.availability_colors }}
        availability={availability}
        timeBlocks={timeBlocks}
      />
    </div>
  );
}
