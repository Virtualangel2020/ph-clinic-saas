"use client";

import { useState, useTransition } from "react";
import { setAppointmentTypeAction } from "../actions";

type AppointmentType = {
  id: string;
  name: string;
  color: string;
  default_duration_minutes: number;
  description: string | null;
  is_active: boolean;
  sort_order: number;
};

export function AppointmentTypesManager({ initialTypes }: { initialTypes: AppointmentType[] }) {
  const [types, setTypes] = useState(initialTypes);
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);
  const [draft, setDraft] = useState({ name: "", color: "#4a86e8", duration: 30, description: "" });

  function save(input: { id: string | null; name: string; color: string; durationMinutes: number; description: string; isActive: boolean; sortOrder: number }) {
    startTransition(async () => {
      try {
        await setAppointmentTypeAction(input);
        setMessage(null);
        // Optimistic local refresh — RSC revalidation will reconcile on next nav.
        if (input.id) {
          setTypes((prev) => prev.map((t) => (t.id === input.id ? { ...t, name: input.name, color: input.color, default_duration_minutes: input.durationMinutes, description: input.description, is_active: input.isActive } : t)));
        } else {
          setDraft({ name: "", color: "#4a86e8", duration: 30, description: "" });
          setTypes((prev) => [...prev, { id: `pending-${Date.now()}`, name: input.name, color: input.color, default_duration_minutes: input.durationMinutes, description: input.description, is_active: true, sort_order: input.sortOrder }]);
        }
      } catch (e: any) {
        setMessage(`Error: ${e.message}`);
      }
    });
  }

  function addType() {
    if (!draft.name.trim()) return;
    save({ id: null, name: draft.name.trim(), color: draft.color, durationMinutes: draft.duration, description: draft.description, isActive: true, sortOrder: types.length });
  }

  return (
    <div style={{ background: "white", border: "1px solid #e2e2e5", borderRadius: 12, padding: 22 }}>
      <h2 style={{ fontSize: 15, marginTop: 0, marginBottom: 4 }}>Appointment types</h2>
      <p style={{ color: "#888", fontSize: 12, marginBottom: 14 }}>Each type gets its own color on the calendar once scheduling ships.</p>

      <div style={{ display: "grid", gap: 8, marginBottom: 16 }}>
        {types.map((t) => (
          <div key={t.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 10px", border: "1px solid #eee", borderRadius: 8 }}>
            <input
              type="color"
              value={t.color}
              disabled={pending}
              onChange={(e) => save({ id: t.id, name: t.name, color: e.target.value, durationMinutes: t.default_duration_minutes, description: t.description ?? "", isActive: t.is_active, sortOrder: t.sort_order })}
              style={{ width: 30, height: 26, border: "none", padding: 0, background: "none" }}
            />
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 600, fontSize: 13 }}>{t.name}</div>
              <div style={{ fontSize: 11, color: "#999" }}>{t.default_duration_minutes} min{t.description ? ` · ${t.description}` : ""}</div>
            </div>
            <label style={{ fontSize: 11.5, color: "#666", display: "flex", alignItems: "center", gap: 5 }}>
              <input
                type="checkbox"
                checked={t.is_active}
                disabled={pending}
                onChange={(e) => save({ id: t.id, name: t.name, color: t.color, durationMinutes: t.default_duration_minutes, description: t.description ?? "", isActive: e.target.checked, sortOrder: t.sort_order })}
              />
              Active
            </label>
          </div>
        ))}
        {types.length === 0 && <div style={{ color: "#aaa", fontSize: 12.5 }}>No appointment types yet — add one below.</div>}
      </div>

      <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
        <input type="color" value={draft.color} onChange={(e) => setDraft((d) => ({ ...d, color: e.target.value }))} style={{ width: 30, height: 32, border: "none", background: "none" }} />
        <input
          placeholder="Type name (e.g. New Patient)"
          value={draft.name}
          onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))}
          style={{ padding: "8px 10px", borderRadius: 8, border: "1px solid #ddd", fontSize: 13, flex: "1 1 180px" }}
        />
        <input
          type="number"
          value={draft.duration}
          onChange={(e) => setDraft((d) => ({ ...d, duration: Number(e.target.value) || 30 }))}
          style={{ width: 70, padding: "8px 10px", borderRadius: 8, border: "1px solid #ddd", fontSize: 13 }}
        />
        <span style={{ fontSize: 12, color: "#888" }}>min</span>
        <button
          onClick={addType}
          disabled={pending || !draft.name.trim()}
          style={{ background: "#0c1730", color: "#e6c66b", fontWeight: 700, fontSize: 12.5, padding: "9px 16px", borderRadius: 8, border: "none", cursor: "pointer" }}
        >
          Add
        </button>
      </div>
      {message && <p style={{ color: "crimson", fontSize: 12, marginTop: 10 }}>{message}</p>}
    </div>
  );
}
