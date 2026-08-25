"use client";

import { DocumentPreviewFrame, LetterheadBlock } from "@/components/document-preview-frame";

type Section = { key: "subjective" | "objective" | "assessment" | "plan"; label: string; placeholder: string };

const SAMPLE_VITALS = "BP 120/80 · HR 76 bpm · RR 18 · Temp 36.7°C · O₂ Sat 98% · Wt 68 kg";

// Live preview of a progress note using this template's labels/placeholder
// hints — same layout a printed or PDF'd encounter note uses, with sample
// patient/vitals data so the provider can see how their relabeling reads
// in context before saving.
export function NoteTemplatePreview({
  clinicName,
  logoUrl,
  addressLine,
  contactLine,
  providerName,
  providerCredentials,
  signatureImageUrl,
  sections,
}: {
  clinicName: string;
  logoUrl: string | null;
  addressLine: string;
  contactLine: string;
  providerName: string;
  providerCredentials: string | null;
  signatureImageUrl: string | null;
  sections: Section[];
}) {
  return (
    <DocumentPreviewFrame>
      <LetterheadBlock clinicName={clinicName} logoUrl={logoUrl} addressLine={addressLine} contactLine={contactLine} />

      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: "#555", marginBottom: 4 }}>
        <span>
          Patient: <strong style={{ color: "#1a1a1a" }}>Juan Dela Cruz</strong> · 34y/o Male
        </span>
        <span>{new Date().toLocaleDateString("en-PH", { year: "numeric", month: "long", day: "numeric" })}</span>
      </div>
      <div style={{ fontSize: 12, color: "#555", marginBottom: 16 }}>Provider: {providerName || "Provider name"}</div>

      <div style={{ fontSize: 12, marginBottom: 16, color: "#555" }}>
        <strong style={{ color: "#1a1a1a" }}>Chief complaint:</strong> Follow-up, hypertension
      </div>

      <div style={{ fontSize: 11, fontWeight: 700, color: "#0c1730", textTransform: "uppercase", letterSpacing: 0.3, marginBottom: 4 }}>Vitals</div>
      <div style={{ marginBottom: 16 }}>{SAMPLE_VITALS}</div>

      <div style={{ display: "grid", gap: 14 }}>
        {sections.map((s) => (
          <div key={s.key}>
            <div style={{ fontSize: 11, fontWeight: 700, color: "#0c1730", textTransform: "uppercase", letterSpacing: 0.3, marginBottom: 4 }}>
              {s.label || "(untitled section)"}
            </div>
            <div style={{ color: s.placeholder ? "#333" : "#bbb", fontStyle: s.placeholder ? "normal" : "italic" }}>
              {s.placeholder || "No placeholder hint set."}
            </div>
          </div>
        ))}
      </div>

      <div style={{ marginTop: 32, textAlign: "right" }}>
        {signatureImageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={signatureImageUrl} alt="Signature" style={{ maxHeight: 64, maxWidth: 280, marginLeft: "auto", marginBottom: 4, display: "block" }} />
        ) : (
          <div style={{ borderBottom: "1px solid #999", width: 280, marginLeft: "auto", marginBottom: 4, height: 44 }} />
        )}
        <div style={{ fontWeight: 700 }}>{providerName || "Provider name"}</div>
        {providerCredentials && <div style={{ fontSize: 11, color: "#777" }}>{providerCredentials}</div>}
      </div>
    </DocumentPreviewFrame>
  );
}
