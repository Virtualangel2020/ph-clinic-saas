"use client";

import { useState, useTransition } from "react";
import { requestProviderSeatAction } from "../actions";

export function SeatUsage({ used, total }: { used: number; total: number }) {
  const [pending, startTransition] = useTransition();
  const [sent, setSent] = useState(false);
  const [notes, setNotes] = useState("");
  const [error, setError] = useState<string | null>(null);
  const atLimit = used >= total;

  function request() {
    startTransition(async () => {
      try {
        await requestProviderSeatAction(notes);
        setSent(true);
      } catch (e: any) {
        setError(e.message);
      }
    });
  }

  return (
    <div style={{ background: "white", border: "1px solid #e2e2e5", borderRadius: 12, padding: 20 }}>
      <h2 style={{ fontSize: 15, marginTop: 0, marginBottom: 4 }}>Clinical provider seats</h2>
      <p style={{ color: "#888", fontSize: 12, marginBottom: 12 }}>
        Only providers holding a seat can sign notes and prescriptions. Staff accounts (reception, other staff) don't
        count against this — they're unlimited.
      </p>
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 12 }}>
        <div style={{ fontSize: 22, fontWeight: 800, color: atLimit ? "#c00" : "#0c1730" }}>
          {used} / {total}
        </div>
        <div style={{ fontSize: 12, color: "#888" }}>seat{total === 1 ? "" : "s"} in use</div>
      </div>
      {sent ? (
        <p style={{ fontSize: 12.5, color: "#1a7f37" }}>Request sent — Virtual Angel Systems will follow up.</p>
      ) : (
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <input
            placeholder="Optional note (e.g. adding Dr. Santos)"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            style={{ flex: "1 1 200px", padding: "8px 10px", borderRadius: 8, border: "1px solid #ddd", fontSize: 12.5 }}
          />
          <button
            onClick={request}
            disabled={pending}
            style={{ background: "#0c1730", color: "#e6c66b", fontWeight: 700, fontSize: 12.5, padding: "9px 16px", borderRadius: 8, border: "none", cursor: "pointer" }}
          >
            {pending ? "Sending…" : "Request Additional Seat"}
          </button>
        </div>
      )}
      {error && <p style={{ color: "crimson", fontSize: 12, marginTop: 8 }}>{error}</p>}
    </div>
  );
}
