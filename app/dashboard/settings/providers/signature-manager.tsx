"use client";

import { useState } from "react";
import { uploadSignatureAction } from "../actions";

type Signature = {
  id: string;
  status: string;
  signature_path: string;
  requested_at: string;
  reviewed_at: string | null;
  rejection_note: string | null;
};

export function SignatureManager({ signatures, activeSignatureUrl }: { signatures: Signature[]; activeSignatureUrl: string | null }) {
  const [uploading, setUploading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const pending = signatures.find((s) => s.status === "pending");

  function handlePick(file: File | null) {
    if (!file) return;
    setUploading(true);
    setMessage(null);
    const formData = new FormData();
    formData.set("file", file);
    uploadSignatureAction(formData)
      .then(() => setMessage("Sent to your Clinic Admin for approval. Your current approved signature (if any) keeps working until this one is approved."))
      .catch((e: any) => setMessage(`Error: ${e.message}`))
      .finally(() => setUploading(false));
  }

  return (
    <div style={{ background: "white", border: "1px solid #e2e2e5", borderRadius: 12, padding: 24 }}>
      <h2 style={{ fontSize: 15, marginTop: 0, marginBottom: 4 }}>Your e-signature</h2>
      <p style={{ fontSize: 12, color: "#999", marginBottom: 16 }}>
        Used automatically on progress notes, prescriptions, and referrals once those ship. A new signature needs
        Clinic Admin approval before it becomes active — nothing is silently replaced.
      </p>

      <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 14 }}>
        <div style={{ width: 160, height: 70, borderRadius: 8, border: "1px solid #eee", display: "flex", alignItems: "center", justifyContent: "center", background: "#fafafa" }}>
          {activeSignatureUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={activeSignatureUrl} alt="Approved signature" style={{ maxWidth: "100%", maxHeight: "100%" }} />
          ) : (
            <span style={{ fontSize: 11, color: "#bbb" }}>No approved signature yet</span>
          )}
        </div>
        <div>
          <input type="file" accept="image/png,image/jpeg,image/webp" onChange={(e) => handlePick(e.target.files?.[0] ?? null)} disabled={uploading || !!pending} style={{ fontSize: 12 }} />
          <p style={{ fontSize: 11, color: "#999", margin: "4px 0 0" }}>PNG, JPG, or WEBP, up to 1MB.</p>
        </div>
      </div>

      {pending && (
        <div style={{ background: "#fff7e6", border: "1px solid #e6c66b", borderRadius: 8, padding: "8px 12px", fontSize: 12, color: "#7a5c12" }}>
          A signature you uploaded on {new Date(pending.requested_at).toLocaleDateString()} is waiting on Clinic Admin approval.
        </div>
      )}

      {message && <p style={{ fontSize: 12, color: message.startsWith("Error") ? "crimson" : "#1a7f37", marginTop: 10 }}>{message}</p>}
    </div>
  );
}
