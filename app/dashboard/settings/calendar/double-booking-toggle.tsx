"use client";

import { useState, useTransition } from "react";
import { setAllowDoubleBookingAction } from "../actions";

export function DoubleBookingToggle({ initialEnabled }: { initialEnabled: boolean }) {
  const [enabled, setEnabled] = useState(initialEnabled);
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);

  function toggle(next: boolean) {
    setEnabled(next);
    startTransition(async () => {
      try {
        await setAllowDoubleBookingAction(next);
        setMessage(null);
      } catch (e: any) {
        setEnabled(!next);
        setMessage(`Error: ${e.message}`);
      }
    });
  }

  return (
    <div style={{ background: "var(--card-bg)", border: "1px solid var(--card-border)", borderRadius: 12, padding: 22 }}>
      <h2 style={{ fontSize: 15, marginTop: 0, marginBottom: 4 }}>Double-booking</h2>
      <p style={{ color: "#888", fontSize: 12, marginBottom: 14 }}>
        When allowed, staff can still book a provider over an existing appointment — the calendar will warn them
        first and let them confirm or pick another time. When off, an overlapping booking is blocked outright.
      </p>
      <label style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 13, cursor: pending ? "default" : "pointer" }}>
        <input type="checkbox" checked={enabled} disabled={pending} onChange={(e) => toggle(e.target.checked)} />
        Allow double-booking (warn, don't block)
      </label>
      {message && <p style={{ color: "crimson", fontSize: 12, marginTop: 10 }}>{message}</p>}
    </div>
  );
}
