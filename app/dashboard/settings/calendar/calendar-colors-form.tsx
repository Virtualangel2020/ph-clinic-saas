"use client";

import { useState, useTransition } from "react";
import { setCalendarColorsAction } from "../actions";
import { STATUS_LABEL as STATUS_LABELS } from "../../calendar/status-constants";

const AVAILABILITY_LABELS: Record<string, string> = { available: "Available", unavailable: "Unavailable" };

export function CalendarColorsForm({ statusColors, availabilityColors }: { statusColors: Record<string, string>; availabilityColors: Record<string, string> }) {
  const [status, setStatus] = useState(statusColors);
  const [availability, setAvailability] = useState(availabilityColors);
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);

  function save() {
    startTransition(async () => {
      try {
        await setCalendarColorsAction(status, availability);
        setMessage("Saved.");
      } catch (e: any) {
        setMessage(`Error: ${e.message}`);
      }
    });
  }

  return (
    <div style={{ background: "white", border: "1px solid #e2e2e5", borderRadius: 12, padding: 22 }}>
      <h2 style={{ fontSize: 15, marginTop: 0, marginBottom: 4 }}>Appointment status colors</h2>
      <p style={{ color: "#888", fontSize: 12, marginBottom: 14 }}>
        Shown on the calendar as a color dot plus a text label — status is never conveyed by color alone.
      </p>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))", gap: 10, marginBottom: 20 }}>
        {Object.entries(STATUS_LABELS).map(([key, label]) => (
          <div key={key} style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <input type="color" value={status[key] ?? "#999999"} onChange={(e) => setStatus((s) => ({ ...s, [key]: e.target.value }))} style={{ width: 28, height: 26, border: "none", background: "none" }} />
            <span style={{ fontSize: 12.5 }}>{label}</span>
          </div>
        ))}
      </div>

      <h2 style={{ fontSize: 15, marginTop: 0, marginBottom: 4 }}>Availability colors</h2>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))", gap: 10, marginBottom: 18 }}>
        {Object.entries(AVAILABILITY_LABELS).map(([key, label]) => (
          <div key={key} style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <input type="color" value={availability[key] ?? "#e5e7eb"} onChange={(e) => setAvailability((a) => ({ ...a, [key]: e.target.value }))} style={{ width: 28, height: 26, border: "none", background: "none" }} />
            <span style={{ fontSize: 12.5 }}>{label}</span>
          </div>
        ))}
      </div>

      {message && <p style={{ fontSize: 12.5, color: message.startsWith("Error") ? "crimson" : "#1a7f37", marginBottom: 10 }}>{message}</p>}
      <button
        onClick={save}
        disabled={pending}
        style={{ background: "#0c1730", color: "#e6c66b", fontWeight: 700, fontSize: 13, padding: "9px 18px", borderRadius: 8, border: "none", cursor: pending ? "default" : "pointer", opacity: pending ? 0.7 : 1 }}
      >
        {pending ? "Saving…" : "Save Colors"}
      </button>
    </div>
  );
}
