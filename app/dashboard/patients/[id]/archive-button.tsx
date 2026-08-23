"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { setPatientActiveAction } from "../actions";

export function ArchiveButton({ patientId, isActive }: { patientId: string; isActive: boolean }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function toggle() {
    const verb = isActive ? "archive" : "restore";
    if (!confirm(`Are you sure you want to ${verb} this patient?`)) return;
    startTransition(async () => {
      await setPatientActiveAction(patientId, !isActive);
      router.refresh();
    });
  }

  return (
    <button
      onClick={toggle}
      disabled={pending}
      style={{
        border: "1px solid " + (isActive ? "#e0b3b3" : "#ccc"),
        background: "white",
        color: isActive ? "#a12a2a" : "#333",
        borderRadius: 8,
        padding: "8px 14px",
        fontSize: 13,
        cursor: "pointer",
        opacity: pending ? 0.6 : 1,
      }}
    >
      {isActive ? "Archive" : "Restore"}
    </button>
  );
}
