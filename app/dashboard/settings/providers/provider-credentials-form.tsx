"use client";

import { useState, useTransition } from "react";
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

export function ProviderCredentialsForm({
  profile,
  isAdmin,
  pendingRequests,
}: {
  profile: Profile;
  isAdmin: boolean;
  pendingRequests: { id: string; field_key: string; new_value: string }[];
}) {
  const [editing, setEditing] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);

  const pendingByField = new Map(pendingRequests.map((r) => [r.field_key, r]));

  function submit(fieldKey: string) {
    startTransition(async () => {
      try {
        await requestCredentialChangeAction(fieldKey, draft);
        setMessage("Sent for approval — it won't appear on documents until approved (see the queue below).");
        setEditing(null);
      } catch (e: any) {
        setMessage(`Error: ${e.message}`);
      }
    });
  }

  return (
    <div style={{ background: "var(--card-bg)", border: "1px solid var(--card-border)", borderRadius: 12, padding: 24 }}>
      <h2 style={{ fontSize: 15, marginTop: 0, marginBottom: 4 }}>Your credentials</h2>
      <p style={{ fontSize: 12, color: "#999", marginBottom: 16 }}>
        {isAdmin
          ? "These sensitive fields still go through the same approval step for audit purposes — you'll see your own request in the queue below and can approve it in one click."
          : "Changes to these fields go to your Clinic Admin for approval before they take effect."}
      </p>
      <div style={{ display: "grid", gap: 10 }}>
        {FIELDS.map((f) => {
          const pendingReq = pendingByField.get(f.key as string);
          return (
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
                  {pendingReq && (
                    <span style={{ fontSize: 11, color: "#c99a2e", fontWeight: 600 }}>Pending approval: "{pendingReq.new_value}"</span>
                  )}
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
          );
        })}
      </div>
      {message && <p style={{ fontSize: 12, color: message.startsWith("Error") ? "crimson" : "#1a7f37", marginTop: 10 }}>{message}</p>}
    </div>
  );
}

const smallBtn: React.CSSProperties = { padding: "5px 10px", borderRadius: 6, border: "none", background: "#2563eb", color: "white", fontSize: 12, fontWeight: 600, cursor: "pointer" };
