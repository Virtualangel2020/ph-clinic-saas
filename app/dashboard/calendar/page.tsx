import { requireClinicMember } from "@/lib/require-clinic-member";
import { CalendarView } from "./calendar-view";
import { addDays, monthGridEnd, monthGridStart, phDayStart, startOfWeek, todayPh } from "./date-utils";

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

  const [{ data: providers }, { data: appointmentTypes }, { data: patients }, { data: appointments }] = await Promise.all([
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
      .select("id, patient_id, provider_id, appointment_type_id, start_at, end_at, status, notes, patients(first_name,last_name), user_profiles(full_name), appointment_types(name,color)")
      .eq("tenant_id", profile.tenant_id)
      .gte("start_at", phDayStart(rangeStart))
      .lt("start_at", phDayStart(rangeEndExclusive))
      .order("start_at"),
  ]);

  return (
    <div>
      <h1 style={{ fontSize: 24, marginBottom: 4 }}>Calendar</h1>
      <p style={{ color: "#666", marginBottom: 20, fontSize: 13 }}>
        Book and manage appointments across your providers. Provider availability rules (blocked time, working
        hours) haven't shipped yet — any active doctor can be booked at any time for now.
      </p>

      <CalendarView
        view={view}
        anchor={anchor}
        providers={(providers as any) ?? []}
        appointmentTypes={(appointmentTypes as any) ?? []}
        patients={(patients as any) ?? []}
        appointments={(appointments as any) ?? []}
      />
    </div>
  );
}
