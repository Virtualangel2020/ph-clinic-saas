"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { recordPrescriptionRefillAction } from "./actions";

export function RecordRefillButton({ id, patientId }: { id: string; patientId: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [nextDue, setNextDue] = useState("");
  const [pending, startTransition] = useTransition();

  function save(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    if (!nextDue) return;
    startTransition(async () => {
      try {
        await recordPrescriptionRefillAction(id, patientId, nextDue);
        setOpen(false);
        router.refresh();
      } catch (err: any) {
        alert(err.message || "Couldn't record that refill.");
      }
    });
  }

  if (!open) {
    return (
      <button
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setOpen(true);
        }}
        style={{ border: "1px solid #0c1730", background: "#0c1730", color: "white", borderRadius: 8, padding: "7px 12px", fontSize: 12, fontWeight: 600, cursor: "pointer", whiteSpace: "nowrap" }}
      >
        Record refill
      </button>
    );
  }

  return (
    <div onClick={(e) => e.preventDefault()} style={{ display: "flex", gap: 6, alignItems: "center" }}>
      <input
        type="date"
        value={nextDue}
        onChange={(e) => setNextDue(e.target.value)}
        style={{ border: "1px solid var(--input-border)", borderRadius: 7, padding: "6px 8px", fontSize: 12 }}
      />
      <button onClick={save} disabled={pending || !nextDue} style={{ border: "none", background: "#0c1730", color: "white", borderRadius: 7, padding: "6px 10px", fontSize: 12, cursor: "pointer" }}>
        {pending ? "…" : "Save"}
      </button>
    </div>
  );
}
