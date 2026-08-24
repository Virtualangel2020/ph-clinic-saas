"use client";

import { DocumentPreviewFrame, LetterheadBlock } from "@/components/document-preview-frame";
import { parseCheckboxOptions, isOtherOption } from "@/lib/forms/checkbox-options";

type FieldType = "text" | "date" | "select" | "checkbox" | "textarea";
type Field = { key: string; label: string; type: FieldType; required: boolean; options?: string };
type ConsentField = { key: "body"; type: "richtext"; label: string; value: string };

const INPUT_STYLE: React.CSSProperties = {
  width: "100%",
  boxSizing: "border-box",
  border: "none",
  borderBottom: "1px solid #999",
  background: "transparent",
  padding: "3px 0",
  fontSize: 13,
  fontFamily: "inherit",
  color: "#999",
};

// Live preview of an intake/consent/other patient form — rendered as the
// patient would actually see and fill it (on paper or on the Patient
// Portal), not as the admin's editing UI. Inputs are disabled/sample-filled
// since there's no real patient attached to a template.
export function FormPreview({
  clinicName,
  logoUrl,
  addressLine,
  contactLine,
  templateName,
  category,
  fields,
  consentBody,
}: {
  clinicName: string;
  logoUrl: string | null;
  addressLine: string;
  contactLine: string;
  templateName: string;
  category: "intake" | "consent" | "other";
  fields: Field[];
  consentBody: string;
}) {
  return (
    <DocumentPreviewFrame>
      <LetterheadBlock clinicName={clinicName} logoUrl={logoUrl} addressLine={addressLine} contactLine={contactLine} />

      <div style={{ textAlign: "center", fontSize: 15, fontWeight: 700, marginBottom: 18 }}>{templateName || "(untitled form)"}</div>

      {category === "consent" ? (
        <div>
          <p style={{ whiteSpace: "pre-wrap", margin: "0 0 28px" }}>{consentBody || <span style={{ color: "#bbb", fontStyle: "italic" }}>No consent text yet.</span>}</p>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>
            <div>
              <div style={{ ...INPUT_STYLE, marginBottom: 2 }}>Juan Dela Cruz</div>
              <div style={{ fontSize: 10.5, color: "#999" }}>Patient signature</div>
            </div>
            <div>
              <div style={{ ...INPUT_STYLE, marginBottom: 2 }}>{new Date().toLocaleDateString()}</div>
              <div style={{ fontSize: 10.5, color: "#999" }}>Date</div>
            </div>
          </div>
        </div>
      ) : fields.length === 0 ? (
        <p style={{ color: "#bbb", fontStyle: "italic" }}>No fields yet.</p>
      ) : (
        <div style={{ display: "grid", gap: 16 }}>
          {fields.map((f, i) => (
            <div key={i}>
              <div style={{ fontSize: 12, marginBottom: 4 }}>
                {f.label || "(untitled field)"}
                {f.required && <span style={{ color: "#a12a2a" }}> *</span>}
              </div>
              {f.type === "textarea" ? (
                <div style={{ ...INPUT_STYLE, borderBottom: "none", border: "1px solid #ccc", borderRadius: 4, padding: 8, minHeight: 40 }}>Sample response</div>
              ) : f.type === "checkbox" ? (
                (() => {
                  const opts = parseCheckboxOptions(f.options);
                  if (opts.length === 0) {
                    return (
                      <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12.5, color: "#999" }}>
                        <input type="checkbox" disabled /> Yes
                      </label>
                    );
                  }
                  const sampleChecked = opts[0];
                  const otherChecked = opts.find((o) => isOtherOption(o)) === sampleChecked;
                  return (
                    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                      {opts.map((o) => (
                        <label key={o} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12.5, color: "#999" }}>
                          <input type="checkbox" disabled checked={o === sampleChecked} readOnly /> {o}
                        </label>
                      ))}
                      {otherChecked && (
                        <div style={{ ...INPUT_STYLE, marginTop: 2 }}>Sample note</div>
                      )}
                    </div>
                  );
                })()
              ) : f.type === "select" ? (
                <div style={INPUT_STYLE}>{(f.options ?? "").split(",").map((o) => o.trim()).filter(Boolean)[0] || "Select an option"}</div>
              ) : f.type === "date" ? (
                <div style={INPUT_STYLE}>{new Date().toLocaleDateString()}</div>
              ) : (
                <div style={INPUT_STYLE}>Sample response</div>
              )}
            </div>
          ))}
        </div>
      )}
    </DocumentPreviewFrame>
  );
}
