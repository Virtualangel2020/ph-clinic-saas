"use client";

import { useState, useTransition } from "react";
import { addPatientAlertAction, deactivatePatientAlertAction } from "../actions";

type Alert = { id: string; category: "red" | "yellow" | "blue"; message: string; created_at: string; kind?: "alert" | "note"; user_profiles?: { full_name: string | null } | null };

const CATEGORY_STYLE: Record<Alert["category"], { bg: string; border: string; text: string; label: string }> = {
  red: { bg: "#fdecec", border: "#f3c2c2", text: "#a12a2a", label: "Alert (clinical/safety)" },
  yellow: { bg: "#fff7e6", border: "#e6c66b", text: "#7a5c12", label: "Billing/administrative" },
  blue: { bg: "#eaf1fd", border: "#bcd4f7", text: "#1a4e8a", label: "General/informational" },
};

// ECW-style sticky notes at the top of the patient chart. Red/yellow/blue
// per the user's own spec — red for clinical alerts like allergies, yellow
// and blue for whatever else a clinic needs surfaced the moment staff open
// this patient's record. The X only hides an alert for THIS viewing (local
// state, resets on reload) — it never deactivates it in the DB. Only
// "Remove" does that, and it's a deliberate separate action.
export function PatientAlertsBanner({ patientId, alerts }: { patientId: string; alerts: Alert[] }) {
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());
  const [showAdd, setShowAdd] = useState(false);
  const [kind, setKind] = useState<"alert" | "note">("alert");
  const [category, setCategory] = useState<Alert["category"]>("red");
  const [message, setMessage] = useState("");
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [removing, setRemoving] = useState<Set<string>>(new Set());

  const visible = alerts.filter((a) => !dismissed.has(a.id));

  function addAlert() {
    setError(null);
    if (!message.trim()) return setError("Enter an alert message.");
    startTransition(async () => {
      try {
        await addPatientAlertAction(patientId, category, message.trim(), kind);
        setMessage("");
        setShowAdd(false);
      } catch (e: any) {
        setError(e.message);
      }
    });
  }

  function remove(id: string) {
    setRemoving((prev) => new Set(prev).add(id));
    startTransition(async () => {
      try {
        await deactivatePatientAlertAction(id, patientId);
      } catch (e: any) {
        setError(e.message);
        setRemoving((prev) => {
          const next = new Set(prev);
          next.delete(id);
          return next;
        });
      }
    });
  }

  return (
    <div style={{ marginBottom: 14 }}>
      {visible.map((a) => {
        const s = CATEGORY_STYLE[a.category];
        return (
          <div
            key={a.id}
            style={{
              display: "flex",
              alignItems: "flex-start",
              gap: 10,
              background: s.bg,
              border: `1px solid ${s.border}`,
              borderRadius: 8,
              padding: "10px 12px",
              marginBottom: 6,
              opacity: removing.has(a.id) ? 0.5 : 1,
            }}
          >
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 10.5, fontWeight: 700, color: s.text, textTransform: "uppercase", letterSpacing: 0.3, marginBottom: 2 }}>
                {a.kind === "note" ? "Note" : s.label}
              </div>
              <div style={{ fontSize: 13, color: "#333" }}>{a.message}</div>
              {a.user_profiles?.full_name && <div style={{ fontSize: 11, color: "#888", marginTop: 2 }}>{a.user_profiles.full_name}</div>}
            </div>
            <button
              onClick={() => remove(a.id)}
              disabled={pending}
              title="Remove permanently"
              style={{ background: "none", border: "1px solid transparent", color: s.text, opacity: 0.65, cursor: "pointer", fontSize: 11, padding: "2px 6px" }}
            >
              Remove
            </button>
            <button
              onClick={() => setDismissed((prev) => new Set(prev).add(a.id))}
              title="Close for now (shows again next time you open this chart)"
              style={{ background: "none", border: "none", color: s.text, cursor: "pointer", fontSize: 15, fontWeight: 700, lineHeight: 1, padding: "0 2px" }}
            >
              ×
            </button>
          </div>
        );
      })}

      {showAdd ? (
        <div style={{ background: "var(--card-bg)", border: "1px solid var(--card-border)", borderRadius: 8, padding: 12 }}>
          <div style={{ display: "flex", gap: 14, marginBottom: 8, fontSize: 12.5 }}>
            <label style={{ display: "flex", alignItems: "center", gap: 5, cursor: "pointer" }}>
              <input type="radio" checked={kind === "alert"} onChange={() => setKind("alert")} />
              Alert
            </label>
            <label style={{ display: "flex", alignItems: "center", gap: 5, cursor: "pointer" }}>
              <input type="radio" checked={kind === "note"} onChange={() => setKind("note")} />
              Note only
            </label>
          </div>
          {kind === "alert" && (
          <div style={{ display: "flex", gap: 8, marginBottom: 8, flexWrap: "wrap" }}>
            {(["red", "yellow", "blue"] as const).map((c) => (
              <label key={c} style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 12, cursor: "pointer" }}>
                <input type="radio" name="alert-category" checked={category === c} onChange={() => setCategory(c)} />
                <span style={{ width: 10, height: 10, borderRadius: "50%", background: CATEGORY_STYLE[c].text, display: "inline-block" }} />
                {CATEGORY_STYLE[c].label}
              </label>
            ))}
          </div>
          )}
          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder={kind === "note" ? "e.g. Prefers morning appointments" : "e.g. Allergic to penicillin"}
            style={{ width: "100%", boxSizing: "border-box", border: "1px solid var(--input-border)", borderRadius: 6, padding: "8px 10px", fontSize: 13, fontFamily: "inherit", minHeight: 44, marginBottom: 8 }}
          />
          {error && <div style={{ fontSize: 12, color: "crimson", marginBottom: 8 }}>{error}</div>}
          <div style={{ display: "flex", gap: 8 }}>
            <button onClick={addAlert} disabled={pending} style={{ background: "#0c1730", color: "white", border: "none", borderRadius: 6, padding: "7px 14px", fontSize: 12.5, cursor: "pointer", fontWeight: 600 }}>
              Add alert
            </button>
            <button onClick={() => { setShowAdd(false); setError(null); }} disabled={pending} style={{ background: "var(--card-bg)", color: "#666", border: "1px solid var(--input-border)", borderRadius: 6, padding: "7px 14px", fontSize: 12.5, cursor: "pointer" }}>
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <button
          onClick={() => setShowAdd(true)}
          style={{ background: "none", border: "1px dashed #ccc", color: "#888", borderRadius: 8, padding: "6px 12px", fontSize: 12, cursor: "pointer" }}
        >
          + Add alert
        </button>
      )}
    </div>
  );
}
