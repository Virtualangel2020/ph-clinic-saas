"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { addProgressNoteAction, removeProgressNoteAction } from "../actions";

type Note = {
  id: string;
  note_date: string;
  chief_complaint: string | null;
  subjective: string | null;
  objective: string | null;
  assessment: string | null;
  plan: string | null;
  created_at: string;
  user_profiles: { full_name: string | null } | null;
};

const FIELD_STYLE: React.CSSProperties = { border: "1px solid #ddd", borderRadius: 8, padding: "8px 10px", fontSize: 13, fontFamily: "inherit", width: "100%" };

export function ProgressNotesSection({ patientId, notes }: { patientId: string; notes: Note[] }) {
  const router = useRouter();
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState({ noteDate: new Date().toISOString().slice(0, 10), chiefComplaint: "", subjective: "", objective: "", assessment: "", plan: "" });
  const [pending, startTransition] = useTransition();

  function save() {
    if (!draft.chiefComplaint.trim() && !draft.assessment.trim()) return;
    startTransition(async () => {
      await addProgressNoteAction(patientId, draft.noteDate, draft.chiefComplaint, draft.subjective, draft.objective, draft.assessment, draft.plan);
      setDraft({ noteDate: new Date().toISOString().slice(0, 10), chiefComplaint: "", subjective: "", objective: "", assessment: "", plan: "" });
      setAdding(false);
      router.refresh();
    });
  }

  function remove(id: string) {
    startTransition(async () => {
      await removeProgressNoteAction(id, patientId);
      router.refresh();
    });
  }

  return (
    <div style={{ marginTop: 24 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
        <h2 style={{ fontSize: 15 }}>Progress notes</h2>
        <button onClick={() => setAdding((v) => !v)} style={{ fontSize: 12.5, color: "#0c1730", background: "none", border: "none", cursor: "pointer", fontWeight: 600 }}>
          {adding ? "Cancel" : "+ Add note"}
        </button>
      </div>

      {adding && (
        <div style={{ background: "white", border: "1px solid #e2e2e5", borderRadius: 10, padding: 14, marginBottom: 10, display: "grid", gap: 8 }}>
          <input type="date" value={draft.noteDate} onChange={(e) => setDraft({ ...draft, noteDate: e.target.value })} style={{ ...FIELD_STYLE, width: 160 }} />
          <input placeholder="Chief complaint" value={draft.chiefComplaint} onChange={(e) => setDraft({ ...draft, chiefComplaint: e.target.value })} style={FIELD_STYLE} />
          <textarea placeholder="Subjective" value={draft.subjective} onChange={(e) => setDraft({ ...draft, subjective: e.target.value })} style={{ ...FIELD_STYLE, minHeight: 50 }} />
          <textarea placeholder="Objective" value={draft.objective} onChange={(e) => setDraft({ ...draft, objective: e.target.value })} style={{ ...FIELD_STYLE, minHeight: 50 }} />
          <textarea placeholder="Assessment / Diagnosis" value={draft.assessment} onChange={(e) => setDraft({ ...draft, assessment: e.target.value })} style={{ ...FIELD_STYLE, minHeight: 50 }} />
          <textarea placeholder="Plan" value={draft.plan} onChange={(e) => setDraft({ ...draft, plan: e.target.value })} style={{ ...FIELD_STYLE, minHeight: 50 }} />
          <button onClick={save} disabled={pending} style={{ background: "#0c1730", color: "white", border: "none", borderRadius: 8, padding: "8px 14px", fontSize: 13, cursor: "pointer", justifySelf: "start" }}>
            Save note
          </button>
        </div>
      )}

      {notes.length === 0 ? (
        <p style={{ color: "#999", fontSize: 12.5 }}>No progress notes yet.</p>
      ) : (
        <div style={{ display: "grid", gap: 10 }}>
          {notes.map((n) => (
            <div key={n.id} style={{ background: "white", border: "1px solid #e2e2e5", borderRadius: 10, padding: 14, fontSize: 13 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                <div style={{ fontWeight: 700 }}>{new Date(n.note_date).toLocaleDateString()} {n.chief_complaint ? `— ${n.chief_complaint}` : ""}</div>
                <button onClick={() => remove(n.id)} style={{ background: "none", border: "none", color: "#999", cursor: "pointer", fontSize: 12 }}>
                  Remove
                </button>
              </div>
              {n.subjective && <div style={{ marginBottom: 3 }}><strong>S:</strong> {n.subjective}</div>}
              {n.objective && <div style={{ marginBottom: 3 }}><strong>O:</strong> {n.objective}</div>}
              {n.assessment && <div style={{ marginBottom: 3 }}><strong>A:</strong> {n.assessment}</div>}
              {n.plan && <div style={{ marginBottom: 3 }}><strong>P:</strong> {n.plan}</div>}
              <div style={{ fontSize: 11, color: "#999", marginTop: 6 }}>{n.user_profiles?.full_name ?? "Staff"}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
