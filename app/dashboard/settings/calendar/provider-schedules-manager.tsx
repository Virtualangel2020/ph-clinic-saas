"use client";

import { useState, useTransition } from "react";
import { deleteProviderScheduleRangeAction, setProviderScheduleRangeAction } from "../actions";

type Provider = { id: string; full_name: string; title: string | null };
type ScheduleRow = { id: string; provider_id: string; day_of_week: number; start_time: string; end_time: string; patient_bookable: boolean };

const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

// One range within one day — a real saved row once it has an id, a
// pending draft while being added. Each range independently carries
// "patients can book this" — a provider being scheduled internally does
// NOT automatically open that time to patient self-booking (spec's core
// distinction), so this checkbox defaults OFF for a brand new range.
type RangeDraft = { id: string | null; startTime: string; endTime: string; patientBookable: boolean };

function RangeRow({
  providerId,
  dayOfWeek,
  range,
  onSaved,
  onDeleted,
}: {
  providerId: string;
  dayOfWeek: number;
  range: RangeDraft;
  onSaved: (saved: RangeDraft) => void;
  onDeleted: () => void;
}) {
  const [draft, setDraft] = useState(range);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const dirty = draft.startTime !== range.startTime || draft.endTime !== range.endTime || draft.patientBookable !== range.patientBookable;

  function save() {
    setError(null);
    startTransition(async () => {
      try {
        await setProviderScheduleRangeAction({
          id: draft.id,
          providerId,
          dayOfWeek,
          startTime: draft.startTime,
          endTime: draft.endTime,
          patientBookable: draft.patientBookable,
        });
        onSaved(draft);
      } catch (e: any) {
        setError(e.message);
      }
    });
  }

  function remove() {
    if (!draft.id) return onDeleted(); // never-saved draft — just drop it locally
    startTransition(async () => {
      try {
        await deleteProviderScheduleRangeAction(draft.id!);
        onDeleted();
      } catch (e: any) {
        setError(e.message);
      }
    });
  }

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, flexWrap: "wrap" }}>
      <input type="time" value={draft.startTime} disabled={pending} onChange={(e) => setDraft((d) => ({ ...d, startTime: e.target.value }))} style={timeFieldStyle} />
      <span style={{ color: "#999" }}>–</span>
      <input type="time" value={draft.endTime} disabled={pending} onChange={(e) => setDraft((d) => ({ ...d, endTime: e.target.value }))} style={timeFieldStyle} />
      <label style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 11, color: "#555" }}>
        <input type="checkbox" checked={draft.patientBookable} disabled={pending} onChange={(e) => setDraft((d) => ({ ...d, patientBookable: e.target.checked }))} />
        Patients can book
      </label>
      {dirty && (
        <button onClick={save} disabled={pending} style={saveBtnStyle}>
          {draft.id ? "Save" : "Add"}
        </button>
      )}
      <button onClick={remove} disabled={pending} title="Remove range" style={{ background: "none", border: "none", color: "#a12a2a", cursor: "pointer", fontSize: 13 }}>
        ×
      </button>
      {error && <span style={{ color: "crimson", fontSize: 11 }}>{error}</span>}
    </div>
  );
}

function ProviderWeekEditor({ provider, existing }: { provider: Provider; existing: ScheduleRow[] }) {
  const configured = existing.some((r) => r.provider_id === provider.id);
  // Local map of day -> list of range drafts, seeded from saved rows plus
  // whatever pending (unsaved) drafts have been added this session.
  const [rangesByDay, setRangesByDay] = useState<Record<number, RangeDraft[]>>(() => {
    const map: Record<number, RangeDraft[]> = {};
    for (let d = 0; d < 7; d++) {
      map[d] = existing.filter((r) => r.provider_id === provider.id && r.day_of_week === d).map((r) => ({ id: r.id, startTime: r.start_time.slice(0, 5), endTime: r.end_time.slice(0, 5), patientBookable: r.patient_bookable }));
    }
    return map;
  });

  function addDraft(day: number) {
    setRangesByDay((prev) => ({ ...prev, [day]: [...prev[day], { id: null, startTime: "08:00", endTime: "17:00", patientBookable: false }] }));
  }
  function replaceAt(day: number, index: number, saved: RangeDraft) {
    setRangesByDay((prev) => ({ ...prev, [day]: prev[day].map((r, i) => (i === index ? saved : r)) }));
  }
  function removeAt(day: number, index: number) {
    setRangesByDay((prev) => ({ ...prev, [day]: prev[day].filter((_, i) => i !== index) }));
  }

  return (
    <div style={{ border: "1px solid #eee", borderRadius: 8, padding: "10px 12px", marginBottom: 10 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
        <div style={{ fontWeight: 700, fontSize: 13 }}>
          {provider.title ? `${provider.title} ` : ""}
          {provider.full_name}
        </div>
        {!configured && <span style={{ fontSize: 10.5, color: "#999" }}>Not set up yet — no shading on the calendar until a range is added</span>}
      </div>
      <div style={{ display: "grid", gap: 8 }}>
        {DAYS.map((label, day) => (
          <div key={day} style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
            <div style={{ width: 32, flexShrink: 0, fontWeight: 600, fontSize: 12, color: "#555", paddingTop: 4 }}>{label}</div>
            <div style={{ display: "grid", gap: 4, flex: 1 }}>
              {rangesByDay[day].length === 0 && <span style={{ fontSize: 11, color: "#bbb", paddingTop: 4 }}>Day off</span>}
              {rangesByDay[day].map((r, i) => (
                <RangeRow
                  key={r.id ?? `new-${i}`}
                  providerId={provider.id}
                  dayOfWeek={day}
                  range={r}
                  onSaved={(saved) => replaceAt(day, i, saved)}
                  onDeleted={() => removeAt(day, i)}
                />
              ))}
              <button onClick={() => addDraft(day)} style={{ background: "none", border: "none", color: "var(--text-heading)", fontSize: 11, fontWeight: 600, cursor: "pointer", textAlign: "left", padding: 0 }}>
                + Add range
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

const timeFieldStyle: React.CSSProperties = { border: "1px solid var(--input-border)", borderRadius: 6, padding: "4px 6px", fontSize: 12 };
const saveBtnStyle: React.CSSProperties = { background: "#0c1730", color: "#e6c66b", fontWeight: 700, fontSize: 11, padding: "3px 9px", borderRadius: 5, border: "none", cursor: "pointer" };

export function ProviderSchedulesManager({ providers, schedules }: { providers: Provider[]; schedules: ScheduleRow[] }) {
  return (
    <div style={{ background: "var(--card-bg)", border: "1px solid var(--card-border)", borderRadius: 12, padding: 22 }}>
      <h2 style={{ fontSize: 15, marginTop: 0, marginBottom: 4 }}>Provider working hours</h2>
      <p style={{ color: "#888", fontSize: 12, marginBottom: 14 }}>
        Shades the calendar grid so it's obvious at a glance when a provider is and isn't working. Add a second range
        on a day to carve out a lunch break. "Patients can book" is separate from being scheduled — check it only for
        the ranges you want patients able to self-book; leave it off for internal-only time. One-off exceptions and
        flexible (non-recurring) dates are managed further down.
      </p>
      {providers.length === 0 ? (
        <p style={{ color: "#aaa", fontSize: 12.5 }}>No active doctors yet — add one under Settings → Users first.</p>
      ) : (
        providers.map((p) => <ProviderWeekEditor key={p.id} provider={p} existing={schedules} />)
      )}
    </div>
  );
}
