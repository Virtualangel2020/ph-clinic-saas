"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { addPatientProblemAction, setPatientProblemStatusAction } from "../actions";

export type ProblemRow = {
  id: string;
  description: string;
  status: "active" | "resolved";
  onset_date: string | null;
  noted_at: string;
  notes: string | null;
  noted_by_name: string | null;
};

const FIELD_STYLE: React.CSSProperties = { border: "1px solid var(--input-border)", borderRadius: 8, padding: "8px 10px", fontSize: 13, fontFamily: "inherit", width: "100%", boxSizing: "border-box" };

// Active Problems (Clinical tab). A longitudinal problem/diagnosis list —
// distinct from any single encounter's assessment, and from the free-text
// "notes" field on the patient record — genuinely new to this app (see
// migration patient_active_problems).
export function ActiveProblemsSection({ patientId, problems }: { patientId: string; problems: ProblemRow[] }) {
  const router = useRouter();
  const [adding, setAdding] = useState(false);
  const [description, setDescription] = useState("");
  const [onsetDate, setOnsetDate] = useState("");
  const [notes, setNotes] = useState("");
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [showResolved, setShowResolved] = useState(false);

  function save() {
    if (!description.trim()) {
      setError("Enter a problem or diagnosis.");
      return;
    }
    setError(null);
    startTransition(async () => {
      try {
        await addPatientProblemAction(patientId, description.trim(), onsetDate, notes);
        setDescription("");
        setOnsetDate("");
        setNotes("");
        setAdding(false);
        router.refresh();
      } catch (e: any) {
        setError(e.message || "Couldn't save that.");
      }
    });
  }

  function setStatus(id: string, status: "active" | "resolved") {
    setBusyId(id);
    startTransition(async () => {
      try {
        await setPatientProblemStatusAction(id, patientId, status);
        router.refresh();
      } finally {
        setBusyId(null);
      }
    });
  }

  const visible = showResolved ? problems : problems.filter((p) => p.status === "active");

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
        <h2 style={{ fontSize: 15 }}>Active Problems</h2>
        <button onClick={() => setAdding((v) => !v)} style={{ fontSize: 12.5, color: "var(--text-heading)", background: "none", border: "none", cursor: "pointer", fontWeight: 600 }}>
          {adding ? "Cancel" : "+ Add problem"}
        </button>
      </div>

      {adding && (
        <div style={{ background: "var(--card-bg)", border: "1px solid var(--card-border)", borderRadius: 10, marginBottom: 10, padding: 14, display: "grid", gap: 8 }}>
          <input placeholder="Problem / diagnosis (e.g. Type 2 Diabetes Mellitus)" value={description} onChange={(e) => setDescription(e.target.value)} style={FIELD_STYLE} />
          <div>
            <div style={{ fontSize: 11, color: "#888", marginBottom: 3 }}>Onset date (optional)</div>
            <input type="date" value={onsetDate} onChange={(e) => setOnsetDate(e.target.value)} style={FIELD_STYLE} />
          </div>
          <textarea placeholder="Notes (optional)" value={notes} onChange={(e) => setNotes(e.target.value)} style={{ ...FIELD_STYLE, minHeight: 50 }} />
          {error && <p style={{ fontSize: 12, color: "#a12a2a", margin: 0 }}>{error}</p>}
          <button onClick={save} disabled={pending} style={{ background: "#0c1730", color: "white", border: "none", borderRadius: 8, padding: "8px 14px", fontSize: 13, cursor: "pointer", justifySelf: "start" }}>
            {pending ? "Saving…" : "Save problem"}
          </button>
        </div>
      )}

      {visible.length === 0 ? (
        <p style={{ color: "#999", fontSize: 12.5 }}>No active problems on file.</p>
      ) : (
        <div style={{ display: "grid", gap: 8 }}>
          {visible.map((p) => (
            <div key={p.id} style={{ background: "var(--card-bg)", border: "1px solid var(--card-border)", borderRadius: 10, padding: 12, fontSize: 13 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8 }}>
                <div>
                  <div style={{ fontWeight: 700 }}>
                    {p.description}
                    <span
                      style={{
                        marginLeft: 8,
                        fontSize: 10.5,
                        fontWeight: 700,
                        color: p.status === "active" ? "#1a7f37" : "#666",
                        background: p.status === "active" ? "#eaf7ee" : "#f2f2f2",
                        border: `1px solid ${p.status === "active" ? "#bfe6c9" : "#ddd"}`,
                        borderRadius: 999,
                        padding: "2px 8px",
                      }}
                    >
                      {p.status === "active" ? "Active" : "Resolved"}
                    </span>
                  </div>
                  {p.onset_date && <div style={{ fontSize: 11.5, color: "#888", marginTop: 2 }}>Onset {new Date(p.onset_date).toLocaleDateString()}</div>}
                  {p.notes && <div style={{ fontSize: 12.5, color: "#555", marginTop: 4 }}>{p.notes}</div>}
                  <div style={{ fontSize: 11, color: "#999", marginTop: 4 }}>
                    {p.noted_by_name ?? "Staff"} · {new Date(p.noted_at).toLocaleDateString()}
                  </div>
                </div>
                <button
                  onClick={() => setStatus(p.id, p.status === "active" ? "resolved" : "active")}
                  disabled={pending && busyId === p.id}
                  style={{ background: "none", border: "none", color: "var(--text-heading)", cursor: "pointer", fontSize: 12, fontWeight: 600, whiteSpace: "nowrap" }}
                >
                  {p.status === "active" ? "Mark resolved" : "Reactivate"}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {problems.some((p) => p.status === "resolved") && (
        <button onClick={() => setShowResolved((v) => !v)} style={{ marginTop: 10, fontSize: 12, color: "#888", background: "none", border: "none", cursor: "pointer" }}>
          {showResolved ? "Hide resolved" : "Show resolved"}
        </button>
      )}
    </div>
  );
}
