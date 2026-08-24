"use client";

import { useState, useTransition } from "react";
import { saveNotificationPreferencesAction } from "./actions";

// Curated, fixed catalog of events this app can actually raise today.
// There's no DB table for this — it's just code, kept in sync by hand
// with what actually happens elsewhere in the app.
const EVENTS = [
  {
    key: "new_appointment",
    label: "New appointment booked",
    description: "A patient or staff member books a new appointment on your calendar.",
  },
  {
    key: "appointment_cancelled",
    label: "Appointment cancelled or no-show",
    description: "An upcoming appointment is cancelled, or marked as a no-show.",
  },
  {
    key: "incoming_records_transfer",
    label: "Records Exchange: a colleague sent you a patient's records",
    description: "Another clinic or provider transfers a patient's records to you.",
  },
  {
    key: "lab_result_ready",
    label: "A lab result is ready for review",
    description: "A new lab result comes in and is waiting for your review.",
  },
  {
    key: "encounter_needs_signature",
    label: "An encounter is completed but not yet signed",
    description: "A completed encounter is still missing your signature.",
  },
] as const;

type ExistingRow = { event_key: string; in_app: boolean; email: boolean };

type PrefState = Record<string, { inApp: boolean; email: boolean }>;

function buildInitialState(existing: ExistingRow[]): PrefState {
  const byKey = new Map(existing.map((row) => [row.event_key, row]));
  const state: PrefState = {};
  for (const event of EVENTS) {
    const row = byKey.get(event.key);
    // Defaults match the RPC's own defaults: In-app on, Email off.
    state[event.key] = {
      inApp: row ? row.in_app : true,
      email: row ? row.email : false,
    };
  }
  return state;
}

export function NotificationsForm({ existing }: { existing: ExistingRow[] }) {
  const [prefs, setPrefs] = useState<PrefState>(() => buildInitialState(existing));
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);

  function toggle(eventKey: string, channel: "inApp" | "email") {
    setPrefs((prev) => ({
      ...prev,
      [eventKey]: { ...prev[eventKey], [channel]: !prev[eventKey][channel] },
    }));
  }

  function save() {
    setMessage(null);
    startTransition(async () => {
      try {
        await saveNotificationPreferencesAction(
          EVENTS.map((event) => ({
            eventKey: event.key,
            inApp: prefs[event.key].inApp,
            email: prefs[event.key].email,
          }))
        );
        setMessage("Saved.");
      } catch (e: any) {
        setMessage(`Error: ${e.message}`);
      }
    });
  }

  return (
    <div style={{ display: "grid", gap: 14 }}>
      <div
        style={{
          background: "#fff7e6",
          border: "1px solid #e6c66b",
          borderRadius: 10,
          padding: "10px 14px",
          fontSize: 12.5,
          color: "#7a5c12",
        }}
      >
        These preferences are saved and ready — delivery (email/in-app alerts) will start going out once
        notification delivery is built.
      </div>

      <div style={{ background: "var(--card-bg)", border: "1px solid var(--card-border)", borderRadius: 12, padding: 24, display: "grid", gap: 4 }}>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 64px 64px",
            gap: 8,
            fontSize: 11,
            fontWeight: 600,
            color: "#999",
            textTransform: "uppercase",
            letterSpacing: 0.3,
            padding: "0 0 8px",
            borderBottom: "1px solid #eee",
          }}
        >
          <span>Event</span>
          <span style={{ textAlign: "center" }}>In-app</span>
          <span style={{ textAlign: "center" }}>Email</span>
        </div>

        {EVENTS.map((event) => (
          <div
            key={event.key}
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 64px 64px",
              gap: 8,
              alignItems: "center",
              padding: "12px 0",
              borderBottom: "1px solid #f2f2f2",
            }}
          >
            <div>
              <div style={{ fontSize: 13.5, fontWeight: 600, color: "#222" }}>{event.label}</div>
              <div style={{ fontSize: 12, color: "#888", marginTop: 2 }}>{event.description}</div>
            </div>
            <div style={{ textAlign: "center" }}>
              <input
                type="checkbox"
                checked={prefs[event.key].inApp}
                onChange={() => toggle(event.key, "inApp")}
                style={{ width: 16, height: 16, cursor: "pointer" }}
              />
            </div>
            <div style={{ textAlign: "center" }}>
              <input
                type="checkbox"
                checked={prefs[event.key].email}
                onChange={() => toggle(event.key, "email")}
                style={{ width: 16, height: 16, cursor: "pointer" }}
              />
            </div>
          </div>
        ))}

        <div style={{ display: "flex", alignItems: "center", gap: 12, marginTop: 10 }}>
          <button onClick={save} disabled={pending} style={buttonStyle}>
            {pending ? "Saving..." : "Save"}
          </button>
          {message && <span style={{ fontSize: 12, color: message.startsWith("Error") ? "crimson" : "#1a7f37" }}>{message}</span>}
        </div>
      </div>
    </div>
  );
}

const buttonStyle: React.CSSProperties = {
  padding: "9px 18px",
  borderRadius: 8,
  border: "none",
  background: "#0c1730",
  color: "#e6c66b",
  fontWeight: 700,
  fontSize: 13,
  cursor: "pointer",
};
