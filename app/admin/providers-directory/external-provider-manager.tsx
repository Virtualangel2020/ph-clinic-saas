"use client";

import { useRef, useState, useTransition } from "react";
import {
  upsertExternalProviderAction,
  deleteExternalProviderAction,
  uploadExternalProviderPhotoAction,
} from "@/app/admin/actions";

type Provider = {
  id: string;
  full_name: string;
  credentials: string | null;
  specialty: string | null;
  subspecialty: string | null;
  clinic_name: string | null;
  hospital: string | null;
  address: string | null;
  city: string | null;
  contact_number: string | null;
  photo_path: string | null;
  schedule_text: string | null;
  source: string;
  source_url: string | null;
  verified_at: string | null;
  is_active: boolean;
};

export function ExternalProviderManager({ providers, photoUrls }: { providers: Provider[]; photoUrls: Record<string, string> }) {
  const [editingId, setEditingId] = useState<string | "new" | null>(null);

  return (
    <div style={{ display: "grid", gap: 12 }}>
      {editingId === "new" && (
        <ProviderForm provider={null} photoUrl={null} onDone={() => setEditingId(null)} onCancel={() => setEditingId(null)} />
      )}

      {providers.map((p) =>
        editingId === p.id ? (
          <ProviderForm key={p.id} provider={p} photoUrl={photoUrls[p.id] ?? null} onDone={() => setEditingId(null)} onCancel={() => setEditingId(null)} />
        ) : (
          <ProviderCard key={p.id} provider={p} photoUrl={photoUrls[p.id] ?? null} onEdit={() => setEditingId(p.id)} />
        )
      )}

      {editingId !== "new" && (
        <button
          onClick={() => setEditingId("new")}
          style={{ padding: "10px 16px", borderRadius: 8, border: "1px solid #2563eb", background: "white", color: "#2563eb", fontWeight: 600, fontSize: 13, cursor: "pointer", justifySelf: "start" }}
        >
          + Add Provider
        </button>
      )}

      {providers.length === 0 && editingId !== "new" && (
        <p style={{ color: "#888", fontSize: 13 }}>No external providers yet — add one above, or leave this empty for now.</p>
      )}
    </div>
  );
}

function ProviderCard({ provider, photoUrl, onEdit }: { provider: Provider; photoUrl: string | null; onEdit: () => void }) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function remove() {
    if (!confirm(`Delete ${provider.full_name} from the directory? This can't be undone.`)) return;
    startTransition(async () => {
      try {
        await deleteExternalProviderAction(provider.id);
      } catch (e: any) {
        setError(e.message);
      }
    });
  }

  return (
    <div style={{ background: "white", border: "1px solid #e2e2e5", borderRadius: 10, padding: 14, display: "flex", gap: 14, alignItems: "flex-start" }}>
      <div style={{ width: 52, height: 52, borderRadius: 8, overflow: "hidden", background: "#f0f0f0", flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
        {photoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={photoUrl} alt={provider.full_name} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
        ) : (
          <span style={{ fontSize: 10, color: "#bbb" }}>No photo</span>
        )}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontWeight: 700, fontSize: 14 }}>
          {provider.full_name}
          {provider.credentials && <span style={{ fontWeight: 400, color: "#888" }}> · {provider.credentials}</span>}
          {!provider.is_active && (
            <span style={{ marginLeft: 8, fontSize: 10.5, color: "#999", background: "#f0f0f0", padding: "2px 7px", borderRadius: 999 }}>Inactive — hidden from public site</span>
          )}
          {provider.verified_at && (
            <span style={{ marginLeft: 8, fontSize: 10.5, color: "#1a7f37", background: "#e6f4ea", padding: "2px 7px", borderRadius: 999 }}>Verified</span>
          )}
        </div>
        <div style={{ color: "#666", fontSize: 12.5, marginTop: 2 }}>{[provider.specialty, provider.subspecialty].filter(Boolean).join(" · ")}</div>
        <div style={{ color: "#999", fontSize: 12, marginTop: 2 }}>{[provider.clinic_name || provider.hospital, provider.city].filter(Boolean).join(" · ")}</div>
        {provider.contact_number && <div style={{ color: "#999", fontSize: 12, marginTop: 2 }}>{provider.contact_number}</div>}
        {error && <p style={{ color: "crimson", fontSize: 12, marginTop: 6 }}>{error}</p>}
      </div>
      <div style={{ display: "flex", gap: 8, flexShrink: 0 }}>
        <button onClick={onEdit} style={{ background: "none", border: "1px solid #ddd", borderRadius: 7, padding: "6px 12px", fontSize: 12, cursor: "pointer" }}>
          Edit
        </button>
        <button onClick={remove} disabled={pending} style={{ background: "none", border: "1px solid #f3c6c6", borderRadius: 7, padding: "6px 12px", fontSize: 12, cursor: "pointer", color: "crimson" }}>
          {pending ? "…" : "Delete"}
        </button>
      </div>
    </div>
  );
}

const inputStyle: React.CSSProperties = { width: "100%", boxSizing: "border-box", padding: "8px 10px", borderRadius: 7, border: "1px solid #ccc", fontSize: 13 };
const labelStyle: React.CSSProperties = { fontSize: 11.5, fontWeight: 600, color: "#555", marginBottom: 4, display: "block" };

function ProviderForm({ provider, photoUrl, onDone, onCancel }: { provider: Provider | null; photoUrl: string | null; onDone: () => void; onCancel: () => void }) {
  const [fullName, setFullName] = useState(provider?.full_name ?? "");
  const [credentials, setCredentials] = useState(provider?.credentials ?? "");
  const [specialty, setSpecialty] = useState(provider?.specialty ?? "");
  const [subspecialty, setSubspecialty] = useState(provider?.subspecialty ?? "");
  const [clinicName, setClinicName] = useState(provider?.clinic_name ?? "");
  const [hospital, setHospital] = useState(provider?.hospital ?? "");
  const [address, setAddress] = useState(provider?.address ?? "");
  const [city, setCity] = useState(provider?.city ?? "");
  const [contactNumber, setContactNumber] = useState(provider?.contact_number ?? "");
  const [scheduleText, setScheduleText] = useState(provider?.schedule_text ?? "");
  const [source, setSource] = useState(provider?.source ?? "");
  const [sourceUrl, setSourceUrl] = useState(provider?.source_url ?? "");
  const [verified, setVerified] = useState(!!provider?.verified_at);
  const [isActive, setIsActive] = useState(provider?.is_active ?? true);
  const [photoPath, setPhotoPath] = useState<string | null>(provider?.photo_path ?? null);
  const [previewUrl, setPreviewUrl] = useState(photoUrl);
  const [uploading, setUploading] = useState(false);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  function handlePhotoPick(file: File | null) {
    if (!file) return;
    setUploading(true);
    setError(null);
    const formData = new FormData();
    formData.set("file", file);
    uploadExternalProviderPhotoAction(formData)
      .then((path) => {
        setPhotoPath(path);
        setPreviewUrl(URL.createObjectURL(file));
      })
      .catch((e: any) => setError(e.message))
      .finally(() => setUploading(false));
  }

  function save() {
    if (!fullName.trim()) {
      setError("Provider name is required.");
      return;
    }
    setError(null);
    startTransition(async () => {
      try {
        await upsertExternalProviderAction({
          id: provider?.id ?? null,
          fullName,
          credentials,
          specialty,
          subspecialty,
          clinicName,
          hospital,
          address,
          city,
          contactNumber,
          photoPath,
          scheduleText,
          source,
          sourceUrl,
          verified,
          isActive,
        });
        onDone();
      } catch (e: any) {
        setError(e.message);
      }
    });
  }

  return (
    <div style={{ background: "white", border: "1px solid #2563eb", borderRadius: 10, padding: 18 }}>
      <div style={{ display: "flex", gap: 16, marginBottom: 14 }}>
        <div style={{ width: 72, height: 72, borderRadius: 8, overflow: "hidden", background: "#f7f7f8", border: "1px solid #eee", flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
          {previewUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={previewUrl} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
          ) : (
            <span style={{ fontSize: 10, color: "#bbb" }}>No photo</span>
          )}
        </div>
        <div>
          <div style={labelStyle}>Photo</div>
          <input ref={fileInput} type="file" accept="image/png,image/jpeg,image/webp" onChange={(e) => handlePhotoPick(e.target.files?.[0] ?? null)} disabled={uploading} style={{ fontSize: 12 }} />
          <p style={{ fontSize: 11, color: "#999", margin: "4px 0 0" }}>PNG, JPG, or WEBP, up to 3MB.</p>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 10, marginBottom: 10 }}>
        <div>
          <div style={labelStyle}>Full name *</div>
          <input style={inputStyle} value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="Dr. Juan Dela Cruz" />
        </div>
        <div>
          <div style={labelStyle}>Credentials</div>
          <input style={inputStyle} value={credentials} onChange={(e) => setCredentials(e.target.value)} placeholder="MD, FPCP" />
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 10, marginBottom: 10 }}>
        <div>
          <div style={labelStyle}>Specialty</div>
          <input style={inputStyle} value={specialty} onChange={(e) => setSpecialty(e.target.value)} placeholder="Internal Medicine" />
        </div>
        <div>
          <div style={labelStyle}>Subspecialty</div>
          <input style={inputStyle} value={subspecialty} onChange={(e) => setSubspecialty(e.target.value)} />
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 10, marginBottom: 10 }}>
        <div>
          <div style={labelStyle}>Clinic name</div>
          <input style={inputStyle} value={clinicName} onChange={(e) => setClinicName(e.target.value)} />
        </div>
        <div>
          <div style={labelStyle}>Hospital (optional)</div>
          <input style={inputStyle} value={hospital} onChange={(e) => setHospital(e.target.value)} />
        </div>
      </div>

      <div style={{ marginBottom: 10 }}>
        <div style={labelStyle}>Clinic location / address</div>
        <input style={inputStyle} value={address} onChange={(e) => setAddress(e.target.value)} placeholder="Unit 4, ABC Building, Makati Ave." />
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 10, marginBottom: 10 }}>
        <div>
          <div style={labelStyle}>City</div>
          <input style={inputStyle} value={city} onChange={(e) => setCity(e.target.value)} />
        </div>
        <div>
          <div style={labelStyle}>Clinic phone number</div>
          <input style={inputStyle} value={contactNumber} onChange={(e) => setContactNumber(e.target.value)} placeholder="+63 2 8123 4567" />
        </div>
      </div>

      <div style={{ marginBottom: 10 }}>
        <div style={labelStyle}>Schedule</div>
        <textarea
          style={{ ...inputStyle, minHeight: 60, fontFamily: "inherit" }}
          value={scheduleText}
          onChange={(e) => setScheduleText(e.target.value)}
          placeholder={"Mon–Fri: 9:00 AM – 5:00 PM\nSat: 9:00 AM – 12:00 PM"}
        />
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 10, marginBottom: 12 }}>
        <div>
          <div style={labelStyle}>Source (how you verified this)</div>
          <input style={inputStyle} value={source} onChange={(e) => setSource(e.target.value)} placeholder="e.g. PRC license lookup, clinic website" />
        </div>
        <div>
          <div style={labelStyle}>Source link (optional)</div>
          <input style={inputStyle} value={sourceUrl} onChange={(e) => setSourceUrl(e.target.value)} placeholder="https://…" />
        </div>
      </div>

      <div style={{ display: "flex", gap: 18, marginBottom: 14, fontSize: 12.5 }}>
        <label style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <input type="checkbox" checked={verified} onChange={(e) => setVerified(e.target.checked)} />
          I've verified this information
        </label>
        <label style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <input type="checkbox" checked={isActive} onChange={(e) => setIsActive(e.target.checked)} />
          Visible on public site
        </label>
      </div>

      {error && <p style={{ color: "crimson", fontSize: 12.5, marginBottom: 10 }}>{error}</p>}

      <div style={{ display: "flex", gap: 10 }}>
        <button
          onClick={save}
          disabled={pending || uploading}
          style={{ background: "#0c1730", color: "#e6c66b", fontWeight: 700, fontSize: 13, padding: "9px 18px", borderRadius: 8, border: "none", cursor: "pointer" }}
        >
          {pending ? "Saving…" : provider ? "Save changes" : "Add provider"}
        </button>
        <button onClick={onCancel} style={{ background: "none", border: "1px solid #ddd", borderRadius: 8, padding: "9px 18px", fontSize: 13, cursor: "pointer" }}>
          Cancel
        </button>
      </div>
    </div>
  );
}
