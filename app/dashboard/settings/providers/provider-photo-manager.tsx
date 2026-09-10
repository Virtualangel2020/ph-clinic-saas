"use client";

import { useState } from "react";
import { uploadProviderPhotoAction } from "../actions";
import { UploadProgress } from "@/components/loading/upload-progress";

// Shown on this page and, if the provider turns on the public directory
// listing (currently off — see providers/page.tsx), on the public
// Find-a-Doctor directory + their profile page. A new upload replaces the
// active photo immediately, same as the signature manager right above it.
//
// Shows a local object-URL preview of the picked file as soon as the upload
// succeeds, instead of calling router.refresh() to fetch the new public URL.
// router.refresh() used to run right after the "Photo updated." message was
// set, which re-rendered this section from the server and reset the upload
// widget (message included) before it ever became visible — the upload was
// actually succeeding the whole time, there was just never any visible
// confirmation. uploadProviderPhotoAction already revalidates the relevant
// paths, so the real (public) URL is picked up next time these pages are
// navigated to.
export function ProviderPhotoManager({ photoUrl, initials }: { photoUrl: string | null; initials: string }) {
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
    uploadProviderPhotoAction(formData)
      .then(() => {
        setPreviewUrl(URL.createObjectURL(file));
        setUploadStatus("success");
        setMessage("Photo updated.");
      })
      .catch((e: any) => {
        setUploadStatus("error");
        setMessage(`Error: ${e.message}`);
      })
      .finally(() => setUploading(false));
  }

  const displayUrl = previewUrl ?? photoUrl;

  return (
    <div style={{ background: "var(--card-bg)", border: "1px solid var(--card-border)", borderRadius: 12, padding: 24 }}>
      <h2 style={{ fontSize: 15, marginTop: 0, marginBottom: 4 }}>Your photo</h2>
      <p style={{ fontSize: 12, color: "#999", marginBottom: 16 }}>
        Shown on your profile, and on the public Find-a-Doctor directory if you turn that on below.
      </p>

      <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 14 }}>
        <div
          style={{
            width: 72,
            height: 72,
            borderRadius: "50%",
            overflow: "hidden",
            background: "var(--brand-primary)",
            color: "white",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 24,
            fontWeight: 700,
            flexShrink: 0,
          }}
        >
          {displayUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={displayUrl} alt="Your photo" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
          ) : (
            initials
          )}
        </div>
        <div>
          <input type="file" accept="image/png,image/jpeg,image/webp" onChange={(e) => handlePick(e.target.files?.[0] ?? null)} disabled={uploading} style={{ fontSize: 12 }} />
          <p style={{ fontSize: 11, color: "#999", margin: "4px 0 0" }}>PNG, JPG, or WEBP, up to 3MB.</p>
          {uploadStatus !== "idle" && (
            <div style={{ marginTop: 6 }}>
              <UploadProgress
                status={uploadStatus}
                label="Uploading photo..."
                successLabel="Photo updated."
                errorLabel={message?.replace(/^Error:\s*/, "") || "Upload failed. Please try again."}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
