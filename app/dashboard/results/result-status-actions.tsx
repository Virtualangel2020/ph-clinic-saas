"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { setLabResultStatusAction } from "../orders/actions";

// Replaces the old binary "Mark reviewed" button now that lab_results
// carries a real New/Reviewed/Released/Follow-up status (spec §20) — same
// set_lab_result_status RPC the patient chart's Orders & Results tab uses.
export function ResultStatusActions({ id, patientId, status }: { id: string; patientId: string; status: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function setStatus(e: React.MouseEvent, next: "reviewed" | "released" | "follow_up") {
    e.preventDefault();
    e.stopPropagation();
    startTransition(async () => {
      try {
        await setLabResultStatusAction(id, patientId, next);
        router.refresh();
      } catch (err: any) {
        alert(err.message || "Couldn't update this result.");
      }
    });
  }

  return (
    <div style={{ display: "flex", gap: 8, flexWrap: "wrap", justifyContent: "flex-end" }}>
      {status === "new" && (
        <button onClick={(e) => setStatus(e, "reviewed")} disabled={pending} style={btnStyle}>
          Mark reviewed
        </button>
      )}
      {status === "reviewed" && (
        <button onClick={(e) => setStatus(e, "released")} disabled={pending} style={btnStyle}>
          Release
        </button>
      )}
      {status !== "follow_up" && (
        <button onClick={(e) => setStatus(e, "follow_up")} disabled={pending} style={{ ...btnStyle, background: "none", border: "1px solid #f0c9c9", color: "#a12a2a" }}>
          Follow-up
        </button>
      )}
    </div>
  );
}

const btnStyle: React.CSSProperties = {
  border: "1px solid #0c1730",
  background: "#0c1730",
  color: "white",
  borderRadius: 8,
  padding: "7px 12px",
  fontSize: 12,
  fontWeight: 600,
  cursor: "pointer",
  whiteSpace: "nowrap",
};
