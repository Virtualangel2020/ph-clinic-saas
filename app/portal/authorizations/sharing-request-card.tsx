"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { respondToSharingRequestAction } from "../actions";

// The "Pending Request -> Review -> Acknowledge/Authorize" step (spec
// §44) — a plain acknowledgment UI, no e-signature theatrics, matching
// how the rest of the portal's consent/forms flow already works.
export function SharingRequestCard({ requestId, providerLabel }: { requestId: string; providerLabel: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [action, setAction] = useState<"authorize" | "decline" | null>(null);

  function respond(approve: boolean) {
    setError(null);
    setAction(approve ? "authorize" : "decline");
    startTransition(async () => {
      try {
        await respondToSharingRequestAction(requestId, approve);
        router.refresh();
      } catch (e: any) {
        setError(e.message || "Couldn't record your response.");
      }
    });
  }

  return (
    <div style={{ background: "#fff8e6", border: "1px solid #e6c66b", borderRadius: 10, padding: "14px 16px", marginBottom: 16 }}>
      <div style={{ fontSize: 11.5, fontWeight: 700, color: "#8a6100", textTransform: "uppercase", letterSpacing: 0.4, marginBottom: 6 }}>
        Action needed
      </div>
      <p style={{ fontSize: 13.5, margin: "0 0 12px", color: "#4a3a06" }}>
        Your clinic is asking to share your record with <strong>{providerLabel}</strong> for your care. Review and
        choose below.
      </p>
      {error && <p style={{ fontSize: 12, color: "#a12a2a", marginBottom: 8 }}>{error}</p>}
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
        <button
          onClick={() => respond(true)}
          disabled={pending}
          style={{ background: "#1a7f37", color: "white", border: "none", borderRadius: 8, padding: "8px 16px", fontSize: 12.5, fontWeight: 600, cursor: "pointer" }}
        >
          {pending && action === "authorize" ? "Authorizing…" : "Acknowledge & Authorize"}
        </button>
        <button
          onClick={() => respond(false)}
          disabled={pending}
          style={{ background: "none", color: "#a12a2a", border: "1px solid #e0b3b3", borderRadius: 8, padding: "8px 16px", fontSize: 12.5, fontWeight: 600, cursor: "pointer" }}
        >
          {pending && action === "decline" ? "Declining…" : "Decline"}
        </button>
      </div>
    </div>
  );
}
