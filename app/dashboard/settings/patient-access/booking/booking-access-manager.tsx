"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { setClinicPatientAccessDefaultsAction, setProviderPatientAccessSettingsAction, revertProviderToClinicDefaultsAction } from "../actions";
import { ClinicPatientAccessRow, ProviderOverrideRow, emptyOverride, isOverrideCustomized, toDefaultsActionInput, toOverrideActionInput } from "../shared";

const BOOKING_TYPES = [
  { value: "walk_in", label: "Walk-In Only", patientWording: "Walk-ins welcome — no appointment needed." },
  { value: "appointment", label: "Appointment Only", patientWording: "By appointment only — book a time online." },
  { value: "both", label: "Walk-In + Appointment", patientWording: "Walk-ins welcome, or book ahead to reserve a time." },
  { value: "appointment_request", label: "Appointment Request", patientWording: "Request a preferred time — the clinic will confirm." },
  { value: "flexible", label: "Flexible / Variable Schedule", patientWording: "General hours shown — contact the clinic to check availability." },
];

const CUTOFF_OPTIONS = [
  { value: 0, label: "No minimum notice" },
  { value: 60, label: "1 hour before" },
  { value: 120, label: "2 hours before" },
  { value: 180, label: "3 hours before" },
  { value: 360, label: "6 hours before" },
  { value: 720, label: "12 hours before" },
  { value: 1440, label: "24 hours before" },
  { value: 2880, label: "48 hours before" },
];

const ADVANCE_OPTIONS = [
  { value: 7, label: "7 days" },
  { value: 14, label: "14 days" },
  { value: 30, label: "30 days" },
  { value: 60, label: "60 days" },
  { value: 90, label: "90 days" },
  { value: 180, label: "6 months" },
];

const ARRIVAL_OPTIONS = [5, 10, 15, 20, 30];

type BookingFieldValue = {
  bookingType: string;
  prioritizeScheduled: boolean;
  cutoffMinutes: number;
  advanceDays: number;
  arrivalEnabled: boolean;
  arrivalMinutes: number;
  instructions: string;
};

function cardStyle(): React.CSSProperties {
  return { background: "var(--card-bg)", border: "1px solid var(--card-border)", borderRadius: 12, padding: 20, marginBottom: 20 };
}
function labelStyle(): React.CSSProperties {
  return { fontSize: 12, fontWeight: 700, color: "#888", textTransform: "uppercase", letterSpacing: 0.4, marginBottom: 6, display: "block" };
}
function selectStyle(): React.CSSProperties {
  return { width: "100%", padding: "8px 10px", borderRadius: 8, border: "1px solid var(--input-border, #ddd)", fontSize: 13, background: "var(--input-bg, white)", color: "var(--text-heading)" };
}

function BookingFields({ value, onChange, disabled }: { value: BookingFieldValue; onChange: (v: BookingFieldValue) => void; disabled?: boolean }) {
  const selected = BOOKING_TYPES.find((b) => b.value === value.bookingType);
  return (
    <div style={{ display: "grid", gap: 14 }}>
      <div>
        <label style={labelStyle()}>How Patients Can Reach This Provider</label>
        <select disabled={disabled} value={value.bookingType} style={selectStyle()} onChange={(e) => onChange({ ...value, bookingType: e.target.value })}>
          {BOOKING_TYPES.map((b) => (
            <option key={b.value} value={b.value}>
              {b.label}
            </option>
          ))}
        </select>
        {selected && <div style={{ fontSize: 11.5, color: "#888", marginTop: 4, fontStyle: "italic" }}>Patients see: &quot;{selected.patientWording}&quot;</div>}
      </div>

      {value.bookingType === "both" && (
        <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12.5, color: "var(--text-heading)" }}>
          <input type="checkbox" disabled={disabled} checked={value.prioritizeScheduled} onChange={(e) => onChange({ ...value, prioritizeScheduled: e.target.checked })} />
          Prioritize Scheduled Patients over walk-ins
        </label>
      )}

      {(value.bookingType === "appointment" || value.bookingType === "both" || value.bookingType === "appointment_request") && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 12 }}>
          <div>
            <label style={labelStyle()}>Booking Cutoff (minimum notice)</label>
            <select disabled={disabled} value={value.cutoffMinutes} style={selectStyle()} onChange={(e) => onChange({ ...value, cutoffMinutes: Number(e.target.value) })}>
              {CUTOFF_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label style={labelStyle()}>Maximum Advance Booking</label>
            <select disabled={disabled} value={value.advanceDays} style={selectStyle()} onChange={(e) => onChange({ ...value, advanceDays: Number(e.target.value) })}>
              {ADVANCE_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>
        </div>
      )}

      <div>
        <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12.5, color: "var(--text-heading)", marginBottom: value.arrivalEnabled ? 8 : 0 }}>
          <input type="checkbox" disabled={disabled} checked={value.arrivalEnabled} onChange={(e) => onChange({ ...value, arrivalEnabled: e.target.checked })} />
          Send an Arrival Reminder
        </label>
        {value.arrivalEnabled && (
          <select disabled={disabled} value={value.arrivalMinutes} style={{ ...selectStyle(), maxWidth: 220 }} onChange={(e) => onChange({ ...value, arrivalMinutes: Number(e.target.value) })}>
            {ARRIVAL_OPTIONS.map((m) => (
              <option key={m} value={m}>
                Arrive {m} minutes early
              </option>
            ))}
          </select>
        )}
      </div>

      <div>
        <label style={labelStyle()}>Appointment Instructions (optional)</label>
        <textarea
          disabled={disabled}
          value={value.instructions}
          onChange={(e) => onChange({ ...value, instructions: e.target.value })}
          placeholder='e.g. "Please bring a valid ID and your HMO card if applicable."'
          rows={3}
          style={{ ...selectStyle(), resize: "vertical", fontFamily: "inherit" }}
        />
      </div>
    </div>
  );
}

export function BookingAccessManager({ clinicDefaults, providers, overrides }: { clinicDefaults: ClinicPatientAccessRow; providers: { id: string; full_name: string; title: string | null }[]; overrides: ProviderOverrideRow[] }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const [defaults, setDefaults] = useState<BookingFieldValue>({
    bookingType: clinicDefaults.default_booking_type,
    prioritizeScheduled: clinicDefaults.default_prioritize_scheduled,
    cutoffMinutes: clinicDefaults.booking_cutoff_minutes,
    advanceDays: clinicDefaults.max_advance_booking_days,
    arrivalEnabled: clinicDefaults.default_arrival_reminder_enabled,
    arrivalMinutes: clinicDefaults.default_arrival_reminder_minutes,
    instructions: clinicDefaults.default_appointment_instructions ?? "",
  });

  function saveDefaults() {
    setError(null);
    setSaved(false);
    startTransition(async () => {
      try {
        await setClinicPatientAccessDefaultsAction({
          ...toDefaultsActionInput(clinicDefaults),
          defaultBookingType: defaults.bookingType,
          defaultPrioritizeScheduled: defaults.prioritizeScheduled,
          bookingCutoffMinutes: defaults.cutoffMinutes,
          maxAdvanceBookingDays: defaults.advanceDays,
          defaultArrivalReminderEnabled: defaults.arrivalEnabled,
          defaultArrivalReminderMinutes: defaults.arrivalMinutes,
          defaultAppointmentInstructions: defaults.instructions || null,
        });
        setSaved(true);
        router.refresh();
      } catch (e: any) {
        setError(e.message || "Couldn't save.");
      }
    });
  }

  return (
    <>
      <div style={cardStyle()}>
        <h2 style={{ fontSize: 14, marginTop: 0, marginBottom: 14 }}>Clinic-Wide Default</h2>
        <BookingFields value={defaults} onChange={setDefaults} />
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 16 }}>
          <button
            onClick={saveDefaults}
            disabled={pending}
            style={{ background: "var(--text-heading, #0c1730)", color: "white", border: "none", borderRadius: 8, padding: "8px 18px", fontSize: 13, fontWeight: 600, cursor: "pointer" }}
          >
            {pending ? "Saving…" : "Save Clinic Default"}
          </button>
          {saved && !pending && <span style={{ fontSize: 12, color: "#1a7f37" }}>Saved.</span>}
          {error && <span style={{ fontSize: 12, color: "#a12a2a" }}>{error}</span>}
        </div>
      </div>

      <div style={cardStyle()}>
        <h2 style={{ fontSize: 14, marginTop: 0, marginBottom: 4 }}>Provider Overrides</h2>
        <p style={{ fontSize: 12, color: "#888", marginTop: 0, marginBottom: 14 }}>
          Every provider uses the clinic default above unless you customize them individually here. You never have
          to configure identical settings for every provider.
        </p>
        {providers.length === 0 ? (
          <p style={{ fontSize: 12.5, color: "#999" }}>No active providers yet.</p>
        ) : (
          <div style={{ display: "grid", gap: 10 }}>
            {providers.map((p) => (
              <ProviderRow key={p.id} provider={p} override={overrides.find((o) => o.provider_id === p.id) ?? null} />
            ))}
          </div>
        )}
      </div>
    </>
  );
}

function ProviderRow({ provider, override }: { provider: { id: string; full_name: string; title: string | null }; override: ProviderOverrideRow | null }) {
  const router = useRouter();
  const [expanded, setExpanded] = useState(false);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const customized = isOverrideCustomized(override);
  const base = override ?? emptyOverride(provider.id);

  const [value, setValue] = useState<BookingFieldValue>({
    bookingType: override?.booking_type ?? "both",
    prioritizeScheduled: override?.prioritize_scheduled ?? false,
    cutoffMinutes: override?.booking_cutoff_minutes ?? 0,
    advanceDays: override?.max_advance_booking_days ?? 30,
    arrivalEnabled: override?.arrival_reminder_enabled ?? false,
    arrivalMinutes: override?.arrival_reminder_minutes ?? 15,
    instructions: override?.custom_instructions ?? "",
  });

  function saveOverride() {
    setError(null);
    startTransition(async () => {
      try {
        await setProviderPatientAccessSettingsAction({
          ...toOverrideActionInput(base),
          bookingType: value.bookingType,
          prioritizeScheduled: value.prioritizeScheduled,
          bookingCutoffMinutes: value.cutoffMinutes,
          maxAdvanceBookingDays: value.advanceDays,
          arrivalReminderEnabled: value.arrivalEnabled,
          arrivalReminderMinutes: value.arrivalMinutes,
          customInstructions: value.instructions || null,
        });
        router.refresh();
      } catch (e: any) {
        setError(e.message || "Couldn't save.");
      }
    });
  }

  function revert() {
    setError(null);
    startTransition(async () => {
      try {
        await revertProviderToClinicDefaultsAction(provider.id);
        router.refresh();
      } catch (e: any) {
        setError(e.message || "Couldn't revert.");
      }
    });
  }

  return (
    <div style={{ border: "1px solid var(--card-border)", borderRadius: 10, padding: 14 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8 }}>
        <div>
          <div style={{ fontSize: 13.5, fontWeight: 700, color: "var(--text-heading)" }}>
            {provider.title ? `${provider.title} ` : ""}
            {provider.full_name}
          </div>
          <span
            style={{
              fontSize: 11,
              fontWeight: 600,
              color: customized ? "#7a5c12" : "#888",
              background: customized ? "#fff7e6" : "#f2f2f2",
              border: `1px solid ${customized ? "#e6c66b" : "#ddd"}`,
              borderRadius: 999,
              padding: "2px 8px",
              marginTop: 4,
              display: "inline-block",
            }}
          >
            {customized ? "Customized for This Provider" : "Using Clinic Defaults"}
          </span>
        </div>
        <button
          onClick={() => setExpanded(!expanded)}
          style={{ fontSize: 12, fontWeight: 600, color: "var(--text-heading)", background: "none", border: "1px solid var(--input-border, #ddd)", borderRadius: 8, padding: "6px 12px", cursor: "pointer" }}
        >
          {expanded ? "Close" : customized ? "Edit" : "Customize for This Provider"}
        </button>
      </div>

      {expanded && (
        <div style={{ marginTop: 14, paddingTop: 14, borderTop: "1px solid var(--card-border)" }}>
          <BookingFields value={value} onChange={setValue} disabled={pending} />
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 14 }}>
            <button
              onClick={saveOverride}
              disabled={pending}
              style={{ background: "var(--text-heading, #0c1730)", color: "white", border: "none", borderRadius: 8, padding: "7px 16px", fontSize: 12.5, fontWeight: 600, cursor: "pointer" }}
            >
              {pending ? "Saving…" : "Save Override"}
            </button>
            {customized && (
              <button
                onClick={revert}
                disabled={pending}
                style={{ background: "none", color: "#a12a2a", border: "1px solid #e6b3b3", borderRadius: 8, padding: "7px 16px", fontSize: 12.5, fontWeight: 600, cursor: "pointer" }}
              >
                Revert to Clinic Defaults
              </button>
            )}
            {error && <span style={{ fontSize: 12, color: "#a12a2a" }}>{error}</span>}
          </div>
        </div>
      )}
    </div>
  );
}
