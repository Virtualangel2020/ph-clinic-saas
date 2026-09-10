"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { buildAvailability, type DateAvailabilityRow, type ScheduleRow, type TimeBlockRow } from "@/app/dashboard/calendar/availability";
import { classifyDate, computeBookableSlots, cutsFor, type DateBookingStatus } from "@/app/dashboard/calendar/bookable-slots";
import { addDays, formatDayLabel, formatMonthLabel, monthGridStart, startOfMonth, todayPh } from "@/app/dashboard/calendar/date-utils";
import { minutesOfDayPh } from "@/app/dashboard/calendar/time-grid";
import { effectiveBookingStyleForVisit, type EffectivePatientAccessSettings, type BookingStyle } from "@/lib/patient-access";
import {
  fetchProviderAvailabilityAction,
  bookAppointmentAction,
  bookFlexibleOrWalkInAction,
  submitPortalAppointmentRequestAction,
  recordPolicyAcknowledgementAction,
  checkExistingClinicLinkAction,
  scheduleFollowUpAction,
} from "../actions";

type Service = {
  id: string;
  name: string;
  description: string | null;
  default_duration_minutes: number;
  price_php: number | null;
  price_max_php: number | null;
  price_type: string;
  show_price_to_patient: boolean;
  allow_advance_payment: boolean;
  require_advance_payment: boolean;
  delivery_mode: "in_person" | "telehealth" | "both";
};
type Hmo = { id: string; hmo_name: string; verification_requirement: string; patient_instructions: string | null };

const NAVY = "var(--brand-primary)";
const STEPS_REQUEST = ["Choose Visit", "Preferred Time", "How Will You Pay?", "Review"];

// Convert a PH-local date + minutes-of-day into a UTC ISO timestamp — same
// math bookAppointmentAction's startAtUtc already used, pulled out so the
// flexible-arrival/walk-in window calculation below can reuse it.
function phMinutesToUtcIso(dateStr: string, minutesOfDay: number): string {
  const [y, m, dd] = dateStr.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, dd, 0, 0, 0) - 8 * 60 * 60 * 1000 + minutesOfDay * 60 * 1000).toISOString();
}

function peso(n: number) {
  return `₱${Number(n).toLocaleString("en-PH")}`;
}
function priceLabel(s: Service): string {
  if (s.price_type === "free") return "Free";
  if (s.price_type === "variable") return "Variable — depends on visit";
  if (!s.show_price_to_patient || s.price_php == null) return "Price provided by clinic";
  const base = peso(s.price_php);
  if (s.price_type === "starting_at") return `Starting at ${base}`;
  if (s.price_type === "range" && s.price_max_php != null) return `${base}–${peso(s.price_max_php)}`;
  return base;
}
function minToLabel(totalMin: number): string {
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  const period = h < 12 ? "AM" : "PM";
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:${String(m).padStart(2, "0")} ${period}`;
}

function cardStyle(): React.CSSProperties {
  return { background: "white", border: "1px solid #eee", borderRadius: 12, padding: 18, marginBottom: 16 };
}

export function BookingWizard({
  provider,
  clinicName,
  effective,
  services,
  hmos,
  financialActive,
  followUpId,
  presetAppointmentTypeId,
}: {
  provider: { id: string; fullName: string; title: string | null };
  clinicName: string | null;
  effective: EffectivePatientAccessSettings;
  services: Service[];
  hmos: Hmo[];
  financialActive: boolean;
  followUpId?: string | null;
  presetAppointmentTypeId?: string | null;
}) {
  const router = useRouter();
  // Legacy request flow (bookingType is the raw, still-synced legacy
  // column — see deriveLegacyBookingType) is left exactly as it was before
  // this phase; it's a per-provider "requires clinic confirmation" flow
  // that predates booking_style and isn't part of Angel's new 3-style
  // model. Every other provider goes through the new dynamic flow below,
  // which picks specific-times / flexible-arrival / walk-in per visit —
  // including forcing specific-times for a telehealth visit regardless of
  // the provider's overall style (spec Part 7).
  const isRequestFlow = effective.bookingType === "appointment_request";

  const [step, setStep] = useState(0);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmedId, setConfirmedId] = useState<string | null>(null);
  const [confirmedMode, setConfirmedMode] = useState<"scheduled" | "flexible_arrival" | "walk_in_intent" | "request">("scheduled");

  // Deep-linked from the dashboard's "Schedule Follow-Up" button (Task
  // #136) with a specific appointment type preselected, when one is given
  // — falls back to the first service exactly like before when it isn't
  // (patient_follow_ups has no appointment_type_id column today, so the
  // dashboard doesn't send one yet; this stays ready for when it does).
  const [serviceId, setServiceId] = useState<string>(
    (presetAppointmentTypeId && services.some((s) => s.id === presetAppointmentTypeId) ? presetAppointmentTypeId : services[0]?.id) ?? ""
  );
  const [followUpStamped, setFollowUpStamped] = useState(false);
  const service = services.find((s) => s.id === serviceId) ?? null;

  // A visit type whose delivery_mode is "both" needs the patient to pick
  // in-person vs. telehealth before we know which booking style applies —
  // telehealth always forces specific-times (spec Part 7), in-person
  // follows the provider's chosen style.
  const [deliveryChoice, setDeliveryChoice] = useState<"in_person" | "telehealth" | null>(null);
  const includeDeliveryChoice = !isRequestFlow && service?.delivery_mode === "both";
  const visitStyle: BookingStyle = service ? effectiveBookingStyleForVisit(effective, service.delivery_mode, deliveryChoice ?? undefined) : effective.bookingStyle;

  const STEPS = useMemo(() => {
    if (isRequestFlow) return STEPS_REQUEST;
    const s = ["Choose Visit"];
    if (includeDeliveryChoice) s.push("In-Person or Telehealth?");
    if (visitStyle === "specific_times") s.push("Choose Date", "Choose Time");
    else if (visitStyle === "flexible_arrival") s.push("Choose Day");
    else s.push("Plan Your Visit");
    s.push("How Will You Pay?", "Review");
    return s;
  }, [isRequestFlow, includeDeliveryChoice, visitStyle]);

  const deliveryStepIndex = includeDeliveryChoice ? 1 : -1;
  const bodyStepStart = includeDeliveryChoice ? 2 : 1;
  const dateStepIndex = bodyStepStart; // "Choose Date" (specific_times) / "Choose Day" (flexible_arrival) / "Plan Your Visit" (walk_in)
  const timeStepIndex = visitStyle === "specific_times" ? bodyStepStart + 1 : -1;

  // Slot-booking state
  const [month, setMonth] = useState(todayPh().slice(0, 7) + "-01");
  const [availability, setAvailability] = useState<Awaited<ReturnType<typeof fetchProviderAvailabilityAction>> | null>(null);
  const [loadingAvail, setLoadingAvail] = useState(false);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [selectedStartMin, setSelectedStartMin] = useState<number | null>(null);
  const [expectedArrivalMin, setExpectedArrivalMin] = useState<number | null>(null);
  const [visitNotes, setVisitNotes] = useState("");

  // Request-flow state
  const [preferredDate, setPreferredDate] = useState("");
  const [preferredTime, setPreferredTime] = useState("");
  const [reason, setReason] = useState("");

  const [paymentMethod, setPaymentMethod] = useState<string>("cash");
  const [hmoId, setHmoId] = useState<string>("");
  const [policyChecked, setPolicyChecked] = useState(false);

  // Is this the patient's first time connecting with THIS provider's
  // clinic? Booking is what creates that clinic-side link (see
  // self_book_ensure_clinic_patient) — the first time it happens, the
  // provider's clinic gains access to this patient's MyCareDesk profile
  // (contact info, allergies, medications, conditions, history), so the
  // review step below asks the patient to acknowledge that explicitly.
  // Defaults to true (show the consent step) until the check resolves, so
  // a slow network never lets a first-time booking skip it.
  const [isNewProvider, setIsNewProvider] = useState(true);
  const [sharingChecked, setSharingChecked] = useState(false);

  useEffect(() => {
    checkExistingClinicLinkAction(provider.id)
      .then((alreadyLinked) => setIsNewProvider(!alreadyLinked))
      .catch(() => setIsNewProvider(true));
  }, [provider.id]);

  useEffect(() => {
    if (step !== dateStepIndex || isRequestFlow) return;
    setLoadingAvail(true);
    const gridStart = monthGridStart(month);
    const rangeEnd = addDays(gridStart, 42);
    fetchProviderAvailabilityAction(provider.id, gridStart, rangeEnd)
      .then(setAvailability)
      .catch((e) => setError(e.message))
      .finally(() => setLoadingAvail(false));
  }, [step, dateStepIndex, month, provider.id, isRequestFlow]);

  // Switching which style applies (e.g. the patient picks Telehealth on
  // the delivery-choice step, or changes visit type) invalidates whatever
  // date/time was picked under the previous style — never carry a stale
  // selection into a different flow's confirm() logic.
  useEffect(() => {
    setSelectedDate(null);
    setSelectedStartMin(null);
    setExpectedArrivalMin(null);
  }, [visitStyle]);

  // Shared per-day availability build, reused by the calendar grid, the
  // slot list, and the flexible-arrival/walk-in window calculation below —
  // one buildAvailability call per render instead of three.
  const builtAvail = useMemo(() => {
    if (!availability) return null;
    const gridStart = monthGridStart(month);
    const dates = Array.from({ length: 42 }, (_, i) => addDays(gridStart, i));
    return {
      dates,
      avail: buildAvailability(
        [provider.id],
        dates,
        availability.schedules.map((s) => ({ id: "", provider_id: provider.id, ...s })) as ScheduleRow[],
        availability.date_availability.map((d) => ({ id: "", provider_id: provider.id, ...d })) as DateAvailabilityRow[],
        availability.time_blocks.map((b) => ({ id: "", provider_id: provider.id, reason: null, ...b })) as TimeBlockRow[]
      ),
    };
  }, [availability, month, provider.id]);

  const flexibleCountByDate = useMemo(() => {
    const m = new Map<string, number>();
    for (const c of availability?.flexible_arrival_daily_counts ?? []) m.set(c.date, c.count);
    return m;
  }, [availability]);

  const grid = useMemo(() => {
    if (!availability || !service || !builtAvail) return [];
    const busyByDate = new Map<string, { startMin: number; endMin: number }[]>();
    for (const b of availability.busy) {
      const phDate = new Date(new Date(b.start_at).getTime() + 8 * 60 * 60 * 1000).toISOString().slice(0, 10);
      if (!busyByDate.has(phDate)) busyByDate.set(phDate, []);
      busyByDate.get(phDate)!.push({ startMin: minutesOfDayPh(b.start_at), endMin: minutesOfDayPh(b.end_at) });
    }
    const currentMonth = month.slice(0, 7);
    return builtAvail.dates.map((d) => {
      const dayAvail = builtAvail.avail[provider.id]?.[d];
      const cuts = cutsFor(dayAvail, busyByDate.get(d) ?? []);
      let status = classifyDate(dayAvail?.ranges ?? [], cuts, visitStyle === "specific_times" ? service.default_duration_minutes : 1);
      // Flexible-arrival capacity is a day-level cap, not a slot-duration
      // question — a day with open hours but at capacity still reads "red"
      // (Fully Booked) even though classifyDate alone would call it green.
      if (status === "green" && visitStyle === "flexible_arrival" && effective.flexibleArrivalMaxPatientsPerDay != null) {
        const count = flexibleCountByDate.get(d) ?? 0;
        if (count >= effective.flexibleArrivalMaxPatientsPerDay) status = "red";
      }
      return { date: d, inMonth: d.slice(0, 7) === currentMonth, status };
    });
  }, [availability, builtAvail, month, provider.id, service, visitStyle, effective.flexibleArrivalMaxPatientsPerDay, flexibleCountByDate]);

  // The day's published clinic-hours window (earliest patient-bookable
  // start to latest patient-bookable end) — this is what flexible-arrival
  // and walk-in-intent bookings actually reserve, per Angel's spec: the
  // whole day's hours, not a personal slot. Not a security boundary (the
  // RPC only trusts it for display math), same precedent as the existing
  // cutoff/advance-day checks.
  const selectedDayWindow = useMemo(() => {
    if (!builtAvail || !selectedDate) return null;
    const dayAvail = builtAvail.avail[provider.id]?.[selectedDate];
    const openRanges = (dayAvail?.ranges ?? []).filter((r) => r.patientBookable);
    if (openRanges.length === 0) return null;
    const startMin = Math.min(...openRanges.map((r) => r.startMin));
    const endMin = Math.max(...openRanges.map((r) => r.endMin));
    return { startMin, endMin };
  }, [builtAvail, provider.id, selectedDate]);

  const arrivalTimeOptions = useMemo(() => {
    if (!selectedDayWindow || !effective.flexibleArrivalIntervalMinutes) return [];
    const opts: number[] = [];
    for (let t = selectedDayWindow.startMin; t < selectedDayWindow.endMin; t += effective.flexibleArrivalIntervalMinutes) opts.push(t);
    return opts;
  }, [selectedDayWindow, effective.flexibleArrivalIntervalMinutes]);

  const slots = useMemo(() => {
    if (!availability || !service || !selectedDate || !builtAvail) return [];
    const dayAvail = builtAvail.avail[provider.id]?.[selectedDate];
    const openRanges = (dayAvail?.ranges ?? []).filter((r) => r.patientBookable);
    const busy = (availability.busy || [])
      .filter((b) => new Date(new Date(b.start_at).getTime() + 8 * 60 * 60 * 1000).toISOString().slice(0, 10) === selectedDate)
      .map((b) => ({ startMin: minutesOfDayPh(b.start_at), endMin: minutesOfDayPh(b.end_at) }));
    const cuts = cutsFor(dayAvail, busy);
    // Enforce the provider's booking cutoff (minimum notice) client-side too.
    const now = new Date();
    const nowPhMin = minutesOfDayPh(now.toISOString());
    const todayStr = todayPh();
    return computeBookableSlots(openRanges, cuts, service.default_duration_minutes).filter((s) => {
      if (selectedDate > todayStr) return true;
      if (selectedDate < todayStr) return false;
      return s.startMin >= nowPhMin + effective.bookingCutoffMinutes;
    });
  }, [availability, month, provider.id, service, selectedDate, effective.bookingCutoffMinutes]);

  const paymentOptions: { value: string; label: string }[] = [{ value: "cash", label: "Cash / Self-Pay" }];
  if (effective.acceptHmo) paymentOptions.push({ value: "hmo", label: "HMO" });
  if (effective.acceptYakap) paymentOptions.push({ value: "yakap", label: "PhilHealth / YAKAP" });
  const onlineUnavailable = !effective.acceptOnlinePayments && financialActive;
  if (effective.acceptOnlinePayments) paymentOptions.push({ value: "online", label: "Pay Online" });
  paymentOptions.push({ value: "other", label: "Other" });

  const policy = effective.cancellationPolicy ?? {};
  const hasNoShowFee = policy?.noShowFee?.afterCount && policy.noShowFee.afterCount !== "never";
  const requiresAdvance = !!service?.require_advance_payment;
  const needsAcknowledgement = hasNoShowFee || requiresAdvance;

  function goNext() {
    setError(null);
    setStep((s) => Math.min(s + 1, STEPS.length - 1));
  }
  function goBack() {
    setError(null);
    setStep((s) => Math.max(s - 1, 0));
  }

  async function confirm() {
    if (isNewProvider && !sharingChecked) {
      setError("Please acknowledge sharing your profile with this provider to continue.");
      return;
    }
    if (needsAcknowledgement && !policyChecked) {
      setError("Please read and acknowledge the appointment policy to continue.");
      return;
    }
    setPending(true);
    setError(null);
    try {
      if (isRequestFlow) {
        const id = await submitPortalAppointmentRequestAction({
          providerId: provider.id,
          appointmentTypeName: service?.name ?? "Consultation",
          preferredDate,
          preferredTime,
          reason,
        });
        setConfirmedMode("request");
        setConfirmedId(id);
      } else if (visitStyle === "specific_times") {
        if (!selectedDate || selectedStartMin == null || !service) throw new Error("Please choose a date and time.");
        const startAtUtc = phMinutesToUtcIso(selectedDate, selectedStartMin);
        // Booking itself creates the clinic-side patient record and portal
        // link the first time this patient connects with this provider's
        // clinic (see self_book_ensure_clinic_patient) — so the real
        // patientId only exists once bookAppointmentAction returns it,
        // never before.
        const { id, patientId } = await bookAppointmentAction({
          providerId: provider.id,
          appointmentTypeId: service.id,
          startAt: startAtUtc,
          paymentMethod,
          hmoId: paymentMethod === "hmo" ? hmoId || null : null,
        });
        if (needsAcknowledgement) {
          await recordPolicyAcknowledgementAction({ patientId, appointmentId: id, policyVersion: effective.cancellationPolicyVersion, policySnapshot: policy });
        }
        if (followUpId) {
          const result = await scheduleFollowUpAction(followUpId, id);
          setFollowUpStamped(result.ok);
        }
        setConfirmedMode("scheduled");
        setConfirmedId(id);
      } else {
        // flexible_arrival or walk_in — reserves the day's whole clinic-
        // hours window, never a personal slot (spec Parts 5-6).
        if (!selectedDate || !selectedDayWindow || !service) throw new Error("Please choose a date.");
        const bookingMode = visitStyle === "flexible_arrival" ? "flexible_arrival" : "walk_in_intent";
        const windowStart = phMinutesToUtcIso(selectedDate, selectedDayWindow.startMin);
        const windowEnd = phMinutesToUtcIso(selectedDate, selectedDayWindow.endMin);
        const { id, patientId } = await bookFlexibleOrWalkInAction({
          providerId: provider.id,
          appointmentTypeId: service.id,
          bookingMode,
          windowStart,
          windowEnd,
          expectedArrivalAt: expectedArrivalMin != null ? phMinutesToUtcIso(selectedDate, expectedArrivalMin) : null,
          paymentMethod,
          hmoId: paymentMethod === "hmo" ? hmoId || null : null,
          notes: visitNotes || undefined,
        });
        if (needsAcknowledgement) {
          await recordPolicyAcknowledgementAction({ patientId, appointmentId: id, policyVersion: effective.cancellationPolicyVersion, policySnapshot: policy });
        }
        if (followUpId) {
          const result = await scheduleFollowUpAction(followUpId, id);
          setFollowUpStamped(result.ok);
        }
        setConfirmedMode(bookingMode);
        setConfirmedId(id);
      }
    } catch (e: any) {
      setError(e.message || "Something went wrong — please try again.");
    } finally {
      setPending(false);
    }
  }

  if (confirmedId) {
    const providerLabel = `${provider.title ? provider.title + " " : ""}${provider.fullName}`;
    const dayLabel = selectedDate ? formatDayLabel(selectedDate) : "";
    const confirmedTitle = confirmedMode === "request" ? "Request Sent" : confirmedMode === "walk_in_intent" ? "Visit Planned" : "Appointment Confirmed";
    let confirmedMessage: string;
    if (confirmedMode === "request") {
      confirmedMessage = `Your preferred time has been sent to ${clinicName ?? "the clinic"} — they'll confirm with you directly.`;
    } else if (confirmedMode === "scheduled") {
      confirmedMessage = `You're booked with ${providerLabel} on ${dayLabel} at ${selectedStartMin != null ? minToLabel(selectedStartMin) : ""}.`;
    } else if (confirmedMode === "flexible_arrival") {
      confirmedMessage = `You're set with ${providerLabel} on ${dayLabel}${
        selectedDayWindow ? ` between ${minToLabel(selectedDayWindow.startMin)} and ${minToLabel(selectedDayWindow.endMin)}` : ""
      }${expectedArrivalMin != null ? ` — you shared that you plan to arrive around ${minToLabel(expectedArrivalMin)}` : ""}. This is a flexible arrival window, not a guaranteed consultation time.`;
    } else {
      confirmedMessage = `Your visit with ${providerLabel} on ${dayLabel} has been noted. Walk in anytime during the clinic's available hours${
        selectedDayWindow ? ` (${minToLabel(selectedDayWindow.startMin)}–${minToLabel(selectedDayWindow.endMin)})` : ""
      } — this isn't a guaranteed appointment time.`;
    }
    return (
      <div style={cardStyle()}>
        <h2 style={{ fontSize: 17, marginTop: 0, color: "#1a7f37" }}>{confirmedTitle}</h2>
        <p style={{ fontSize: 13.5, color: "#444" }}>{confirmedMessage}</p>
        {effective.arrivalReminderEnabled && confirmedMode === "scheduled" && (
          <p style={{ fontSize: 12.5, color: "#888" }}>Please arrive {effective.arrivalReminderMinutes} minutes early.</p>
        )}
        {effective.customInstructions && <p style={{ fontSize: 12.5, color: "#888" }}>{effective.customInstructions}</p>}
        {followUpId && followUpStamped && <p style={{ fontSize: 12.5, color: "#1a7f37" }}>Your follow-up has also been marked scheduled.</p>}
        <button
          onClick={() => router.push("/portal/appointments")}
          style={{ background: NAVY, color: "#fff", fontWeight: 700, fontSize: 13, padding: "9px 18px", borderRadius: 8, border: "none", cursor: "pointer" }}
        >
          View My Appointments
        </button>
      </div>
    );
  }

  return (
    <div>
      <div style={{ display: "flex", gap: 4, marginBottom: 14 }}>
        {STEPS.map((s, i) => (
          <div key={s} title={s} style={{ height: 5, flex: 1, borderRadius: 3, background: i <= step ? NAVY : "#e2e2e5" }} />
        ))}
      </div>
      <div style={{ fontSize: 11.5, color: "#888", marginBottom: 4 }}>
        Step {step + 1} of {STEPS.length}
      </div>
      <h2 style={{ fontSize: 16, marginTop: 0, marginBottom: 14 }}>{STEPS[step]}</h2>

      {step === 0 && (
        <div style={cardStyle()}>
          {services.length === 0 ? (
            <p style={{ fontSize: 13, color: "#888" }}>No bookable services are set up for this provider yet — please contact the clinic.</p>
          ) : (
            <div style={{ display: "grid", gap: 10 }}>
              {services.map((s) => (
                <label key={s.id} style={{ display: "flex", gap: 10, alignItems: "flex-start", border: `1px solid ${serviceId === s.id ? NAVY : "#eee"}`, borderRadius: 10, padding: 12, cursor: "pointer" }}>
                  <input type="radio" checked={serviceId === s.id} onChange={() => setServiceId(s.id)} style={{ marginTop: 3 }} />
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 700, fontSize: 13.5, color: NAVY }}>{s.name}</div>
                    {s.description && <div style={{ fontSize: 12, color: "#888" }}>{s.description}</div>}
                    <div style={{ fontSize: 12, color: "#555", marginTop: 2 }}>
                      {s.default_duration_minutes} min · {priceLabel(s)}
                    </div>
                  </div>
                </label>
              ))}
            </div>
          )}
          <NavRow onNext={goNext} disabled={!serviceId} />
        </div>
      )}

      {step === deliveryStepIndex && includeDeliveryChoice && (
        <div style={cardStyle()}>
          <div style={{ display: "grid", gap: 10 }}>
            {(["in_person", "telehealth"] as const).map((d) => (
              <label key={d} style={{ display: "flex", gap: 10, alignItems: "flex-start", border: `1px solid ${deliveryChoice === d ? NAVY : "#eee"}`, borderRadius: 10, padding: 12, cursor: "pointer" }}>
                <input type="radio" checked={deliveryChoice === d} onChange={() => setDeliveryChoice(d)} style={{ marginTop: 3 }} />
                <div>
                  <div style={{ fontWeight: 700, fontSize: 13.5, color: NAVY }}>{d === "in_person" ? "In-Person Visit" : "Telehealth (Video) Visit"}</div>
                  <div style={{ fontSize: 12, color: "#888" }}>
                    {d === "in_person" ? "Visit the clinic in person." : "A specific appointment time is required for telehealth visits."}
                  </div>
                </div>
              </label>
            ))}
          </div>
          <NavRow onBack={goBack} onNext={goNext} disabled={!deliveryChoice} />
        </div>
      )}

      {step === dateStepIndex && !isRequestFlow && visitStyle === "specific_times" && (
        <div style={cardStyle()}>
          <MonthCalendar
            month={month}
            setMonth={setMonth}
            loadingAvail={loadingAvail}
            grid={grid}
            selectedDate={selectedDate}
            onSelectDate={(d) => {
              setSelectedDate(d);
              setSelectedStartMin(null);
            }}
          />
          <NavRow onBack={goBack} onNext={goNext} disabled={!selectedDate} />
        </div>
      )}

      {step === dateStepIndex && !isRequestFlow && visitStyle === "flexible_arrival" && (
        <div style={cardStyle()}>
          <MonthCalendar month={month} setMonth={setMonth} loadingAvail={loadingAvail} grid={grid} selectedDate={selectedDate} onSelectDate={setSelectedDate} />
          {selectedDate && (
            <div style={{ marginTop: 14, paddingTop: 14, borderTop: "1px solid #eee" }}>
              {effective.flexibleArrivalMaxPatientsPerDay != null && (
                <p style={{ fontSize: 12, color: "#888", marginTop: 0 }}>
                  {Math.max(0, effective.flexibleArrivalMaxPatientsPerDay - (flexibleCountByDate.get(selectedDate) ?? 0))} spot
                  {Math.max(0, effective.flexibleArrivalMaxPatientsPerDay - (flexibleCountByDate.get(selectedDate) ?? 0)) === 1 ? "" : "s"} left this day.
                </p>
              )}
              {arrivalTimeOptions.length > 0 ? (
                <div>
                  <label style={{ fontSize: 12, fontWeight: 700, color: "#888", display: "block", marginBottom: 6 }}>When do you plan to arrive? (optional)</label>
                  <select
                    value={expectedArrivalMin ?? ""}
                    onChange={(e) => setExpectedArrivalMin(e.target.value === "" ? null : Number(e.target.value))}
                    style={{ padding: "8px 10px", borderRadius: 8, border: "1px solid #ddd", fontSize: 13, width: "100%" }}
                  >
                    <option value="">No preference</option>
                    {arrivalTimeOptions.map((t) => (
                      <option key={t} value={t}>
                        {minToLabel(t)}
                      </option>
                    ))}
                  </select>
                </div>
              ) : (
                <p style={{ fontSize: 12, color: "#888", margin: 0 }}>
                  Clinic hours: {selectedDayWindow ? `${minToLabel(selectedDayWindow.startMin)}–${minToLabel(selectedDayWindow.endMin)}` : ""}
                </p>
              )}
              <p style={{ fontSize: 11.5, color: "#999", marginTop: 8, fontStyle: "italic" }}>
                This reserves a flexible arrival window, not a guaranteed consultation time — your actual visit time may vary.
              </p>
            </div>
          )}
          <NavRow onBack={goBack} onNext={goNext} disabled={!selectedDate} />
        </div>
      )}

      {step === dateStepIndex && !isRequestFlow && visitStyle === "walk_in" && (
        <div style={cardStyle()}>
          <MonthCalendar month={month} setMonth={setMonth} loadingAvail={loadingAvail} grid={grid} selectedDate={selectedDate} onSelectDate={setSelectedDate} />
          {selectedDate && (
            <div style={{ marginTop: 14, paddingTop: 14, borderTop: "1px solid #eee" }}>
              <label style={{ fontSize: 12, fontWeight: 700, color: "#888", display: "block", marginBottom: 6 }}>Anything the clinic should know? (optional)</label>
              <textarea
                value={visitNotes}
                onChange={(e) => setVisitNotes(e.target.value)}
                rows={2}
                style={{ padding: "8px 10px", borderRadius: 8, border: "1px solid #ddd", fontSize: 13, width: "100%", fontFamily: "inherit" }}
              />
              <p style={{ fontSize: 11.5, color: "#999", marginTop: 8, fontStyle: "italic" }}>
                This lets {clinicName ?? "the clinic"} know you&apos;re planning to visit — it&apos;s not a guaranteed appointment time. Walk in during the
                clinic&apos;s available hours{selectedDayWindow ? ` (${minToLabel(selectedDayWindow.startMin)}–${minToLabel(selectedDayWindow.endMin)})` : ""}.
              </p>
            </div>
          )}
          <NavRow onBack={goBack} onNext={goNext} disabled={!selectedDate} />
        </div>
      )}

      {step === timeStepIndex && !isRequestFlow && visitStyle === "specific_times" && (
        <div style={cardStyle()}>
          <p style={{ fontSize: 13, fontWeight: 600, marginTop: 0 }}>{selectedDate ? formatDayLabel(selectedDate) : ""}</p>
          {slots.length === 0 ? (
            <p style={{ fontSize: 12.5, color: "#a12a2a" }}>No times available on this date — please go back and pick another date.</p>
          ) : (
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
              {slots.map((s, i) => (
                <button
                  key={i}
                  onClick={() => setSelectedStartMin(s.startMin)}
                  style={{
                    border: `1.5px solid ${selectedStartMin === s.startMin ? NAVY : "#cfe3d3"}`,
                    background: selectedStartMin === s.startMin ? NAVY : "#f3faf4",
                    color: selectedStartMin === s.startMin ? "var(--brand-secondary)" : "#1a7f37",
                    borderRadius: 8,
                    padding: "8px 12px",
                    fontSize: 12.5,
                    fontWeight: 600,
                    cursor: "pointer",
                  }}
                >
                  {minToLabel(s.startMin)}
                </button>
              ))}
            </div>
          )}
          <NavRow onBack={goBack} onNext={goNext} disabled={selectedStartMin == null} />
        </div>
      )}

      {step === 1 && isRequestFlow && (
        <div style={cardStyle()}>
          <div style={{ display: "grid", gap: 12 }}>
            <div>
              <label style={{ fontSize: 12, fontWeight: 700, color: "#888", display: "block", marginBottom: 4 }}>Preferred Date</label>
              <input type="date" value={preferredDate} onChange={(e) => setPreferredDate(e.target.value)} style={{ padding: "8px 10px", borderRadius: 8, border: "1px solid #ddd", fontSize: 13 }} />
            </div>
            <div>
              <label style={{ fontSize: 12, fontWeight: 700, color: "#888", display: "block", marginBottom: 4 }}>Preferred Time</label>
              <input placeholder="e.g. Morning, or 2:00 PM" value={preferredTime} onChange={(e) => setPreferredTime(e.target.value)} style={{ padding: "8px 10px", borderRadius: 8, border: "1px solid #ddd", fontSize: 13, width: "100%" }} />
            </div>
            <div>
              <label style={{ fontSize: 12, fontWeight: 700, color: "#888", display: "block", marginBottom: 4 }}>Reason for Visit (optional)</label>
              <textarea value={reason} onChange={(e) => setReason(e.target.value)} rows={2} style={{ padding: "8px 10px", borderRadius: 8, border: "1px solid #ddd", fontSize: 13, width: "100%", fontFamily: "inherit" }} />
            </div>
          </div>
          <p style={{ fontSize: 11.5, color: "#888", marginTop: 10 }}>This sends a request — {clinicName ?? "the clinic"} must confirm before it's a booked appointment.</p>
          <NavRow onBack={goBack} onNext={goNext} />
        </div>
      )}

      {step === STEPS.length - 2 && (
        <div style={cardStyle()}>
          <div>
            <label style={{ fontSize: 12, fontWeight: 700, color: "#888", display: "block", marginBottom: 6 }}>How will you pay?</label>
            <div style={{ display: "grid", gap: 8 }}>
              {paymentOptions.map((o) => (
                <label key={o.value} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, border: `1px solid ${paymentMethod === o.value ? NAVY : "#eee"}`, borderRadius: 8, padding: 10, cursor: "pointer" }}>
                  <input type="radio" checked={paymentMethod === o.value} onChange={() => setPaymentMethod(o.value)} />
                  {o.label}
                </label>
              ))}
            </div>
            {onlineUnavailable && <p style={{ fontSize: 11.5, color: "#a12a2a", marginTop: 8 }}>Online Payment — Not available for this clinic.</p>}
          </div>

          {paymentMethod === "hmo" && (
            <div style={{ marginTop: 14 }}>
              <label style={{ fontSize: 12, fontWeight: 700, color: "#888", display: "block", marginBottom: 6 }}>Which HMO?</label>
              {hmos.length === 0 ? (
                <p style={{ fontSize: 12, color: "#888" }}>Please contact the clinic for accepted HMOs.</p>
              ) : (
                <select value={hmoId} onChange={(e) => setHmoId(e.target.value)} style={{ padding: "8px 10px", borderRadius: 8, border: "1px solid #ddd", fontSize: 13, width: "100%" }}>
                  <option value="">Select an HMO…</option>
                  {hmos.map((h) => (
                    <option key={h.id} value={h.id}>
                      {h.hmo_name}
                    </option>
                  ))}
                </select>
              )}
              {hmoId && hmos.find((h) => h.id === hmoId)?.patient_instructions && (
                <p style={{ fontSize: 11.5, color: "#888", marginTop: 6 }}>{hmos.find((h) => h.id === hmoId)?.patient_instructions}</p>
              )}
              <p style={{ fontSize: 11, color: "#999", marginTop: 6 }}>
                Selecting an HMO doesn&apos;t automatically confirm coverage — the clinic will verify as needed.
              </p>
            </div>
          )}
          <NavRow onBack={goBack} onNext={goNext} />
        </div>
      )}

      {step === STEPS.length - 1 && (
        <div style={cardStyle()}>
          <div style={{ display: "grid", gap: 6, fontSize: 13, marginBottom: 14 }}>
            <Row label="Provider" value={`${provider.title ? provider.title + " " : ""}${provider.fullName}`} />
            <Row label="Visit" value={service?.name ?? ""} />
            {includeDeliveryChoice && <Row label="Delivery" value={deliveryChoice === "telehealth" ? "Telehealth" : "In-Person"} />}
            {!isRequestFlow && visitStyle === "specific_times" && <Row label="Date" value={selectedDate ? formatDayLabel(selectedDate) : ""} />}
            {!isRequestFlow && visitStyle === "specific_times" && <Row label="Time" value={selectedStartMin != null ? minToLabel(selectedStartMin) : ""} />}
            {!isRequestFlow && visitStyle === "flexible_arrival" && <Row label="Day" value={selectedDate ? formatDayLabel(selectedDate) : ""} />}
            {!isRequestFlow && visitStyle === "flexible_arrival" && (
              <Row label="Arrival Window" value={selectedDayWindow ? `${minToLabel(selectedDayWindow.startMin)}–${minToLabel(selectedDayWindow.endMin)}` : ""} />
            )}
            {!isRequestFlow && visitStyle === "flexible_arrival" && expectedArrivalMin != null && <Row label="Planned Arrival" value={minToLabel(expectedArrivalMin)} />}
            {!isRequestFlow && visitStyle === "walk_in" && <Row label="Day" value={selectedDate ? formatDayLabel(selectedDate) : ""} />}
            {!isRequestFlow && visitStyle === "walk_in" && <Row label="Type" value="Walk-in — no reserved time" />}
            {isRequestFlow && <Row label="Preferred" value={`${preferredDate || "Any date"} · ${preferredTime || "Any time"}`} />}
            {service && service.show_price_to_patient && <Row label="Price" value={priceLabel(service)} />}
            <Row label="Payment Method" value={paymentOptions.find((o) => o.value === paymentMethod)?.label ?? paymentMethod} />
            {paymentMethod === "hmo" && hmoId && <Row label="HMO" value={hmos.find((h) => h.id === hmoId)?.hmo_name ?? ""} />}
          </div>

          {(effective.customInstructions || (effective.arrivalReminderEnabled && visitStyle === "specific_times")) && (
            <div style={{ background: "#f4f4f5", borderRadius: 8, padding: 12, marginBottom: 12 }}>
              <div style={{ fontSize: 11.5, fontWeight: 700, color: "#888", marginBottom: 4 }}>Important Information</div>
              {effective.arrivalReminderEnabled && visitStyle === "specific_times" && (
                <p style={{ fontSize: 12, margin: "0 0 4px", color: "#444" }}>Please arrive {effective.arrivalReminderMinutes} minutes early.</p>
              )}
              {effective.customInstructions && <p style={{ fontSize: 12, margin: 0, color: "#444" }}>{effective.customInstructions}</p>}
            </div>
          )}

          {isNewProvider && (
            <div style={{ background: "#eef6fb", border: "1px solid #b9d9ec", borderRadius: 8, padding: 12, marginBottom: 12 }}>
              <div style={{ fontSize: 12, color: "#2a5674", marginBottom: 8 }}>
                <p style={{ margin: "0 0 6px", fontWeight: 700 }}>This is your first booking with {provider.title ? provider.title + " " : ""}{provider.fullName}.</p>
                <p style={{ margin: 0 }}>
                  By booking, your MyCareDesk health profile — contact and demographic info, allergies, medications, medical
                  conditions, and family/surgical history — will be shared with {clinicName ?? "this provider's clinic"} so
                  they can prepare for your visit.
                </p>
              </div>
              <label style={{ display: "flex", gap: 8, alignItems: "flex-start", fontSize: 12, color: "#2a5674", cursor: "pointer" }}>
                <input type="checkbox" checked={sharingChecked} onChange={(e) => setSharingChecked(e.target.checked)} style={{ marginTop: 2 }} />
                I understand and agree to share my profile with this provider.
              </label>
            </div>
          )}

          {needsAcknowledgement && (
            <div style={{ background: "#fff7e6", border: "1px solid #e6c66b", borderRadius: 8, padding: 12, marginBottom: 12 }}>
              <div style={{ fontSize: 12, color: "#7a5c12", marginBottom: 8 }}>
                {requiresAdvance && <p style={{ margin: "0 0 6px" }}>This service requires advance payment to confirm your booking.</p>}
                {hasNoShowFee && <p style={{ margin: 0 }}>A no-show fee may apply if you don&apos;t attend and don&apos;t cancel in advance — see your clinic&apos;s policy for details.</p>}
              </div>
              <label style={{ display: "flex", gap: 8, alignItems: "flex-start", fontSize: 12, color: "#7a5c12", cursor: "pointer" }}>
                <input type="checkbox" checked={policyChecked} onChange={(e) => setPolicyChecked(e.target.checked)} style={{ marginTop: 2 }} />
                I have read and understand the appointment and payment policy.
              </label>
            </div>
          )}

          {error && <p style={{ fontSize: 12, color: "#a12a2a" }}>{error}</p>}
          <NavRow onBack={goBack} onNext={confirm} nextLabel={pending ? "Confirming…" : isRequestFlow ? "Send Request" : "Confirm"} disabled={pending} />
        </div>
      )}

      {error && step < STEPS.length - 1 && <p style={{ fontSize: 12, color: "#a12a2a" }}>{error}</p>}
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: 6 }}>
      <span style={{ color: "#888", flexShrink: 0 }}>{label}</span>
      <span style={{ fontWeight: 600, color: NAVY, textAlign: "right", wordBreak: "break-word" }}>{value}</span>
    </div>
  );
}

function NavRow({ onBack, onNext, disabled, nextLabel }: { onBack?: () => void; onNext: () => void; disabled?: boolean; nextLabel?: string }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", marginTop: 16 }}>
      {onBack ? (
        <button onClick={onBack} style={{ background: "none", border: "1px solid #ddd", borderRadius: 8, padding: "8px 16px", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
          ← Back
        </button>
      ) : (
        <span />
      )}
      <button
        onClick={onNext}
        disabled={disabled}
        style={{ background: NAVY, color: "#fff", border: "none", borderRadius: 8, padding: "8px 18px", fontSize: 13, fontWeight: 700, cursor: disabled ? "default" : "pointer", opacity: disabled ? 0.5 : 1 }}
      >
        {nextLabel ?? "Continue →"}
      </button>
    </div>
  );
}

const navBtn: React.CSSProperties = { padding: "6px 12px", border: "1px solid #ddd", borderRadius: 8, background: "white", cursor: "pointer", fontSize: 13 };

// Shared month grid — used by the specific-times, flexible-arrival, and
// walk-in date steps alike (only what happens after a date is picked
// differs between the three).
function MonthCalendar({
  month,
  setMonth,
  loadingAvail,
  grid,
  selectedDate,
  onSelectDate,
}: {
  month: string;
  setMonth: (m: string) => void;
  loadingAvail: boolean;
  grid: { date: string; inMonth: boolean; status: DateBookingStatus }[];
  selectedDate: string | null;
  onSelectDate: (date: string) => void;
}) {
  return (
    <>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
        <button onClick={() => setMonth(startOfMonth(addDays(startOfMonth(month), -1)))} style={navBtn}>
          ‹
        </button>
        <div style={{ fontWeight: 700 }}>{formatMonthLabel(month)}</div>
        <button onClick={() => setMonth(startOfMonth(addDays(startOfMonth(month), 32)))} style={navBtn}>
          ›
        </button>
      </div>
      {loadingAvail ? (
        <p style={{ fontSize: 12.5, color: "#888" }}>Loading availability…</p>
      ) : (
        <>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 5, marginBottom: 4 }}>
            {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((d) => (
              <div key={d} style={{ fontSize: 10.5, fontWeight: 700, color: "#888", textAlign: "center" }}>
                {d}
              </div>
            ))}
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 5 }}>
            {grid.map((cell) => {
              const colors: Record<DateBookingStatus, { bg: string; border: string; text: string }> = {
                green: { bg: "#eaf7ec", border: "#8fd19e", text: "#1a7f37" },
                red: { bg: "#fdecec", border: "#f3a6a6", text: "#a12a2a" },
                gray: { bg: "#f4f4f5", border: "#e2e2e5", text: "#999" },
              };
              const c = colors[cell.status];
              const clickable = cell.status === "green" && cell.date >= todayPh();
              return (
                <button
                  key={cell.date}
                  disabled={!clickable}
                  onClick={() => onSelectDate(cell.date)}
                  style={{
                    height: 42,
                    borderRadius: 8,
                    border: `1.5px solid ${selectedDate === cell.date ? NAVY : c.border}`,
                    background: c.bg,
                    color: c.text,
                    fontSize: 12,
                    fontWeight: 600,
                    opacity: cell.inMonth ? 1 : 0.3,
                    cursor: clickable ? "pointer" : "default",
                  }}
                >
                  {Number(cell.date.slice(8, 10))}
                </button>
              );
            })}
          </div>
        </>
      )}
    </>
  );
}
