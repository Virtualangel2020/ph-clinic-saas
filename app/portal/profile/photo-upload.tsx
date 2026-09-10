"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { uploadMyPhotoAction } from "../actions";
import { UploadProgress } from "@/components/loading/upload-progress";

// A new upload replaces the active photo immediately. Shown here (your own
// Profile) and, if a clinic connection exists, on your record in that
// clinic's EHR chart too — never public, only you and clinic staff you're
// actually connected to can ever see it (patient-photos storage policies).
export function PhotoUpload({ photoUrl, initials }: { photoUrl: string | null; initials: string }) {
  const router = useRouter();
  const [uploading, setUploading] = useState(false);
  const [uploadStatus, setUploadStatus] = useState<"idle" | "uploading" | "success" | "error">("idle");
  const [message, setMessage] = useState<string | null>(null);

  function handlePick(file: File | null) {
    if (!file) return;
    setUploading(true);
    setUploadStatus("uploading");
    setMessage(null);
    const formData = new FormData();
    formData.set("file", file);
    uploadMyPhotoAction(formData)
      .then(() => {
        setUploadStatus("success");
        setMessage("Photo updated.");
        router.refresh();
      })
      .catch((e: any) => {
        setUploadStatus("error");
        setMessage(`Error: ${e.message}`);
      })
      .finally(() => setUploading(false));
  }

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
        {photoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={photoUrl} alt="Your photo" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
        ) : (
          initials
        )}
      </div>
      <div>
        <input type="file" accept="image/png,image/jpeg,image/webp" onChange={(e) => handlePick(e.target.files?.[0] ?? null)} disabled={uploading} style={{ fontSize: 12 }} />
        <p style={{ fontSize: 11, color: "#999", margin: "4px 0 0" }}>PNG, JPG, or WEBP, up to 3MB. Only you and your clinic can see this.</p>
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
