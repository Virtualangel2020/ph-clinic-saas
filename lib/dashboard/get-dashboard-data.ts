import type { SupabaseClient } from "@supabase/supabase-js";
import { todayPh, addDays, phDayStart, weekdayMon0, formatTime } from "@/app/dashboard/calendar/date-utils";
import { buildAvailability, timeToMin } from "@/app/dashboard/calendar/availability";
import { computeBookableSlots, cutsFor } from "@/app/dashboard/calendar/bookable-slots";

// Single source of truth for "everything the operational dashboard needs."
// Mirrors lib/patients/get-patient-chart-data.ts's pattern: one function,
// one place all the queries live, so the page component only decides how
// to lay out what's already fetched.
//
// Role shapes what's returned:
//   - doctor: every count is scoped to that doctor's own patients/queue/
//     messages/revenue (the "My ___" dashboard). No Provider Overview.
//   - clinic_admin / staff / reception: clinic-wide counts + Provider
//     Overview (every active doctor's today). Revenue is included only
//     for clinic_admin — reception/staff never see money.
//
// "Walk-in only" mode (clinic_settings.default_booking_type === 'walk_in')
// doesn't change which queries run — it only changes which widgets
// page.tsx chooses to render (appointments-funnel widgets hidden, walk-in/
// queue/revenue widgets emphasized). All the raw numbers below are always
// computed the same way regardless of that setting.

const SLOT_MINUTES = 15; // granularity for "next available" — fine enough to be useful, coarse enough to be fast

export type FollowUpDue = { id: string; patientId: string; patientName: string; dueDate: string; reason: string | null };
export type AttentionItem = { id: string; patientId: string; patientName: string; label: string; at: string };
export type ProviderOverviewRow = {
  id: string;
  name: string;
  patientsToday: number;
  waiting: number;
  completed: number;
  nextAvailable: string | null; // formatted time, or null
  fullyBooked: boolean;
  notWorkingToday: boolean;
};

export async function getDashboardData(supabase: SupabaseClient, tenantId: string, profile: { id: string; role: string; full_name: string | null }) {
  const isDoctor = profile.role === "doctor";
  const isClinicAdmin = profile.role === "clinic_admin";

  const today = todayPh();
  const tomorrow = addDays(today, 1);
  const todayStart = phDayStart(today);
  const tomorrowStart = phDayStart(tomorrow);

  const [{ data: clinicSettings }, { data: doctorsRaw }] = await Promise.all([
    supabase.from("clinic_settings").select("clinic_name, default_booking_type").eq("tenant_id", tenantId).maybeSingle(),
    supabase.from("user_profiles").select("id, full_name, title").eq("tenant_id", tenantId).eq("role", "doctor").eq("is_active", true).order("full_name"),
  ]);
  const walkInOnly = clinicSettings?.default_booking_type === "walk_in";
  const doctors = (doctorsRaw as { id: string; full_name: string | null; title: string | null }[]) ?? [];

  // ── Today's appointments (everyone in the clinic, or just this doctor's own) ──
  let todaysApptQuery = supabase
    .from("appointments")
    .select("id, start_at, end_at, status, provider_id, patients(id, first_name, last_name), user_profiles(full_name), appointment_types(name)")
    .eq("tenant_id", tenantId)
    .gte("start_at", todayStart)
    .lt("start_at", tomorrowStart)
    .order("start_at");
  if (isDoctor) todaysApptQuery = todaysApptQuery.eq("provider_id", profile.id);
  const { data: todaysApptsRaw } = await todaysApptQuery;
  const todaysAppts = (todaysApptsRaw as any[]) ?? [];

  const NOT_COUNTED = new Set(["cancelled", "late_cancellation"]);
  const patientsToday = new Set(todaysAppts.filter((a) => !NOT_COUNTED.has(a.status)).map((a) => a.patients?.id).filter(Boolean)).size;
  const walkInsToday = todaysAppts.filter((a) => a.status === "walk_in").length;

  const apptBuckets = {
    confirmed: todaysAppts.filter((a) => a.status === "confirmed").length,
    pending: todaysAppts.filter((a) => a.status === "scheduled").length,
    cancelled: todaysAppts.filter((a) => a.status === "cancelled" || a.status === "late_cancellation").length,
    noShow: todaysAppts.filter((a) => a.status === "no_show").length,
  };

  const queue = {
    waiting: todaysAppts.filter((a) => a.status === "checked_in" || a.status === "waiting").length,
    inConsultation: todaysAppts.filter((a) => a.status === "with_provider").length,
    completed: todaysAppts.filter((a) => a.status === "completed").length,
  };

  // Rough current average wait — how long, right now, has each
  // currently-waiting patient been sitting in that state. Approximated
  // from `updated_at` (the last status change) since there's no dedicated
  // per-transition timestamp table; honest label on this in the UI.
  let avgWaitMinutes: number | null = null;
  {
    let waitingQuery = supabase
      .from("appointments")
      .select("updated_at")
      .eq("tenant_id", tenantId)
      .in("status", ["checked_in", "waiting"])
      .gte("start_at", todayStart)
      .lt("start_at", tomorrowStart);
    if (isDoctor) waitingQuery = waitingQuery.eq("provider_id", profile.id);
    const { data: waitingRows } = await waitingQuery;
    const rows = (waitingRows as { updated_at: string }[]) ?? [];
    if (rows.length > 0) {
      const now = Date.now();
      const totalMin = rows.reduce((sum, r) => sum + Math.max(0, (now - new Date(r.updated_at).getTime()) / 60000), 0);
      avgWaitMinutes = Math.round(totalMin / rows.length);
    }
  }

  const upcoming = todaysAppts
    .filter((a) => !["completed", "cancelled", "no_show", "late_cancellation"].includes(a.status))
    .sort((a, b) => a.start_at.localeCompare(b.start_at))
    .slice(0, 6)
    .map((a) => ({
      id: a.id,
      time: formatTime(a.start_at),
      patientName: a.patients ? `${a.patients.last_name}, ${a.patients.first_name}` : "Unknown patient",
      providerName: a.user_profiles?.full_name ?? null,
      typeName: a.appointment_types?.name ?? null,
      status: a.status as string,
    }));

  // ── New patients today ──
  const { count: newPatientsToday } = await supabase
    .from("patients")
    .select("id", { count: "exact", head: true })
    .eq("tenant_id", tenantId)
    .gte("created_at", todayStart)
    .lt("created_at", tomorrowStart);

  // ── Follow-ups due ──
  let followUpsQuery = supabase
    .from("patient_follow_ups")
    .select("id, due_date, reason, patient_id, provider_id, patients(first_name, last_name)")
    .eq("tenant_id", tenantId)
    .eq("status", "pending")
    .order("due_date");
  if (isDoctor) followUpsQuery = followUpsQuery.eq("provider_id", profile.id);
  const { data: followUpsRaw } = await followUpsQuery;
  const followUps = (followUpsRaw as any[]) ?? [];
  const toFollowUp = (f: any): FollowUpDue => ({
    id: f.id,
    patientId: f.patient_id,
    patientName: f.patients ? `${f.patients.last_name}, ${f.patients.first_name}` : "Unknown patient",
    dueDate: f.due_date,
    reason: f.reason,
  });
  const followUpsDue = {
    overdue: followUps.filter((f) => f.due_date < today).map(toFollowUp),
    today: followUps.filter((f) => f.due_date === today).map(toFollowUp),
    tomorrow: followUps.filter((f) => f.due_date === tomorrow).map(toFollowUp),
  };

  // ── Results requiring attention (new or flagged follow-up, backlog — not date-scoped) ──
  let resultsQuery = supabase
    .from("lab_results")
    .select("id, status, resulted_at, patient_id, patients(first_name, last_name), lab_orders(ordering_provider_id)")
    .eq("tenant_id", tenantId)
    .in("status", ["new", "follow_up"])
    .order("resulted_at", { ascending: false })
    .limit(50);
  const { data: resultsRaw } = await resultsQuery;
  let resultRows = (resultsRaw as any[]) ?? [];
  if (isDoctor) resultRows = resultRows.filter((r) => r.lab_orders?.ordering_provider_id === profile.id);
  const resultsRequiringAttention: AttentionItem[] = resultRows.slice(0, 6).map((r) => ({
    id: r.id,
    patientId: r.patient_id,
    patientName: r.patients ? `${r.patients.last_name}, ${r.patients.first_name}` : "Unknown patient",
    label: r.status === "follow_up" ? "Flagged for follow-up" : "New result",
    at: r.resulted_at,
  }));
  const resultsRequiringAttentionCount = resultRows.length;

  // ── Patient portal messages, unread ──
  let unreadMessagesQuery = supabase.from("provider_patient_messages").select("id", { count: "exact", head: true }).eq("tenant_id", tenantId).eq("sender_type", "patient").is("read_at", null);
  if (isDoctor) unreadMessagesQuery = unreadMessagesQuery.eq("provider_id", profile.id);
  const { count: unreadMessages } = await unreadMessagesQuery;

  // ── Referrals incoming pending ──
  const { count: incomingReferrals } = await supabase
    .from("referrals")
    .select("id", { count: "exact", head: true })
    .eq("receiving_tenant_id", tenantId)
    .eq("status", "pending");

  // ── Revenue today (clinic_admin: clinic total; doctor: own only; nobody else) ──
  let revenueToday: number | null = null;
  if (isClinicAdmin) {
    const { data: paymentsRaw } = await supabase.from("patient_charge_payments").select("amount_php").eq("tenant_id", tenantId).gte("paid_at", todayStart).lt("paid_at", tomorrowStart);
    revenueToday = ((paymentsRaw as { amount_php: number }[]) ?? []).reduce((s, p) => s + Number(p.amount_php), 0);
  } else if (isDoctor) {
    const { data: paymentsRaw } = await supabase
      .from("patient_charge_payments")
      .select("amount_php, patient_charges!inner(provider_id)")
      .eq("tenant_id", tenantId)
      .eq("patient_charges.provider_id", profile.id)
      .gte("paid_at", todayStart)
      .lt("paid_at", tomorrowStart);
    revenueToday = ((paymentsRaw as { amount_php: number }[]) ?? []).reduce((s, p) => s + Number(p.amount_php), 0);
  }

  // ── Provider Overview (clinic-wide roles only) — per-doctor today's numbers + real next-available slot ──
  let providerOverview: ProviderOverviewRow[] = [];
  if (!isDoctor && doctors.length > 0) {
    const doctorIds = doctors.map((d) => d.id);
    const dow = weekdayMon0(today);
    const [{ data: schedulesRaw }, { data: dateAvailRaw }, { data: timeBlocksRaw }] = await Promise.all([
      supabase.from("provider_schedules").select("id, provider_id, day_of_week, start_time, end_time, patient_bookable").in("provider_id", doctorIds).eq("day_of_week", dow),
      supabase.from("provider_date_availability").select("id, provider_id, avail_date, start_time, end_time, patient_bookable").in("provider_id", doctorIds).eq("avail_date", today),
      supabase.from("provider_time_blocks").select("id, provider_id, block_date, start_time, end_time, reason").in("provider_id", doctorIds).eq("block_date", today),
    ]);
    const availability = buildAvailability(
      doctorIds,
      [today],
      (schedulesRaw as any[]) ?? [],
      (dateAvailRaw as any[]) ?? [],
      (timeBlocksRaw as any[]) ?? []
    );

    const nowPh = new Date(Date.now() + 8 * 60 * 60 * 1000);
    const nowMin = nowPh.getUTCHours() * 60 + nowPh.getUTCMinutes();

    providerOverview = doctors.map((d) => {
      const apptsForDoctor = todaysAppts.filter((a) => a.provider_id === d.id);
      const patientsTodayForDoctor = new Set(apptsForDoctor.filter((a) => !NOT_COUNTED.has(a.status)).map((a) => a.patients?.id).filter(Boolean)).size;
      const waitingForDoctor = apptsForDoctor.filter((a) => a.status === "checked_in" || a.status === "waiting").length;
      const completedForDoctor = apptsForDoctor.filter((a) => a.status === "completed").length;

      const avail = availability[d.id]?.[today];
      let nextAvailable: string | null = null;
      let fullyBooked = false;
      let notWorkingToday = false;
      if (!avail || avail.ranges.length === 0) {
        notWorkingToday = true;
      } else {
        const bookedRanges = apptsForDoctor
          .filter((a) => !NOT_COUNTED.has(a.status))
          .map((a) => ({ startMin: timeToMin(new Date(a.start_at).toLocaleTimeString("en-GB", { hour12: false, timeZone: "Asia/Manila" }).slice(0, 5)), endMin: timeToMin(new Date(a.end_at).toLocaleTimeString("en-GB", { hour12: false, timeZone: "Asia/Manila" }).slice(0, 5)) }));
        const cuts = cutsFor(avail, bookedRanges);
        const slots = computeBookableSlots(avail.ranges, cuts, SLOT_MINUTES).filter((s) => s.startMin >= nowMin);
        if (slots.length === 0) {
          fullyBooked = true;
        } else {
          const h = Math.floor(slots[0].startMin / 60);
          const m = slots[0].startMin % 60;
          const period = h >= 12 ? "PM" : "AM";
          const h12 = h % 12 === 0 ? 12 : h % 12;
          nextAvailable = `${h12}:${String(m).padStart(2, "0")} ${period}`;
        }
      }

      return {
        id: d.id,
        name: `${d.title ? d.title + " " : ""}${d.full_name ?? "—"}`,
        patientsToday: patientsTodayForDoctor,
        waiting: waitingForDoctor,
        completed: completedForDoctor,
        nextAvailable,
        fullyBooked,
        notWorkingToday,
      };
    });
  }

  return {
    today,
    walkInOnly,
    clinicName: clinicSettings?.clinic_name ?? null,
    patientsToday,
    walkInsToday,
    newPatientsToday: newPatientsToday ?? 0,
    apptBuckets,
    queue,
    avgWaitMinutes,
    upcoming,
    followUpsDue,
    resultsRequiringAttention,
    resultsRequiringAttentionCount,
    unreadMessages: unreadMessages ?? 0,
    incomingReferrals: incomingReferrals ?? 0,
    revenueToday,
    providerOverview,
  };
}

export type DashboardData = Awaited<ReturnType<typeof getDashboardData>>;
