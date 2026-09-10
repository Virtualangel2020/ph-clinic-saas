"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { acknowledgeStatusEventAction } from "./actions";

// "Dismiss" on the dashboard's appointment-change notice (spec Part 25) —
// same acknowledge-and-refresh pattern as SharingRequestCard, kept as its
// own tiny component since this card has no approve/decline choice, just
// "okay, I saw it."
export function DismissStatusEventButton({ eventId }: { eventId: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function dismiss() {
    startTransition(async () => {
      await acknowledgeStatusEventAction(eventId);
      router.refresh();
    });
  }

  return (
    <button
      onClick={dismiss}
      disabled={pending}
      style={{ fontSize: 11.5, fontWeight: 600, color: "#888", background: "none", border: "1px solid #ddd", borderRadius: 6, padding: "4px 10px", cursor: "pointer", flexShrink: 0 }}
    >
      {pending ? "…" : "Dismiss"}
    </button>
  );
}
