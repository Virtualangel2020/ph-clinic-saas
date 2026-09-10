"use client";

import { useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { LoadingButton } from "@/components/loading/loading-button";

// "None vs. not-answered vs. has-entries" (spec Phase 3): a section can be
// unknown (patient hasn't gotten to it), none (patient explicitly said
// they have none), or has_entries (at least one item). The server
// (upsert_my_health_profile) is the actual source of truth for mutual
// exclusivity — this is just the client mirroring it for a good UI.
type SectionStatus = "unknown" | "none" | "has_entries";

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
  allergies_status: string | null;
  medications_status: string | null;
  conditions_status: string | null;
  surgical_history_status: string | null;
  family_history_status: string | null;
} | null;

function asStatus(v: string | null | undefined): SectionStatus {
  return v === "none" || v === "has_entries" ? v : "unknown";
}

const FIELD_STYLE: React.CSSProperties = { border: "1px solid #ddd", borderRadius: 8, padding: "9px 11px", fontSize: 13.5, width: "100%", boxSizing: "border-box", background: "white" };
const LABEL_STYLE: React.CSSProperties = { fontSize: 12, color: "#666", marginBottom: 4, display: "block", fontWeight: 600 };
const HINT_STYLE: React.CSSProperties = { fontSize: 11.5, color: "#999", margin: "-2px 0 8px", lineHeight: 1.4 };
const ROW_CARD_STYLE: React.CSSProperties = { background: "#fafafa", border: "1px solid #eee", borderRadius: 8, padding: "10px 10px 10px 12px", marginBottom: 8, display: "flex", flexDirection: "column", gap: 8 };
const DRAFT_CARD_STYLE: React.CSSProperties = { background: "#fbfcff", border: "1px dashed #bbb", borderRadius: 8, padding: "10px 10px 10px 12px", marginBottom: 8, display: "flex", flexDirection: "column", gap: 8 };
const ADD_BTN_STYLE: React.CSSProperties = { display: "inline-flex", alignItems: "center", gap: 6, padding: "8px 14px", borderRadius: 8, border: "1px solid var(--brand-primary)", background: "white", color: "var(--brand-primary)", fontSize: 12.5, fontWeight: 700, cursor: "pointer" };
const REMOVE_BTN_STYLE: React.CSSProperties = { border: "none", background: "transparent", color: "#aaa", cursor: "pointer", fontSize: 17, lineHeight: 1, padding: "0 4px", flexShrink: 0 };
const COMMITTED_ROW_STYLE: React.CSSProperties = { display: "flex", gap: 8, alignItems: "center", marginBottom: 8, border: "1px solid #eee", borderRadius: 8, padding: "9px 11px", background: "white" };

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
function medicationSummary(m: MedicationEntry): string {
  const details = [m.dose.trim(), m.frequency.trim()].filter(Boolean).join(", ");
  let line = details ? `${m.name.trim()} (${details})` : m.name.trim();
  if (m.notes.trim()) line += ` — ${m.notes.trim()}`;
  return line;
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
function familyEntrySummary(e: FamilyEntry): string {
  const who = [e.relative.trim(), e.side ? `(${e.side})` : ""].filter(Boolean).join(" ");
  return who ? `${e.condition.trim()} — ${who}` : e.condition.trim();
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
function surgerySummary(e: SurgeryEntry): string {
  return e.year.trim() ? `${e.procedure.trim()} (${e.year.trim()})` : e.procedure.trim();
}

function linesToList(text: string | null | undefined): string[] {
  return (text ?? "")
    .split("\n")
    .map((s) => s.trim())
    .filter(Boolean);
}

// 8 checkpoints for the "X% Complete" indicator (spec Part 4 / Part 11
// pre-visit readiness). A section explicitly marked "None" counts as
// answered, same as one with entries — only "unknown" (never touched)
// counts as incomplete.
function completion(p: {
  allergiesAnswered: boolean;
  medicationsAnswered: boolean;
  conditionsAnswered: boolean;
  surgicalAnswered: boolean;
  familyAnswered: boolean;
  hmoName: string;
  philhealthNumber: string;
  emergencyContactName: string;
}): number {
  const checks = [
    p.allergiesAnswered,
    p.medicationsAnswered,
    p.conditionsAnswered,
    p.surgicalAnswered,
    p.familyAnswered,
    p.hmoName.trim().length > 0,
    p.philhealthNumber.trim().length > 0,
    p.emergencyContactName.trim().length > 0,
  ];
  const filled = checks.filter(Boolean).length;
  return Math.round((filled / checks.length) * 100);
}

export function HealthProfileForm({ initial, forAccountId, forName }: { initial: Profile; forAccountId?: string | null; forName?: string | null }) {
  const [allergies, setAllergies] = useState<string[]>(initial?.allergies ?? []);
  const [allergiesStatus, setAllergiesStatus] = useState<SectionStatus>(asStatus(initial?.allergies_status));
  const [medications, setMedications] = useState<MedicationEntry[]>((initial?.medications ?? []).map(medicationFromLine));
  const [medicationsStatus, setMedicationsStatus] = useState<SectionStatus>(asStatus(initial?.medications_status));
  const [conditions, setConditions] = useState<string[]>(initial?.conditions ?? []);
  const [conditionsStatus, setConditionsStatus] = useState<SectionStatus>(asStatus(initial?.conditions_status));
  const [surgicalHistory, setSurgicalHistory] = useState<SurgeryEntry[]>(linesToList(initial?.surgical_history).map(surgeryFromLine));
  const [surgicalHistoryStatus, setSurgicalHistoryStatus] = useState<SectionStatus>(asStatus(initial?.surgical_history_status));
  const [familyHistory, setFamilyHistory] = useState<FamilyEntry[]>(linesToList(initial?.family_history).map(familyEntryFromLine));
  const [familyHistoryStatus, setFamilyHistoryStatus] = useState<SectionStatus>(asStatus(initial?.family_history_status));
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
        allergiesAnswered: allergies.length > 0 || allergiesStatus === "none",
        medicationsAnswered: medications.some((m) => m.name.trim()) || medicationsStatus === "none",
        conditionsAnswered: conditions.length > 0 || conditionsStatus === "none",
        surgicalAnswered: surgicalHistory.some((s) => s.procedure.trim()) || surgicalHistoryStatus === "none",
        familyAnswered: familyHistory.some((f) => f.condition.trim()) || familyHistoryStatus === "none",
        hmoName,
        philhealthNumber,
        emergencyContactName,
      }),
    [allergies, allergiesStatus, medications, medicationsStatus, conditions, conditionsStatus, surgicalHistory, surgicalHistoryStatus, familyHistory, familyHistoryStatus, hmoName, philhealthNumber, emergencyContactName]
  );

  // Persists the whole profile row (the RPC always upserts everything —
  // there's no per-field endpoint). `overrides` lets a single section's
  // action (an "Add", a "None" toggle) send its just-changed value
  // immediately, without waiting for React state to re-render first —
  // this is what makes clicking "Add" on one entry actually save it right
  // away, rather than only updating in-memory state until the bottom
  // "Save" button is pressed.
  async function persist(
    overrides: Partial<{
      allergies: string[];
      allergiesStatus: SectionStatus;
      medications: MedicationEntry[];
      medicationsStatus: SectionStatus;
      conditions: string[];
      conditionsStatus: SectionStatus;
      surgicalHistory: SurgeryEntry[];
      surgicalHistoryStatus: SectionStatus;
      familyHistory: FamilyEntry[];
      familyHistoryStatus: SectionStatus;
    }> = {}
  ) {
    setSaving(true);
    setSaved(false);
    setError(null);
    const supabase = createClient();
    const nextAllergies = overrides.allergies ?? allergies;
    const nextMedications = overrides.medications ?? medications;
    const nextConditions = overrides.conditions ?? conditions;
    const nextSurgical = overrides.surgicalHistory ?? surgicalHistory;
    const nextFamily = overrides.familyHistory ?? familyHistory;
    const { error } = await supabase.rpc("upsert_my_health_profile", {
      p_allergies: nextAllergies.map((a) => a.trim()).filter(Boolean),
      p_medications: nextMedications.map(medicationToLine).filter(Boolean),
      p_conditions: nextConditions.map((c) => c.trim()).filter(Boolean),
      p_surgical_history: nextSurgical.map(surgeryToLine).filter(Boolean).join("\n"),
      p_family_history: nextFamily.map(familyEntryToLine).filter(Boolean).join("\n"),
      p_social_history: socialHistory,
      p_hmo_name: hmoName,
      p_hmo_number: hmoNumber,
      p_philhealth_number: philhealthNumber,
      p_emergency_contact_name: emergencyContactName,
      p_emergency_contact_relationship: emergencyContactRelationship,
      p_emergency_contact_phone: emergencyContactPhone,
      p_for_account_id: forAccountId ?? null,
      p_allergies_status: overrides.allergiesStatus ?? allergiesStatus,
      p_medications_status: overrides.medicationsStatus ?? medicationsStatus,
      p_conditions_status: overrides.conditionsStatus ?? conditionsStatus,
      p_surgical_history_status: overrides.surgicalHistoryStatus ?? surgicalHistoryStatus,
      p_family_history_status: overrides.familyHistoryStatus ?? familyHistoryStatus,
    });
    setSaving(false);
    if (error) {
      setError(error.message);
      return;
    }
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  }

  // ---- Per-section action handlers: each "Add" or "None" click commits
  // to state AND saves immediately, rather than silently queuing until
  // the bottom Save button is pressed.
  function addAllergy(value: string) {
    const next = [...allergies, value];
    setAllergies(next);
    setAllergiesStatus("has_entries");
    persist({ allergies: next, allergiesStatus: "has_entries" });
  }
  function removeAllergy(i: number) {
    const next = allergies.filter((_, idx) => idx !== i);
    setAllergies(next);
    persist({ allergies: next });
  }
  function setAllergiesNone() {
    setAllergies([]);
    setAllergiesStatus("none");
    persist({ allergies: [], allergiesStatus: "none" });
  }
  function undoAllergiesNone() {
    setAllergiesStatus("unknown");
    persist({ allergiesStatus: "unknown" });
  }

  function addMedication(entry: MedicationEntry) {
    const next = [...medications, entry];
    setMedications(next);
    setMedicationsStatus("has_entries");
    persist({ medications: next, medicationsStatus: "has_entries" });
  }
  function removeMedication(i: number) {
    const next = medications.filter((_, idx) => idx !== i);
    setMedications(next);
    persist({ medications: next });
  }
  function setMedicationsNone() {
    setMedications([]);
    setMedicationsStatus("none");
    persist({ medications: [], medicationsStatus: "none" });
  }
  function undoMedicationsNone() {
    setMedicationsStatus("unknown");
    persist({ medicationsStatus: "unknown" });
  }

  function addCondition(value: string) {
    const next = [...conditions, value];
    setConditions(next);
    setConditionsStatus("has_entries");
    persist({ conditions: next, conditionsStatus: "has_entries" });
  }
  function removeCondition(i: number) {
    const next = conditions.filter((_, idx) => idx !== i);
    setConditions(next);
    persist({ conditions: next });
  }
  function setConditionsNone() {
    setConditions([]);
    setConditionsStatus("none");
    persist({ conditions: [], conditionsStatus: "none" });
  }
  function undoConditionsNone() {
    setConditionsStatus("unknown");
    persist({ conditionsStatus: "unknown" });
  }

  function addSurgery(entry: SurgeryEntry) {
    const next = [...surgicalHistory, entry];
    setSurgicalHistory(next);
    setSurgicalHistoryStatus("has_entries");
    persist({ surgicalHistory: next, surgicalHistoryStatus: "has_entries" });
  }
  function removeSurgery(i: number) {
    const next = surgicalHistory.filter((_, idx) => idx !== i);
    setSurgicalHistory(next);
    persist({ surgicalHistory: next });
  }
  function setSurgicalHistoryNone() {
    setSurgicalHistory([]);
    setSurgicalHistoryStatus("none");
    persist({ surgicalHistory: [], surgicalHistoryStatus: "none" });
  }
  function undoSurgicalHistoryNone() {
    setSurgicalHistoryStatus("unknown");
    persist({ surgicalHistoryStatus: "unknown" });
  }

  function addFamilyHistory(entry: FamilyEntry) {
    const next = [...familyHistory, entry];
    setFamilyHistory(next);
    setFamilyHistoryStatus("has_entries");
    persist({ familyHistory: next, familyHistoryStatus: "has_entries" });
  }
  function removeFamilyHistory(i: number) {
    const next = familyHistory.filter((_, idx) => idx !== i);
    setFamilyHistory(next);
    persist({ familyHistory: next });
  }
  function setFamilyHistoryNone() {
    setFamilyHistory([]);
    setFamilyHistoryStatus("none");
    persist({ familyHistory: [], familyHistoryStatus: "none" });
  }
  function undoFamilyHistoryNone() {
    setFamilyHistoryStatus("unknown");
    persist({ familyHistoryStatus: "unknown" });
  }

  // Bottom "Save" button — for the free-text fields (social history,
  // insurance, emergency contact) that don't have their own per-entry Add.
  function save() {
    persist({});
  }

  const pdfHref = `/api/portal/health-profile-pdf${forAccountId ? `?forAccountId=${forAccountId}` : ""}`;

  return (
    <div>
      <div style={{ background: "white", border: "1px solid #eee", borderRadius: 10, padding: "12px 16px", marginBottom: 20 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 12.5, fontWeight: 600, marginBottom: 6, gap: 10, flexWrap: "wrap" }}>
          <span>{forName ? `Health Profile — ${forName}` : "Health Profile"}</span>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            {saving && <span style={{ color: "#999", fontWeight: 500 }}>Saving…</span>}
            {!saving && saved && <span style={{ color: "#2a8f5a", fontWeight: 500 }}>Saved ✓</span>}
            <a
              href={pdfHref}
              style={{ display: "inline-flex", alignItems: "center", gap: 5, color: "var(--brand-primary)", fontWeight: 700, fontSize: 12.5, textDecoration: "none", border: "1px solid var(--brand-primary)", borderRadius: 7, padding: "5px 10px" }}
            >
              ⬇ Download PDF
            </a>
            <span style={{ color: "var(--brand-primary)" }}>{pct}% Complete</span>
          </div>
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
          status={allergiesStatus}
          onAdd={addAllergy}
          onRemove={removeAllergy}
          onSetNone={setAllergiesNone}
          onUndoNone={undoAllergiesNone}
          placeholder="e.g. Penicillin"
          noneLabel="known allergies"
        />

        <MedicationsList items={medications} status={medicationsStatus} onAdd={addMedication} onRemove={removeMedication} onSetNone={setMedicationsNone} onUndoNone={undoMedicationsNone} />

        <SimpleAddableList
          label="Medical conditions"
          hint="Ongoing or past diagnoses your doctor should know about."
          items={conditions}
          status={conditionsStatus}
          onAdd={addCondition}
          onRemove={removeCondition}
          onSetNone={setConditionsNone}
          onUndoNone={undoConditionsNone}
          placeholder="e.g. Hypertension"
          noneLabel="medical conditions"
        />

        <SurgicalHistoryList items={surgicalHistory} status={surgicalHistoryStatus} onAdd={addSurgery} onRemove={removeSurgery} onSetNone={setSurgicalHistoryNone} onUndoNone={undoSurgicalHistoryNone} />

        <FamilyHistoryList items={familyHistory} status={familyHistoryStatus} onAdd={addFamilyHistory} onRemove={removeFamilyHistory} onSetNone={setFamilyHistoryNone} onUndoNone={undoFamilyHistoryNone} />

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

// "None reported" toggle, shared by every repeatable section. Only shown
// when the section currently has zero committed entries — an entry
// existing always implies has_entries (enforced server-side too), so the
// two states are mutually exclusive by construction.
function NoneToggle({ status, hasItems, onSetNone, onUndo, noneLabel }: { status: SectionStatus; hasItems: boolean; onSetNone: () => void; onUndo: () => void; noneLabel: string }) {
  if (hasItems) return null;
  if (status === "none") {
    return (
      <div style={{ display: "flex", alignItems: "center", gap: 10, background: "#f2faf5", border: "1px solid #cbe9d6", borderRadius: 8, padding: "9px 12px", marginBottom: 8 }}>
        <span style={{ color: "#2a8f5a", fontSize: 12.5, fontWeight: 700 }}>✓ None reported</span>
        <button type="button" onClick={onUndo} style={{ border: "none", background: "transparent", color: "var(--brand-primary)", fontSize: 12, fontWeight: 700, cursor: "pointer", padding: 0 }}>
          Add one instead
        </button>
      </div>
    );
  }
  return (
    <button type="button" onClick={onSetNone} style={{ display: "block", border: "1px solid #ddd", background: "#fafafa", color: "#555", fontSize: 12, fontWeight: 600, borderRadius: 8, padding: "7px 12px", marginBottom: 8, cursor: "pointer" }}>
      None — I don't have any {noneLabel}
    </button>
  );
}

// Simple repeatable list of single-value entries (allergies, conditions).
// Committed entries are shown read-only; a new one only joins the list
// (and saves immediately) once "+ Add" is explicitly clicked.
function SimpleAddableList({
  label,
  hint,
  items,
  status,
  onAdd,
  onRemove,
  onSetNone,
  onUndoNone,
  placeholder,
  noneLabel,
}: {
  label: string;
  hint?: string;
  items: string[];
  status: SectionStatus;
  onAdd: (value: string) => void;
  onRemove: (i: number) => void;
  onSetNone: () => void;
  onUndoNone: () => void;
  placeholder?: string;
  noneLabel: string;
}) {
  const [draft, setDraft] = useState("");
  function commit() {
    const v = draft.trim();
    if (!v) return;
    onAdd(v);
    setDraft("");
  }
  return (
    <div>
      <span style={LABEL_STYLE}>{label}</span>
      {hint && <p style={HINT_STYLE}>{hint}</p>}
      <NoneToggle status={status} hasItems={items.length > 0} onSetNone={onSetNone} onUndo={onUndoNone} noneLabel={noneLabel} />
      {items.map((val, i) => (
        <div key={i} style={COMMITTED_ROW_STYLE}>
          <span style={{ flex: 1, fontSize: 13.5 }}>{val}</span>
          <button type="button" onClick={() => onRemove(i)} style={REMOVE_BTN_STYLE} aria-label={`Remove ${label.toLowerCase()} entry`}>
            ×
          </button>
        </div>
      ))}
      {status !== "none" && (
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                commit();
              }
            }}
            placeholder={placeholder}
            style={FIELD_STYLE}
          />
          <button type="button" onClick={commit} disabled={!draft.trim()} style={{ ...ADD_BTN_STYLE, opacity: draft.trim() ? 1 : 0.45, cursor: draft.trim() ? "pointer" : "default" }}>
            + Add
          </button>
        </div>
      )}
    </div>
  );
}

// Medications — guided fields so the entry actually tells the doctor what
// they need (name, dose, how often, optional notes). A draft card holds
// the fields being typed; nothing joins the saved list until "+ Add
// medication" is clicked.
function MedicationsList({
  items,
  status,
  onAdd,
  onRemove,
  onSetNone,
  onUndoNone,
}: {
  items: MedicationEntry[];
  status: SectionStatus;
  onAdd: (entry: MedicationEntry) => void;
  onRemove: (i: number) => void;
  onSetNone: () => void;
  onUndoNone: () => void;
}) {
  const [draft, setDraft] = useState<MedicationEntry>(emptyMedication());
  function commit() {
    if (!draft.name.trim()) return;
    onAdd(draft);
    setDraft(emptyMedication());
  }
  return (
    <div>
      <span style={LABEL_STYLE}>Current medications</span>
      <p style={HINT_STYLE}>Include the dose and how often it's taken — that's what your doctor needs most (e.g. Metformin, 500mg, twice daily).</p>
      <NoneToggle status={status} hasItems={items.length > 0} onSetNone={onSetNone} onUndo={onUndoNone} noneLabel="current medications" />
      {items.map((m, i) => (
        <div key={i} style={COMMITTED_ROW_STYLE}>
          <span style={{ flex: 1, fontSize: 13.5 }}>{medicationSummary(m)}</span>
          <button type="button" onClick={() => onRemove(i)} style={REMOVE_BTN_STYLE} aria-label="Remove medication">
            ×
          </button>
        </div>
      ))}
      {status !== "none" && (
        <div style={DRAFT_CARD_STYLE}>
          <input value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} placeholder="Medication name (e.g. Metformin)" style={FIELD_STYLE} />
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
            <input value={draft.dose} onChange={(e) => setDraft({ ...draft, dose: e.target.value })} placeholder="Dose (e.g. 500mg)" style={FIELD_STYLE} />
            <input value={draft.frequency} onChange={(e) => setDraft({ ...draft, frequency: e.target.value })} placeholder="How often (e.g. twice daily)" style={FIELD_STYLE} />
          </div>
          <input value={draft.notes} onChange={(e) => setDraft({ ...draft, notes: e.target.value })} placeholder="Notes (optional — e.g. taken with food)" style={FIELD_STYLE} />
          <button type="button" onClick={commit} disabled={!draft.name.trim()} style={{ ...ADD_BTN_STYLE, alignSelf: "flex-start", opacity: draft.name.trim() ? 1 : 0.45, cursor: draft.name.trim() ? "pointer" : "default" }}>
            + Add medication
          </button>
        </div>
      )}
    </div>
  );
}

// Family history — guided fields so a condition is paired with who had it
// and which side of the family. Same draft-then-Add pattern as medications.
function FamilyHistoryList({
  items,
  status,
  onAdd,
  onRemove,
  onSetNone,
  onUndoNone,
}: {
  items: FamilyEntry[];
  status: SectionStatus;
  onAdd: (entry: FamilyEntry) => void;
  onRemove: (i: number) => void;
  onSetNone: () => void;
  onUndoNone: () => void;
}) {
  const [draft, setDraft] = useState<FamilyEntry>(emptyFamilyEntry());
  function commit() {
    if (!draft.condition.trim()) return;
    onAdd(draft);
    setDraft(emptyFamilyEntry());
  }
  return (
    <div>
      <span style={LABEL_STYLE}>Family history</span>
      <p style={HINT_STYLE}>List any conditions that run in the family, who had them, and on which side (e.g. Colon cancer — mother's side, your grandmother).</p>
      <NoneToggle status={status} hasItems={items.length > 0} onSetNone={onSetNone} onUndo={onUndoNone} noneLabel="family history to report" />
      {items.map((f, i) => (
        <div key={i} style={COMMITTED_ROW_STYLE}>
          <span style={{ flex: 1, fontSize: 13.5 }}>{familyEntrySummary(f)}</span>
          <button type="button" onClick={() => onRemove(i)} style={REMOVE_BTN_STYLE} aria-label="Remove family history entry">
            ×
          </button>
        </div>
      ))}
      {status !== "none" && (
        <div style={DRAFT_CARD_STYLE}>
          <input value={draft.condition} onChange={(e) => setDraft({ ...draft, condition: e.target.value })} placeholder="Condition (e.g. Colon cancer)" style={FIELD_STYLE} />
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
            <input value={draft.relative} onChange={(e) => setDraft({ ...draft, relative: e.target.value })} placeholder="Who (e.g. Mother, Grandfather)" style={FIELD_STYLE} />
            <select value={draft.side} onChange={(e) => setDraft({ ...draft, side: e.target.value })} style={FIELD_STYLE}>
              {FAMILY_SIDES.map((s) => (
                <option key={s || "none"} value={s}>
                  {s || "Side of family (optional)"}
                </option>
              ))}
            </select>
          </div>
          <button
            type="button"
            onClick={commit}
            disabled={!draft.condition.trim()}
            style={{ ...ADD_BTN_STYLE, alignSelf: "flex-start", opacity: draft.condition.trim() ? 1 : 0.45, cursor: draft.condition.trim() ? "pointer" : "default" }}
          >
            + Add family history
          </button>
        </div>
      )}
    </div>
  );
}

// Previous surgeries — procedure plus an optional year. Same draft-then-
// Add pattern as the other guided sections.
function SurgicalHistoryList({
  items,
  status,
  onAdd,
  onRemove,
  onSetNone,
  onUndoNone,
}: {
  items: SurgeryEntry[];
  status: SectionStatus;
  onAdd: (entry: SurgeryEntry) => void;
  onRemove: (i: number) => void;
  onSetNone: () => void;
  onUndoNone: () => void;
}) {
  const [draft, setDraft] = useState<SurgeryEntry>(emptySurgery());
  function commit() {
    if (!draft.procedure.trim()) return;
    onAdd(draft);
    setDraft(emptySurgery());
  }
  return (
    <div>
      <span style={LABEL_STYLE}>Previous surgeries</span>
      <NoneToggle status={status} hasItems={items.length > 0} onSetNone={onSetNone} onUndo={onUndoNone} noneLabel="previous surgeries" />
      {items.map((s, i) => (
        <div key={i} style={COMMITTED_ROW_STYLE}>
          <span style={{ flex: 1, fontSize: 13.5 }}>{surgerySummary(s)}</span>
          <button type="button" onClick={() => onRemove(i)} style={REMOVE_BTN_STYLE} aria-label="Remove surgery entry">
            ×
          </button>
        </div>
      ))}
      {status !== "none" && (
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <input value={draft.procedure} onChange={(e) => setDraft({ ...draft, procedure: e.target.value })} placeholder="Procedure (e.g. Appendectomy)" style={{ ...FIELD_STYLE, flex: 2 }} />
          <input value={draft.year} onChange={(e) => setDraft({ ...draft, year: e.target.value })} placeholder="Year (optional)" style={{ ...FIELD_STYLE, flex: 1 }} />
          <button type="button" onClick={commit} disabled={!draft.procedure.trim()} style={{ ...ADD_BTN_STYLE, opacity: draft.procedure.trim() ? 1 : 0.45, cursor: draft.procedure.trim() ? "pointer" : "default" }}>
            + Add
          </button>
        </div>
      )}
    </div>
  );
}
