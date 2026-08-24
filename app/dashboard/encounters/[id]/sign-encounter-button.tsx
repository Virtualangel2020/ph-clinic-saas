"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { signEncounterAction } from "../actions";

// Signing is one-way (spec §16-18): once signed, the encounter's notes
// become permanently undeletable and any further documentation must go
// through the amendment flow. Gated server-side by the encounters.sign
// permission (canSign, computed in the page) — this button doesn't even
// render for someone who can't sign.
export function SignEncounterButton({ encounterId, patientId, hasNotes }: { encounterId: string; patientId: string; hasNotes: boolean }) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function sign() {
    setError(null);
    startTransition(async () => {
      try {
        await signEncounterAction(encounterId, patientId);
        setConfirming(false);
        router.refresh();
      } catch (e: any) {
        setError(e.message);
      }
    });
  }

  if (!hasNotes) {
    return <p style={{ fontSize: 11.5, color: "#999", margin: 0 }}>Add a progress note before this encounter can be signed.</p>;
  }

  return (
    <div>
      {!confirming ? (
        <button
          onClick={() => setConfirming(true)}
          style={{ background: "#0c1730", color: "#e6c66b", border: "none", borderRadius: 8, padding: "8px 16px", fontSize: 12.5, fontWeight: 700, cursor: "pointer" }}
        >
          Sign encounter
        </button>
      ) : (
        <div style={{ background: "#fff6e6", border: "1px solid #f0d998", borderRadius: 10, padding: 12 }}>
          <p style={{ fontSize: 12.5, color: "#5c4400", margin: "0 0 8px" }}>
            Signing locks this encounter's notes. After signing, corrections must be recorded as amendments — the
            original stays visible alongside the correction. This can't be undone.
          </p>
          {error && <p style={{ fontSize: 11.5, color: "crimson", margin: "0 0 8px" }}>{error}</p>}
          <div style={{ display: "flex", gap: 8 }}>
            <button onClick={sign} disabled={pending} style={{ background: "#0c1730", color: "#e6c66b", border: "none", borderRadius: 8, padding: "7px 14px", fontSize: 12.5, fontWeight: 700, cursor: "pointer" }}>
              {pending ? "Signing…" : "Confirm — sign encounter"}
            </button>
            <button onClick={() => setConfirming(false)} disabled={pending} style={{ background: "white", border: "1px solid #ddd", borderRadius: 8, padding: "7px 14px", fontSize: 12.5, cursor: "pointer" }}>
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
