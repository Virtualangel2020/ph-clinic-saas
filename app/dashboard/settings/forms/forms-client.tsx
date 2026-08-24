"use client";

import { useRef, useState, useTransition } from "react";
import { saveIntakeFormTemplateAction, deleteIntakeFormTemplateAction, duplicateIntakeFormTemplateAction, assignTemplateToPatientFromSettingsAction } from "./actions";
import { searchPatientsAction, type PatientSearchResult } from "../../patients/actions";
import { FormPreview } from "./form-preview";

type Category = "intake" | "consent" | "other";
type FieldType = "text" | "date" | "select" | "checkbox" | "textarea";

type Field = { key: string; label: string; type: FieldType; required: boolean; options?: string };
// Consent (and any category without a structured field list) stores its
// text in a single-element fields_config array, since the table has no
// separate `body` column: [{ key: "body", type: "richtext", label: "Consent Text", value }]
type ConsentField = { key: "body"; type: "richtext"; label: string; value: string };

type Template = {
  id: string;
  name: string;
  category: Category;
  fields_config: Field[] | ConsentField[];
  is_active: boolean;
  version?: number;
  is_required?: boolean;
};

const CATEGORY_LABEL: Record<Category, string> = {
  intake: "Intake",
  consent: "Consent / Acknowledgement",
  other: "Other",
};

const DEFAULT_INTAKE_FIELDS: Field[] = [
  { key: "chief_complaint", label: "Chief Complaint / Reason for Visit", type: "textarea", required: true },
  { key: "known_allergies", label: "Known Allergies", type: "text", required: false },
  { key: "current_medications", label: "Current Medications", type: "text", required: false },
  { key: "emergency_contact", label: "Emergency Contact", type: "text", required: true },
];

const DEFAULT_CONSENT_BODY =
  "I acknowledge that I have been informed of the nature of the services to be provided and consent to receiving care at this clinic. I understand that I may ask questions at any time and may withdraw consent for a specific procedure before it is performed.";

function slugify(label: string, fallback: string) {
  const s = label
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
  return s || fallback;
}

function blankTemplate(category: Category): Template {
  if (category === "consent") {
    return {
      id: "",
      name: "Standard Consent for Treatment",
      category,
      fields_config: [{ key: "body", type: "richtext", label: "Consent Text", value: DEFAULT_CONSENT_BODY }],
      is_active: true,
      is_required: false,
    };
  }
  return {
    id: "",
    name: category === "intake" ? "Standard Intake Form" : "New Form",
    category,
    fields_config: category === "intake" ? DEFAULT_INTAKE_FIELDS : [],
    is_active: true,
    is_required: false,
  };
}

export function FormTemplatesClient({
  initialTemplates,
  canAssign = false,
  clinicName,
  logoUrl,
  addressLine,
  contactLine,
}: {
  initialTemplates: Template[];
  canAssign?: boolean;
  clinicName: string;
  logoUrl: string | null;
  addressLine: string;
  contactLine: string;
}) {
  const [templates, setTemplates] = useState(initialTemplates);
  const [editing, setEditing] = useState<Template | null>(null);
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<{ text: string; ok: boolean } | null>(null);
  const [assigningId, setAssigningId] = useState<string | null>(null);
  const [assignQuery, setAssignQuery] = useState("");
  const [assignResults, setAssignResults] = useState<PatientSearchResult[]>([]);
  const [assignSearching, setAssignSearching] = useState(false);
  const [assignMessage, setAssignMessage] = useState<string | null>(null);
  const assignTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const isConsent = editing?.category === "consent";
  const fields = (editing?.fields_config as Field[]) ?? [];
  const consentField = (editing?.fields_config as ConsentField[])?.[0];

  function startNew(category: Category) {
    setEditing(blankTemplate(category));
    setMessage(null);
  }

  function startEdit(t: Template) {
    setEditing(t);
    setMessage(null);
  }

  function addField() {
    if (!editing) return;
    const next: Field = { key: `field_${fields.length + 1}`, label: "", type: "text", required: false };
    setEditing({ ...editing, fields_config: [...fields, next] });
  }

  function updateField(idx: number, patch: Partial<Field>) {
    if (!editing) return;
    const updated = fields.map((f, i) => {
      if (i !== idx) return f;
      const merged = { ...f, ...patch };
      // Keep key in sync with label unless the field's key was already
      // customized away from its auto-slug — simplest rule: re-slug from
      // the new label, same pattern as most auto-key builders in this app.
      if (patch.label !== undefined) merged.key = slugify(patch.label, f.key);
      return merged;
    });
    setEditing({ ...editing, fields_config: updated });
  }

  function removeField(idx: number) {
    if (!editing) return;
    setEditing({ ...editing, fields_config: fields.filter((_, i) => i !== idx) });
  }

  function moveField(idx: number, dir: -1 | 1) {
    if (!editing) return;
    const target = idx + dir;
    if (target < 0 || target >= fields.length) return;
    const next = [...fields];
    [next[idx], next[target]] = [next[target], next[idx]];
    setEditing({ ...editing, fields_config: next });
  }

  function updateConsentBody(value: string) {
    if (!editing) return;
    setEditing({ ...editing, fields_config: [{ key: "body", type: "richtext", label: "Consent Text", value }] });
  }

  function save() {
    if (!editing || !editing.name.trim()) return;
    startTransition(async () => {
      try {
        const savedFields = editing.fields_config;
        await saveIntakeFormTemplateAction({
          id: editing.id || null,
          name: editing.name,
          category: editing.category,
          fieldsConfig: savedFields,
          isActive: editing.is_active,
          isRequired: editing.is_required ?? false,
        });
        setTemplates((prev) => {
          if (editing.id) return prev.map((t) => (t.id === editing.id ? editing : t));
          return [...prev, { ...editing, id: `pending-${Date.now()}` }];
        });
        setEditing(null);
        setMessage({ text: "Template saved.", ok: true });
      } catch (e: any) {
        setMessage({ text: `Error: ${e.message}`, ok: false });
      }
    });
  }

  function duplicate(t: Template) {
    startTransition(async () => {
      try {
        await duplicateIntakeFormTemplateAction(t.id);
        setMessage({ text: `Duplicated "${t.name}" — find the copy below, inactive until you review it.`, ok: true });
        window.location.reload();
      } catch (e: any) {
        setMessage({ text: `Error: ${e.message}`, ok: false });
      }
    });
  }

  function startAssign(t: Template) {
    setAssigningId(t.id);
    setAssignQuery("");
    setAssignResults([]);
    setAssignMessage(null);
  }

  function onAssignQueryChange(value: string) {
    setAssignQuery(value);
    if (assignTimer.current) clearTimeout(assignTimer.current);
    if (value.trim().length < 2) {
      setAssignResults([]);
      return;
    }
    assignTimer.current = setTimeout(async () => {
      setAssignSearching(true);
      try {
        setAssignResults(await searchPatientsAction(value));
      } finally {
        setAssignSearching(false);
      }
    }, 250);
  }

  function assignTo(t: Template, patient: PatientSearchResult) {
    startTransition(async () => {
      try {
        await assignTemplateToPatientFromSettingsAction(t.id, patient.id);
        setAssignMessage(`Assigned to ${patient.last_name}, ${patient.first_name}.`);
        setAssignResults([]);
        setAssignQuery("");
      } catch (e: any) {
        setAssignMessage(`Error: ${e.message}`);
      }
    });
  }

  function remove(t: Template) {
    const sure = confirm(`Delete "${t.name}"? This cannot be undone.`);
    if (!sure) return;
    startTransition(async () => {
      try {
        await deleteIntakeFormTemplateAction(t.id);
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
        {templates.length === 0 && !editing && (
          <p style={{ color: "#aaa", fontSize: 12.5, marginBottom: 14 }}>No templates yet.</p>
        )}
        <div style={{ display: "grid", gap: 8, marginBottom: 14 }}>
          {templates.map((t) => (
            <div key={t.id} style={{ border: "1px solid #eee", borderRadius: 8, padding: "10px 12px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div>
                  <div style={{ fontWeight: 600, fontSize: 13 }}>
                    {t.name}
                    {t.is_required && <span style={{ marginLeft: 6, fontSize: 10, color: "#a12a2a", fontWeight: 700 }}>REQUIRED</span>}
                  </div>
                  <div style={{ fontSize: 11.5, color: "#999" }}>
                    {CATEGORY_LABEL[t.category]} ·{" "}
                    {t.category === "consent" ? "Text document" : `${t.fields_config.length} field(s)`} · v{t.version ?? 1} ·{" "}
                    {t.is_active ? "Active" : "Inactive"}
                  </div>
                </div>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap", justifyContent: "flex-end" }}>
                  {canAssign && t.is_active && t.id && (
                    <button
                      onClick={() => startAssign(t)}
                      style={{ background: "none", border: "1px solid var(--input-border)", borderRadius: 7, padding: "6px 12px", fontSize: 12, cursor: "pointer" }}
                    >
                      Assign to patient
                    </button>
                  )}
                  <button
                    onClick={() => duplicate(t)}
                    disabled={pending || !t.id}
                    style={{ background: "none", border: "1px solid var(--input-border)", borderRadius: 7, padding: "6px 12px", fontSize: 12, cursor: pending ? "default" : "pointer" }}
                  >
                    Duplicate
                  </button>
                  <button
                    onClick={() => startEdit(t)}
                    style={{ background: "none", border: "1px solid var(--input-border)", borderRadius: 7, padding: "6px 12px", fontSize: 12, cursor: "pointer" }}
                  >
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

              {assigningId === t.id && (
                <div style={{ marginTop: 10, background: "#f7f7f9", border: "1px solid #eee", borderRadius: 8, padding: 10 }}>
                  <input
                    autoFocus
                    placeholder="Search patient by name, DOB, or Patient ID…"
                    value={assignQuery}
                    onChange={(e) => onAssignQueryChange(e.target.value)}
                    style={{ width: "100%", boxSizing: "border-box", border: "1px solid var(--input-border)", borderRadius: 7, padding: "7px 10px", fontSize: 12.5 }}
                  />
                  {assignSearching && <p style={{ fontSize: 11.5, color: "#999", margin: "6px 0 0" }}>Searching…</p>}
                  {assignResults.length > 0 && (
                    <div style={{ marginTop: 6, display: "grid", gap: 4 }}>
                      {assignResults.map((p) => (
                        <button
                          key={p.id}
                          onClick={() => assignTo(t, p)}
                          disabled={pending}
                          style={{ textAlign: "left", background: "white", border: "1px solid #eee", borderRadius: 6, padding: "6px 10px", fontSize: 12, cursor: pending ? "default" : "pointer" }}
                        >
                          {p.last_name}, {p.first_name} <span style={{ color: "#999" }}>· {p.patient_code ?? "—"}</span>
                        </button>
                      ))}
                    </div>
                  )}
                  {assignMessage && <p style={{ fontSize: 11.5, color: assignMessage.startsWith("Error") ? "#a12a2a" : "#1a7f37", margin: "6px 0 0" }}>{assignMessage}</p>}
                  <button
                    onClick={() => setAssigningId(null)}
                    style={{ marginTop: 8, background: "none", border: "none", color: "#888", fontSize: 11.5, cursor: "pointer", padding: 0 }}
                  >
                    Close
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
        {!editing && (
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <button
              onClick={() => startNew("intake")}
              style={{ background: "#0c1730", color: "#e6c66b", fontWeight: 700, fontSize: 12.5, padding: "9px 16px", borderRadius: 8, border: "none", cursor: "pointer" }}
            >
              + New Intake Form
            </button>
            <button
              onClick={() => startNew("consent")}
              style={{ background: "none", border: "1px solid #0c1730", color: "var(--text-heading)", fontWeight: 600, fontSize: 12.5, padding: "9px 16px", borderRadius: 8, cursor: "pointer" }}
            >
              + New Consent Form
            </button>
            <button
              onClick={() => startNew("other")}
              style={{ background: "none", border: "1px solid var(--input-border)", color: "#555", fontWeight: 600, fontSize: 12.5, padding: "9px 16px", borderRadius: 8, cursor: "pointer" }}
            >
              + New Other Form
            </button>
          </div>
        )}
      </div>

      {editing && (
        <div style={{ display: "flex", gap: 20, alignItems: "flex-start", flexWrap: "wrap" }}>
        <div style={{ flex: "1 1 380px", minWidth: 0, background: "var(--card-bg)", border: "1px solid var(--card-border)", borderRadius: 12, padding: 22 }}>
          <h2 style={{ fontSize: 15, marginTop: 0, marginBottom: 12 }}>
            {editing.id ? "Edit template" : "New template"} — {CATEGORY_LABEL[editing.category]}
          </h2>
          <div style={{ display: "grid", gap: 10, marginBottom: 16 }}>
            <input
              placeholder="Template name"
              value={editing.name}
              onChange={(e) => setEditing({ ...editing, name: e.target.value })}
              style={{ padding: "9px 11px", borderRadius: 8, border: "1px solid var(--input-border)", fontSize: 13.5 }}
            />
            <div style={{ display: "flex", gap: 18 }}>
              <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13 }}>
                <input type="checkbox" checked={editing.is_active} onChange={(e) => setEditing({ ...editing, is_active: e.target.checked })} />
                Active
              </label>
              <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13 }}>
                <input type="checkbox" checked={!!editing.is_required} onChange={(e) => setEditing({ ...editing, is_required: e.target.checked })} />
                Required for every patient
              </label>
            </div>
          </div>

          {isConsent ? (
            <div style={{ marginBottom: 16 }}>
              <div style={{ fontSize: 12.5, fontWeight: 600, color: "#333", marginBottom: 8 }}>Consent Text</div>
              <textarea
                value={consentField?.value ?? ""}
                onChange={(e) => updateConsentBody(e.target.value)}
                rows={8}
                style={{ width: "100%", padding: "10px 12px", borderRadius: 8, border: "1px solid var(--input-border)", fontSize: 13, fontFamily: "inherit", resize: "vertical" }}
              />
              <div style={{ fontSize: 11.5, color: "#999", marginTop: 6 }}>
                This is the acknowledgement text patients will read and sign. Patient name, date, and signature are
                added automatically at the point of use.
              </div>
            </div>
          ) : (
            <>
              <div style={{ fontSize: 12.5, fontWeight: 600, color: "#333", marginBottom: 8 }}>Fields</div>
              <div style={{ display: "grid", gap: 8, marginBottom: 12 }}>
                {fields.map((f, i) => (
                  <div key={i} style={{ display: "flex", gap: 8, alignItems: "center" }}>
                    <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                      <button
                        onClick={() => moveField(i, -1)}
                        disabled={i === 0}
                        style={{ background: "none", border: "none", color: i === 0 ? "#ddd" : "#666", fontSize: 11, cursor: i === 0 ? "default" : "pointer", lineHeight: 1, padding: 0 }}
                      >
                        ▲
                      </button>
                      <button
                        onClick={() => moveField(i, 1)}
                        disabled={i === fields.length - 1}
                        style={{ background: "none", border: "none", color: i === fields.length - 1 ? "#ddd" : "#666", fontSize: 11, cursor: i === fields.length - 1 ? "default" : "pointer", lineHeight: 1, padding: 0 }}
                      >
                        ▼
                      </button>
                    </div>
                    <input
                      placeholder="Field label"
                      value={f.label}
                      onChange={(e) => updateField(i, { label: e.target.value })}
                      style={{ flex: 1, padding: "8px 10px", borderRadius: 7, border: "1px solid var(--input-border)", fontSize: 13 }}
                    />
                    <select
                      value={f.type}
                      onChange={(e) => updateField(i, { type: e.target.value as FieldType })}
                      style={{ padding: "8px 10px", borderRadius: 7, border: "1px solid var(--input-border)", fontSize: 12.5 }}
                    >
                      <option value="text">Short text</option>
                      <option value="textarea">Long text</option>
                      <option value="date">Date</option>
                      <option value="select">Dropdown</option>
                      <option value="checkbox">Checkbox</option>
                    </select>
                    {f.type === "select" && (
                      <input
                        placeholder="Options, comma-separated"
                        value={f.options ?? ""}
                        onChange={(e) => updateField(i, { options: e.target.value })}
                        style={{ flex: 1, padding: "8px 10px", borderRadius: 7, border: "1px solid var(--input-border)", fontSize: 12.5 }}
                      />
                    )}
                    <label style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 11.5, color: "#666", whiteSpace: "nowrap" }}>
                      <input type="checkbox" checked={f.required} onChange={(e) => updateField(i, { required: e.target.checked })} />
                      Required
                    </label>
                    <button onClick={() => removeField(i)} style={{ background: "none", border: "none", color: "#c00", fontSize: 16, cursor: "pointer" }}>
                      ✕
                    </button>
                  </div>
                ))}
                {fields.length === 0 && <p style={{ color: "#aaa", fontSize: 12.5 }}>No fields yet.</p>}
              </div>
              <button
                onClick={addField}
                style={{ background: "none", border: "1px dashed #bbb", borderRadius: 7, padding: "7px 14px", fontSize: 12, cursor: "pointer", color: "#666", marginBottom: 16 }}
              >
                + Add field
              </button>
            </>
          )}

          {message && !message.ok && <p style={{ color: "crimson", fontSize: 12.5, marginBottom: 10 }}>{message.text}</p>}

          <div style={{ display: "flex", gap: 10 }}>
            <button
              onClick={save}
              disabled={pending || !editing.name.trim()}
              style={{ padding: "9px 18px", borderRadius: 8, border: "none", background: "#0c1730", color: "#e6c66b", fontWeight: 700, fontSize: 13, cursor: "pointer" }}
            >
              {pending ? "Saving…" : "Save Template"}
            </button>
            <button
              onClick={() => setEditing(null)}
              style={{ background: "none", border: "1px solid var(--input-border)", borderRadius: 8, padding: "9px 18px", fontSize: 13, cursor: "pointer" }}
            >
              Cancel
            </button>
          </div>
        </div>

        <div style={{ flex: "1 1 340px", minWidth: 0 }}>
          <FormPreview
            clinicName={clinicName}
            logoUrl={logoUrl}
            addressLine={addressLine}
            contactLine={contactLine}
            templateName={editing.name}
            category={editing.category}
            fields={fields}
            consentBody={consentField?.value ?? ""}
          />
        </div>
        </div>
      )}

      {message && message.ok && !editing && <p style={{ color: "#1a7f37", fontSize: 12.5 }}>{message.text}</p>}
    </div>
  );
}
