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
  bp_systolic: number | null;
  bp_diastolic: number | null;
  pulse_rate: number | null;
  respiratory_rate: number | null;
  oxygen_saturation: number | null;
  temperature_c: number | null;
  weight_kg: number | null;
  height_cm: number | null;
  created_at: string;
  user_profiles: { full_name: string | null } | null;
};

const FIELD_STYLE: React.CSSProperties = { border: "1px solid #ddd", borderRadius: 8, padding: "8px 10px", fontSize: 13, fontFamily: "inherit", width: "100%" };
const VITAL_INPUT_STYLE: React.CSSProperties = { ...FIELD_STYLE, textAlign: "center" };

const EMPTY_DRAFT = {
  noteDate: new Date().toISOString().slice(0, 10),
  chiefComplaint: "",
  subjective: "",
  objective: "",
  assessment: "",
  plan: "",
  bpSystolic: "",
  bpDiastolic: "",
  pulseRate: "",
  respiratoryRate: "",
  oxygenSaturation: "",
  temperatureC: "",
  weightKg: "",
  heightCm: "",
};

function hasAnyVital(n: Note) {
  return (
    n.bp_systolic != null ||
    n.bp_diastolic != null ||
    n.pulse_rate != null ||
    n.respiratory_rate != null ||
    n.oxygen_saturation != null ||
    n.temperature_c != null ||
    n.weight_kg != null ||
    n.height_cm != null
  );
}

export function ProgressNotesSection({ patientId, notes }: { patientId: string; notes: Note[] }) {
  const router = useRouter();
  const [adding, setAdding] = useState(false);
  const [tab, setTab] = useState<"notes" | "vitals">("notes");
  const [draft, setDraft] = useState(EMPTY_DRAFT);
  const [pending, startTransition] = useTransition();

  function save() {
    if (!draft.chiefComplaint.trim() && !draft.assessment.trim() && !draft.bpSystolic && !draft.pulseRate) return;
    startTransition(async () => {
      await addProgressNoteAction(patientId, draft.noteDate, draft.chiefComplaint, draft.subjective, draft.objective, draft.assessment, draft.plan, {
        bpSystolic: draft.bpSystolic,
        bpDiastolic: draft.bpDiastolic,
        pulseRate: draft.pulseRate,
        respiratoryRate: draft.respiratoryRate,
        oxygenSaturation: draft.oxygenSaturation,
        temperatureC: draft.temperatureC,
        weightKg: draft.weightKg,
        heightCm: draft.heightCm,
      });
      setDraft(EMPTY_DRAFT);
      setTab("notes");
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
        <div style={{ background: "white", border: "1px solid #e2e2e5", borderRadius: 10, marginBottom: 10, overflow: "hidden" }}>
          <div style={{ display: "flex", borderBottom: "1px solid #e2e2e5" }}>
            {(["notes", "vitals"] as const).map((t) => (
              <button
                key={t}
                onClick={() => setTab(t)}
                style={{
                  flex: 1,
                  padding: "9px 0",
                  fontSize: 12.5,
                  fontWeight: 700,
                  border: "none",
                  cursor: "pointer",
                  background: tab === t ? "#0c1730" : "#f7f7f9",
                  color: tab === t ? "white" : "#555",
                }}
              >
                {t === "notes" ? "SOAP Notes" : "Vital Signs"}
              </button>
            ))}
          </div>

          <div style={{ padding: 14, display: "grid", gap: 8 }}>
            {tab === "notes" ? (
              <>
                <input type="date" value={draft.noteDate} onChange={(e) => setDraft({ ...draft, noteDate: e.target.value })} style={{ ...FIELD_STYLE, width: 160 }} />
                <input placeholder="Chief complaint" value={draft.chiefComplaint} onChange={(e) => setDraft({ ...draft, chiefComplaint: e.target.value })} style={FIELD_STYLE} />
                <textarea placeholder="Subjective" value={draft.subjective} onChange={(e) => setDraft({ ...draft, subjective: e.target.value })} style={{ ...FIELD_STYLE, minHeight: 50 }} />
                <textarea placeholder="Objective" value={draft.objective} onChange={(e) => setDraft({ ...draft, objective: e.target.value })} style={{ ...FIELD_STYLE, minHeight: 50 }} />
                <textarea placeholder="Assessment / Diagnosis" value={draft.assessment} onChange={(e) => setDraft({ ...draft, assessment: e.target.value })} style={{ ...FIELD_STYLE, minHeight: 50 }} />
                <textarea placeholder="Plan" value={draft.plan} onChange={(e) => setDraft({ ...draft, plan: e.target.value })} style={{ ...FIELD_STYLE, minHeight: 50 }} />
              </>
            ) : (
              <>
                <p style={{ fontSize: 11.5, color: "#999", margin: "0 0 2px" }}>Leave any field blank if it wasn't taken for this visit.</p>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                  <div>
                    <div style={vitalLabelStyle}>BP — Blood pressure (mmHg)</div>
                    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                      <input inputMode="numeric" placeholder="120" value={draft.bpSystolic} onChange={(e) => setDraft({ ...draft, bpSystolic: e.target.value })} style={VITAL_INPUT_STYLE} />
                      <span style={{ color: "#999" }}>/</span>
                      <input inputMode="numeric" placeholder="80" value={draft.bpDiastolic} onChange={(e) => setDraft({ ...draft, bpDiastolic: e.target.value })} style={VITAL_INPUT_STYLE} />
                    </div>
                  </div>
                  <div>
                    <div style={vitalLabelStyle}>O2 — Oxygen saturation (%)</div>
                    <input inputMode="numeric" placeholder="98" value={draft.oxygenSaturation} onChange={(e) => setDraft({ ...draft, oxygenSaturation: e.target.value })} style={VITAL_INPUT_STYLE} />
                  </div>
                  <div>
                    <div style={vitalLabelStyle}>PR — Pulse rate (bpm)</div>
                    <input inputMode="numeric" placeholder="76" value={draft.pulseRate} onChange={(e) => setDraft({ ...draft, pulseRate: e.target.value })} style={VITAL_INPUT_STYLE} />
                  </div>
                  <div>
                    <div style={vitalLabelStyle}>RR — Respiratory rate (breaths/min)</div>
                    <input inputMode="numeric" placeholder="18" value={draft.respiratoryRate} onChange={(e) => setDraft({ ...draft, respiratoryRate: e.target.value })} style={VITAL_INPUT_STYLE} />
                  </div>
                  <div>
                    <div style={vitalLabelStyle}>Temp — Temperature (°C)</div>
                    <input inputMode="decimal" placeholder="36.8" value={draft.temperatureC} onChange={(e) => setDraft({ ...draft, temperatureC: e.target.value })} style={VITAL_INPUT_STYLE} />
                  </div>
                  <div>
                    <div style={vitalLabelStyle}>Weight (kg)</div>
                    <input inputMode="decimal" placeholder="60" value={draft.weightKg} onChange={(e) => setDraft({ ...draft, weightKg: e.target.value })} style={VITAL_INPUT_STYLE} />
                  </div>
                  <div>
                    <div style={vitalLabelStyle}>Height (cm)</div>
                    <input inputMode="decimal" placeholder="165" value={draft.heightCm} onChange={(e) => setDraft({ ...draft, heightCm: e.target.value })} style={VITAL_INPUT_STYLE} />
                  </div>
                </div>
              </>
            )}
            <button onClick={save} disabled={pending} style={{ background: "#0c1730", color: "white", border: "none", borderRadius: 8, padding: "8px 14px", fontSize: 13, cursor: "pointer", justifySelf: "start", marginTop: 4 }}>
              Save note
            </button>
          </div>
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

              {hasAnyVital(n) && (
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 8 }}>
                  {(n.bp_systolic != null || n.bp_diastolic != null) && (
                    <VitalChip label="BP" value={`${n.bp_systolic ?? "—"}/${n.bp_diastolic ?? "—"}`} />
                  )}
                  {n.oxygen_saturation != null && <VitalChip label="O2" value={`${n.oxygen_saturation}%`} />}
                  {n.pulse_rate != null && <VitalChip label="PR" value={`${n.pulse_rate} bpm`} />}
                  {n.respiratory_rate != null && <VitalChip label="RR" value={`${n.respiratory_rate}/min`} />}
                  {n.temperature_c != null && <VitalChip label="Temp" value={`${n.temperature_c}°C`} />}
                  {n.weight_kg != null && <VitalChip label="Wt" value={`${n.weight_kg} kg`} />}
                  {n.height_cm != null && <VitalChip label="Ht" value={`${n.height_cm} cm`} />}
                </div>
              )}

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

function VitalChip({ label, value }: { label: string; value: string }) {
  return (
    <span style={{ fontSize: 11, background: "#f0f4ff", color: "#0c1730", border: "1px solid #c7d4f5", borderRadius: 999, padding: "2px 9px", fontWeight: 600 }}>
      {label} <span style={{ fontWeight: 400 }}>{value}</span>
    </span>
  );
}

const vitalLabelStyle: React.CSSProperties = { fontSize: 11, fontWeight: 600, color: "#666", marginBottom: 4 };
