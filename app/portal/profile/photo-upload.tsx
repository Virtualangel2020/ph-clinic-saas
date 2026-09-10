"use client";

import { useState } from "react";
import { uploadMyPhotoAction } from "../actions";
import { UploadProgress } from "@/components/loading/upload-progress";

// A new upload replaces the active photo immediately. Shown here (your own
// Profile) and, if a clinic connection exists, on your record in that
// clinic's EHR chart too — never public, only you and clinic staff you're
// actually connected to can ever see it (patient-photos storage policies).
//
// The avatar shows a local object-URL preview of the picked file the instant
// the upload succeeds, rather than waiting on router.refresh() to fetch a
// fresh signed URL from the server. router.refresh() used to be called here
// immediately after showing the "Photo updated." message — but that
// re-renders this whole section from the server, which reset the upload
// widget (including this success message) before it was ever visible. The
// upload itself was working the whole time; nothing ever confirmed it. The
// server action already calls revalidatePath, so the real signed URL is
// picked up next time this page is actually navigated to — no client-side
// refresh needed to make the change durable.
// forAccountId: omit for "my own photo" (Profile page — unchanged
// behavior). Pass a dependent's mycaredesk_accounts id to let a manager
// upload/replace THAT profile's photo instead (My Family screen) — the
// server action re-validates access to that id independently, so this
// prop is a UI convenience, not a trust boundary.
export function PhotoUpload({ photoUrl, initials, forAccountId, caption }: { photoUrl: string | null; initials: string; forAccountId?: string; caption?: string }) {
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
    if (forAccountId) formData.set("forAccountId", forAccountId);
    uploadMyPhotoAction(formData)
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
    <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 16 }}>
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
        <p style={{ fontSize: 11, color: "#999", margin: "4px 0 0" }}>{caption ?? "PNG, JPG, or WEBP, up to 3MB. Only you and your clinic can see this."}</p>
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
  );
}
