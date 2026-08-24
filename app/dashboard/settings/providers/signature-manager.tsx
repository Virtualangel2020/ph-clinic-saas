"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { uploadSignatureAction } from "../actions";

// A new upload replaces the active signature immediately — no Clinic Admin
// approval step (per explicit instruction; see migration
// provider_signature_and_credentials_no_approval). It's used right away on
// anything that pulls the provider's signature, including the live
// preview panels on Settings > Medical Certificates and > Progress Note
// Templates.
export function SignatureManager({ activeSignatureUrl }: { activeSignatureUrl: string | null }) {
  const router = useRouter();
  const [uploading, setUploading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  function handlePick(file: File | null) {
    if (!file) return;
    setUploading(true);
    setMessage(null);
    const formData = new FormData();
    formData.set("file", file);
    uploadSignatureAction(formData)
      .then(() => {
        setMessage("Signature updated — it's active immediately.");
        router.refresh();
      })
      .catch((e: any) => setMessage(`Error: ${e.message}`))
      .finally(() => setUploading(false));
  }

  return (
    <div style={{ background: "var(--card-bg)", border: "1px solid var(--card-border)", borderRadius: 12, padding: 24 }}>
      <h2 style={{ fontSize: 15, marginTop: 0, marginBottom: 4 }}>Your e-signature</h2>
      <p style={{ fontSize: 12, color: "#999", marginBottom: 16 }}>
        Used automatically on medical certificates, progress notes, and referrals. Uploading a new one replaces the
        active signature right away.
      </p>

      <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 14 }}>
        <div style={{ width: 160, height: 70, borderRadius: 8, border: "1px solid #eee", display: "flex", alignItems: "center", justifyContent: "center", background: "#fafafa" }}>
          {activeSignatureUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={activeSignatureUrl} alt="Your signature" style={{ maxWidth: "100%", maxHeight: "100%" }} />
          ) : (
            <span style={{ fontSize: 11, color: "#bbb" }}>No signature on file yet</span>
          )}
        </div>
        <div>
          <input type="file" accept="image/png,image/jpeg,image/webp" onChange={(e) => handlePick(e.target.files?.[0] ?? null)} disabled={uploading} style={{ fontSize: 12 }} />
          <p style={{ fontSize: 11, color: "#999", margin: "4px 0 0" }}>PNG, JPG, or WEBP, up to 1MB.</p>
        </div>
      </div>

      {message && <p style={{ fontSize: 12, color: message.startsWith("Error") ? "crimson" : "#1a7f37", marginTop: 10 }}>{message}</p>}
    </div>
  );
}
