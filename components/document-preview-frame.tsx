// Shared "live preview" chrome for any settings page where a provider is
// building a document template (medical certificates, progress note
// templates, patient forms, and anywhere else a template gets edited).
// Renders as a sticky white "sheet of paper" on the right side of the
// editor so changes to fields/labels/branding are visible immediately,
// without needing to save and reopen the template elsewhere. Deliberately
// always white/black regardless of light/dark theme — it's meant to look
// like the printed or PDF output, not like the app UI around it.
export function DocumentPreviewFrame({ label, children }: { label?: string; children: React.ReactNode }) {
  return (
    <div style={{ position: "sticky", top: 16 }}>
      <div style={{ fontSize: 11, fontWeight: 700, color: "#999", textTransform: "uppercase", letterSpacing: 0.4, marginBottom: 8 }}>
        {label ?? "Live Preview"}
      </div>
      <div
        style={{
          background: "white",
          color: "#1a1a1a",
          border: "1px solid #ddd",
          borderRadius: 4,
          boxShadow: "0 2px 10px rgba(0,0,0,0.12)",
          padding: "36px 32px",
          minHeight: 520,
          fontFamily: "Georgia, 'Times New Roman', serif",
          fontSize: 13,
          lineHeight: 1.55,
        }}
      >
        {children}
      </div>
      <p style={{ fontSize: 11, color: "#999", marginTop: 8 }}>
        This shows sample data so you can check the layout — actual patient details fill in when it's issued.
      </p>
    </div>
  );
}

// Clinic letterhead block — logo + name + address/contact, right-aligned
// contact block underneath the name. Reused at the top of every printed
// clinical document preview (certificates, notes, and eventually
// prescriptions/referrals) so they all look consistent.
export function LetterheadBlock({
  clinicName,
  logoUrl,
  addressLine,
  contactLine,
}: {
  clinicName: string;
  logoUrl: string | null;
  addressLine: string;
  contactLine: string;
}) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 12, borderBottom: "2px solid #0c1730", paddingBottom: 12, marginBottom: 18 }}>
      {logoUrl && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={logoUrl} alt="" style={{ width: 44, height: 44, objectFit: "contain", flexShrink: 0 }} />
      )}
      <div>
        <div style={{ fontSize: 17, fontWeight: 700, color: "#0c1730" }}>{clinicName}</div>
        {addressLine && <div style={{ fontSize: 11, color: "#555" }}>{addressLine}</div>}
        {contactLine && <div style={{ fontSize: 11, color: "#555" }}>{contactLine}</div>}
      </div>
    </div>
  );
}
