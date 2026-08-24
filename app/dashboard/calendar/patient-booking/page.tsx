import Link from "next/link";
import { requireClinicMember } from "@/lib/require-clinic-member";
import { BackLink } from "@/components/back-link";
import { ProviderTypePicker } from "./provider-type-picker";
import { addDays, formatDayLabel, formatMonthLabel, monthGridStart, phDayStart, startOfMonth, todayPh } from "../date-utils";
import { buildAvailability, type DateAvailabilityRow, type ScheduleRow, type TimeBlockRow } from "../availability";
import { classifyDate, computeBookableSlots, cutsFor, type DateBookingStatus } from "../bookable-slots";
import { minutesOfDayPh } from "../time-grid";

// CALENDAR AVAILABILITY & PATIENT BOOKING UPDATE, sections 1/2/4/12 — the
// green/red/gray month view + "Available Times" list, from the STAFF side.
// This previews exactly what a patient will see once the Patient Portal
// booking wizard (a separate, larger phase) ships, using the real
// patient-bookable-availability engine (availability.ts + bookable-slots.ts)
// rather than a mockup, so staff can verify what patients can actually book
// before that wizard exists. Internal-only info (blocked time, who's on
// which appointment) stays out of this view on purpose — it's meant to
// match what the Patient Portal will show, which is deliberately simpler
// than the internal calendar (spec section 12).
export default async function PatientBookingPreviewPage({
  searchParams,
}: {
  searchParams: { providerId?: string; typeId?: string; month?: string; date?: string };
}) {
  const { supabase, profile } = await requireClinicMember();

  const [{ data: providers }, { data: appointmentTypes }] = await Promise.all([
    supabase.from("user_profiles").select("id, full_name, title").eq("tenant_id", profile.tenant_id).eq("role", "doctor").eq("is_active", true).order("full_name"),
    supabase.from("appointment_types").select("id, name, default_duration_minutes").eq("tenant_id", profile.tenant_id).eq("is_active", true).order("sort_order"),
  ]);

  const providerId = searchParams.providerId ?? "";
  const typeId = searchParams.typeId ?? "";
  const month = searchParams.month && /^\d{4}-\d{2}$/.test(searchParams.month) ? `${searchParams.month}-01` : todayPh().slice(0, 7) + "-01";
  const selectedType = ((appointmentTypes as any) ?? []).find((t: any) => t.id === typeId) as { id: string; name: string; default_duration_minutes: number } | undefined;

  function monthHref(m: string) {
    const qs = new URLSearchParams({ providerId, typeId, month: m.slice(0, 7) }).toString();
    return `/dashboard/calendar/patient-booking?${qs}`;
  }
  function dateHref(d: string) {
    const qs = new URLSearchParams({ providerId, typeId, month: month.slice(0, 7), date: d }).toString();
    return `/dashboard/calendar/patient-booking?${qs}`;
  }

  let grid: { date: string; inMonth: boolean; status: DateBookingStatus }[] = [];
  let selectedDateSlots: { startMin: number; endMin: number }[] | null = null;
  let selectedDateStatus: DateBookingStatus | null = null;

  if (providerId && typeId && selectedType) {
    const gridStart = monthGridStart(month);
    const dates = Array.from({ length: 42 }, (_, i) => addDays(gridStart, i));
    const rangeEndExclusive = addDays(gridStart, 42);

    const [{ data: schedules }, { data: dateAvailabilityRaw }, { data: timeBlocksRaw }, { data: appointmentsRaw }] = await Promise.all([
      supabase.from("provider_schedules").select("id, provider_id, day_of_week, start_time, end_time, patient_bookable").eq("tenant_id", profile.tenant_id).eq("provider_id", providerId),
      supabase
        .from("provider_date_availability")
        .select("id, provider_id, avail_date, start_time, end_time, patient_bookable")
        .eq("tenant_id", profile.tenant_id)
        .eq("provider_id", providerId)
        .gte("avail_date", gridStart)
        .lt("avail_date", rangeEndExclusive),
      supabase
        .from("provider_time_blocks")
        .select("id, provider_id, block_date, start_time, end_time, reason")
        .eq("tenant_id", profile.tenant_id)
        .eq("provider_id", providerId)
        .gte("block_date", gridStart)
        .lt("block_date", rangeEndExclusive),
      supabase
        .from("appointments")
        .select("start_at, end_at, status")
        .eq("tenant_id", profile.tenant_id)
        .eq("provider_id", providerId)
        .gte("start_at", phDayStart(gridStart))
        .lt("start_at", phDayStart(rangeEndExclusive))
        .not("status", "in", "(cancelled,no_show,late_cancellation)"),
    ]);

    const availability = buildAvailability(
      [providerId],
      dates,
      (schedules as any as ScheduleRow[]) ?? [],
      (dateAvailabilityRaw as any as DateAvailabilityRow[]) ?? [],
      (timeBlocksRaw as any as TimeBlockRow[]) ?? []
    );

    // Bucket booked appointments by PH-local date, as minute-of-day ranges.
    const bookedByDate = new Map<string, { startMin: number; endMin: number }[]>();
    for (const a of (appointmentsRaw as any as { start_at: string; end_at: string; status: string }[]) ?? []) {
      const phDate = new Date(new Date(a.start_at).getTime() + 8 * 60 * 60 * 1000).toISOString().slice(0, 10);
      if (!bookedByDate.has(phDate)) bookedByDate.set(phDate, []);
      bookedByDate.get(phDate)!.push({ startMin: minutesOfDayPh(a.start_at), endMin: minutesOfDayPh(a.end_at) });
    }

    const currentMonth = month.slice(0, 7);
    grid = dates.map((d) => {
      const avail = availability[providerId]?.[d];
      const cuts = cutsFor(avail, bookedByDate.get(d) ?? []);
      const status = classifyDate(avail?.ranges ?? [], cuts, selectedType.default_duration_minutes);
      return { date: d, inMonth: d.slice(0, 7) === currentMonth, status };
    });

    if (searchParams.date) {
      const avail = availability[providerId]?.[searchParams.date];
      const cuts = cutsFor(avail, bookedByDate.get(searchParams.date) ?? []);
      const openRanges = (avail?.ranges ?? []).filter((r) => r.patientBookable);
      selectedDateStatus = grid.find((g) => g.date === searchParams.date)?.status ?? classifyDate(openRanges, cuts, selectedType.default_duration_minutes);
      selectedDateSlots = computeBookableSlots(openRanges, cuts, selectedType.default_duration_minutes);
    }
  }

  return (
    <div style={{ maxWidth: 720 }}>
      <BackLink href="/dashboard/calendar" label="Calendar" />
      <h1 style={{ fontSize: 22, marginBottom: 4 }}>Patient Booking Availability</h1>
      <p style={{ color: "#666", fontSize: 13, marginBottom: 18 }}>
        A staff preview of what a patient will see once Patient Portal self-booking ships — same availability engine,
        so what you check here is what patients would actually be offered. Booking itself isn't wired up on this page yet.
      </p>

      <div style={{ background: "var(--card-bg)", border: "1px solid var(--card-border)", borderRadius: 12, padding: 18, marginBottom: 18 }}>
        <ProviderTypePicker providers={(providers as any) ?? []} appointmentTypes={(appointmentTypes as any) ?? []} providerId={providerId} typeId={typeId} />
      </div>

      {!providerId || !typeId ? (
        <div style={{ background: "#fff6e6", border: "1px solid #f0d998", borderRadius: 10, padding: 14, fontSize: 13, color: "#8a6100" }}>
          Select a provider and appointment type above to preview their booking calendar.
        </div>
      ) : (
        <>
          <div style={{ background: "var(--card-bg)", border: "1px solid var(--card-border)", borderRadius: 12, padding: 18, marginBottom: 18 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14, flexWrap: "wrap", gap: 10 }}>
              <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                <Link href={monthHref(addDays(startOfMonth(month), -1))} style={navBtn}>
                  ‹ Previous
                </Link>
                <Link href={monthHref(todayPh())} style={navBtn}>
                  Today
                </Link>
                <Link href={monthHref(addDays(startOfMonth(month), 32))} style={navBtn}>
                  Next ›
                </Link>
              </div>
              <div style={{ fontWeight: 800, fontSize: 18, color: "var(--text-heading)" }}>{formatMonthLabel(month)}</div>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 6, marginBottom: 4 }}>
              {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((d) => (
                <div key={d} style={{ fontSize: 11, fontWeight: 700, color: "#888", textAlign: "center" }}>
                  {d}
                </div>
              ))}
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 6 }}>
              {grid.map((cell) => {
                const isToday = cell.date === todayPh();
                const isSelected = cell.date === searchParams.date;
                const colors: Record<DateBookingStatus, { bg: string; border: string; text: string; label: string }> = {
                  green: { bg: "#eaf7ec", border: "#8fd19e", text: "#1a7f37", label: "Available" },
                  red: { bg: "#fdecec", border: "#f3a6a6", text: "#a12a2a", label: "Fully booked" },
                  gray: { bg: "#f4f4f5", border: "#e2e2e5", text: "#999", label: "Not available for online booking" },
                };
                const c = colors[cell.status];
                return (
                  <Link
                    key={cell.date}
                    href={dateHref(cell.date)}
                    title={`${cell.date} — ${c.label}`}
                    aria-label={`${cell.date}, ${c.label}`}
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "center",
                      justifyContent: "center",
                      height: 48,
                      borderRadius: 8,
                      textDecoration: "none",
                      background: c.bg,
                      border: `1.5px solid ${isSelected ? "#0c1730" : c.border}`,
                      opacity: cell.inMonth ? 1 : 0.35,
                    }}
                  >
                    <span style={{ fontSize: 12.5, fontWeight: isToday ? 800 : 600, color: isToday ? "#0c1730" : c.text }}>{Number(cell.date.slice(8, 10))}</span>
                  </Link>
                );
              })}
            </div>

            <div style={{ display: "flex", gap: 16, marginTop: 14, flexWrap: "wrap", fontSize: 11.5, color: "#555" }}>
              <span>
                <span aria-hidden style={{ display: "inline-block", width: 9, height: 9, borderRadius: "50%", background: "#8fd19e", marginRight: 5 }} />
                Green — Available
              </span>
              <span>
                <span aria-hidden style={{ display: "inline-block", width: 9, height: 9, borderRadius: "50%", background: "#f3a6a6", marginRight: 5 }} />
                Red — Fully booked
              </span>
              <span>
                <span aria-hidden style={{ display: "inline-block", width: 9, height: 9, borderRadius: "50%", background: "#ccc", marginRight: 5 }} />
                Gray — Not available for online booking
              </span>
            </div>
          </div>

          {searchParams.date && (
            <div style={{ background: "var(--card-bg)", border: "1px solid var(--card-border)", borderRadius: 12, padding: 18 }}>
              <h2 style={{ fontSize: 15, marginTop: 0, marginBottom: 10 }}>{formatDayLabel(searchParams.date)} — Available Times</h2>
              {selectedDateStatus === "gray" && (
                <p style={{ color: "#888", fontSize: 13 }}>Online booking is not available for this provider on this date. Please submit an appointment request or contact the clinic.</p>
              )}
              {selectedDateStatus === "red" && <p style={{ color: "#a12a2a", fontSize: 13 }}>Fully booked — no remaining online appointment times for this date.</p>}
              {selectedDateStatus === "green" && selectedDateSlots && (
                <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                  {selectedDateSlots.map((s, i) => (
                    <div key={i} style={{ border: "1px solid #cfe3d3", background: "#f3faf4", color: "#1a7f37", borderRadius: 8, padding: "7px 12px", fontSize: 12.5, fontWeight: 600 }}>
                      {minToLabel(s.startMin)}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}

function minToLabel(totalMin: number): string {
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  const period = h < 12 ? "AM" : "PM";
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:${String(m).padStart(2, "0")} ${period}`;
}

const navBtn: React.CSSProperties = { padding: "6px 12px", border: "1px solid var(--input-border)", borderRadius: 8, textDecoration: "none", color: "#333", fontSize: 12.5, fontWeight: 600, background: "var(--card-bg)" };
