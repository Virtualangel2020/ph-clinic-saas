"use client";

import { useState, useTransition } from "react";
import { setMedicalCertificateTemplateAction } from "../actions";
import { CertificatePreview } from "./certificate-preview";

type Field = { key: string; label: string; type: "text" | "textarea" | "date" };
type Template = { id: string; name: string; based_on: string; fields_config: Field[]; is_active: boolean };

const DEFAULT_FIELDS: Field[] = [
  { key: "diagnosis", label: "Diagnosis / Reason", type: "textarea" },
  { key: "rest_from", label: "Rest / Leave From", type: "date" },
  { key: "rest_to", label: "Rest / Leave To", type: "date" },
  { key: "recommendations", label: "Recommendations", type: "textarea" },
];

export function MedicalCertificateTemplateForm({
  initialTemplates,
  clinicName,
  logoUrl,
  addressLine,
  contactLine,
  providerName,
}: {
  initialTemplates: Template[];
  clinicName: string;
  logoUrl: string | null;
  addressLine: string;
  contactLine: string;
  providerName: string;
}) {
  const [templates, setTemplates] = useState(initialTemplates);
  const [editing, setEditing] = useState<Template | null>(null);
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);

  function startNew() {
    setEditing({ id: "", name: "Standard Medical Certificate", based_on: "standard", fields_config: DEFAULT_FIELDS, is_active: true });
  }

  function addField() {
    if (!editing) return;
    setEditing({ ...editing, fields_config: [...editing.fields_config, { key: `field_${editing.fields_config.length}`, label: "", type: "text" }] });
  }

  function updateField(idx: number, patch: Partial<Field>) {
    if (!editing) return;
    const fields = editing.fields_config.map((f, i) => (i === idx ? { ...f, ...patch } : f));
    setEditing({ ...editing, fields_config: fields });
  }

  function removeField(idx: number) {
    if (!editing) return;
    setEditing({ ...editing, fields_config: editing.fields_config.filter((_, i) => i !== idx) });
  }

  function save() {
    if (!editing || !editing.name.trim()) return;
    startTransition(async () => {
      try {
        await setMedicalCertificateTemplateAction({
          id: editing.id || null,
          name: editing.name,
          basedOn: editing.based_on,
          fieldsConfig: editing.fields_config,
          isActive: editing.is_active,
        });
        setTemplates((prev) => {
          if (editing.id) return prev.map((t) => (t.id === editing.id ? editing : t));
          return [...prev, { ...editing, id: `pending-${Date.now()}` }];
        });
        setEditing(null);
        setMessage(null);
      } catch (e: any) {
        setMessage(`Error: ${e.message}`);
      }
    });
  }

  return (
    <div style={{ display: "grid", gap: 16 }}>
      <div style={{ background: "var(--card-bg)", border: "1px solid var(--card-border)", borderRadius: 12, padding: 22 }}>
        <h2 style={{ fontSize: 15, marginTop: 0, marginBottom: 12 }}>Templates</h2>
        {templates.length === 0 && !editing && <p style={{ color: "#aaa", fontSize: 12.5, marginBottom: 14 }}>No template yet.</p>}
        <div style={{ display: "grid", gap: 8, marginBottom: 14 }}>
          {templates.map((t) => (
            <div key={t.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 12px", border: "1px solid #eee", borderRadius: 8 }}>
              <div>
                <div style={{ fontWeight: 600, fontSize: 13 }}>{t.name}</div>
                <div style={{ fontSize: 11.5, color: "#999" }}>{t.fields_config.length} field(s) · {t.is_active ? "Active" : "Inactive"}</div>
              </div>
              <button onClick={() => setEditing(t)} style={{ background: "none", border: "1px solid var(--input-border)", borderRadius: 7, padding: "6px 12px", fontSize: 12, cursor: "pointer" }}>
                Edit
              </button>
            </div>
          ))}
        </div>
        {!editing && (
          <button onClick={startNew} style={{ background: "#0c1730", color: "#e6c66b", fontWeight: 700, fontSize: 12.5, padding: "9px 16px", borderRadius: 8, border: "none", cursor: "pointer" }}>
            + New Template
          </button>
        )}
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
              style={{ padding: "9px 11px", borderRadius: 8, border: "1px solid var(--input-border)", fontSize: 13.5 }}
            />
            <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13 }}>
              <input type="checkbox" checked={editing.is_active} onChange={(e) => setEditing({ ...editing, is_active: e.target.checked })} />
              Active
            </label>
          </div>

          <div style={{ fontSize: 12.5, fontWeight: 600, color: "#333", marginBottom: 8 }}>Fields (in addition to clinic branding, patient info, and provider credentials/signature — always included automatically)</div>
          <div style={{ display: "grid", gap: 8, marginBottom: 12 }}>
            {editing.fields_config.map((f, i) => (
              <div key={i} style={{ display: "flex", gap: 8, alignItems: "center" }}>
                <input
                  placeholder="Field label"
                  value={f.label}
                  onChange={(e) => updateField(i, { label: e.target.value })}
                  style={{ flex: 1, padding: "8px 10px", borderRadius: 7, border: "1px solid var(--input-border)", fontSize: 13 }}
                />
                <select value={f.type} onChange={(e) => updateField(i, { type: e.target.value as Field["type"] })} style={{ padding: "8px 10px", borderRadius: 7, border: "1px solid var(--input-border)", fontSize: 12.5 }}>
                  <option value="text">Short text</option>
                  <option value="textarea">Long text</option>
                  <option value="date">Date</option>
                </select>
                <button onClick={() => removeField(i)} style={{ background: "none", border: "none", color: "#c00", fontSize: 16, cursor: "pointer" }}>
                  ✕
                </button>
              </div>
            ))}
          </div>
          <button onClick={addField} style={{ background: "none", border: "1px dashed #bbb", borderRadius: 7, padding: "7px 14px", fontSize: 12, cursor: "pointer", color: "#666", marginBottom: 16 }}>
            + Add field
          </button>

          {message && <p style={{ color: "crimson", fontSize: 12.5, marginBottom: 10 }}>{message}</p>}

          <div style={{ display: "flex", gap: 10 }}>
            <button
              onClick={save}
              disabled={pending || !editing.name.trim()}
              style={{ background: "#0c1730", color: "#e6c66b", fontWeight: 700, fontSize: 13, padding: "9px 18px", borderRadius: 8, border: "none", cursor: "pointer" }}
            >
              {pending ? "Saving…" : "Save Template"}
            </button>
            <button onClick={() => setEditing(null)} style={{ background: "none", border: "1px solid var(--input-border)", borderRadius: 8, padding: "9px 18px", fontSize: 13, cursor: "pointer" }}>
              Cancel
            </button>
          </div>
        </div>

        <div style={{ flex: "1 1 340px", minWidth: 0 }}>
          <CertificatePreview
            clinicName={clinicName}
            logoUrl={logoUrl}
            addressLine={addressLine}
            contactLine={contactLine}
            providerName={providerName}
            fields={editing.fields_config}
          />
        </div>
        </div>
      )}
    </div>
  );
}
