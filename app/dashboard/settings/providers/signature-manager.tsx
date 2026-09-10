"use client";

import { useState } from "react";
import { uploadSignatureAction } from "../actions";
import { UploadProgress } from "@/components/loading/upload-progress";

// A new upload replaces the active signature immediately — no Clinic Admin
// approval step (per explicit instruction; see migration
// provider_signature_and_credentials_no_approval). It's used right away on
// anything that pulls the provider's signature, including the live
// preview panels on Settings > Medical Certificates and > Progress Note
// Templates.
//
// Shows a local object-URL preview of the picked file as soon as the upload
// succeeds, instead of calling router.refresh() to fetch the new signed URL.
// router.refresh() used to run right after the success message was set,
// re-rendering this section from the server and resetting the upload widget
// (message included) before it was ever visible — same latent bug found and
// fixed in the photo uploaders that copied this pattern. uploadSignatureAction
// already revalidates the relevant paths, so the real signed URL is picked
// up next time these pages are navigated to.
export function SignatureManager({ activeSignatureUrl }: { activeSignatureUrl: string | null }) {
  const [uploading, setUploading] = useState(false);
  const [uploadStatus, setUploadStatus] = useState<"idle" | "uploading" | "success" | "error">("idle");
  const [message, setMessage] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  function handlePick(file: File | null) {
    if (!file) return;
    setUploading(true);
    setUploadStatus("uploading");
    setMessage(null);
    const formData = new FormData();
    formData.set("file", file);
    uploadSignatureAction(formData)
      .then(() => {
        setPreviewUrl(URL.createObjectURL(file));
        setUploadStatus("success");
        setMessage("Signature updated — it's active immediately.");
      })
      .catch((e: any) => {
        setUploadStatus("error");
        setMessage(`Error: ${e.message}`);
      })
      .finally(() => setUploading(false));
  }

  const displaySignatureUrl = previewUrl ?? activeSignatureUrl;

  return (
    <div style={{ background: "var(--card-bg)", border: "1px solid var(--card-border)", borderRadius: 12, padding: 24 }}>
      <h2 style={{ fontSize: 15, marginTop: 0, marginBottom: 4 }}>Your e-signature</h2>
      <p style={{ fontSize: 12, color: "#999", marginBottom: 16 }}>
        Used automatically on medical certificates, progress notes, and referrals. Uploading a new one replaces the
        active signature right away.
      </p>

      <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 14 }}>
        <div style={{ width: 160, height: 70, borderRadius: 8, border: "1px solid #eee", display: "flex", alignItems: "center", justifyContent: "center", background: "#fafafa" }}>
          {displaySignatureUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={displaySignatureUrl} alt="Your signature" style={{ maxWidth: "100%", maxHeight: "100%" }} />
          ) : (
            <span style={{ fontSize: 11, color: "#bbb" }}>No signature on file yet</span>
          )}
        </div>
        <div>
          <input type="file" accept="image/png,image/jpeg,image/webp" onChange={(e) => handlePick(e.target.files?.[0] ?? null)} disabled={uploading} style={{ fontSize: 12 }} />
          <p style={{ fontSize: 11, color: "#999", margin: "4px 0 0" }}>PNG, JPG, or WEBP, up to 1MB.</p>
          {uploadStatus !== "idle" && (
            <div style={{ marginTop: 6 }}>
              <UploadProgress
                status={uploadStatus}
                label="Uploading signature..."
                successLabel="Signature updated — active immediately."
                errorLabel={message?.replace(/^Error:\s*/, "") || "Upload failed. Please try again."}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
