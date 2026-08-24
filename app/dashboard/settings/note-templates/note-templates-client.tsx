"use client";

import { useState, useTransition } from "react";
import { saveNoteTemplateAction, deleteNoteTemplateAction } from "./actions";
import { NoteTemplatePreview } from "./note-template-preview";

type Section = { key: "subjective" | "objective" | "assessment" | "plan"; label: string; placeholder: string };
type BasedOn = "soap" | "expanded" | "custom";
type Template = {
  id: string;
  name: string;
  based_on: BasedOn;
  sections: Section[];
  is_default: boolean;
  is_active: boolean;
};

const BASED_ON_LABEL: Record<BasedOn, string> = { soap: "SOAP", expanded: "Expanded", custom: "Custom" };

// Every template is constrained to exactly these 4 slots — they map 1:1 to
// patient_progress_notes' fixed subjective/objective/assessment/plan
// columns. A template can only relabel and re-prompt them, never add or
// remove a slot.
const SOAP_PRESET: Section[] = [
  { key: "subjective", label: "Subjective", placeholder: "Patient's reported symptoms..." },
  { key: "objective", label: "Objective", placeholder: "Exam findings, vitals..." },
  { key: "assessment", label: "Assessment", placeholder: "Diagnosis / clinical impression..." },
  { key: "plan", label: "Plan", placeholder: "Treatment plan, follow-up..." },
];

const EXPANDED_PRESET: Section[] = [
  { key: "subjective", label: "History & Symptoms", placeholder: "Onset, duration, associated symptoms, patient's own account..." },
  { key: "objective", label: "Exam Findings & Vitals", placeholder: "Physical exam findings, vital signs, relevant measurements..." },
  { key: "assessment", label: "Clinical Impression", placeholder: "Working diagnosis / differential, clinical reasoning..." },
  { key: "plan", label: "Treatment & Follow-up Plan", placeholder: "Medications, procedures, referrals, next visit..." },
];

const SECTION_TITLE: Record<Section["key"], string> = {
  subjective: "Subjective (S)",
  objective: "Objective (O)",
  assessment: "Assessment (A)",
  plan: "Plan (P)",
};

const FIELD_STYLE: React.CSSProperties = { padding: "8px 10px", borderRadius: 7, border: "1px solid var(--input-border)", fontSize: 13, width: "100%", fontFamily: "inherit" };
const SAVE_BTN_STYLE: React.CSSProperties = { padding: "9px 18px", borderRadius: 8, border: "none", background: "#0c1730", color: "#e6c66b", fontWeight: 700, fontSize: 13, cursor: "pointer" };

function emptyDraft(): Template {
  return { id: "", name: "SOAP (Standard)", based_on: "soap", sections: SOAP_PRESET.map((s) => ({ ...s })), is_default: false, is_active: true };
}

export function NoteTemplatesClient({
  initialTemplates,
  clinicName,
  logoUrl,
  addressLine,
  contactLine,
  providerName,
  providerCredentials,
  signatureImageUrl,
}: {
  initialTemplates: Template[];
  clinicName: string;
  logoUrl: string | null;
  addressLine: string;
  contactLine: string;
  providerName: string;
  providerCredentials: string | null;
  signatureImageUrl: string | null;
}) {
  const [templates, setTemplates] = useState(initialTemplates);
  const [editing, setEditing] = useState<Template | null>(null);
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<{ text: string; ok: boolean } | null>(null);

  function startNew() {
    setMessage(null);
    setEditing(emptyDraft());
  }

  function startEdit(t: Template) {
    setMessage(null);
    setEditing({ ...t, sections: t.sections.map((s) => ({ ...s })) });
  }

  function applyPreset(preset: Section[], basedOn: BasedOn) {
    if (!editing) return;
    setEditing({ ...editing, based_on: basedOn, sections: preset.map((s) => ({ ...s })) });
  }

  function updateSection(idx: number, patch: Partial<Section>) {
    if (!editing) return;
    const sections = editing.sections.map((s, i) => (i === idx ? { ...s, ...patch } : s));
    setEditing({ ...editing, sections });
  }

  function save() {
    if (!editing) return;
    if (!editing.name.trim()) {
      setMessage({ text: "Error: template name is required.", ok: false });
      return;
    }
    if (editing.sections.some((s) => !s.label.trim())) {
      setMessage({ text: "Error: every section needs a label.", ok: false });
      return;
    }
    startTransition(async () => {
      try {
        await saveNoteTemplateAction({
          id: editing.id || null,
          name: editing.name,
          basedOn: editing.based_on,
          sections: editing.sections,
          isDefault: editing.is_default,
          isActive: editing.is_active,
        });
        setTemplates((prev) => {
          // If this one is now the default, no other row can stay default —
          // the DB enforces that too, but mirror it locally so the list
          // doesn't show two defaults until the next server refetch.
          const next = editing.is_default ? prev.map((t) => ({ ...t, is_default: false })) : prev;
          if (editing.id) return next.map((t) => (t.id === editing.id ? editing : t));
          return [...next, { ...editing, id: `pending-${Date.now()}` }];
        });
        setEditing(null);
        setMessage({ text: "Template saved.", ok: true });
      } catch (e: any) {
        setMessage({ text: `Error: ${e.message}`, ok: false });
      }
    });
  }

  function remove(t: Template) {
    const sure = confirm(`Delete "${t.name}"? This cannot be undone.`);
    if (!sure) return;
    startTransition(async () => {
      try {
        await deleteNoteTemplateAction(t.id);
        setTemplates((prev) => prev.filter((x) => x.id !== t.id));
        if (editing?.id === t.id) setEditing(null);
        setMessage({ text: "Template deleted.", ok: true });
      } catch (e: any) {
        setMessage({ text: `Error: ${e.message}`, ok: false });
      }
    });
  }

  return (
    <div style={{ display: "grid", gap: 16 }}>
      <div style={{ background: "var(--card-bg)", border: "1px solid var(--card-border)", borderRadius: 12, padding: 22 }}>
        <h2 style={{ fontSize: 15, marginTop: 0, marginBottom: 12 }}>Templates</h2>
        {templates.length === 0 && !editing && <p style={{ color: "#aaa", fontSize: 12.5, marginBottom: 14 }}>No templates yet — the standard SOAP labels are used until you add one and mark it default.</p>}
        <div style={{ display: "grid", gap: 8, marginBottom: 14 }}>
          {templates.map((t) => (
            <div key={t.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 12px", border: "1px solid #eee", borderRadius: 8, gap: 10 }}>
              <div>
                <div style={{ fontWeight: 600, fontSize: 13, display: "flex", alignItems: "center", gap: 8 }}>
                  {t.name}
                  {t.is_default && (
                    <span style={{ fontSize: 10, fontWeight: 700, color: "var(--text-heading)", background: "#f0e6c6", border: "1px solid #e6c66b", borderRadius: 999, padding: "1px 8px" }}>DEFAULT</span>
                  )}
                </div>
                <div style={{ fontSize: 11.5, color: "#999" }}>
                  {BASED_ON_LABEL[t.based_on] ?? t.based_on} · {t.sections.map((s) => s.label).join(" / ")} · {t.is_active ? "Active" : "Inactive"}
                </div>
              </div>
              <div style={{ display: "flex", gap: 8, flexShrink: 0 }}>
                <button onClick={() => startEdit(t)} style={{ background: "none", border: "1px solid var(--input-border)", borderRadius: 7, padding: "6px 12px", fontSize: 12, cursor: "pointer" }}>
                  Edit
                </button>
                <button
                  onClick={() => remove(t)}
                  disabled={pending}
                  style={{ background: "none", border: "1px solid #f0c8c8", color: "#a12a2a", borderRadius: 7, padding: "6px 12px", fontSize: 12, cursor: pending ? "default" : "pointer" }}
                >
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>
        {!editing && (
          <button onClick={startNew} style={{ background: "#0c1730", color: "#e6c66b", fontWeight: 700, fontSize: 12.5, padding: "9px 16px", borderRadius: 8, border: "none", cursor: "pointer" }}>
            + New Template
          </button>
        )}
        {message && !editing && <p style={{ color: message.ok ? "#1a7f37" : "crimson", fontSize: 12.5, marginTop: 12, marginBottom: 0 }}>{message.text}</p>}
      </div>

      {editing && (
        <div style={{ display: "flex", gap: 20, alignItems: "flex-start", flexWrap: "wrap" }}>
        <div style={{ flex: "1 1 380px", minWidth: 0, background: "var(--card-bg)", border: "1px solid var(--card-border)", borderRadius: 12, padding: 22 }}>
          <h2 style={{ fontSize: 15, marginTop: 0, marginBottom: 12 }}>{editing.id ? "Edit template" : "New template"}</h2>

          <div style={{ display: "grid", gap: 10, marginBottom: 16 }}>
            <input
              placeholder="Template name"
              value={editing.name}
              onChange={(e) => setEditing({ ...editing, name: e.target.value })}
              style={FIELD_STYLE}
            />
            <div>
              <div style={{ fontSize: 11.5, fontWeight: 600, color: "#666", marginBottom: 4 }}>Style</div>
              <select value={editing.based_on} onChange={(e) => setEditing({ ...editing, based_on: e.target.value as BasedOn })} style={{ ...FIELD_STYLE, width: "auto" }}>
                <option value="soap">SOAP</option>
                <option value="expanded">Expanded</option>
                <option value="custom">Custom</option>
              </select>
            </div>
            <div style={{ display: "flex", gap: 18 }}>
              <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13 }}>
                <input type="checkbox" checked={editing.is_active} onChange={(e) => setEditing({ ...editing, is_active: e.target.checked })} />
                Active
              </label>
              <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13 }}>
                <input type="checkbox" checked={editing.is_default} onChange={(e) => setEditing({ ...editing, is_default: e.target.checked })} />
                Clinic default (used in every patient chart's note composer)
              </label>
            </div>
          </div>

          <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
            <span style={{ fontSize: 11.5, color: "#999", alignSelf: "center" }}>Start from a preset:</span>
            <button onClick={() => applyPreset(SOAP_PRESET, "soap")} style={{ background: "none", border: "1px solid var(--input-border)", borderRadius: 7, padding: "5px 12px", fontSize: 12, cursor: "pointer" }}>
              SOAP
            </button>
            <button onClick={() => applyPreset(EXPANDED_PRESET, "expanded")} style={{ background: "none", border: "1px solid var(--input-border)", borderRadius: 7, padding: "5px 12px", fontSize: 12, cursor: "pointer" }}>
              Expanded
            </button>
          </div>

          <div style={{ fontSize: 12.5, fontWeight: 600, color: "#333", marginBottom: 8 }}>
            Sections — these map to the note's fixed Subjective / Objective / Assessment / Plan fields; you're only relabeling and re-prompting them.
          </div>
          <div style={{ display: "grid", gap: 12, marginBottom: 16 }}>
            {editing.sections.map((s, i) => (
              <div key={s.key} style={{ border: "1px solid #eee", borderRadius: 8, padding: 12 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: "#999", textTransform: "uppercase", marginBottom: 8 }}>{SECTION_TITLE[s.key]}</div>
                <div style={{ display: "grid", gap: 8 }}>
                  <input
                    placeholder="Label"
                    value={s.label}
                    onChange={(e) => updateSection(i, { label: e.target.value })}
                    style={FIELD_STYLE}
                  />
                  <input
                    placeholder="Placeholder hint text"
                    value={s.placeholder}
                    onChange={(e) => updateSection(i, { placeholder: e.target.value })}
                    style={FIELD_STYLE}
                  />
                </div>
              </div>
            ))}
          </div>

          {message && <p style={{ color: message.ok ? "#1a7f37" : "crimson", fontSize: 12.5, marginBottom: 10 }}>{message.text}</p>}

          <div style={{ display: "flex", gap: 10 }}>
            <button onClick={save} disabled={pending || !editing.name.trim()} style={SAVE_BTN_STYLE}>
              {pending ? "Saving…" : "Save Template"}
            </button>
            <button onClick={() => setEditing(null)} style={{ background: "none", border: "1px solid var(--input-border)", borderRadius: 8, padding: "9px 18px", fontSize: 13, cursor: "pointer" }}>
              Cancel
            </button>
          </div>
        </div>

        <div style={{ flex: "1 1 340px", minWidth: 0 }}>
          <NoteTemplatePreview
            clinicName={clinicName}
            logoUrl={logoUrl}
            addressLine={addressLine}
            contactLine={contactLine}
            providerName={providerName}
            providerCredentials={providerCredentials}
            signatureImageUrl={signatureImageUrl}
            sections={editing.sections}
          />
        </div>
        </div>
      )}
    </div>
  );
}
