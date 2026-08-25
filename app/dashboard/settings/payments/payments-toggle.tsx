"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { setAcceptOnlinePaymentsAction } from "../actions";

export function PaymentsToggle({ enabled, disabled }: { enabled: boolean; disabled: boolean }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function toggle() {
    setError(null);
    startTransition(async () => {
      try {
        await setAcceptOnlinePaymentsAction(!enabled);
        router.refresh();
      } catch (e: any) {
        setError(e.message || "Couldn't update this setting.");
      }
    });
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 4 }}>
      <button
        onClick={toggle}
        disabled={disabled || pending}
        title={disabled ? "PayMongo isn't connected yet" : undefined}
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 8,
          border: "none",
          background: "none",
          cursor: disabled || pending ? "default" : "pointer",
          opacity: disabled ? 0.5 : 1,
          padding: 0,
        }}
      >
        <span
          style={{
            width: 40,
            height: 22,
            borderRadius: 999,
            background: enabled ? "#1a7f37" : "#ccc",
            position: "relative",
            transition: "background 0.15s ease",
            flexShrink: 0,
          }}
        >
          <span
            style={{
              position: "absolute",
              top: 2,
              left: enabled ? 20 : 2,
              width: 18,
              height: 18,
              borderRadius: "50%",
              background: "white",
              transition: "left 0.15s ease",
            }}
          />
        </span>
        <span style={{ fontSize: 13, fontWeight: 600, color: "var(--text-heading)" }}>{enabled ? "ON" : "OFF"}</span>
      </button>
      {error && <span style={{ fontSize: 11.5, color: "#a12a2a" }}>{error}</span>}
    </div>
  );
}
