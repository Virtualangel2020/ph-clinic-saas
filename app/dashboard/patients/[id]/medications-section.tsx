"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { addMedicationAction, removeMedicationAction, setMedicationActiveAction } from "../actions";

type Medication = {
  id: string;
  medication_name: string;
  dosage: string | null;
  frequency: string | null;
  started_at: string | null;
  is_active: boolean;
  notes: string | null;
};

export function MedicationsSection({ patientId, medications }: { patientId: string; medications: Medication[] }) {
  const router = useRouter();
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState("");
  const [dosage, setDosage] = useState("");
  const [frequency, setFrequency] = useState("");
  const [startedAt, setStartedAt] = useState("");
  const [pending, startTransition] = useTransition();

  function save() {
    if (!name.trim()) return;
    startTransition(async () => {
      await addMedicationAction(patientId, name, dosage, frequency, startedAt, "");
      setName("");
      setDosage("");
      setFrequency("");
      setStartedAt("");
      setAdding(false);
      router.refresh();
    });
  }

  function toggleActive(id: string, isActive: boolean) {
    startTransition(async () => {
      await setMedicationActiveAction(id, patientId, !isActive);
      router.refresh();
    });
  }

  function remove(id: string) {
    startTransition(async () => {
      await removeMedicationAction(id, patientId);
      router.refresh();
    });
  }

  return (
    <div style={{ marginTop: 24 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
        <h2 style={{ fontSize: 15 }}>Current medications</h2>
        <button onClick={() => setAdding((v) => !v)} style={{ fontSize: 12.5, color: "var(--text-heading)", background: "none", border: "none", cursor: "pointer", fontWeight: 600 }}>
          {adding ? "Cancel" : "+ Add medication"}
        </button>
      </div>

      {adding && (
        <div style={{ background: "var(--card-bg)", border: "1px solid var(--card-border)", borderRadius: 10, padding: 14, marginBottom: 10, display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 8 }}>
          <input placeholder="Medication name" value={name} onChange={(e) => setName(e.target.value)} style={{ border: "1px solid var(--input-border)", borderRadius: 8, padding: "8px 10px", fontSize: 13, gridColumn: "1 / -1" }} />
          <input placeholder="Dosage (e.g. 500mg)" value={dosage} onChange={(e) => setDosage(e.target.value)} style={{ border: "1px solid var(--input-border)", borderRadius: 8, padding: "8px 10px", fontSize: 13 }} />
          <input placeholder="Frequency (e.g. 2x/day)" value={frequency} onChange={(e) => setFrequency(e.target.value)} style={{ border: "1px solid var(--input-border)", borderRadius: 8, padding: "8px 10px", fontSize: 13 }} />
          <input type="date" value={startedAt} onChange={(e) => setStartedAt(e.target.value)} style={{ border: "1px solid var(--input-border)", borderRadius: 8, padding: "8px 10px", fontSize: 13 }} />
          <button onClick={save} disabled={pending} style={{ background: "#0c1730", color: "white", border: "none", borderRadius: 8, padding: "8px 14px", fontSize: 13, cursor: "pointer", justifySelf: "start" }}>
            Save
          </button>
        </div>
      )}

      {medications.length === 0 ? (
        <p style={{ color: "#999", fontSize: 12.5 }}>No medications on file.</p>
      ) : (
        <div style={{ display: "grid", gap: 6 }}>
          {medications.map((m) => (
            <div key={m.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", background: "var(--card-bg)", border: "1px solid var(--card-border)", borderRadius: 8, padding: "8px 12px", fontSize: 13, opacity: m.is_active ? 1 : 0.55 }}>
              <div>
                <strong>{m.medication_name}</strong>
                {m.dosage ? ` — ${m.dosage}` : ""}
                {m.frequency ? `, ${m.frequency}` : ""}
                {!m.is_active && <span style={{ marginLeft: 8, fontSize: 11, color: "#999" }}>DISCONTINUED</span>}
              </div>
              <div style={{ display: "flex", gap: 10 }}>
                <button onClick={() => toggleActive(m.id, m.is_active)} style={{ background: "none", border: "none", color: "#666", cursor: "pointer", fontSize: 12 }}>
                  {m.is_active ? "Discontinue" : "Resume"}
                </button>
                <button onClick={() => remove(m.id)} style={{ background: "none", border: "none", color: "#999", cursor: "pointer", fontSize: 12 }}>
                  Remove
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
