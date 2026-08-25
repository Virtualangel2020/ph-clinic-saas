"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  setClinicPatientAccessDefaultsAction,
  setProviderPatientAccessSettingsAction,
  revertProviderToClinicDefaultsAction,
  setProviderMessagingHoursAction,
  setProviderMessagingAllowedPatientsAction,
} from "../actions";
import { ClinicPatientAccessRow, ProviderOverrideRow, emptyOverride, isOverrideCustomized, toDefaultsActionInput, toOverrideActionInput } from "../shared";

const AUDIENCE_OPTIONS = [
  { value: "all_established", label: "All Established Patients" },
  { value: "upcoming_appointment", label: "Patients With Upcoming Appointments" },
  { value: "after_visit", label: "Patients After Completed Visit" },
  { value: "selected_patients", label: "Selected Patients Only" },
  { value: "custom", label: "Custom" },
];

const AVAILABILITY_OPTIONS = [
  { value: "always", label: "Always Available" },
  { value: "before_appointment", label: "Before Appointment" },
  { value: "after_appointment", label: "After Appointment" },
  { value: "before_after_appointment", label: "Before + After Appointment" },
  { value: "custom_hours", label: "Custom Time Window" },
];

const DAY_LABELS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

type Provider = { id: string; full_name: string; title: string | null };
type Patient = { id: string; first_name: string; last_name: string };
type Hour = { provider_id: string; day_of_week: number; start_time: string; end_time: string };

function cardStyle(): React.CSSProperties {
  return { background: "var(--card-bg)", border: "1px solid var(--card-border)", borderRadius: 12, padding: 20, marginBottom: 20 };
}
function labelStyle(): React.CSSProperties {
  return { fontSize: 12, fontWeight: 700, color: "#888", textTransform: "uppercase", letterSpacing: 0.4, marginBottom: 6, display: "block" };
}
function inputStyle(): React.CSSProperties {
  return { width: "100%", padding: "8px 10px", borderRadius: 8, border: "1px solid var(--input-border, #ddd)", fontSize: 13, background: "var(--input-bg, white)", color: "var(--text-heading)" };
}
function Toggle({ checked, onChange, disabled, label }: { checked: boolean; onChange: (v: boolean) => void; disabled?: boolean; label: string }) {
  return (
    <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: "var(--text-heading)", cursor: disabled ? "default" : "pointer" }}>
      <input type="checkbox" checked={checked} disabled={disabled} onChange={(e) => onChange(e.target.checked)} />
      {label}
    </label>
  );
}

type MessagingValue = {
  enabled: boolean;
  audience: string;
  availabilityMode: string;
  beforeDays: number | null;
  afterDays: number | null;
  outsideHoursBehavior: string;
  disclaimer: string;
};

function MessagingFields({ value, onChange, disabled }: { value: MessagingValue; onChange: (v: MessagingValue) => void; disabled?: boolean }) {
  return (
    <div style={{ display: "grid", gap: 12 }}>
      <Toggle checked={value.enabled} onChange={(v) => onChange({ ...value, enabled: v })} disabled={disabled} label="Patient Portal Messaging" />
      {value.enabled && (
        <>
          <div>
            <label style={labelStyle()}>Who Can Message</label>
            <select disabled={disabled} value={value.audience} onChange={(e) => onChange({ ...value, audience: e.target.value })} style={inputStyle()}>
              {AUDIENCE_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label style={labelStyle()}>When</label>
            <select disabled={disabled} value={value.availabilityMode} onChange={(e) => onChange({ ...value, availabilityMode: e.target.value })} style={inputStyle()}>
              {AVAILABILITY_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>
          {(value.availabilityMode === "before_appointment" || value.availabilityMode === "before_after_appointment") && (
            <div>
              <label style={labelStyle()}>Starting how many days before the appointment?</label>
              <input disabled={disabled} type="number" min={0} value={value.beforeDays ?? 3} onChange={(e) => onChange({ ...value, beforeDays: Number(e.target.value) })} style={{ ...inputStyle(), maxWidth: 140 }} />
            </div>
          )}
          {(value.availabilityMode === "after_appointment" || value.availabilityMode === "before_after_appointment") && (
            <div>
              <label style={labelStyle()}>For how many days after the appointment?</label>
              <input disabled={disabled} type="number" min={0} value={value.afterDays ?? 7} onChange={(e) => onChange({ ...value, afterDays: Number(e.target.value) })} style={{ ...inputStyle(), maxWidth: 140 }} />
            </div>
          )}
          <div>
            <label style={labelStyle()}>Outside Messaging Hours</label>
            <select disabled={disabled} value={value.outsideHoursBehavior} onChange={(e) => onChange({ ...value, outsideHoursBehavior: e.target.value })} style={inputStyle()}>
              <option value="allow_queue">Allow patients to send — provider replies when available</option>
              <option value="disable">Disable sending entirely</option>
            </select>
          </div>
          <div>
            <label style={labelStyle()}>Disclaimer Shown to Patients</label>
            <textarea disabled={disabled} value={value.disclaimer} onChange={(e) => onChange({ ...value, disclaimer: e.target.value })} rows={2} style={{ ...inputStyle(), resize: "vertical", fontFamily: "inherit" }} />
          </div>
        </>
      )}
    </div>
  );
}

export function MessagingManager({
  clinicDefaults,
  providers,
  overrides,
  hours,
  allowedPatients,
  patients,
}: {
  clinicDefaults: ClinicPatientAccessRow;
  providers: Provider[];
  overrides: ProviderOverrideRow[];
  hours: Hour[];
  allowedPatients: { provider_id: string; patient_id: string }[];
  patients: Patient[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const [value, setValue] = useState<MessagingValue>({
    enabled: clinicDefaults.default_messaging_enabled,
    audience: clinicDefaults.default_messaging_audience,
    availabilityMode: clinicDefaults.default_messaging_availability_mode,
    beforeDays: clinicDefaults.default_messaging_before_days,
    afterDays: clinicDefaults.default_messaging_after_days,
    outsideHoursBehavior: clinicDefaults.default_messaging_outside_hours_behavior,
    disclaimer: clinicDefaults.default_messaging_disclaimer ?? "Portal messaging is not intended for emergencies.",
  });

  function saveDefaults() {
    setError(null);
    setSaved(false);
    startTransition(async () => {
      try {
        await setClinicPatientAccessDefaultsAction({
          ...toDefaultsActionInput(clinicDefaults),
          defaultMessagingEnabled: value.enabled,
          defaultMessagingAudience: value.audience,
          defaultMessagingAvailabilityMode: value.availabilityMode,
          defaultMessagingBeforeDays: value.beforeDays,
          defaultMessagingAfterDays: value.afterDays,
          defaultMessagingOutsideHoursBehavior: value.outsideHoursBehavior,
          defaultMessagingDisclaimer: value.disclaimer || null,
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
        <MessagingFields value={value} onChange={setValue} />
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 16 }}>
          <button onClick={saveDefaults} disabled={pending} style={{ background: "var(--text-heading, #0c1730)", color: "white", border: "none", borderRadius: 8, padding: "8px 18px", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
            {pending ? "Saving…" : "Save Clinic Default"}
          </button>
          {saved && !pending && <span style={{ fontSize: 12, color: "#1a7f37" }}>Saved.</span>}
          {error && <span style={{ fontSize: 12, color: "#a12a2a" }}>{error}</span>}
        </div>
      </div>

      <div style={cardStyle()}>
        <h2 style={{ fontSize: 14, marginTop: 0, marginBottom: 4 }}>Provider Overrides</h2>
        <p style={{ fontSize: 12, color: "#888", marginTop: 0, marginBottom: 14 }}>
          Turning messaging off for a provider never removes it from your subscription — it just disables the
          &quot;Send a Message&quot; button on that provider&apos;s profile.
        </p>
        {providers.length === 0 ? (
          <p style={{ fontSize: 12.5, color: "#999" }}>No active providers yet.</p>
        ) : (
          <div style={{ display: "grid", gap: 10 }}>
            {providers.map((p) => (
              <ProviderMessagingRow
                key={p.id}
                provider={p}
                override={overrides.find((o) => o.provider_id === p.id) ?? null}
                hours={hours.filter((h) => h.provider_id === p.id)}
                allowedPatientIds={allowedPatients.filter((a) => a.provider_id === p.id).map((a) => a.patient_id)}
                patients={patients}
              />
            ))}
          </div>
        )}
      </div>
    </>
  );
}

function ProviderMessagingRow({
  provider,
  override,
  hours,
  allowedPatientIds,
  patients,
}: {
  provider: Provider;
  override: ProviderOverrideRow | null;
  hours: Hour[];
  allowedPatientIds: string[];
  patients: Patient[];
}) {
  const router = useRouter();
  const [expanded, setExpanded] = useState(false);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const customized = isOverrideCustomized(override);
  const base = override ?? emptyOverride(provider.id);

  const [value, setValue] = useState<MessagingValue>({
    enabled: override?.messaging_enabled ?? false,
    audience: override?.messaging_audience ?? "all_established",
    availabilityMode: override?.messaging_availability_mode ?? "always",
    beforeDays: override?.messaging_before_days ?? null,
    afterDays: override?.messaging_after_days ?? null,
    outsideHoursBehavior: override?.messaging_outside_hours_behavior ?? "allow_queue",
    disclaimer: override?.messaging_disclaimer ?? "Portal messaging is not intended for emergencies.",
  });
  const [useOverride, setUseOverride] = useState(customized);
  const [customHours, setCustomHours] = useState<{ dayOfWeek: number; startTime: string; endTime: string }[]>(
    hours.map((h) => ({ dayOfWeek: h.day_of_week, startTime: h.start_time.slice(0, 5), endTime: h.end_time.slice(0, 5) }))
  );
  const [selectedPatients, setSelectedPatients] = useState<string[]>(allowedPatientIds);
  const [patientSearch, setPatientSearch] = useState("");

  function addHourRow() {
    setCustomHours([...customHours, { dayOfWeek: 1, startTime: "13:00", endTime: "16:00" }]);
  }
  function updateHourRow(i: number, patch: Partial<{ dayOfWeek: number; startTime: string; endTime: string }>) {
    setCustomHours(customHours.map((h, idx) => (idx === i ? { ...h, ...patch } : h)));
  }
  function removeHourRow(i: number) {
    setCustomHours(customHours.filter((_, idx) => idx !== i));
  }

  function save() {
    setError(null);
    startTransition(async () => {
      try {
        if (useOverride) {
          await setProviderPatientAccessSettingsAction({
            ...toOverrideActionInput(base),
            messagingEnabled: value.enabled,
            messagingAudience: value.audience,
            messagingAvailabilityMode: value.availabilityMode,
            messagingBeforeDays: value.beforeDays,
            messagingAfterDays: value.afterDays,
            messagingOutsideHoursBehavior: value.outsideHoursBehavior,
            messagingDisclaimer: value.disclaimer || null,
          });
          if (value.availabilityMode === "custom_hours") {
            await setProviderMessagingHoursAction(provider.id, customHours);
          }
          if (value.audience === "selected_patients") {
            await setProviderMessagingAllowedPatientsAction(provider.id, selectedPatients);
          }
        } else {
          await revertProviderToClinicDefaultsAction(provider.id);
        }
        router.refresh();
      } catch (e: any) {
        setError(e.message || "Couldn't save.");
      }
    });
  }

  const matchingPatients = patientSearch.trim()
    ? patients.filter((p) => `${p.first_name} ${p.last_name}`.toLowerCase().includes(patientSearch.trim().toLowerCase())).slice(0, 20)
    : patients.filter((p) => selectedPatients.includes(p.id));

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
          {expanded ? "Close" : "Customize"}
        </button>
      </div>
      {expanded && (
        <div style={{ marginTop: 14, paddingTop: 14, borderTop: "1px solid var(--card-border)" }}>
          <Toggle checked={useOverride} onChange={setUseOverride} disabled={pending} label="Customize for This Provider (uncheck to use clinic default)" />
          {useOverride && (
            <div style={{ marginTop: 12 }}>
              <MessagingFields value={value} onChange={setValue} disabled={pending} />

              {value.enabled && value.availabilityMode === "custom_hours" && (
                <div style={{ marginTop: 12 }}>
                  <label style={labelStyle()}>Custom Messaging Hours</label>
                  <div style={{ display: "grid", gap: 8 }}>
                    {customHours.map((h, i) => (
                      <div key={i} style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                        <select value={h.dayOfWeek} onChange={(e) => updateHourRow(i, { dayOfWeek: Number(e.target.value) })} style={{ ...inputStyle(), width: 130 }}>
                          {DAY_LABELS.map((d, idx) => (
                            <option key={idx} value={idx}>
                              {d}
                            </option>
                          ))}
                        </select>
                        <input type="time" value={h.startTime} onChange={(e) => updateHourRow(i, { startTime: e.target.value })} style={{ ...inputStyle(), width: 110 }} />
                        <span style={{ fontSize: 12, color: "#888" }}>to</span>
                        <input type="time" value={h.endTime} onChange={(e) => updateHourRow(i, { endTime: e.target.value })} style={{ ...inputStyle(), width: 110 }} />
                        <button onClick={() => removeHourRow(i)} style={{ background: "none", border: "none", color: "#a12a2a", fontSize: 12, cursor: "pointer" }}>
                          Remove
                        </button>
                      </div>
                    ))}
                    <button
                      onClick={addHourRow}
                      style={{ fontSize: 12, fontWeight: 600, color: "var(--text-heading)", background: "none", border: "1px solid var(--input-border, #ddd)", borderRadius: 8, padding: "6px 12px", cursor: "pointer", width: "fit-content" }}
                    >
                      + Add Time Window
                    </button>
                  </div>
                </div>
              )}

              {value.enabled && value.audience === "selected_patients" && (
                <div style={{ marginTop: 12 }}>
                  <label style={labelStyle()}>Selected Patients</label>
                  <input placeholder="Search patients by name…" value={patientSearch} onChange={(e) => setPatientSearch(e.target.value)} style={inputStyle()} />
                  <div style={{ display: "grid", gap: 4, marginTop: 8, maxHeight: 180, overflowY: "auto" }}>
                    {matchingPatients.map((p) => (
                      <Toggle
                        key={p.id}
                        checked={selectedPatients.includes(p.id)}
                        onChange={() => setSelectedPatients((prev) => (prev.includes(p.id) ? prev.filter((x) => x !== p.id) : [...prev, p.id]))}
                        label={`${p.first_name} ${p.last_name}`}
                      />
                    ))}
                    {matchingPatients.length === 0 && <span style={{ fontSize: 12, color: "#999" }}>No matches.</span>}
                  </div>
                </div>
              )}
            </div>
          )}
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 14 }}>
            <button onClick={save} disabled={pending} style={{ background: "var(--text-heading, #0c1730)", color: "white", border: "none", borderRadius: 8, padding: "7px 16px", fontSize: 12.5, fontWeight: 600, cursor: "pointer" }}>
              {pending ? "Saving…" : "Save"}
            </button>
            {error && <span style={{ fontSize: 12, color: "#a12a2a" }}>{error}</span>}
          </div>
        </div>
      )}
    </div>
  );
}
