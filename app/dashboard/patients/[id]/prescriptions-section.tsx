"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { addPrescriptionAction, setPrescriptionStatusAction, type PrescriptionItemInput } from "../../prescriptions/actions";

export type PrescriptionItem = {
  id: string;
  drug_name: string;
  dosage: string | null;
  form: string | null;
  frequency: string | null;
  duration: string | null;
  quantity: string | null;
  instructions: string | null;
};

export type PrescriptionRow = {
  id: string;
  status: string;
  notes: string | null;
  prescribed_at: string;
  prescriber_name: string | null;
  items: PrescriptionItem[];
};

const FIELD_STYLE: React.CSSProperties = { border: "1px solid var(--input-border)", borderRadius: 8, padding: "8px 10px", fontSize: 13, fontFamily: "inherit", width: "100%", boxSizing: "border-box" };

const STATUS_STYLE: Record<string, { color: string; bg: string; border: string; label: string }> = {
  active: { color: "#1a7f37", bg: "#eaf7ee", border: "#bfe6c9", label: "Active" },
  completed: { color: "var(--text-heading)", bg: "#f0f4ff", border: "#c7d4f5", label: "Completed" },
  cancelled: { color: "#a12a2a", bg: "#fbeaea", border: "#f0c9c9", label: "Cancelled" },
};

const EMPTY_ITEM: PrescriptionItemInput = { drugName: "", dosage: "", form: "", frequency: "", duration: "", quantity: "", instructions: "" };

function itemSummary(i: PrescriptionItem) {
  return [i.drug_name, i.dosage, i.form].filter(Boolean).join(" ") + (i.frequency ? ` — ${i.frequency}` : "") + (i.duration ? ` for ${i.duration}` : "");
}

// Patient chart section for Prescriptions (v1). Every write goes through
// the add_prescription / set_prescription_status RPCs (see
// ../../prescriptions/actions.ts) — this component holds no DB privilege
// of its own, same pattern as progress-notes-section.tsx and
// care-coordination-section.tsx alongside it.
//
// No encounter-linkage UI yet — encounterId is accepted so a future picker
// can be dropped in without changing the call site, but the add call
// always passes null unless the caller supplies one.
export function PrescriptionsSection({
  patientId,
  prescriptions,
  encounterId = null,
}: {
  patientId: string;
  prescriptions: PrescriptionRow[];
  encounterId?: string | null;
}) {
  const router = useRouter();
  const [adding, setAdding] = useState(false);
  const [notes, setNotes] = useState("");
  const [items, setItems] = useState<PrescriptionItemInput[]>([{ ...EMPTY_ITEM }]);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function updateItem(i: number, field: keyof PrescriptionItemInput, value: string) {
    setItems((prev) => prev.map((it, idx) => (idx === i ? { ...it, [field]: value } : it)));
  }

  function addRow() {
    setItems((prev) => [...prev, { ...EMPTY_ITEM }]);
  }

  function removeRow(i: number) {
    setItems((prev) => (prev.length === 1 ? prev : prev.filter((_, idx) => idx !== i)));
  }

  function resetForm() {
    setNotes("");
    setItems([{ ...EMPTY_ITEM }]);
  }

  function save() {
    const validItems = items.filter((it) => it.drugName.trim());
    if (validItems.length === 0) {
      setError("Add at least one drug with a name.");
      return;
    }
    setError(null);
    startTransition(async () => {
      try {
        await addPrescriptionAction(patientId, encounterId, notes, validItems);
        resetForm();
        setAdding(false);
        router.refresh();
      } catch (e: any) {
        setError(e.message);
      }
    });
  }

  function setStatus(id: string, status: string) {
    setError(null);
    startTransition(async () => {
      try {
        await setPrescriptionStatusAction(id, patientId, status);
        router.refresh();
      } catch (e: any) {
        setError(e.message);
      }
    });
  }

  return (
    <div style={{ marginTop: 24 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
        <h2 style={{ fontSize: 15 }}>Prescriptions</h2>
        <button onClick={() => setAdding((v) => !v)} style={{ fontSize: 12.5, color: "var(--text-heading)", background: "none", border: "none", cursor: "pointer", fontWeight: 600 }}>
          {adding ? "Cancel" : "+ New prescription"}
        </button>
      </div>

      {error && !adding && <p style={{ fontSize: 12, color: "crimson", marginBottom: 8 }}>{error}</p>}

      {adding && (
        <div style={{ background: "var(--card-bg)", border: "1px solid var(--card-border)", borderRadius: 10, marginBottom: 10, padding: 14, display: "grid", gap: 10 }}>
          <div style={{ display: "grid", gap: 8 }}>
            {items.map((it, i) => (
              <div key={i} style={{ border: "1px solid #eee", borderRadius: 8, padding: 10, display: "grid", gap: 6, background: "#fafafa" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span style={{ fontSize: 11, fontWeight: 700, color: "#666" }}>Drug {i + 1}</span>
                  {items.length > 1 && (
                    <button onClick={() => removeRow(i)} style={{ background: "none", border: "none", color: "#999", cursor: "pointer", fontSize: 11.5 }}>
                      Remove
                    </button>
                  )}
                </div>
                <input placeholder="Drug name *" value={it.drugName} onChange={(e) => updateItem(i, "drugName", e.target.value)} style={FIELD_STYLE} />
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(110px, 1fr))", gap: 6 }}>
                  <input placeholder="Dosage (e.g. 500mg)" value={it.dosage} onChange={(e) => updateItem(i, "dosage", e.target.value)} style={FIELD_STYLE} />
                  <input placeholder="Form (e.g. tablet)" value={it.form} onChange={(e) => updateItem(i, "form", e.target.value)} style={FIELD_STYLE} />
                  <input placeholder="Frequency (e.g. 3x/day)" value={it.frequency} onChange={(e) => updateItem(i, "frequency", e.target.value)} style={FIELD_STYLE} />
                  <input placeholder="Duration (e.g. 7 days)" value={it.duration} onChange={(e) => updateItem(i, "duration", e.target.value)} style={FIELD_STYLE} />
                  <input placeholder="Quantity (e.g. #21)" value={it.quantity} onChange={(e) => updateItem(i, "quantity", e.target.value)} style={FIELD_STYLE} />
                </div>
                <input placeholder="Instructions (e.g. Take after meals)" value={it.instructions} onChange={(e) => updateItem(i, "instructions", e.target.value)} style={FIELD_STYLE} />
              </div>
            ))}
            <button onClick={addRow} style={{ fontSize: 12, color: "var(--text-heading)", background: "none", border: "none", cursor: "pointer", fontWeight: 600, justifySelf: "start" }}>
              + Add another drug
            </button>
          </div>

          <textarea placeholder="Notes (optional)" value={notes} onChange={(e) => setNotes(e.target.value)} style={{ ...FIELD_STYLE, minHeight: 50 }} />

          {error && <p style={{ fontSize: 12, color: "crimson", margin: 0 }}>{error}</p>}
          <button onClick={save} disabled={pending} style={{ background: "#0c1730", color: "white", border: "none", borderRadius: 8, padding: "8px 14px", fontSize: 13, cursor: "pointer", justifySelf: "start" }}>
            {pending ? "Saving…" : "Save prescription"}
          </button>
        </div>
      )}

      {prescriptions.length === 0 ? (
        <p style={{ color: "#999", fontSize: 12.5 }}>No prescriptions yet.</p>
      ) : (
        <div style={{ display: "grid", gap: 10 }}>
          {prescriptions.map((p) => {
            const s = STATUS_STYLE[p.status] ?? STATUS_STYLE.active;
            return (
              <div key={p.id} style={{ background: "var(--card-bg)", border: "1px solid var(--card-border)", borderRadius: 10, padding: 14, fontSize: 13 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                  <div style={{ fontWeight: 700 }}>
                    {new Date(p.prescribed_at).toLocaleDateString()}
                    <span
                      style={{ marginLeft: 8, fontSize: 10.5, fontWeight: 700, color: s.color, background: s.bg, border: `1px solid ${s.border}`, borderRadius: 999, padding: "2px 8px" }}
                    >
                      {s.label}
                    </span>
                  </div>
                  <div style={{ display: "flex", gap: 10 }}>
                    {p.status === "active" && (
                      <>
                        <button onClick={() => setStatus(p.id, "completed")} disabled={pending} style={{ background: "none", border: "none", color: "#1a7f37", cursor: "pointer", fontSize: 12, fontWeight: 600 }}>
                          Mark completed
                        </button>
                        <button onClick={() => setStatus(p.id, "cancelled")} disabled={pending} style={{ background: "none", border: "none", color: "#a12a2a", cursor: "pointer", fontSize: 12, fontWeight: 600 }}>
                          Cancel
                        </button>
                      </>
                    )}
                  </div>
                </div>

                <div style={{ display: "grid", gap: 3, marginBottom: 6 }}>
                  {p.items.map((item) => (
                    <div key={item.id}>
                      <strong>{item.drug_name}</strong>
                      {item.dosage ? ` ${item.dosage}` : ""}
                      {item.form ? ` (${item.form})` : ""}
                      {item.frequency ? ` — ${item.frequency}` : ""}
                      {item.duration ? `, ${item.duration}` : ""}
                      {item.quantity ? ` · Qty ${item.quantity}` : ""}
                      {item.instructions && <div style={{ fontSize: 12, color: "#666" }}>{item.instructions}</div>}
                    </div>
                  ))}
                </div>

                {p.notes && <div style={{ fontSize: 12.5, color: "#555", marginBottom: 4 }}>{p.notes}</div>}
                <div style={{ fontSize: 11, color: "#999" }}>{p.prescriber_name ?? "Unknown prescriber"}</div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
