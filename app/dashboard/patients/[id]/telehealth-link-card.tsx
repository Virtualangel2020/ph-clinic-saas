"use client";

import { useState } from "react";
import { saveTelehealthLinkAction } from "../actions";

const CARD: React.CSSProperties = { background: "var(--card-bg)", border: "1px solid var(--card-border)", borderRadius: 12, padding: 18 };
const CARD_TITLE: React.CSSProperties = { fontSize: 12, fontWeight: 700, color: "#666", textTransform: "uppercase", letterSpacing: 0.4, marginBottom: 8 };

// Angel: "for the meeting link, just leave it blank. Whatever the doctor
// put in there, the patient will see. Just have to click on it and it will
// redirect them. as simple as that" — no picker, no auto-generation, no
// validation. Whatever URL is pasted here is remembered for this
// provider+patient pair and reused for every future telehealth
// appointment between them (provider_patient_telehealth_links); a
// per-appointment override lives on the booking form instead of here.
export function TelehealthLinkCard({ patientId, providerId, initialUrl }: { patientId: string; providerId: string; initialUrl: string | null }) {
  const [url, setUrl] = useState(initialUrl ?? "");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    setSaving(true);
    setSaved(false);
    setError(null);
    try {
      await saveTelehealthLinkAction(patientId, providerId, url.trim());
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (e: any) {
      setError(e.message ?? "Couldn't save the link.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div style={CARD}>
      <div style={CARD_TITLE}>Telehealth link</div>
      <p style={{ fontSize: 12, color: "#888", margin: "0 0 10px" }}>
        Paste your meeting link here (Zoom, Google Meet, Messenger, anything). It's remembered for this patient and shown on every telehealth appointment they book with
        you — they just click it.
      </p>
      <div style={{ display: "flex", gap: 8 }}>
        <input
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="https://meet.google.com/…"
          style={{ flex: 1, padding: "8px 10px", borderRadius: 8, border: "1px solid var(--input-border)", fontSize: 13, minWidth: 0 }}
        />
        <button
          onClick={save}
          disabled={saving}
          style={{ padding: "8px 14px", borderRadius: 8, border: "none", background: "var(--brand-primary)", color: "white", fontWeight: 700, fontSize: 13, cursor: "pointer", whiteSpace: "nowrap" }}
        >
          {saving ? "Saving…" : saved ? "Saved ✓" : "Save"}
        </button>
      </div>
      {error && <p style={{ color: "crimson", fontSize: 12, marginTop: 6 }}>{error}</p>}
    </div>
  );
}
