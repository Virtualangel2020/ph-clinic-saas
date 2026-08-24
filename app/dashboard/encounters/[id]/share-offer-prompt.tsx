"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { sendRecordsTransferAction } from "../records-exchange-actions";

// "On encounter completion, if an active sharing preference exists, offer
// (never force) Send Copy to Dr. X" (spec §12-13) — shown once the
// encounter is closed or signed, and only while the patient has an active
// sharing preference that this specific encounter hasn't already been sent
// through. "Not Now" just dismisses for this page load; nothing is ever
// sent without an explicit click.
export function ShareOfferPrompt({
  patientId,
  encounterId,
  providerId,
  providerName,
}: {
  patientId: string;
  encounterId: string;
  providerId: string;
  providerName: string;
}) {
  const router = useRouter();
  const [dismissed, setDismissed] = useState(false);
  const [sent, setSent] = useState(false);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  if (dismissed || sent) return null;

  function send() {
    setError(null);
    startTransition(async () => {
      try {
        await sendRecordsTransferAction(patientId, [encounterId], providerId);
        setSent(true);
        router.refresh();
      } catch (e: any) {
        setError(e.message);
      }
    });
  }

  return (
    <div style={{ background: "#eef1fb", border: "1px solid #c7d4f5", borderRadius: 10, padding: 14, marginBottom: 20 }}>
      <p style={{ fontSize: 13, color: "#0c1730", margin: "0 0 8px" }}>
        This patient has an active sharing preference for <strong>{providerName}</strong>. Send a copy of this
        encounter to them now?
      </p>
      {error && <p style={{ fontSize: 11.5, color: "crimson", margin: "0 0 8px" }}>{error}</p>}
      <div style={{ display: "flex", gap: 8 }}>
        <button onClick={send} disabled={pending} style={{ background: "#0c1730", color: "white", border: "none", borderRadius: 8, padding: "7px 14px", fontSize: 12.5, fontWeight: 600, cursor: "pointer" }}>
          {pending ? "Sending…" : `Send Copy to ${providerName}`}
        </button>
        <button onClick={() => setDismissed(true)} disabled={pending} style={{ background: "white", border: "1px solid #ddd", borderRadius: 8, padding: "7px 14px", fontSize: 12.5, cursor: "pointer" }}>
          Not Now
        </button>
      </div>
    </div>
  );
}
