"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";

const NAVY = "var(--brand-primary)";

// Angel's explicit spec: "never show the generic server-side exception
// page to a patient... show a friendly in-app error state... log the
// actual technical error server-side." Every Find a Doctor / booking page
// wraps its RPC calls in try/catch and renders THIS inside <PortalShell>
// on failure — instead of letting the exception bubble up to Next's
// generic "Application error: a server-side exception has occurred" page
// (which has no portal chrome at all). The real error is always
// console.error'd server-side (visible in Vercel logs) before this
// component ever renders; nothing technical is shown to the patient.
export function PortalDataError({ message = "We couldn't load this right now." }: { message?: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  return (
    <div style={{ background: "white", border: "1px solid #e2e2e5", borderRadius: 12, padding: 28, textAlign: "center" }}>
      <p style={{ color: "#555", fontSize: 14, marginBottom: 14 }}>{message}</p>
      <button
        onClick={() => startTransition(() => router.refresh())}
        disabled={pending}
        style={{ background: NAVY, color: "#fff", fontWeight: 700, fontSize: 13, padding: "9px 20px", borderRadius: 8, border: "none", cursor: "pointer" }}
      >
        {pending ? "Retrying…" : "Try Again"}
      </button>
    </div>
  );
}
