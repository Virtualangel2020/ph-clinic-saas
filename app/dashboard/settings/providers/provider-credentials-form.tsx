"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { requestCredentialChangeAction } from "../actions";

type Profile = {
  id: string;
  full_name: string | null;
  title: string | null;
  specialty: string | null;
  subspecialty: string | null;
  prc_license: string | null;
  ptr_number: string | null;
};

const FIELDS: { key: keyof Profile; label: string }[] = [
  { key: "full_name", label: "Full professional name" },
  { key: "title", label: "Title (e.g. MD, Dr.)" },
  { key: "specialty", label: "Specialty" },
  { key: "subspecialty", label: "Subspecialty" },
  { key: "prc_license", label: "PRC license no." },
  { key: "ptr_number", label: "PTR number (if used)" },
];

// Edits apply immediately — no Clinic Admin approval step (per explicit
// instruction; see migration provider_signature_and_credentials_no_approval).
// Updates optimistically so the field reflects the new value right away,
// then reconciles with the server (also refreshes anything elsewhere on
// the page reading these same values, like the live document previews on
// Settings > Medical Certificates / > Progress Note Templates).
export function ProviderCredentialsForm({ profile: initialProfile }: { profile: Profile }) {
  const router = useRouter();
  const [profile, setProfile] = useState(initialProfile);
  const [editing, setEditing] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);

  function submit(fieldKey: string) {
    startTransition(async () => {
      try {
        await requestCredentialChangeAction(fieldKey, draft);
        setProfile((prev) => ({ ...prev, [fieldKey]: draft }));
        setMessage("Saved.");
        setEditing(null);
        router.refresh();
      } catch (e: any) {
        setMessage(`Error: ${e.message}`);
      }
    });
  }

  return (
    <div style={{ background: "var(--card-bg)", border: "1px solid var(--card-border)", borderRadius: 12, padding: 24 }}>
      <h2 style={{ fontSize: 15, marginTop: 0, marginBottom: 4 }}>Your credentials</h2>
      <p style={{ fontSize: 12, color: "#999", marginBottom: 16 }}>
        Auto-populates every document you issue — medical certificates, prescriptions, referrals, and more. Changes
        take effect immediately.
      </p>
      <div style={{ display: "grid", gap: 10 }}>
        {FIELDS.map((f) => (
          <div key={f.key} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 0", borderBottom: "1px solid #f2f2f2" }}>
            <div style={{ width: 190, fontSize: 12, color: "#888" }}>{f.label}</div>
            {editing === f.key ? (
              <>
                <input value={draft} onChange={(e) => setDraft(e.target.value)} style={{ flex: 1, padding: "6px 8px", borderRadius: 6, border: "1px solid var(--input-border)", fontSize: 13 }} autoFocus />
                <button onClick={() => submit(f.key as string)} disabled={pending} style={smallBtn}>Save</button>
                <button onClick={() => setEditing(null)} style={{ ...smallBtn, background: "#888" }}>Cancel</button>
              </>
            ) : (
              <>
                <div style={{ flex: 1, fontSize: 13 }}>{(profile[f.key] as string) || <span style={{ color: "#bbb" }}>Not set</span>}</div>
                <button
                  onClick={() => {
                    setEditing(f.key as string);
                    setDraft((profile[f.key] as string) || "");
                  }}
                  style={{ ...smallBtn, background: "var(--card-bg)", color: "#2563eb", border: "1px solid #2563eb" }}
                >
                  Edit
                </button>
              </>
            )}
          </div>
        ))}
      </div>
      {message && <p style={{ fontSize: 12, color: message.startsWith("Error") ? "crimson" : "#1a7f37", marginTop: 10 }}>{message}</p>}
    </div>
  );
}

const smallBtn: React.CSSProperties = { padding: "5px 10px", borderRadius: 6, border: "none", background: "#2563eb", color: "white", fontSize: 12, fontWeight: 600, cursor: "pointer" };
