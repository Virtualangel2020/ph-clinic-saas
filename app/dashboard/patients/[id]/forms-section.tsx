"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { assignFormToPatientAction, completePatientFormAction, expirePatientFormAction } from "../actions";
import { parseCheckboxOptions, isOtherOption, otherNoteKey } from "@/lib/forms/checkbox-options";

type FieldType = "text" | "date" | "select" | "checkbox" | "textarea";
type Field = { key: string; label: string; type: FieldType; required: boolean; options?: string };
type ConsentField = { key: "body"; type: "richtext"; label: string; value: string };

export type PatientFormRow = {
  id: string;
  template_id: string | null;
  template_name: string;
  template_category: string;
  template_version: number;
  fields_config_snapshot: Field[] | ConsentField[];
  is_required: boolean;
  status: "assigned" | "completed" | "expired";
  responses: Record<string, any>;
  assigned_at: string;
  completed_at: string | null;
  signature_name: string | null;
  signed_at: string | null;
};

export type ActiveFormTemplate = { id: string; name: string; category: string; is_required: boolean };

const CATEGORY_LABEL: Record<string, string> = { intake: "Intake", consent: "Consent / Acknowledgement", other: "Other" };
const STATUS_STYLE: Record<string, { bg: string; fg: string; label: string }> = {
  assigned: { bg: "#fff7e6", fg: "#7a5c12", label: "Assigned — not yet completed" },
  completed: { bg: "#e9f7ee", fg: "#1a7f37", label: "Completed" },
  expired: { bg: "#f2f2f2", fg: "#888", label: "Removed" },
};

// Patient Forms (spec §13-14): assigned/completed form instances for one
// patient. This is the SAME patient_forms table the Patient Portal's "My
// Forms" page reads — a portal patient completes their own assigned forms
// there, staff can also assign or complete-on-behalf-of here. Templates
// themselves are managed once, in Settings → Forms & Registration; nothing
// here duplicates that editor.
export function FormsSection({
  patientId,
  forms,
  activeTemplates,
  entitled,
}: {
  patientId: string;
  forms: PatientFormRow[];
  activeTemplates: ActiveFormTemplate[];
  entitled: boolean;
}) {
  const router = useRouter();
  const [assigning, setAssigning] = useState(false);
  const [templateId, setTemplateId] = useState("");
  const [fillingId, setFillingId] = useState<string | null>(null);
  const [responses, setResponses] = useState<Record<string, any>>({});
  const [signatureName, setSignatureName] = useState("");
  const [viewingId, setViewingId] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  if (!entitled) {
    return (
      <div style={{ background: "var(--card-bg)", border: "1px solid var(--card-border)", borderRadius: 12, padding: 24 }}>
        <h2 style={{ fontSize: 15, marginTop: 0 }}>Patient Forms</h2>
        <p style={{ color: "#666", fontSize: 13, lineHeight: 1.6, margin: 0 }}>
          Patient Forms isn&apos;t included on this clinic&apos;s current plan yet. Reach out to Virtual Angel Systems to
          add it — once enabled, patients can complete intake, consent, and history forms here and through the
          Patient Portal, and staff can assign or fill them out on a patient&apos;s behalf.
        </p>
      </div>
    );
  }

  function startFill(f: PatientFormRow) {
    setFillingId(f.id);
    setResponses(f.template_category === "consent" ? {} : { ...f.responses });
    setSignatureName(f.signature_name ?? "");
    setError(null);
  }

  function assign() {
    if (!templateId) return;
    setError(null);
    startTransition(async () => {
      try {
        await assignFormToPatientAction(patientId, templateId);
        setTemplateId("");
        setAssigning(false);
        router.refresh();
      } catch (e: any) {
        setError(e.message || "Couldn't assign that form.");
      }
    });
  }

  function submitFill(f: PatientFormRow) {
    const isConsent = f.template_category === "consent";
    if (isConsent && !signatureName.trim()) {
      setError("A signature name is required to mark a consent form as signed.");
      return;
    }
    setError(null);
    startTransition(async () => {
      try {
        await completePatientFormAction(f.id, patientId, isConsent ? { agreed: true } : responses, signatureName.trim() || undefined);
        setFillingId(null);
        router.refresh();
      } catch (e: any) {
        setError(e.message || "Couldn't save that form.");
      }
    });
  }

  function remove(f: PatientFormRow) {
    if (!confirm(`Remove "${f.template_name}" from this patient's assigned forms?`)) return;
    startTransition(async () => {
      await expirePatientFormAction(f.id, patientId);
      router.refresh();
    });
  }

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
        <h2 style={{ fontSize: 15 }}>Patient Forms</h2>
        {!assigning && (
          <button
            onClick={() => setAssigning(true)}
            style={{ background: "#0c1730", color: "#e6c66b", fontWeight: 700, fontSize: 12, padding: "7px 14px", borderRadius: 8, border: "none", cursor: "pointer" }}
          >
            + Assign form
          </button>
        )}
      </div>

      {assigning && (
        <div style={{ background: "#f7f7f9", border: "1px solid #eee", borderRadius: 8, padding: 12, marginBottom: 12, display: "grid", gap: 8 }}>
          {activeTemplates.length === 0 ? (
            <p style={{ fontSize: 12.5, color: "#888", margin: 0 }}>
              No active form templates yet. Create one under Settings → Forms &amp; Registration first.
            </p>
          ) : (
            <select value={templateId} onChange={(e) => setTemplateId(e.target.value)} style={{ border: "1px solid var(--input-border)", borderRadius: 8, padding: "8px 10px", fontSize: 13 }}>
              <option value="">Choose a template…</option>
              {activeTemplates.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name} — {CATEGORY_LABEL[t.category] ?? t.category}
                  {t.is_required ? " (required)" : ""}
                </option>
              ))}
            </select>
          )}
          {error && <div style={{ color: "#a12a2a", fontSize: 12.5 }}>{error}</div>}
          <div style={{ display: "flex", gap: 8 }}>
            <button
              onClick={assign}
              disabled={pending || !templateId}
              style={{ background: "#0c1730", color: "white", border: "none", borderRadius: 8, padding: "8px 14px", fontSize: 13, cursor: "pointer", opacity: pending || !templateId ? 0.6 : 1 }}
            >
              {pending ? "Assigning…" : "Assign"}
            </button>
            <button
              onClick={() => {
                setAssigning(false);
                setError(null);
              }}
              style={{ background: "none", border: "1px solid var(--input-border)", borderRadius: 8, padding: "8px 14px", fontSize: 13, cursor: "pointer", color: "#555" }}
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {forms.length === 0 ? (
        <p style={{ color: "#999", fontSize: 12.5 }}>No forms assigned to this patient yet.</p>
      ) : (
        <div style={{ display: "grid", gap: 8 }}>
          {forms.map((f) => {
            const style = STATUS_STYLE[f.status] ?? STATUS_STYLE.assigned;
            const isConsent = f.template_category === "consent";
            return (
              <div key={f.id} style={{ border: "1px solid var(--card-border)", borderRadius: 10, background: "var(--card-bg)", padding: "12px 14px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 10, flexWrap: "wrap" }}>
                  <div>
                    <strong style={{ fontSize: 13.5 }}>{f.template_name}</strong>
                    {f.is_required && <span style={{ marginLeft: 6, fontSize: 10.5, color: "#a12a2a", fontWeight: 700 }}>REQUIRED</span>}
                    <div style={{ marginTop: 4 }}>
                      <span style={{ display: "inline-block", fontSize: 10.5, fontWeight: 700, background: style.bg, color: style.fg, borderRadius: 999, padding: "2px 9px" }}>
                        {style.label}
                      </span>
                    </div>
                    <div style={{ color: "#888", fontSize: 11.5, marginTop: 5 }}>
                      {CATEGORY_LABEL[f.template_category] ?? f.template_category} · v{f.template_version} · Assigned{" "}
                      {new Date(f.assigned_at).toLocaleDateString()}
                      {f.completed_at ? ` · Completed ${new Date(f.completed_at).toLocaleDateString()}` : ""}
                      {f.signature_name ? ` · Signed by ${f.signature_name}` : ""}
                    </div>
                  </div>
                  <div style={{ display: "flex", gap: 12, flexShrink: 0 }}>
                    {f.status === "assigned" && (
                      <>
                        <button onClick={() => startFill(f)} style={{ background: "none", border: "none", color: "var(--text-heading)", cursor: "pointer", fontSize: 12, fontWeight: 600 }}>
                          Fill out with patient
                        </button>
                        <button onClick={() => remove(f)} style={{ background: "none", border: "none", color: "#999", cursor: "pointer", fontSize: 12 }}>
                          Remove
                        </button>
                      </>
                    )}
                    {f.status === "completed" && (
                      <button
                        onClick={() => setViewingId(viewingId === f.id ? null : f.id)}
                        style={{ background: "none", border: "none", color: "var(--text-heading)", cursor: "pointer", fontSize: 12, fontWeight: 600 }}
                      >
                        {viewingId === f.id ? "Hide responses" : "View responses"}
                      </button>
                    )}
                  </div>
                </div>

                {fillingId === f.id && (
                  <div style={{ marginTop: 12, background: "#f7f7f9", border: "1px solid #eee", borderRadius: 8, padding: 12, display: "grid", gap: 8 }}>
                    {isConsent ? (
                      <>
                        <div style={{ fontSize: 12.5, color: "#333", lineHeight: 1.6, whiteSpace: "pre-wrap", background: "white", border: "1px solid #eee", borderRadius: 6, padding: 10 }}>
                          {(f.fields_config_snapshot as ConsentField[])[0]?.value ?? ""}
                        </div>
                        <input
                          placeholder="Patient's printed name (signature)"
                          value={signatureName}
                          onChange={(e) => setSignatureName(e.target.value)}
                          style={{ border: "1px solid var(--input-border)", borderRadius: 8, padding: "8px 10px", fontSize: 13 }}
                        />
                      </>
                    ) : (
                      <>
                        {(f.fields_config_snapshot as Field[]).map((field) => (
                          <div key={field.key}>
                            <div style={{ fontSize: 11.5, color: "#666", marginBottom: 3 }}>
                              {field.label}
                              {field.required ? " *" : ""}
                            </div>
                            {field.type === "textarea" ? (
                              <textarea
                                value={responses[field.key] ?? ""}
                                onChange={(e) => setResponses((prev) => ({ ...prev, [field.key]: e.target.value }))}
                                style={{ width: "100%", boxSizing: "border-box", border: "1px solid var(--input-border)", borderRadius: 8, padding: "8px 10px", fontSize: 13, minHeight: 50, fontFamily: "inherit" }}
                              />
                            ) : field.type === "select" ? (
                              <select
                                value={responses[field.key] ?? ""}
                                onChange={(e) => setResponses((prev) => ({ ...prev, [field.key]: e.target.value }))}
                                style={{ border: "1px solid var(--input-border)", borderRadius: 8, padding: "8px 10px", fontSize: 13, width: "100%", boxSizing: "border-box" }}
                              >
                                <option value="">—</option>
                                {(field.options ?? "")
                                  .split(",")
                                  .map((o) => o.trim())
                                  .filter(Boolean)
                                  .map((o) => (
                                    <option key={o} value={o}>
                                      {o}
                                    </option>
                                  ))}
                              </select>
                            ) : field.type === "checkbox" ? (
                              (() => {
                                const opts = parseCheckboxOptions(field.options);
                                if (opts.length === 0) {
                                  return (
                                    <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13 }}>
                                      <input
                                        type="checkbox"
                                        checked={!!responses[field.key]}
                                        onChange={(e) => setResponses((prev) => ({ ...prev, [field.key]: e.target.checked }))}
                                      />
                                      Yes
                                    </label>
                                  );
                                }
                                const selected: string[] = Array.isArray(responses[field.key]) ? responses[field.key] : [];
                                const showOtherNote = selected.some((o) => isOtherOption(o));
                                return (
                                  <div style={{ display: "grid", gap: 6 }}>
                                    {opts.map((o) => (
                                      <label key={o} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13 }}>
                                        <input
                                          type="checkbox"
                                          checked={selected.includes(o)}
                                          onChange={(e) => {
                                            setResponses((prev) => {
                                              const cur: string[] = Array.isArray(prev[field.key]) ? prev[field.key] : [];
                                              const next = e.target.checked ? [...cur, o] : cur.filter((v) => v !== o);
                                              return { ...prev, [field.key]: next };
                                            });
                                          }}
                                        />
                                        {o}
                                      </label>
                                    ))}
                                    {showOtherNote && (
                                      <input
                                        placeholder="Please specify…"
                                        value={responses[otherNoteKey(field.key)] ?? ""}
                                        onChange={(e) => setResponses((prev) => ({ ...prev, [otherNoteKey(field.key)]: e.target.value }))}
                                        style={{ border: "1px solid var(--input-border)", borderRadius: 8, padding: "8px 10px", fontSize: 13 }}
                                      />
                                    )}
                                  </div>
                                );
                              })()
                            ) : (
                              <input
                                type={field.type === "date" ? "date" : "text"}
                                value={responses[field.key] ?? ""}
                                onChange={(e) => setResponses((prev) => ({ ...prev, [field.key]: e.target.value }))}
                                style={{ width: "100%", boxSizing: "border-box", border: "1px solid var(--input-border)", borderRadius: 8, padding: "8px 10px", fontSize: 13 }}
                              />
                            )}
                          </div>
                        ))}
                        <input
                          placeholder="Signature name (optional)"
                          value={signatureName}
                          onChange={(e) => setSignatureName(e.target.value)}
                          style={{ border: "1px solid var(--input-border)", borderRadius: 8, padding: "8px 10px", fontSize: 13 }}
                        />
                      </>
                    )}
                    {error && <div style={{ color: "#a12a2a", fontSize: 12.5 }}>{error}</div>}
                    <div style={{ display: "flex", gap: 8 }}>
                      <button
                        onClick={() => submitFill(f)}
                        disabled={pending}
                        style={{ background: "#0c1730", color: "white", border: "none", borderRadius: 8, padding: "8px 14px", fontSize: 13, cursor: "pointer", opacity: pending ? 0.6 : 1 }}
                      >
                        {pending ? "Saving…" : "Mark completed"}
                      </button>
                      <button
                        onClick={() => {
                          setFillingId(null);
                          setError(null);
                        }}
                        style={{ background: "none", border: "1px solid var(--input-border)", borderRadius: 8, padding: "8px 14px", fontSize: 13, cursor: "pointer", color: "#555" }}
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                )}

                {viewingId === f.id && f.status === "completed" && (
                  <div style={{ marginTop: 12, background: "#f7f7f9", border: "1px solid #eee", borderRadius: 8, padding: 12, fontSize: 12.5, display: "grid", gap: 6 }}>
                    {isConsent ? (
                      <div>Signed by {f.signature_name ?? "—"} on {f.signed_at ? new Date(f.signed_at).toLocaleString() : "—"}.</div>
                    ) : (
                      (f.fields_config_snapshot as Field[]).map((field) => {
                        const opts = field.type === "checkbox" ? parseCheckboxOptions(field.options) : [];
                        let display: string;
                        if (field.type === "checkbox" && opts.length > 0) {
                          const selected: string[] = Array.isArray(f.responses[field.key]) ? f.responses[field.key] : [];
                          const note = f.responses[otherNoteKey(field.key)];
                          display = selected.length === 0 ? "—" : selected.join(", ") + (note ? ` (${note})` : "");
                        } else if (field.type === "checkbox") {
                          display = f.responses[field.key] ? "Yes" : "No";
                        } else {
                          display = f.responses[field.key] || "—";
                        }
                        return (
                          <div key={field.key}>
                            <span style={{ color: "#888" }}>{field.label}:</span> <strong>{display}</strong>
                          </div>
                        );
                      })
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
