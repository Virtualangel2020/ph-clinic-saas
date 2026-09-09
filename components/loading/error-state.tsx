"use client";

// Reusable "this failed" block (spec §8): a loader must never spin
// forever, so every place that uses LoadingOverlay/useAsyncStatus for a
// blocking action renders this instead once status flips to "error."
// Also usable standalone for a section that failed to load (e.g. "We
// couldn't load this patient record.").
export function ErrorState({
  message = "Something went wrong.",
  detail,
  onRetry,
  retryLabel = "Try Again",
}: {
  message?: string;
  detail?: string | null;
  onRetry?: () => void;
  retryLabel?: string;
}) {
  return (
    <div
      role="alert"
      style={{
        textAlign: "center",
        maxWidth: 320,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 12,
      }}
    >
      <div
        style={{
          width: 40,
          height: 40,
          borderRadius: "50%",
          background: "#fbeaea",
          color: "#a12a2a",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: 20,
          fontWeight: 700,
        }}
      >
        !
      </div>
      <div>
        <div style={{ fontSize: 14, fontWeight: 600, color: "var(--brand-text, #10233d)" }}>{message}</div>
        {detail && <div style={{ fontSize: 12.5, color: "var(--brand-text-muted, #64748b)", marginTop: 4 }}>{detail}</div>}
      </div>
      {onRetry && (
        <button
          type="button"
          onClick={onRetry}
          style={{
            padding: "8px 18px",
            borderRadius: 8,
            border: "1px solid var(--brand-primary, #0f5a8c)",
            background: "var(--brand-primary, #0f5a8c)",
            color: "#fff",
            fontSize: 13,
            fontWeight: 600,
            cursor: "pointer",
          }}
        >
          {retryLabel}
        </button>
      )}
    </div>
  );
}
