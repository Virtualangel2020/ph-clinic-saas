"use client";

import { useState, useTransition } from "react";
import { setProviderWeekScheduleAction } from "../actions";

type Provider = { id: string; full_name: string; title: string | null };
type ScheduleRow = { provider_id: string; day_of_week: number; start_time: string; end_time: string; is_active: boolean };

const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

function defaultWeek(existing: ScheduleRow[], providerId: string) {
  return Array.from({ length: 7 }, (_, dow) => {
    const row = existing.find((r) => r.provider_id === providerId && r.day_of_week === dow);
    return row
      ? { dayOfWeek: dow, startTime: row.start_time.slice(0, 5), endTime: row.end_time.slice(0, 5), isActive: row.is_active }
      : { dayOfWeek: dow, startTime: "08:00", endTime: "17:00", isActive: dow < 5 };
  });
}

// One provider's weekly template — saved as all 7 days at once. A provider
// with no rows yet just gets the sensible Mon-Fri 8-5 defaults shown here
// until Save is pressed; nothing is written until then, so the calendar
// grid shows no shading for them in the meantime (see availability.ts).
function ProviderWeekEditor({ provider, existing }: { provider: Provider; existing: ScheduleRow[] }) {
  const [week, setWeek] = useState(() => defaultWeek(existing, provider.id));
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);
  const configured = existing.some((r) => r.provider_id === provider.id);

  function update(dow: number, patch: Partial<(typeof week)[number]>) {
    setWeek((prev) => prev.map((d) => (d.dayOfWeek === dow ? { ...d, ...patch } : d)));
  }

  function save() {
    setMessage(null);
    startTransition(async () => {
      try {
        await setProviderWeekScheduleAction(provider.id, week);
        setMessage("Saved.");
      } catch (e: any) {
        setMessage(`Error: ${e.message}`);
      }
    });
  }

  return (
    <div style={{ border: "1px solid #eee", borderRadius: 8, padding: "10px 12px", marginBottom: 10 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
        <div style={{ fontWeight: 700, fontSize: 13 }}>
          {provider.title ? `${provider.title} ` : ""}
          {provider.full_name}
        </div>
        {!configured && <span style={{ fontSize: 10.5, color: "#999" }}>Not set up yet — no shading on the calendar until saved</span>}
      </div>
      <div style={{ display: "grid", gap: 6 }}>
        {week.map((d) => (
          <div key={d.dayOfWeek} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12.5 }}>
            <label style={{ display: "flex", alignItems: "center", gap: 5, width: 90, flexShrink: 0 }}>
              <input type="checkbox" checked={d.isActive} disabled={pending} onChange={(e) => update(d.dayOfWeek, { isActive: e.target.checked })} />
              {DAYS[d.dayOfWeek]}
            </label>
            <input
              type="time"
              value={d.startTime}
              disabled={pending || !d.isActive}
              onChange={(e) => update(d.dayOfWeek, { startTime: e.target.value })}
              style={{ border: "1px solid #ddd", borderRadius: 6, padding: "4px 6px", fontSize: 12, opacity: d.isActive ? 1 : 0.5 }}
            />
            <span style={{ color: "#999" }}>–</span>
            <input
              type="time"
              value={d.endTime}
              disabled={pending || !d.isActive}
              onChange={(e) => update(d.dayOfWeek, { endTime: e.target.value })}
              style={{ border: "1px solid #ddd", borderRadius: 6, padding: "4px 6px", fontSize: 12, opacity: d.isActive ? 1 : 0.5 }}
            />
            {!d.isActive && <span style={{ color: "#bbb", fontSize: 11 }}>Day off</span>}
          </div>
        ))}
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 8 }}>
        <button onClick={save} disabled={pending} style={{ background: "#0c1730", color: "#e6c66b", fontWeight: 700, fontSize: 12, padding: "6px 14px", borderRadius: 6, border: "none", cursor: "pointer" }}>
          {pending ? "Saving…" : "Save hours"}
        </button>
        {message && <span style={{ fontSize: 11.5, color: message.startsWith("Error") ? "crimson" : "#1a7f37" }}>{message}</span>}
      </div>
    </div>
  );
}

export function ProviderSchedulesManager({ providers, schedules }: { providers: Provider[]; schedules: ScheduleRow[] }) {
  return (
    <div style={{ background: "white", border: "1px solid #e2e2e5", borderRadius: 12, padding: 22 }}>
      <h2 style={{ fontSize: 15, marginTop: 0, marginBottom: 4 }}>Provider working hours</h2>
      <p style={{ color: "#888", fontSize: 12, marginBottom: 14 }}>
        Shades the calendar grid so it's obvious at a glance when a provider is and isn't working — same idea as the
        light/dark bands in most EHR schedulers. One-off exceptions (a day off, a blocked lunch) are added from the
        calendar itself, not here.
      </p>
      {providers.length === 0 ? (
        <p style={{ color: "#aaa", fontSize: 12.5 }}>No active doctors yet — add one under Settings → Users first.</p>
      ) : (
        providers.map((p) => <ProviderWeekEditor key={p.id} provider={p} existing={schedules} />)
      )}
    </div>
  );
}
