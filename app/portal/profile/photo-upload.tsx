"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { uploadMyPhotoAction } from "../actions";
import { UploadProgress } from "@/components/loading/upload-progress";
import { ImageCropper } from "@/components/image-cropper";

// A new upload replaces the active photo. Shown here (your own Profile)
// and, if a clinic connection exists, on your record in that clinic's EHR
// chart too — never public, only you and clinic staff you're actually
// connected to can ever see it (patient-photos storage policies).
//
// Angel: "Must have a save button for it to save. Also, allow us to crop a
// photo." Picking a file used to upload immediately with no confirmation
// step — the actual save always worked, but nothing you could SEE updated
// until the next full page load (the outer avatar shown next to "Change
// photo" on a dependent's card reads a prop computed once when the page
// server-rendered, so closing the panel right after uploading looked like
// nothing had happened). This now shows a crop step first — drag to
// reposition, zoom, then an explicit "Save Photo" button — and calls
// onUploaded with the cropped preview's local URL so a parent card can
// update its own header avatar immediately, without waiting on
// router.refresh() to fetch a fresh signed URL from the server.
//
// forAccountId: omit for "my own photo" (Profile page — unchanged
// behavior). Pass a dependent's mycaredesk_accounts id to let a manager
// upload/replace THAT profile's photo instead (My Family / dependent
// cards) — the server action re-validates access to that id independently,
// so this prop is a UI convenience, not a trust boundary.
export function PhotoUpload({
  photoUrl,
  initials,
  forAccountId,
  caption,
  onUploaded,
}: {
  photoUrl: string | null;
  initials: string;
  forAccountId?: string;
  caption?: string;
  onUploaded?: (previewUrl: string) => void;
}) {
  const router = useRouter();
  const [pendingUrl, setPendingUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadStatus, setUploadStatus] = useState<"idle" | "uploading" | "success" | "error">("idle");
  const [message, setMessage] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [inputKey, setInputKey] = useState(0);

  function handlePick(file: File | null) {
    if (!file) return;
    setUploadStatus("idle");
    setMessage(null);
    setPendingUrl(URL.createObjectURL(file));
  }

  function cancelCrop() {
    if (pendingUrl) URL.revokeObjectURL(pendingUrl);
    setPendingUrl(null);
    setInputKey((k) => k + 1);
  }

  function handleCropped(blob: Blob) {
    setUploading(true);
    setUploadStatus("uploading");
    setMessage(null);
    const file = new File([blob], "photo.jpg", { type: "image/jpeg" });
    const formData = new FormData();
    formData.set("file", file);
    if (forAccountId) formData.set("forAccountId", forAccountId);
    uploadMyPhotoAction(formData)
      .then(() => {
        const url = URL.createObjectURL(blob);
        setPreviewUrl(url);
        setUploadStatus("success");
        setMessage("Photo updated.");
        onUploaded?.(url);
        router.refresh();
      })
      .catch((e: any) => {
        setUploadStatus("error");
        setMessage(`Error: ${e.message}`);
      })
      .finally(() => {
        setUploading(false);
        if (pendingUrl) URL.revokeObjectURL(pendingUrl);
        setPendingUrl(null);
        setInputKey((k) => k + 1);
      });
  }

  const displayUrl = previewUrl ?? photoUrl;

  if (pendingUrl) {
    return <ImageCropper imageUrl={pendingUrl} onCancel={cancelCrop} onCropped={handleCropped} />;
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
        {displayUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={displayUrl} alt="Your photo" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
        ) : (
          initials
        )}
      </div>
      <div>
        <input
          key={inputKey}
          type="file"
          accept="image/png,image/jpeg,image/webp"
          onChange={(e) => handlePick(e.target.files?.[0] ?? null)}
          disabled={uploading}
          style={{ fontSize: 12 }}
        />
        <p style={{ fontSize: 11, color: "#999", margin: "4px 0 0" }}>{caption ?? "PNG, JPG, or WEBP, up to 3MB. Only you and your clinic can see this."}</p>
        {uploadStatus !== "idle" && (
          <div style={{ marginTop: 6 }}>
            <UploadProgress
              status={uploadStatus}
              label="Saving photo..."
              successLabel="Photo updated."
              errorLabel={message?.replace(/^Error:\s*/, "") || "Upload failed. Please try again."}
            />
          </div>
        )}
      </div>
    </div>
  );
}
