"use client";

import { ErrorState } from "./error-state";

// File upload feedback (spec §3C): a progress bar when a percentage is
// known (native fetch/XHR progress events), an indeterminate bar when it
// isn't (many of this app's uploads go straight to a Supabase Storage
// helper that doesn't report progress), and success/error terminal states
// that never leave the bar stuck mid-way.
export function UploadProgress({
  status,
  percent,
  label = "Uploading...",
  successLabel = "Upload complete",
  errorLabel = "Upload failed. Please try again.",
  onRetry,
}: {
  status: "uploading" | "success" | "error";
  percent?: number | null;
  label?: string;
  successLabel?: string;
  errorLabel?: string;
  onRetry?: () => void;
}) {
  if (status === "error") {
    return <ErrorState message={errorLabel} onRetry={onRetry} />;
  }

  if (status === "success") {
    return (
      <div role="status" style={{ display: "flex", alignItems: "center", gap: 8, color: "#1a7f37", fontSize: 13, fontWeight: 600 }}>
        <span>✓</span> {successLabel}
      </div>
    );
  }

  const known = typeof percent === "number" && Number.isFinite(percent);

  return (
    <div role="status" aria-live="polite" style={{ display: "flex", flexDirection: "column", gap: 6, minWidth: 180 }}>
      <div style={{ fontSize: 12.5, color: "var(--brand-text-muted, #64748b)" }}>
        {label} {known && `${Math.round(percent as number)}%`}
      </div>
      <div
        style={{
          height: 6,
          borderRadius: 999,
          background: "var(--brand-border-tint, #e1e7ec)",
          overflow: "hidden",
        }}
      >
        {known ? (
          <div
            style={{
              height: "100%",
              width: `${Math.min(100, Math.max(0, percent as number))}%`,
              background: "var(--brand-secondary, #049ca0)",
              borderRadius: 999,
              transition: "width 0.2s ease",
            }}
          />
        ) : (
          <div
            className="mcd-shimmer"
            style={{
              height: "100%",
              width: "100%",
              borderRadius: 999,
            }}
          />
        )}
      </div>
    </div>
  );
}
