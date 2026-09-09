"use client";

import { useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { LoadingButton } from "@/components/loading/loading-button";

type Profile = {
  allergies: string[] | null;
  medications: string[] | null;
  conditions: string[] | null;
  surgical_history: string | null;
  family_history: string | null;
  social_history: string | null;
  hmo_name: string | null;
  hmo_number: string | null;
  philhealth_number: string | null;
  emergency_contact_name: string | null;
  emergency_contact_relationship: string | null;
  emergency_contact_phone: string | null;
} | null;

const FIELD_STYLE: React.CSSProperties = { border: "1px solid #ccc", borderRadius: 8, padding: "9px 11px", fontSize: 13.5, width: "100%", boxSizing: "border-box" };
const LABEL_STYLE: React.CSSProperties = { fontSize: 12, color: "#666", marginBottom: 4, display: "block" };

function toLines(arr: string[] | null | undefined): string {
  return (arr ?? []).join("\n");
}
function fromLines(text: string): string[] {
  return text
    .split("\n")
    .map((s) => s.trim())
    .filter(Boolean);
}

// 8 checkpoints for the "X% Complete" indicator (spec Part 4 / Part 11
// pre-visit readiness). Deliberately simple — this is a patient-facing
// nudge, not a clinical completeness score.
function completion(p: {
  allergies: string;
  medications: string;
  conditions: string;
  surgicalHistory: string;
  familyHistory: string;
  hmoName: string;
  philhealthNumber: string;
  emergencyContactName: string;
}): number {
  const checks = [p.allergies, p.medications, p.conditions, p.surgicalHistory, p.familyHistory, p.hmoName, p.philhealthNumber, p.emergencyContactName];
  const filled = checks.filter((c) => c.trim().length > 0).length;
  return Math.round((filled / checks.length) * 100);
}

export function HealthProfileForm({ initial, forAccountId, forName }: { initial: Profile; forAccountId?: string | null; forName?: string | null }) {
  const [allergies, setAllergies] = useState(toLines(initial?.allergies));
  const [medications, setMedications] = useState(toLines(initial?.medications));
  const [conditions, setConditions] = useState(toLines(initial?.conditions));
  const [surgicalHistory, setSurgicalHistory] = useState(initial?.surgical_history ?? "");
  const [familyHistory, setFamilyHistory] = useState(initial?.family_history ?? "");
  const [socialHistory, setSocialHistory] = useState(initial?.social_history ?? "");
  const [hmoName, setHmoName] = useState(initial?.hmo_name ?? "");
  const [hmoNumber, setHmoNumber] = useState(initial?.hmo_number ?? "");
  const [philhealthNumber, setPhilhealthNumber] = useState(initial?.philhealth_number ?? "");
  const [emergencyContactName, setEmergencyContactName] = useState(initial?.emergency_contact_name ?? "");
  const [emergencyContactRelationship, setEmergencyContactRelationship] = useState(initial?.emergency_contact_relationship ?? "");
  const [emergencyContactPhone, setEmergencyContactPhone] = useState(initial?.emergency_contact_phone ?? "");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const pct = useMemo(
    () => completion({ allergies, medications, conditions, surgicalHistory, familyHistory, hmoName, philhealthNumber, emergencyContactName }),
    [allergies, medications, conditions, surgicalHistory, familyHistory, hmoName, philhealthNumber, emergencyContactName]
  );

  async function save() {
    setSaving(true);
    setSaved(false);
    setError(null);
    const supabase = createClient();
    const { error } = await supabase.rpc("upsert_my_health_profile", {
      p_allergies: fromLines(allergies),
      p_medications: fromLines(medications),
      p_conditions: fromLines(conditions),
      p_surgical_history: surgicalHistory,
      p_family_history: familyHistory,
      p_social_history: socialHistory,
      p_hmo_name: hmoName,
      p_hmo_number: hmoNumber,
      p_philhealth_number: philhealthNumber,
      p_emergency_contact_name: emergencyContactName,
      p_emergency_contact_relationship: emergencyContactRelationship,
      p_emergency_contact_phone: emergencyContactPhone,
      p_for_account_id: forAccountId ?? null,
    });
    setSaving(false);
    if (error) {
      setError(error.message);
      return;
    }
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  }

  return (
    <div>
      <div style={{ background: "white", border: "1px solid #eee", borderRadius: 10, padding: "12px 16px", marginBottom: 20 }}>
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12.5, fontWeight: 600, marginBottom: 6 }}>
          <span>{forName ? `Health Profile — ${forName}` : "Health Profile"}</span>
          <span style={{ color: "var(--brand-primary)" }}>{pct}% Complete</span>
        </div>
        <div style={{ background: "#eee", borderRadius: 999, height: 6, overflow: "hidden" }}>
          <div style={{ background: "var(--brand-primary)", height: "100%", width: `${pct}%`, transition: "width 0.2s" }} />
        </div>
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          save();
        }}
        style={{ display: "grid", gap: 16 }}
      >
        <Field label="Allergies (one per line)">
          <textarea rows={2} value={allergies} onChange={(e) => setAllergies(e.target.value)} placeholder="e.g. Penicillin" style={{ ...FIELD_STYLE, resize: "vertical" }} />
        </Field>
        <Field label="Current medications (one per line)">
          <textarea rows={2} value={medications} onChange={(e) => setMedications(e.target.value)} style={{ ...FIELD_STYLE, resize: "vertical" }} />
        </Field>
        <Field label="Medical conditions (one per line)">
          <textarea rows={2} value={conditions} onChange={(e) => setConditions(e.target.value)} style={{ ...FIELD_STYLE, resize: "vertical" }} />
        </Field>
        <Field label="Previous surgeries">
          <textarea rows={2} value={surgicalHistory} onChange={(e) => setSurgicalHistory(e.target.value)} style={{ ...FIELD_STYLE, resize: "vertical" }} />
        </Field>
        <Field label="Family history">
          <textarea rows={2} value={familyHistory} onChange={(e) => setFamilyHistory(e.target.value)} style={{ ...FIELD_STYLE, resize: "vertical" }} />
        </Field>
        <Field label="Other relevant health history">
          <textarea rows={2} value={socialHistory} onChange={(e) => setSocialHistory(e.target.value)} style={{ ...FIELD_STYLE, resize: "vertical" }} />
        </Field>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <Field label="HMO / Insurance name">
            <input value={hmoName} onChange={(e) => setHmoName(e.target.value)} style={FIELD_STYLE} />
          </Field>
          <Field label="HMO / Insurance number">
            <input value={hmoNumber} onChange={(e) => setHmoNumber(e.target.value)} style={FIELD_STYLE} />
          </Field>
        </div>
        <Field label="PhilHealth number">
          <input value={philhealthNumber} onChange={(e) => setPhilhealthNumber(e.target.value)} style={FIELD_STYLE} />
        </Field>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
          <Field label="Emergency contact name">
            <input value={emergencyContactName} onChange={(e) => setEmergencyContactName(e.target.value)} style={FIELD_STYLE} />
          </Field>
          <Field label="Relationship">
            <input value={emergencyContactRelationship} onChange={(e) => setEmergencyContactRelationship(e.target.value)} style={FIELD_STYLE} />
          </Field>
          <Field label="Contact phone">
            <input value={emergencyContactPhone} onChange={(e) => setEmergencyContactPhone(e.target.value)} style={FIELD_STYLE} />
          </Field>
        </div>

        {error && <p style={{ color: "crimson", fontSize: 13 }}>{error}</p>}
        <LoadingButton
          type="submit"
          loading={saving}
          loadingText="Saving..."
          success={saved}
          successText="Saved ✓"
          style={{ padding: 11, borderRadius: 8, border: "none", background: "var(--brand-primary)", color: "white", fontWeight: 700, fontSize: 14 }}
        >
          Save
        </LoadingButton>
      </form>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label style={{ display: "block" }}>
      <span style={LABEL_STYLE}>{label}</span>
      {children}
    </label>
  );
}
