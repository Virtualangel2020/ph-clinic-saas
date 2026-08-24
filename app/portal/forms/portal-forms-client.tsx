"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { completeMyFormAction } from "../actions";

type FieldType = "text" | "date" | "select" | "checkbox" | "textarea";
type Field = { key: string; label: string; type: FieldType; required: boolean; options?: string };
type ConsentField = { key: "body"; type: "richtext"; label: string; value: string };

type PatientFormRow = {
  id: string;
  template_name: string;
  template_category: string;
  fields_config_snapshot: Field[] | ConsentField[];
  is_required: boolean;
  status: "assigned" | "completed" | "expired";
  responses: Record<string, any>;
  assigned_at: string;
  completed_at: string | null;
  signature_name: string | null;
};

const CATEGORY_LABEL: Record<string, string> = { intake: "Intake", consent: "Consent / Acknowledgement", other: "Other" };

export function PortalFormsClient({ forms }: { forms: PatientFormRow[] }) {
  const router = useRouter();
  const [fillingId, setFillingId] = useState<string | null>(null);
  const [responses, setResponses] = useState<Record<string, any>>({});
  const [signatureName, setSignatureName] = useState("");
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const pendingForms = forms.filter((f) => f.status === "assigned");
  const doneForms = forms.filter((f) => f.status === "completed");

  if (forms.length === 0) {
    return <p style={{ color: "#999", fontSize: 12.5 }}>No forms have been assigned to you.</p>;
  }

  function startFill(f: PatientFormRow) {
    setFillingId(f.id);
    setResponses({});
    setSignatureName("");
    setError(null);
  }

  function submit(f: PatientFormRow) {
    const isConsent = f.template_category === "consent";
    if (!signatureName.trim()) {
      setError("Please type your full name to sign this form.");
      return;
    }
    setError(null);
    startTransition(async () => {
      try {
        await completeMyFormAction(f.id, isConsent ? { agreed: true } : responses, signatureName.trim());
        setFillingId(null);
        router.refresh();
      } catch (e: any) {
        setError(e.message || "Couldn't save that form.");
      }
    });
  }

  return (
    <div style={{ display: "grid", gap: 20 }}>
      {pendingForms.length > 0 && (
        <div>
          <h2 style={{ fontSize: 13.5, color: "#888", textTransform: "uppercase", letterSpacing: 0.4, marginBottom: 8 }}>To Complete</h2>
          <div style={{ display: "grid", gap: 8 }}>
            {pendingForms.map((f) => {
              const isConsent = f.template_category === "consent";
              return (
                <div key={f.id} style={{ background: "white", border: "1px solid #eee", borderRadius: 10, padding: "12px 14px" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8 }}>
                    <div>
                      <strong style={{ fontSize: 13.5 }}>{f.template_name}</strong>
                      {f.is_required && <span style={{ marginLeft: 6, fontSize: 10, color: "#a12a2a", fontWeight: 700 }}>REQUIRED</span>}
                      <div style={{ color: "#888", fontSize: 11.5, marginTop: 3 }}>{CATEGORY_LABEL[f.template_category] ?? f.template_category}</div>
                    </div>
                    {fillingId !== f.id && (
                      <button
                        onClick={() => startFill(f)}
                        style={{ background: "#0c1730", color: "#e6c66b", fontWeight: 700, fontSize: 12, padding: "7px 14px", borderRadius: 8, border: "none", cursor: "pointer" }}
                      >
                        Fill out
                      </button>
                    )}
                  </div>

                  {fillingId === f.id && (
                    <div style={{ marginTop: 12, background: "#f7f7f9", border: "1px solid #eee", borderRadius: 8, padding: 12, display: "grid", gap: 8 }}>
                      {isConsent ? (
                        <div style={{ fontSize: 12.5, color: "#333", lineHeight: 1.6, whiteSpace: "pre-wrap", background: "white", border: "1px solid #eee", borderRadius: 6, padding: 10 }}>
                          {(f.fields_config_snapshot as ConsentField[])[0]?.value ?? ""}
                        </div>
                      ) : (
                        (f.fields_config_snapshot as Field[]).map((field) => (
                          <div key={field.key}>
                            <div style={{ fontSize: 11.5, color: "#666", marginBottom: 3 }}>
                              {field.label}
                              {field.required ? " *" : ""}
                            </div>
                            {field.type === "textarea" ? (
                              <textarea
                                value={responses[field.key] ?? ""}
                                onChange={(e) => setResponses((prev) => ({ ...prev, [field.key]: e.target.value }))}
                                style={{ width: "100%", boxSizing: "border-box", border: "1px solid #ddd", borderRadius: 8, padding: "8px 10px", fontSize: 13, minHeight: 50, fontFamily: "inherit" }}
                              />
                            ) : field.type === "select" ? (
                              <select
                                value={responses[field.key] ?? ""}
                                onChange={(e) => setResponses((prev) => ({ ...prev, [field.key]: e.target.value }))}
                                style={{ border: "1px solid #ddd", borderRadius: 8, padding: "8px 10px", fontSize: 13, width: "100%", boxSizing: "border-box" }}
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
                              <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13 }}>
                                <input type="checkbox" checked={!!responses[field.key]} onChange={(e) => setResponses((prev) => ({ ...prev, [field.key]: e.target.checked }))} />
                                Yes
                              </label>
                            ) : (
                              <input
                                type={field.type === "date" ? "date" : "text"}
                                value={responses[field.key] ?? ""}
                                onChange={(e) => setResponses((prev) => ({ ...prev, [field.key]: e.target.value }))}
                                style={{ width: "100%", boxSizing: "border-box", border: "1px solid #ddd", borderRadius: 8, padding: "8px 10px", fontSize: 13 }}
                              />
                            )}
                          </div>
                        ))
                      )}
                      <input
                        placeholder="Type your full name to sign"
                        value={signatureName}
                        onChange={(e) => setSignatureName(e.target.value)}
                        style={{ border: "1px solid #ddd", borderRadius: 8, padding: "8px 10px", fontSize: 13 }}
                      />
                      {error && <div style={{ color: "#a12a2a", fontSize: 12.5 }}>{error}</div>}
                      <div style={{ display: "flex", gap: 8 }}>
                        <button
                          onClick={() => submit(f)}
                          disabled={pending}
                          style={{ background: "#0c1730", color: "white", border: "none", borderRadius: 8, padding: "8px 14px", fontSize: 13, cursor: "pointer", opacity: pending ? 0.6 : 1 }}
                        >
                          {pending ? "Submitting…" : "Submit & Sign"}
                        </button>
                        <button
                          onClick={() => {
                            setFillingId(null);
                            setError(null);
                          }}
                          style={{ background: "none", border: "1px solid #ddd", borderRadius: 8, padding: "8px 14px", fontSize: 13, cursor: "pointer", color: "#555" }}
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {doneForms.length > 0 && (
        <div>
          <h2 style={{ fontSize: 13.5, color: "#888", textTransform: "uppercase", letterSpacing: 0.4, marginBottom: 8 }}>Completed</h2>
          <div style={{ display: "grid", gap: 6 }}>
            {doneForms.map((f) => (
              <div key={f.id} style={{ background: "white", border: "1px solid #eee", borderRadius: 8, padding: "8px 12px", fontSize: 12.5, color: "#666" }}>
                <strong style={{ color: "#333" }}>{f.template_name}</strong> · Completed{" "}
                {f.completed_at ? new Date(f.completed_at).toLocaleDateString() : "—"}
                {f.signature_name ? ` · Signed by ${f.signature_name}` : ""}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
