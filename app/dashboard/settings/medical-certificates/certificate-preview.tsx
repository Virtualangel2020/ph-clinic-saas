"use client";

import { DocumentPreviewFrame, LetterheadBlock } from "@/components/document-preview-frame";

type Field = { key: string; label: string; type: "text" | "textarea" | "date" };

const SAMPLE_VALUE: Record<Field["type"], string> = {
  text: "Sample response",
  textarea: "This is a sample of how a longer response will wrap across the printed certificate.",
  date: "August 24, 2026",
};

// Live preview of the Medical Certificate template as it will actually
// print/PDF once issuance ships — same letterhead, same "always included"
// patient/provider blocks, plus whatever custom fields are configured on
// the left. Sample data throughout since no real patient is attached to a
// template.
export function CertificatePreview({
  clinicName,
  logoUrl,
  addressLine,
  contactLine,
  providerName,
  providerCredentials,
  signatureImageUrl,
  fields,
}: {
  clinicName: string;
  logoUrl: string | null;
  addressLine: string;
  contactLine: string;
  providerName: string;
  providerCredentials: string | null;
  signatureImageUrl: string | null;
  fields: Field[];
}) {
  return (
    <DocumentPreviewFrame>
      <LetterheadBlock clinicName={clinicName} logoUrl={logoUrl} addressLine={addressLine} contactLine={contactLine} />

      <div style={{ textAlign: "center", fontSize: 16, fontWeight: 700, letterSpacing: 1, marginBottom: 4 }}>MEDICAL CERTIFICATE</div>
      <div style={{ textAlign: "right", fontSize: 12, color: "#555", marginBottom: 18 }}>
        Date issued: {new Date().toLocaleDateString("en-PH", { year: "numeric", month: "long", day: "numeric" })}
      </div>

      <p style={{ margin: "0 0 14px" }}>
        This is to certify that <strong>Juan Dela Cruz</strong>, 34 years old, Male, of{" "}
        <span style={{ color: "#999" }}>[patient address]</span>, was examined/consulted at this clinic.
      </p>

      {fields.length === 0 ? (
        <p style={{ color: "#999", fontStyle: "italic", margin: "0 0 14px" }}>No additional fields configured yet.</p>
      ) : (
        <div style={{ display: "grid", gap: 12, marginBottom: 14 }}>
          {fields.map((f, i) => (
            <div key={i}>
              <div style={{ fontSize: 11, fontWeight: 700, color: "#0c1730", textTransform: "uppercase", letterSpacing: 0.3, marginBottom: 2 }}>
                {f.label || "(untitled field)"}
              </div>
              <div>{SAMPLE_VALUE[f.type]}</div>
            </div>
          ))}
        </div>
      )}

      <p style={{ margin: "0 0 32px" }}>This certification is issued upon the patient's request for whatever legal purpose it may serve.</p>

      <div style={{ marginLeft: "auto", width: 220, textAlign: "center" }}>
        {signatureImageUrl ? (
          // Bottom-aligned within a fixed-height box so the visible ink
          // sits close to the printed name regardless of the signature
          // image's own aspect ratio, and centered so it lines up over
          // the name/credentials rather than flush to one edge.
          <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "center", height: 76, marginBottom: 2 }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={signatureImageUrl} alt="Signature" style={{ maxHeight: 76, maxWidth: 200, display: "block" }} />
          </div>
        ) : (
          <div style={{ borderBottom: "1px solid #999", width: 200, margin: "0 auto 4px", height: 44 }} />
        )}
        <div style={{ fontWeight: 700 }}>{providerName || "Provider name"}</div>
        <div style={{ fontSize: 11, color: "#777" }}>{providerCredentials || "License No. _________ · PTR No. _________"}</div>
      </div>
    </DocumentPreviewFrame>
  );
}
