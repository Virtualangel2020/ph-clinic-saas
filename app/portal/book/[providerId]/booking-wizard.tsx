"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { buildAvailability, type DateAvailabilityRow, type ScheduleRow, type TimeBlockRow } from "@/app/dashboard/calendar/availability";
import { classifyDate, computeBookableSlots, cutsFor, type DateBookingStatus } from "@/app/dashboard/calendar/bookable-slots";
import { addDays, formatDayLabel, formatMonthLabel, monthGridStart, startOfMonth, todayPh } from "@/app/dashboard/calendar/date-utils";
import { minutesOfDayPh } from "@/app/dashboard/calendar/time-grid";
import type { EffectivePatientAccessSettings } from "@/lib/patient-access";
import { fetchProviderAvailabilityAction, bookAppointmentAction, submitPortalAppointmentRequestAction, recordPolicyAcknowledgementAction } from "../actions";

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
};
type Hmo = { id: string; hmo_name: string; verification_requirement: string; patient_instructions: string | null };

const NAVY = "#0c1730";
const STEPS_SLOT = ["Choose Visit", "Choose Date", "Choose Time", "How Will You Pay?", "Review"];
const STEPS_REQUEST = ["Choose Visit", "Preferred Time", "How Will You Pay?", "Review"];

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
  patientId,
  provider,
  clinicName,
  effective,
  services,
  hmos,
  financialActive,
}: {
  patientId: string;
  provider: { id: string; fullName: string; title: string | null };
  clinicName: string | null;
  effective: EffectivePatientAccessSettings;
  services: Service[];
  hmos: Hmo[];
  financialActive: boolean;
}) {
  const router = useRouter();
  const isRequestFlow = effective.bookingType === "appointment_request";
  const STEPS = isRequestFlow ? STEPS_REQUEST : STEPS_SLOT;

  const [step, setStep] = useState(0);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmedId, setConfirmedId] = useState<string | null>(null);

  const [serviceId, setServiceId] = useState<string>(services[0]?.id ?? "");
  const service = services.find((s) => s.id === serviceId) ?? null;

  // Slot-booking state
  const [month, setMonth] = useState(todayPh().slice(0, 7) + "-01");
  const [availability, setAvailability] = useState<Awaited<ReturnType<typeof fetchProviderAvailabilityAction>> | null>(null);
  const [loadingAvail, setLoadingAvail] = useState(false);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [selectedStartMin, setSelectedStartMin] = useState<number | null>(null);

  // Request-flow state
  const [preferredDate, setPreferredDate] = useState("");
  const [preferredTime, setPreferredTime] = useState("");
  const [reason, setReason] = useState("");

  const [paymentMethod, setPaymentMethod] = useState<string>("cash");
  const [hmoId, setHmoId] = useState<string>("");
  const [policyChecked, setPolicyChecked] = useState(false);

  useEffect(() => {
    if (step !== 1 || isRequestFlow) return;
    setLoadingAvail(true);
    const gridStart = monthGridStart(month);
    const rangeEnd = addDays(gridStart, 42);
    fetchProviderAvailabilityAction(provider.id, gridStart, rangeEnd)
      .then(setAvailability)
      .catch((e) => setError(e.message))
      .finally(() => setLoadingAvail(false));
  }, [step, month, provider.id, isRequestFlow]);

  const grid = useMemo(() => {
    if (!availability || !service) return [];
    const gridStart = monthGridStart(month);
    const dates = Array.from({ length: 42 }, (_, i) => addDays(gridStart, i));
    const avail = buildAvailability(
      [provider.id],
      dates,
      availability.schedules.map((s) => ({ id: "", provider_id: provider.id, ...s })) as ScheduleRow[],
      availability.date_availability.map((d) => ({ id: "", provider_id: provider.id, ...d })) as DateAvailabilityRow[],
      availability.time_blocks.map((b) => ({ id: "", provider_id: provider.id, reason: null, ...b })) as TimeBlockRow[]
    );
    const busyByDate = new Map<string, { startMin: number; endMin: number }[]>();
    for (const b of availability.busy) {
      const phDate = new Date(new Date(b.start_at).getTime() + 8 * 60 * 60 * 1000).toISOString().slice(0, 10);
      if (!busyByDate.has(phDate)) busyByDate.set(phDate, []);
      busyByDate.get(phDate)!.push({ startMin: minutesOfDayPh(b.start_at), endMin: minutesOfDayPh(b.end_at) });
    }
    const currentMonth = month.slice(0, 7);
    return dates.map((d) => {
      const dayAvail = avail[provider.id]?.[d];
      const cuts = cutsFor(dayAvail, busyByDate.get(d) ?? []);
      const status = classifyDate(dayAvail?.ranges ?? [], cuts, service.default_duration_minutes);
      return { date: d, inMonth: d.slice(0, 7) === currentMonth, status };
    });
  }, [availability, month, provider.id, service]);

  const slots = useMemo(() => {
    if (!availability || !service || !selectedDate) return [];
    const gridStart = monthGridStart(month);
    const dates = Array.from({ length: 42 }, (_, i) => addDays(gridStart, i));
    const avail = buildAvailability(
      [provider.id],
      dates,
      availability.schedules.map((s) => ({ id: "", provider_id: provider.id, ...s })) as ScheduleRow[],
      availability.date_availability.map((d) => ({ id: "", provider_id: provider.id, ...d })) as DateAvailabilityRow[],
      availability.time_blocks.map((b) => ({ id: "", provider_id: provider.id, reason: null, ...b })) as TimeBlockRow[]
    );
    const dayAvail = avail[provider.id]?.[selectedDate];
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
        setConfirmedId(id);
      } else {
        if (!selectedDate || selectedStartMin == null || !service) throw new Error("Please choose a date and time.");
        const [y, m, dd] = selectedDate.split("-").map(Number);
        const startAtUtc = new Date(Date.UTC(y, m - 1, dd, 0, 0, 0) - 8 * 60 * 60 * 1000 + selectedStartMin * 60 * 1000);
        const id = await bookAppointmentAction({
          providerId: provider.id,
          appointmentTypeId: service.id,
          startAt: startAtUtc.toISOString(),
          paymentMethod,
          hmoId: paymentMethod === "hmo" ? hmoId || null : null,
        });
        if (needsAcknowledgement) {
          await recordPolicyAcknowledgementAction({ patientId, appointmentId: id, policyVersion: effective.cancellationPolicyVersion, policySnapshot: policy });
        }
        setConfirmedId(id);
      }
    } catch (e: any) {
      setError(e.message || "Something went wrong — please try again.");
    } finally {
      setPending(false);
    }
  }

  if (confirmedId) {
    return (
      <div style={cardStyle()}>
        <h2 style={{ fontSize: 17, marginTop: 0, color: "#1a7f37" }}>{isRequestFlow ? "Request Sent" : "Appointment Confirmed"}</h2>
        <p style={{ fontSize: 13.5, color: "#444" }}>
          {isRequestFlow
            ? `Your preferred time has been sent to ${clinicName ?? "the clinic"} — they'll confirm with you directly.`
            : `You're booked with ${provider.title ? provider.title + " " : ""}${provider.fullName} on ${selectedDate ? formatDayLabel(selectedDate) : ""} at ${selectedStartMin != null ? minToLabel(selectedStartMin) : ""}.`}
        </p>
        {effective.arrivalReminderEnabled && !isRequestFlow && (
          <p style={{ fontSize: 12.5, color: "#888" }}>Please arrive {effective.arrivalReminderMinutes} minutes early.</p>
        )}
        {effective.customInstructions && <p style={{ fontSize: 12.5, color: "#888" }}>{effective.customInstructions}</p>}
        <button
          onClick={() => router.push("/portal/appointments")}
          style={{ background: NAVY, color: "#e6c66b", fontWeight: 700, fontSize: 13, padding: "9px 18px", borderRadius: 8, border: "none", cursor: "pointer" }}
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

      {step === 1 && !isRequestFlow && (
        <div style={cardStyle()}>
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
                      onClick={() => {
                        setSelectedDate(cell.date);
                        setSelectedStartMin(null);
                      }}
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
          <NavRow onBack={goBack} onNext={goNext} disabled={!selectedDate} />
        </div>
      )}

      {step === 2 && !isRequestFlow && (
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
                    color: selectedStartMin === s.startMin ? "#e6c66b" : "#1a7f37",
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
            {!isRequestFlow && <Row label="Date" value={selectedDate ? formatDayLabel(selectedDate) : ""} />}
            {!isRequestFlow && <Row label="Time" value={selectedStartMin != null ? minToLabel(selectedStartMin) : ""} />}
            {isRequestFlow && <Row label="Preferred" value={`${preferredDate || "Any date"} · ${preferredTime || "Any time"}`} />}
            {service && service.show_price_to_patient && <Row label="Price" value={priceLabel(service)} />}
            <Row label="Payment Method" value={paymentOptions.find((o) => o.value === paymentMethod)?.label ?? paymentMethod} />
            {paymentMethod === "hmo" && hmoId && <Row label="HMO" value={hmos.find((h) => h.id === hmoId)?.hmo_name ?? ""} />}
          </div>

          {(effective.customInstructions || effective.arrivalReminderEnabled) && (
            <div style={{ background: "#f4f4f5", borderRadius: 8, padding: 12, marginBottom: 12 }}>
              <div style={{ fontSize: 11.5, fontWeight: 700, color: "#888", marginBottom: 4 }}>Important Information</div>
              {effective.arrivalReminderEnabled && <p style={{ fontSize: 12, margin: "0 0 4px", color: "#444" }}>Please arrive {effective.arrivalReminderMinutes} minutes early.</p>}
              {effective.customInstructions && <p style={{ fontSize: 12, margin: 0, color: "#444" }}>{effective.customInstructions}</p>}
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
        style={{ background: NAVY, color: "#e6c66b", border: "none", borderRadius: 8, padding: "8px 18px", fontSize: 13, fontWeight: 700, cursor: disabled ? "default" : "pointer", opacity: disabled ? 0.5 : 1 }}
      >
        {nextLabel ?? "Continue →"}
      </button>
    </div>
  );
}

const navBtn: React.CSSProperties = { padding: "6px 12px", border: "1px solid #ddd", borderRadius: 8, background: "white", cursor: "pointer", fontSize: 13 };
