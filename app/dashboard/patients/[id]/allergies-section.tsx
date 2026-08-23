"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { addAllergyAction, removeAllergyAction } from "../actions";

type Allergy = { id: string; allergen: string; reaction: string | null; severity: string | null; noted_at: string };

const SEVERITY_COLOR: Record<string, string> = { mild: "#c99a2e", moderate: "#e69138", severe: "#a12a2a" };

export function AllergiesSection({ patientId, allergies }: { patientId: string; allergies: Allergy[] }) {
  const router = useRouter();
  const [adding, setAdding] = useState(false);
  const [allergen, setAllergen] = useState("");
  const [reaction, setReaction] = useState("");
  const [severity, setSeverity] = useState("mild");
  const [pending, startTransition] = useTransition();

  function save() {
    if (!allergen.trim()) return;
    startTransition(async () => {
      await addAllergyAction(patientId, allergen, reaction, severity);
      setAllergen("");
      setReaction("");
      setSeverity("mild");
      setAdding(false);
      router.refresh();
    });
  }

  function remove(id: string) {
    startTransition(async () => {
      await removeAllergyAction(id, patientId);
      router.refresh();
    });
  }

  return (
    <div style={{ marginTop: 24 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
        <h2 style={{ fontSize: 15 }}>Allergies</h2>
        <button onClick={() => setAdding((v) => !v)} style={{ fontSize: 12.5, color: "#0c1730", background: "none", border: "none", cursor: "pointer", fontWeight: 600 }}>
          {adding ? "Cancel" : "+ Add allergy"}
        </button>
      </div>

      {adding && (
        <div style={{ background: "white", border: "1px solid #e2e2e5", borderRadius: 10, padding: 14, marginBottom: 10, display: "grid", gap: 8 }}>
          <input placeholder="Allergen (e.g. Penicillin)" value={allergen} onChange={(e) => setAllergen(e.target.value)} style={{ border: "1px solid #ddd", borderRadius: 8, padding: "8px 10px", fontSize: 13 }} />
          <input placeholder="Reaction (e.g. Rash, hives)" value={reaction} onChange={(e) => setReaction(e.target.value)} style={{ border: "1px solid #ddd", borderRadius: 8, padding: "8px 10px", fontSize: 13 }} />
          <select value={severity} onChange={(e) => setSeverity(e.target.value)} style={{ border: "1px solid #ddd", borderRadius: 8, padding: "8px 10px", fontSize: 13 }}>
            <option value="mild">Mild</option>
            <option value="moderate">Moderate</option>
            <option value="severe">Severe</option>
          </select>
          <button onClick={save} disabled={pending} style={{ background: "#0c1730", color: "white", border: "none", borderRadius: 8, padding: "8px 14px", fontSize: 13, cursor: "pointer", justifySelf: "start" }}>
            Save
          </button>
        </div>
      )}

      {allergies.length === 0 ? (
        <p style={{ color: "#999", fontSize: 12.5 }}>No known allergies on file.</p>
      ) : (
        <div style={{ display: "grid", gap: 6 }}>
          {allergies.map((a) => (
            <div key={a.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", background: "white", border: "1px solid #e2e2e5", borderRadius: 8, padding: "8px 12px", fontSize: 13 }}>
              <div>
                <strong>{a.allergen}</strong>
                {a.reaction ? ` — ${a.reaction}` : ""}
                {a.severity && (
                  <span style={{ marginLeft: 8, fontSize: 11, fontWeight: 700, color: SEVERITY_COLOR[a.severity] ?? "#666" }}>{a.severity.toUpperCase()}</span>
                )}
              </div>
              <button onClick={() => remove(a.id)} style={{ background: "none", border: "none", color: "#999", cursor: "pointer", fontSize: 12 }}>
                Remove
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
