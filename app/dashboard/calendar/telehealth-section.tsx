"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { setAppointmentTelehealthOverrideAction } from "./actions";

const FIELD_STYLE: React.CSSProperties = { border: "1px solid var(--input-border)", borderRadius: 8, padding: "8px 10px", fontSize: 13, fontFamily: "inherit", width: "100%", boxSizing: "border-box" };

// Angel: "for the meeting link, just leave it blank. Whatever the doctor
// put in there, the patient will see. Just have to click on it and it will
// redirect them. as simple as that." Shown only when editing an existing
// appointment with a provider assigned — self-contained (fetches its own
// data) so it doesn't require threading new fields through the calendar
// page's appointment-type/patient fetch code.
export function TelehealthSection({ appointmentId, patientId, providerId }: { appointmentId: string; patientId: string; providerId: string | null }) {
  const [recurringLink, setRecurringLink] = useState<string | null>(null);
  const [override, setOverride] = useState("");
  const [loaded, setLoaded] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!providerId) {
      setLoaded(true);
      return;
    }
    let cancelled = false;
    const supabase = createClient();
    Promise.all([
      supabase.from("provider_patient_telehealth_links").select("meeting_url").eq("provider_id", providerId).eq("patient_id", patientId).maybeSingle(),
      supabase.from("appointments").select("telehealth_link_override").eq("id", appointmentId).maybeSingle(),
    ]).then(([linkRes, apptRes]) => {
      if (cancelled) return;
      setRecurringLink((linkRes.data as any)?.meeting_url ?? null);
      setOverride((apptRes.data as any)?.telehealth_link_override ?? "");
      setLoaded(true);
    });
    return () => {
      cancelled = true;
    };
  }, [appointmentId, patientId, providerId]);

  if (!providerId || !loaded) return null;

  const effectiveLink = override.trim() || recurringLink;

  async function saveOverride() {
    setSaving(true);
    setError(null);
    try {
      await setAppointmentTelehealthOverrideAction(appointmentId, override);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (e: any) {
      setError(e.message ?? "Couldn't save.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div style={{ border: "1px solid var(--input-border)", borderRadius: 8, padding: "10px 12px", display: "grid", gap: 8 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <span style={{ fontSize: 12, fontWeight: 700, color: "#666", textTransform: "uppercase", letterSpacing: 0.3 }}>Telehealth</span>
        {effectiveLink ? (
          <a
            href={effectiveLink}
            target="_blank"
            rel="noopener noreferrer"
            style={{ fontSize: 12, fontWeight: 700, background: "var(--brand-primary)", color: "white", borderRadius: 999, padding: "4px 12px", textDecoration: "none" }}
          >
            Start Online Visit
          </a>
        ) : (
          <span style={{ fontSize: 11.5, color: "#999" }}>No link on file yet</span>
        )}
      </div>
      {!recurringLink && (
        <p style={{ fontSize: 11.5, color: "#999", margin: 0 }}>
          No recurring link saved for this patient yet — set one from the patient's chart, or paste a one-time link below just for this visit.
        </p>
      )}
      <div style={{ display: "flex", gap: 8 }}>
        <input
          value={override}
          onChange={(e) => setOverride(e.target.value)}
          placeholder={recurringLink ? "Override just for this visit (optional)" : "Meeting link for this visit"}
          style={FIELD_STYLE}
        />
        <button
          type="button"
          onClick={saveOverride}
          disabled={saving}
          style={{ padding: "8px 12px", borderRadius: 8, border: "1px solid var(--input-border)", background: "white", fontWeight: 600, fontSize: 12.5, cursor: "pointer", whiteSpace: "nowrap" }}
        >
          {saving ? "Saving…" : saved ? "Saved ✓" : "Save"}
        </button>
      </div>
      {error && <p style={{ color: "crimson", fontSize: 12, margin: 0 }}>{error}</p>}
    </div>
  );
}
