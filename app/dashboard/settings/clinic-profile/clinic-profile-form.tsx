"use client";

import { useRef, useState, useTransition } from "react";
import { setClinicBrandingAction, uploadClinicLogoAction } from "../actions";

type Settings = {
  clinic_name: string | null;
  logo_path: string | null;
  address_line1: string | null;
  address_line2: string | null;
  city: string | null;
  province: string | null;
  postal_code: string | null;
  phone: string | null;
  mobile: string | null;
  email: string | null;
  website: string | null;
} | null;

export function ClinicProfileForm({ settings, logoUrl }: { settings: Settings; logoUrl: string | null }) {
  const [clinicName, setClinicName] = useState(settings?.clinic_name ?? "");
  const [logoPath, setLogoPath] = useState(settings?.logo_path ?? null);
  const [previewUrl, setPreviewUrl] = useState(logoUrl);
  const [addressLine1, setAddressLine1] = useState(settings?.address_line1 ?? "");
  const [addressLine2, setAddressLine2] = useState(settings?.address_line2 ?? "");
  const [city, setCity] = useState(settings?.city ?? "");
  const [province, setProvince] = useState(settings?.province ?? "");
  const [postalCode, setPostalCode] = useState(settings?.postal_code ?? "");
  const [phone, setPhone] = useState(settings?.phone ?? "");
  const [mobile, setMobile] = useState(settings?.mobile ?? "");
  const [email, setEmail] = useState(settings?.email ?? "");
  const [website, setWebsite] = useState(settings?.website ?? "");
  const [pending, startTransition] = useTransition();
  const [uploading, setUploading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  function handleLogoPick(file: File | null) {
    if (!file) return;
    setUploading(true);
    setMessage(null);
    const formData = new FormData();
    formData.set("file", file);
    uploadClinicLogoAction(formData)
      .then((path) => {
        setLogoPath(path);
        setPreviewUrl(URL.createObjectURL(file));
        setMessage("Logo uploaded — click Save to apply it.");
      })
      .catch((e: any) => setMessage(`Error: ${e.message}`))
      .finally(() => setUploading(false));
  }

  function save() {
    setMessage(null);
    startTransition(async () => {
      try {
        await setClinicBrandingAction({
          clinicName,
          logoPath,
          addressLine1,
          addressLine2,
          city,
          province,
          postalCode,
          phone,
          mobile,
          email,
          website,
        });
        setMessage("Saved.");
      } catch (e: any) {
        setMessage(`Error: ${e.message}`);
      }
    });
  }

  return (
    <div style={{ background: "white", border: "1px solid #e2e2e5", borderRadius: 12, padding: 24, display: "grid", gap: 14 }}>
      <div>
        <div style={label}>Clinic logo</div>
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <div style={{ width: 72, height: 72, borderRadius: 8, border: "1px solid #eee", display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden", background: "#fafafa" }}>
            {previewUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={previewUrl} alt="Clinic logo" style={{ maxWidth: "100%", maxHeight: "100%" }} />
            ) : (
              <span style={{ fontSize: 11, color: "#bbb" }}>No logo</span>
            )}
          </div>
          <div>
            <input ref={fileInput} type="file" accept="image/png,image/jpeg,image/webp,image/svg+xml" onChange={(e) => handleLogoPick(e.target.files?.[0] ?? null)} style={{ fontSize: 12 }} disabled={uploading} />
            <p style={{ fontSize: 11, color: "#999", margin: "4px 0 0" }}>PNG, JPG, WEBP, or SVG, up to 3MB.</p>
          </div>
        </div>
      </div>

      <Field label="Clinic name" value={clinicName} onChange={setClinicName} />
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 10 }}>
        <Field label="Address line 1" value={addressLine1} onChange={setAddressLine1} />
        <Field label="Address line 2 (optional)" value={addressLine2} onChange={setAddressLine2} />
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))", gap: 10 }}>
        <Field label="City" value={city} onChange={setCity} />
        <Field label="Province" value={province} onChange={setProvince} />
        <Field label="Postal code" value={postalCode} onChange={setPostalCode} />
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 10 }}>
        <Field label="Phone" value={phone} onChange={setPhone} />
        <Field label="Mobile" value={mobile} onChange={setMobile} />
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 10 }}>
        <Field label="Email" value={email} onChange={setEmail} />
        <Field label="Website (optional)" value={website} onChange={setWebsite} />
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 12, marginTop: 4 }}>
        <button onClick={save} disabled={pending || uploading} style={buttonStyle}>
          {pending ? "Saving..." : "Save"}
        </button>
        {message && <span style={{ fontSize: 12, color: message.startsWith("Error") ? "crimson" : "#1a7f37" }}>{message}</span>}
      </div>
    </div>
  );
}

function Field({ label: labelText, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <label>
      <div style={label}>{labelText}</div>
      <input value={value} onChange={(e) => onChange(e.target.value)} style={inputStyle} />
    </label>
  );
}

const label: React.CSSProperties = { fontSize: 12, fontWeight: 600, color: "#555", marginBottom: 6 };
const inputStyle: React.CSSProperties = { width: "100%", boxSizing: "border-box", padding: "9px 10px", borderRadius: 6, border: "1px solid #ccc", fontSize: 13 };
const buttonStyle: React.CSSProperties = { padding: "9px 18px", borderRadius: 8, border: "none", background: "#0c1730", color: "#e6c66b", fontWeight: 700, fontSize: 13, cursor: "pointer" };
