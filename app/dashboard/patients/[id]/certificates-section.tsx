"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { issueMedicalCertificateAction, voidMedicalCertificateAction, getMedicalCertificatePdfUrlAction } from "../actions";

type TemplateField = { key: string; label: string; type: "text" | "textarea" | "date" };
type Template = { id: string; name: string; fields_config: TemplateField[] };

export type CertificateRow = {
  id: string;
  certificate_number: string;
  template_name: string;
  fields_snapshot: TemplateField[];
  values: Record<string, string>;
  status: "finalized" | "void";
  void_reason: string | null;
  voided_at: string | null;
  issued_at: string;
  provider_name: string | null;
};

const CARD: React.CSSProperties = { background: "var(--card-bg)", border: "1px solid var(--card-border)", borderRadius: 12, padding: 16 };
const FIELD_STYLE: React.CSSProperties = { border: "1px solid var(--input-border)", borderRadius: 8, padding: "8px 10px", fontSize: 13, fontFamily: "inherit", width: "100%", boxSizing: "border-box" };

// Medical Certificate issuance, live inside the patient chart (Clinical
// tab). Same underlying medical_certificates rows this app's certificate
// template builder (Settings > Medical Certificates) sets fields up for —
// picking a template here snapshots its current fields_config so a later
// template edit never rewrites an already-issued certificate.
export function CertificatesSection({
  patientId,
  certificates,
  templates,
}: {
  patientId: string;
  certificates: CertificateRow[];
  templates: Template[];
}) {
  const router = useRouter();
  const [issuing, setIssuing] = useState(false);
  const [templateId, setTemplateId] = useState(templates[0]?.id ?? "");
  const [values, setValues] = useState<Record<string, string>>({});
  const [pending, startTransition] = useTransition();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const selectedTemplate = templates.find((t) => t.id === templateId) ?? null;

  function startIssue() {
    setTemplateId(templates[0]?.id ?? "");
    setValues({});
    setError(null);
    setIssuing(true);
  }

  function issue() {
    if (!templateId) {
      setError("Choose a template first.");
      return;
    }
    setError(null);
    startTransition(async () => {
      try {
        const id = await issueMedicalCertificateAction(patientId, templateId, values);
        setIssuing(false);
        setValues({});
        router.refresh();
        try {
          const url = await getMedicalCertificatePdfUrlAction(id);
          window.open(url, "_blank", "noopener,noreferrer");
        } catch {
          // PDF may still be generating — the row's "View PDF" button covers a retry.
        }
      } catch (e: any) {
        setError(e.message || "Couldn't issue that certificate.");
      }
    });
  }

  function view(certId: string) {
    setBusyId(certId);
    startTransition(async () => {
      try {
        const url = await getMedicalCertificatePdfUrlAction(certId);
        window.open(url, "_blank", "noopener,noreferrer");
      } catch (e: any) {
        alert(e.message || "Couldn't open this certificate.");
      } finally {
        setBusyId(null);
      }
    });
  }

  function voidCert(certId: string) {
    const reason = prompt("Reason for voiding this certificate (optional):") || "";
    if (!confirm("Void this certificate? It stays on record, marked VOID, and can't be un-voided.")) return;
    setBusyId(certId);
    startTransition(async () => {
      try {
        await voidMedicalCertificateAction(certId, patientId, reason);
        router.refresh();
      } catch (e: any) {
        alert(e.message || "Couldn't void that certificate.");
      } finally {
        setBusyId(null);
      }
    });
  }

  return (
    <div style={{ display: "grid", gap: 14 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <h3 style={{ fontSize: 14, fontWeight: 700, margin: 0 }}>Medical Certificates</h3>
        {!issuing && templates.length > 0 && (
          <button onClick={startIssue} style={{ fontSize: 12, color: "var(--text-heading)", background: "none", border: "none", cursor: "pointer", fontWeight: 600 }}>
            + Issue certificate
          </button>
        )}
      </div>

      {templates.length === 0 && (
        <p style={{ color: "#999", fontSize: 12.5, margin: 0 }}>
          No active certificate template yet — set one up under Settings → Medical Certificates first.
        </p>
      )}

      {issuing && (
        <div style={CARD}>
          <div style={{ display: "grid", gap: 8, marginBottom: 12 }}>
            <select value={templateId} onChange={(e) => { setTemplateId(e.target.value); setValues({}); }} style={FIELD_STYLE}>
              {templates.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
          </div>

          {selectedTemplate && (
            <div style={{ display: "grid", gap: 10, marginBottom: 12 }}>
              {selectedTemplate.fields_config.map((f) => (
                <div key={f.key}>
                  <div style={{ fontSize: 11.5, color: "#888", marginBottom: 3 }}>{f.label}</div>
                  {f.type === "textarea" ? (
                    <textarea
                      value={values[f.key] ?? ""}
                      onChange={(e) => setValues({ ...values, [f.key]: e.target.value })}
                      style={{ ...FIELD_STYLE, minHeight: 60, resize: "vertical" }}
                    />
                  ) : (
                    <input
                      type={f.type === "date" ? "date" : "text"}
                      value={values[f.key] ?? ""}
                      onChange={(e) => setValues({ ...values, [f.key]: e.target.value })}
                      style={FIELD_STYLE}
                    />
                  )}
                </div>
              ))}
            </div>
          )}

          {error && <p style={{ fontSize: 12, color: "#a12a2a", marginBottom: 8 }}>{error}</p>}

          <div style={{ display: "flex", gap: 8 }}>
            <button onClick={issue} disabled={pending} style={{ background: "#0c1730", color: "#e6c66b", border: "none", borderRadius: 8, padding: "8px 16px", fontSize: 12.5, fontWeight: 700, cursor: "pointer" }}>
              {pending ? "Issuing…" : "Issue Certificate"}
            </button>
            <button onClick={() => setIssuing(false)} style={{ background: "none", border: "1px solid var(--input-border)", borderRadius: 8, padding: "8px 16px", fontSize: 12.5, cursor: "pointer", color: "#555" }}>
              Cancel
            </button>
          </div>
        </div>
      )}

      {certificates.length === 0 ? (
        <p style={{ color: "#999", fontSize: 12.5, margin: 0 }}>No certificates issued yet.</p>
      ) : (
        <div style={{ display: "grid", gap: 8 }}>
          {certificates.map((c) => (
            <div key={c.id} style={{ ...CARD, padding: "12px 14px", opacity: c.status === "void" ? 0.65 : 1 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 10, flexWrap: "wrap" }}>
                <div>
                  <div style={{ fontWeight: 700, fontSize: 13.5 }}>
                    {c.template_name}
                    <span style={{ marginLeft: 8, fontSize: 11, color: "#999", fontFamily: "monospace" }}>{c.certificate_number}</span>
                    {c.status === "void" && (
                      <span style={{ marginLeft: 8, fontSize: 10.5, fontWeight: 700, color: "#a12a2a", background: "#fbeaea", border: "1px solid #f0c2c2", borderRadius: 999, padding: "2px 8px" }}>
                        VOID
                      </span>
                    )}
                  </div>
                  <div style={{ fontSize: 11.5, color: "#888", marginTop: 2 }}>
                    Issued {new Date(c.issued_at).toLocaleDateString()}
                    {c.provider_name ? ` · ${c.provider_name}` : ""}
                    {c.status === "void" && c.void_reason ? ` · Voided: ${c.void_reason}` : ""}
                  </div>
                </div>
                <div style={{ display: "flex", gap: 12, flexShrink: 0 }}>
                  <button onClick={() => view(c.id)} disabled={pending && busyId === c.id} style={{ background: "none", border: "none", color: "var(--text-heading)", cursor: "pointer", fontSize: 12, fontWeight: 600 }}>
                    View PDF
                  </button>
                  {c.status === "finalized" && (
                    <button onClick={() => voidCert(c.id)} disabled={pending && busyId === c.id} style={{ background: "none", border: "none", color: "#a12a2a", cursor: "pointer", fontSize: 12 }}>
                      Void
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
