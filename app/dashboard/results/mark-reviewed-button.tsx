"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { markLabResultReviewedAction } from "../orders/actions";

export function MarkReviewedButton({ id, patientId }: { id: string; patientId: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function mark(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    startTransition(async () => {
      try {
        await markLabResultReviewedAction(id, patientId);
        router.refresh();
      } catch (err: any) {
        alert(err.message || "Couldn't mark this result reviewed.");
      }
    });
  }

  return (
    <button
      onClick={mark}
      disabled={pending}
      style={{
        border: "1px solid #0c1730",
        background: "#0c1730",
        color: "white",
        borderRadius: 8,
        padding: "7px 12px",
        fontSize: 12,
        fontWeight: 600,
        cursor: "pointer",
        opacity: pending ? 0.6 : 1,
        whiteSpace: "nowrap",
      }}
    >
      {pending ? "…" : "Mark reviewed"}
    </button>
  );
}
