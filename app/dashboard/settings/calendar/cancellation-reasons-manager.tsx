"use client";

import { useState, useTransition } from "react";
import { setCancellationReasonAction } from "../actions";

type Reason = { id: string; label: string; is_active: boolean; sort_order: number };

export function CancellationReasonsManager({ initialReasons }: { initialReasons: Reason[] }) {
  const [reasons, setReasons] = useState(initialReasons);
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);
  const [draft, setDraft] = useState("");

  function save(input: { id: string | null; label: string; isActive: boolean; sortOrder: number }) {
    startTransition(async () => {
      try {
        await setCancellationReasonAction(input);
        setMessage(null);
        if (input.id) {
          setReasons((prev) => prev.map((r) => (r.id === input.id ? { ...r, label: input.label, is_active: input.isActive } : r)));
        } else {
          setDraft("");
          setReasons((prev) => [...prev, { id: `pending-${Date.now()}`, label: input.label, is_active: true, sort_order: input.sortOrder }]);
        }
      } catch (e: any) {
        setMessage(`Error: ${e.message}`);
      }
    });
  }

  function addReason() {
    if (!draft.trim()) return;
    save({ id: null, label: draft.trim(), isActive: true, sortOrder: reasons.length });
  }

  return (
    <div style={{ background: "white", border: "1px solid #e2e2e5", borderRadius: 12, padding: 22 }}>
      <h2 style={{ fontSize: 15, marginTop: 0, marginBottom: 4 }}>Cancellation reasons</h2>
      <p style={{ color: "#888", fontSize: 12, marginBottom: 14 }}>
        Shown as a dropdown whenever staff cancel an appointment or mark it a late cancellation — keeps reasons
        structured instead of free text. Every new clinic starts with 7 defaults; edit or deactivate any of them.
      </p>

      <div style={{ display: "grid", gap: 8, marginBottom: 16 }}>
        {reasons.map((r) => (
          <div key={r.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 10px", border: "1px solid #eee", borderRadius: 8 }}>
            <input
              value={r.label}
              disabled={pending}
              onChange={(e) => setReasons((prev) => prev.map((x) => (x.id === r.id ? { ...x, label: e.target.value } : x)))}
              onBlur={(e) => save({ id: r.id, label: e.target.value, isActive: r.is_active, sortOrder: r.sort_order })}
              style={{ flex: 1, border: "1px solid #ddd", borderRadius: 6, padding: "6px 8px", fontSize: 13 }}
            />
            <label style={{ fontSize: 11.5, color: "#666", display: "flex", alignItems: "center", gap: 5, whiteSpace: "nowrap" }}>
              <input
                type="checkbox"
                checked={r.is_active}
                disabled={pending}
                onChange={(e) => save({ id: r.id, label: r.label, isActive: e.target.checked, sortOrder: r.sort_order })}
              />
              Active
            </label>
          </div>
        ))}
        {reasons.length === 0 && <div style={{ color: "#aaa", fontSize: 12.5 }}>No cancellation reasons yet — add one below.</div>}
      </div>

      <div style={{ display: "flex", gap: 8 }}>
        <input
          placeholder="New reason (e.g. Weather)"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && addReason()}
          style={{ flex: 1, padding: "8px 10px", borderRadius: 8, border: "1px solid #ddd", fontSize: 13 }}
        />
        <button
          onClick={addReason}
          disabled={pending || !draft.trim()}
          style={{ background: "#0c1730", color: "#e6c66b", fontWeight: 700, fontSize: 12.5, padding: "9px 16px", borderRadius: 8, border: "none", cursor: "pointer" }}
        >
          Add
        </button>
      </div>
      {message && <p style={{ color: "crimson", fontSize: 12, marginTop: 10 }}>{message}</p>}
    </div>
  );
}
