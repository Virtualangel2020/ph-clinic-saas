"use client";

import { MyCareDeskLoader } from "./mycaredesk-loader";
import { ErrorState } from "./error-state";

// The "big" loader (spec §3A): fullscreen for login/checkout/major page
// transitions, or `fullscreen={false}` to cover just the nearest
// `position: relative` container (e.g. a modal, a card mid-refresh) instead
// of the whole viewport. Always light-background per spec §10 — never a
// dark takeover screen.
//
// Handles the slow/error branches itself so call sites don't re-implement
// spec §8-9: pass `status` from useAsyncStatus and this renders the right
// thing — loading label, the "taking longer than usual" upgrade, or a
// Try Again error card — and never spins forever.
export function LoadingOverlay({
  status = "loading",
  label = "Loading...",
  slowLabel = "This is taking a little longer than usual.",
  slowSublabel = "Please keep this page open.",
  error,
  onRetry,
  fullscreen = true,
}: {
  status?: "loading" | "slow" | "error";
  label?: string;
  slowLabel?: string;
  slowSublabel?: string;
  error?: string | null;
  onRetry?: () => void;
  fullscreen?: boolean;
}) {
  return (
    <div
      style={{
        position: fullscreen ? "fixed" : "absolute",
        inset: 0,
        zIndex: fullscreen ? 1000 : 20,
        background: "rgba(246, 249, 251, 0.92)",
        backdropFilter: "blur(1px)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 24,
      }}
      className="mcd-fade-in"
    >
      {status === "error" ? (
        <ErrorState message={error ?? "Something went wrong."} onRetry={onRetry} />
      ) : status === "slow" ? (
        <MyCareDeskLoader size="lg" label={slowLabel} sublabel={slowSublabel} />
      ) : (
        <MyCareDeskLoader size="lg" label={label} sublabel="Please wait." />
      )}
    </div>
  );
}
