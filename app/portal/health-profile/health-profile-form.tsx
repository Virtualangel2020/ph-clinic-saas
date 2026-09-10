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

const FIELD_STYLE: React.CSSProperties = { border: "1px solid #ddd", borderRadius: 8, padding: "9px 11px", fontSize: 13.5, width: "100%", boxSizing: "border-box", background: "white" };
const LABEL_STYLE: React.CSSProperties = { fontSize: 12, color: "#666", marginBottom: 4, display: "block", fontWeight: 600 };
const HINT_STYLE: React.CSSProperties = { fontSize: 11.5, color: "#999", margin: "-2px 0 8px", lineHeight: 1.4 };
const ROW_CARD_STYLE: React.CSSProperties = { background: "#fafafa", border: "1px solid #eee", borderRadius: 8, padding: "10px 10px 10px 12px", marginBottom: 8, display: "flex", flexDirection: "column", gap: 8 };
const ADD_BTN_STYLE: React.CSSProperties = { display: "inline-flex", alignItems: "center", gap: 6, padding: "8px 14px", borderRadius: 8, border: "1px dashed #bbb", background: "transparent", color: "var(--brand-primary)", fontSize: 12.5, fontWeight: 700, cursor: "pointer" };
const REMOVE_BTN_STYLE: React.CSSProperties = { border: "none", background: "transparent", color: "#aaa", cursor: "pointer", fontSize: 17, lineHeight: 1, padding: "0 4px", flexShrink: 0 };

// ---- Repeatable-entry data shapes -----------------------------------
// The underlying DB columns are unchanged (allergies/medications/
// conditions stay text[]; surgical_history/family_history stay a single
// text field) — only the UI collects structured pieces and composes them
// into one readable line per entry, so no migration is needed and older
// free-text data still displays (it just falls back into the first
// field with the guided fields left blank).

type MedicationEntry = { name: string; dose: string; frequency: string; notes: string };
function emptyMedication(): MedicationEntry {
  return { name: "", dose: "", frequency: "", notes: "" };
}
function medicationToLine(m: MedicationEntry): string {
  const name = m.name.trim();
  if (!name) return "";
  const details = [m.dose.trim(), m.frequency.trim()].filter(Boolean).join(", ");
  let line = details ? `${name} (${details})` : name;
  if (m.notes.trim()) line += ` — ${m.notes.trim()}`;
  return line;
}
function medicationFromLine(s: string): MedicationEntry {
  let rest = s.trim();
  let notes = "";
  const dashIdx = rest.indexOf(" — ");
  if (dashIdx >= 0) {
    notes = rest.slice(dashIdx + 3).trim();
    rest = rest.slice(0, dashIdx).trim();
  }
  const m = rest.match(/^(.*?)\s*\(([^)]*)\)\s*$/);
  if (m) {
    const parts = m[2].split(",").map((x) => x.trim());
    return { name: m[1].trim(), dose: parts[0] || "", frequency: parts[1] || "", notes };
  }
  return { name: rest, dose: "", frequency: "", notes };
}

const FAMILY_SIDES = ["", "Mother's side", "Father's side", "Both sides", "Not sure"];
type FamilyEntry = { condition: string; relative: string; side: string };
function emptyFamilyEntry(): FamilyEntry {
  return { condition: "", relative: "", side: "" };
}
function familyEntryToLine(e: FamilyEntry): string {
  const condition = e.condition.trim();
  if (!condition) return "";
  const who = [e.relative.trim(), e.side ? `(${e.side})` : ""].filter(Boolean).join(" ");
  return who ? `${condition} — ${who}` : condition;
}
function familyEntryFromLine(s: string): FamilyEntry {
  const rest = s.trim();
  const dashIdx = rest.indexOf(" — ");
  if (dashIdx < 0) return { condition: rest, relative: "", side: "" };
  const condition = rest.slice(0, dashIdx).trim();
  const who = rest.slice(dashIdx + 3).trim();
  const m = who.match(/^(.*?)\s*\(([^)]*)\)\s*$/);
  if (m) {
    const side = FAMILY_SIDES.includes(m[2].trim()) ? m[2].trim() : "";
    return { condition, relative: m[1].trim(), side };
  }
  return { condition, relative: who, side: "" };
}

type SurgeryEntry = { procedure: string; year: string };
function emptySurgery(): SurgeryEntry {
  return { procedure: "", year: "" };
}
function surgeryToLine(e: SurgeryEntry): string {
  const p = e.procedure.trim();
  if (!p) return "";
  return e.year.trim() ? `${p} (${e.year.trim()})` : p;
}
function surgeryFromLine(s: string): SurgeryEntry {
  const rest = s.trim();
  const m = rest.match(/^(.*?)\s*\(([^)]*)\)\s*$/);
  if (m) return { procedure: m[1].trim(), year: m[2].trim() };
  return { procedure: rest, year: "" };
}

function linesToList(text: string | null | undefined): string[] {
  return (text ?? "")
    .split("\n")
    .map((s) => s.trim())
    .filter(Boolean);
}

// 8 checkpoints for the "X% Complete" indicator (spec Part 4 / Part 11
// pre-visit readiness) — same 8 checks as before, just measured against
// the new list shapes instead of raw textarea text.
function completion(p: {
  allergiesCount: number;
  medicationsCount: number;
  conditionsCount: number;
  surgicalCount: number;
  familyCount: number;
  hmoName: string;
  philhealthNumber: string;
  emergencyContactName: string;
}): number {
  const checks = [
    p.allergiesCount > 0,
    p.medicationsCount > 0,
    p.conditionsCount > 0,
    p.surgicalCount > 0,
    p.familyCount > 0,
    p.hmoName.trim().length > 0,
    p.philhealthNumber.trim().length > 0,
    p.emergencyContactName.trim().length > 0,
  ];
  const filled = checks.filter(Boolean).length;
  return Math.round((filled / checks.length) * 100);
}

export function HealthProfileForm({ initial, forAccountId, forName }: { initial: Profile; forAccountId?: string | null; forName?: string | null }) {
  const [allergies, setAllergies] = useState<string[]>(initial?.allergies ?? []);
  const [medications, setMedications] = useState<MedicationEntry[]>((initial?.medications ?? []).map(medicationFromLine));
  const [conditions, setConditions] = useState<string[]>(initial?.conditions ?? []);
  const [surgicalHistory, setSurgicalHistory] = useState<SurgeryEntry[]>(linesToList(initial?.surgical_history).map(surgeryFromLine));
  const [familyHistory, setFamilyHistory] = useState<FamilyEntry[]>(linesToList(initial?.family_history).map(familyEntryFromLine));
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
    () =>
      completion({
        allergiesCount: allergies.filter((a) => a.trim()).length,
        medicationsCount: medications.filter((m) => m.name.trim()).length,
        conditionsCount: conditions.filter((c) => c.trim()).length,
        surgicalCount: surgicalHistory.filter((s) => s.procedure.trim()).length,
        familyCount: familyHistory.filter((f) => f.condition.trim()).length,
        hmoName,
        philhealthNumber,
        emergencyContactName,
      }),
    [allergies, medications, conditions, surgicalHistory, familyHistory, hmoName, philhealthNumber, emergencyContactName]
  );

  async function save() {
    setSaving(true);
    setSaved(false);
    setError(null);
    const supabase = createClient();
    const { error } = await supabase.rpc("upsert_my_health_profile", {
      p_allergies: allergies.map((a) => a.trim()).filter(Boolean),
      p_medications: medications.map(medicationToLine).filter(Boolean),
      p_conditions: conditions.map((c) => c.trim()).filter(Boolean),
      p_surgical_history: surgicalHistory.map(surgeryToLine).filter(Boolean).join("\n"),
      p_family_history: familyHistory.map(familyEntryToLine).filter(Boolean).join("\n"),
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
        style={{ display: "grid", gap: 20 }}
      >
        <SimpleAddableList
          label="Allergies"
          hint="Include medications, food, or anything else you're allergic to."
          items={allergies}
          onChange={setAllergies}
          placeholder="e.g. Penicillin"
          addLabel="+ Add allergy"
        />

        <MedicationsList items={medications} onChange={setMedications} />

        <SimpleAddableList
          label="Medical conditions"
          hint="Ongoing or past diagnoses your doctor should know about."
          items={conditions}
          onChange={setConditions}
          placeholder="e.g. Hypertension"
          addLabel="+ Add condition"
        />

        <SurgicalHistoryList items={surgicalHistory} onChange={setSurgicalHistory} />

        <FamilyHistoryList items={familyHistory} onChange={setFamilyHistory} />

        <Field label="Other relevant health history">
          <textarea rows={2} value={socialHistory} onChange={(e) => setSocialHistory(e.target.value)} placeholder="Anything else worth mentioning (lifestyle, habits, etc.)" style={{ ...FIELD_STYLE, resize: "vertical" }} />
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

// Simple repeatable list of single-value entries (allergies, conditions) —
// click "+ Add" to get another row, click × to remove one.
function SimpleAddableList({
  label,
  hint,
  items,
  onChange,
  placeholder,
  addLabel,
}: {
  label: string;
  hint?: string;
  items: string[];
  onChange: (items: string[]) => void;
  placeholder?: string;
  addLabel: string;
}) {
  function update(i: number, value: string) {
    const next = [...items];
    next[i] = value;
    onChange(next);
  }
  function remove(i: number) {
    onChange(items.filter((_, idx) => idx !== i));
  }
  return (
    <div>
      <span style={LABEL_STYLE}>{label}</span>
      {hint && <p style={HINT_STYLE}>{hint}</p>}
      {items.map((val, i) => (
        <div key={i} style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 8 }}>
          <input value={val} onChange={(e) => update(i, e.target.value)} placeholder={placeholder} style={FIELD_STYLE} />
          <button type="button" onClick={() => remove(i)} style={REMOVE_BTN_STYLE} aria-label={`Remove ${label.toLowerCase()} entry`}>
            ×
          </button>
        </div>
      ))}
      <button type="button" onClick={() => onChange([...items, ""])} style={ADD_BTN_STYLE}>
        {addLabel}
      </button>
    </div>
  );
}

// Medications — guided fields so the entry actually tells the doctor what
// they need (name, dose, how often, optional notes), not just a bare name.
function MedicationsList({ items, onChange }: { items: MedicationEntry[]; onChange: (items: MedicationEntry[]) => void }) {
  function update(i: number, patch: Partial<MedicationEntry>) {
    const next = [...items];
    next[i] = { ...next[i], ...patch };
    onChange(next);
  }
  function remove(i: number) {
    onChange(items.filter((_, idx) => idx !== i));
  }
  return (
    <div>
      <span style={LABEL_STYLE}>Current medications</span>
      <p style={HINT_STYLE}>Include the dose and how often it's taken — that's what your doctor needs most (e.g. Metformin, 500mg, twice daily).</p>
      {items.map((m, i) => (
        <div key={i} style={ROW_CARD_STYLE}>
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <input value={m.name} onChange={(e) => update(i, { name: e.target.value })} placeholder="Medication name (e.g. Metformin)" style={{ ...FIELD_STYLE, flex: 1 }} />
            <button type="button" onClick={() => remove(i)} style={REMOVE_BTN_STYLE} aria-label="Remove medication">
              ×
            </button>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
            <input value={m.dose} onChange={(e) => update(i, { dose: e.target.value })} placeholder="Dose (e.g. 500mg)" style={FIELD_STYLE} />
            <input value={m.frequency} onChange={(e) => update(i, { frequency: e.target.value })} placeholder="How often (e.g. twice daily)" style={FIELD_STYLE} />
          </div>
          <input value={m.notes} onChange={(e) => update(i, { notes: e.target.value })} placeholder="Notes (optional — e.g. taken with food)" style={FIELD_STYLE} />
        </div>
      ))}
      <button type="button" onClick={() => onChange([...items, emptyMedication()])} style={ADD_BTN_STYLE}>
        + Add medication
      </button>
    </div>
  );
}

// Family history — guided fields so a condition is paired with who had it
// and which side of the family, not just a bare condition name.
function FamilyHistoryList({ items, onChange }: { items: FamilyEntry[]; onChange: (items: FamilyEntry[]) => void }) {
  function update(i: number, patch: Partial<FamilyEntry>) {
    const next = [...items];
    next[i] = { ...next[i], ...patch };
    onChange(next);
  }
  function remove(i: number) {
    onChange(items.filter((_, idx) => idx !== i));
  }
  return (
    <div>
      <span style={LABEL_STYLE}>Family history</span>
      <p style={HINT_STYLE}>List any conditions that run in the family, who had them, and on which side (e.g. Colon cancer — mother's side, your grandmother).</p>
      {items.map((f, i) => (
        <div key={i} style={ROW_CARD_STYLE}>
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <input value={f.condition} onChange={(e) => update(i, { condition: e.target.value })} placeholder="Condition (e.g. Colon cancer)" style={{ ...FIELD_STYLE, flex: 1 }} />
            <button type="button" onClick={() => remove(i)} style={REMOVE_BTN_STYLE} aria-label="Remove family history entry">
              ×
            </button>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
            <input value={f.relative} onChange={(e) => update(i, { relative: e.target.value })} placeholder="Who (e.g. Mother, Grandfather)" style={FIELD_STYLE} />
            <select value={f.side} onChange={(e) => update(i, { side: e.target.value })} style={FIELD_STYLE}>
              {FAMILY_SIDES.map((s) => (
                <option key={s || "none"} value={s}>
                  {s || "Side of family (optional)"}
                </option>
              ))}
            </select>
          </div>
        </div>
      ))}
      <button type="button" onClick={() => onChange([...items, emptyFamilyEntry()])} style={ADD_BTN_STYLE}>
        + Add family history
      </button>
    </div>
  );
}

// Previous surgeries — procedure plus an optional year, so multiple past
// surgeries are listed individually instead of jammed into one textarea.
function SurgicalHistoryList({ items, onChange }: { items: SurgeryEntry[]; onChange: (items: SurgeryEntry[]) => void }) {
  function update(i: number, patch: Partial<SurgeryEntry>) {
    const next = [...items];
    next[i] = { ...next[i], ...patch };
    onChange(next);
  }
  function remove(i: number) {
    onChange(items.filter((_, idx) => idx !== i));
  }
  return (
    <div>
      <span style={LABEL_STYLE}>Previous surgeries</span>
      {items.map((s, i) => (
        <div key={i} style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 8 }}>
          <input value={s.procedure} onChange={(e) => update(i, { procedure: e.target.value })} placeholder="Procedure (e.g. Appendectomy)" style={{ ...FIELD_STYLE, flex: 2 }} />
          <input value={s.year} onChange={(e) => update(i, { year: e.target.value })} placeholder="Year (optional)" style={{ ...FIELD_STYLE, flex: 1 }} />
          <button type="button" onClick={() => remove(i)} style={REMOVE_BTN_STYLE} aria-label="Remove surgery entry">
            ×
          </button>
        </div>
      ))}
      <button type="button" onClick={() => onChange([...items, emptySurgery()])} style={ADD_BTN_STYLE}>
        + Add surgery
      </button>
    </div>
  );
}
