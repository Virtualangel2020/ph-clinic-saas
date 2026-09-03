"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { addProgressNoteAction, removeProgressNoteAction } from "../actions";
import { addEncounterAmendmentAction } from "../../encounters/actions";

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
  amends_note_id?: string | null;
  amendment_reason?: string | null;
  user_profiles: { full_name: string | null } | null;
};

const FIELD_STYLE: React.CSSProperties = { border: "1px solid var(--input-border)", borderRadius: 8, padding: "8px 10px", fontSize: 13, fontFamily: "inherit", width: "100%" };
const VITAL_INPUT_STYLE: React.CSSProperties = { ...FIELD_STYLE, textAlign: "center" };

// The clinic's default note template (if any) only relabels/reprompts these
// same 4 fixed fields — patient_progress_notes has no flexible storage for
// note content, so there's nothing else a template could add here. When no
// template is set (the common case today), every field falls back to
// exactly the hardcoded label/placeholder this composer always used.
type NoteSection = { label: string; placeholder: string };
type NoteTemplate = {
  subjective?: NoteSection;
  objective?: NoteSection;
  assessment?: NoteSection;
  plan?: NoteSection;
} | null;

const DEFAULT_SECTIONS: Record<"subjective" | "objective" | "assessment" | "plan", NoteSection> = {
  subjective: { label: "Subjective", placeholder: "Subjective" },
  objective: { label: "Objective", placeholder: "Objective" },
  assessment: { label: "Assessment", placeholder: "Assessment / Diagnosis" },
  plan: { label: "Plan", placeholder: "Plan" },
};

const EMPTY_DRAFT = {
  noteDate: new Date().toISOString().slice(0, 10),
  chiefComplaint: "",
  subjective: "",
  objective: "",
  assessment: "",
  plan: "",
  followUpDate: "",
  followUpReason: "",
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

export function ProgressNotesSection({
  patientId,
  notes,
  encounterId,
  isSignedEncounter = false,
  canViewClinical = true,
  noteTemplate = null,
}: {
  patientId: string;
  notes: Note[];
  encounterId?: string;
  isSignedEncounter?: boolean;
  canViewClinical?: boolean;
  noteTemplate?: NoteTemplate;
}) {
  const sections = {
    subjective: noteTemplate?.subjective ?? DEFAULT_SECTIONS.subjective,
    objective: noteTemplate?.objective ?? DEFAULT_SECTIONS.objective,
    assessment: noteTemplate?.assessment ?? DEFAULT_SECTIONS.assessment,
    plan: noteTemplate?.plan ?? DEFAULT_SECTIONS.plan,
  };
  const router = useRouter();
  const [adding, setAdding] = useState(false);
  const [tab, setTab] = useState<"notes" | "vitals">("notes");
  const [draft, setDraft] = useState(EMPTY_DRAFT);
  const [amendsNoteId, setAmendsNoteId] = useState("");
  const [amendmentReason, setAmendmentReason] = useState("");
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function save() {
    if (!draft.chiefComplaint.trim() && !draft.assessment.trim() && !draft.bpSystolic && !draft.pulseRate) return;
    if (isSignedEncounter && !amendsNoteId) {
      setError("Select which note this amendment corrects.");
      return;
    }
    if (isSignedEncounter && !amendmentReason.trim()) {
      setError("An amendment reason is required.");
      return;
    }
    setError(null);
    startTransition(async () => {
      try {
        const vitals = {
          bpSystolic: draft.bpSystolic,
          bpDiastolic: draft.bpDiastolic,
          pulseRate: draft.pulseRate,
          respiratoryRate: draft.respiratoryRate,
          oxygenSaturation: draft.oxygenSaturation,
          temperatureC: draft.temperatureC,
          weightKg: draft.weightKg,
          heightCm: draft.heightCm,
        };
        if (isSignedEncounter && encounterId) {
          await addEncounterAmendmentAction(
            patientId,
            encounterId,
            amendsNoteId,
            amendmentReason,
            draft.noteDate,
            draft.chiefComplaint,
            draft.subjective,
            draft.objective,
            draft.assessment,
            draft.plan,
            vitals,
            draft.followUpDate || null,
            draft.followUpReason || null
          );
        } else {
          await addProgressNoteAction(
            patientId,
            draft.noteDate,
            draft.chiefComplaint,
            draft.subjective,
            draft.objective,
            draft.assessment,
            draft.plan,
            vitals,
            encounterId,
            draft.followUpDate || null,
            draft.followUpReason || null
          );
        }
        setDraft(EMPTY_DRAFT);
        setAmendsNoteId("");
        setAmendmentReason("");
        setTab("notes");
        setAdding(false);
        router.refresh();
      } catch (e: any) {
        setError(e.message);
      }
    });
  }

  function remove(id: string) {
    setError(null);
    startTransition(async () => {
      try {
        await removeProgressNoteAction(id, patientId);
        router.refresh();
      } catch (e: any) {
        setError(e.message);
      }
    });
  }

  if (!canViewClinical) {
    return (
      <div style={{ marginTop: 24 }}>
        <h2 style={{ fontSize: 15, marginBottom: 8 }}>Progress notes</h2>
        <div style={{ background: "#f7f7f9", border: "1px solid var(--card-border)", borderRadius: 10, padding: 16, color: "#888", fontSize: 12.5 }}>
          🔒 Clinical documentation is restricted for your role. Contact your clinic administrator if you need access.
        </div>
      </div>
    );
  }

  return (
    <div style={{ marginTop: 24 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
        <h2 style={{ fontSize: 15 }}>Progress notes</h2>
        <button onClick={() => setAdding((v) => !v)} style={{ fontSize: 12.5, color: "var(--text-heading)", background: "none", border: "none", cursor: "pointer", fontWeight: 600 }}>
          {adding ? "Cancel" : isSignedEncounter ? "+ Add amendment" : "+ Add note"}
        </button>
      </div>

      {error && !adding && <p style={{ fontSize: 12, color: "crimson", marginBottom: 8 }}>{error}</p>}

      {adding && (
        <div style={{ background: "var(--card-bg)", border: "1px solid var(--card-border)", borderRadius: 10, marginBottom: 10, overflow: "hidden" }}>
          {isSignedEncounter && (
            <div style={{ padding: 14, borderBottom: "1px solid #e2e2e5", background: "#fff6e6" }}>
              <p style={{ fontSize: 11.5, color: "#5c4400", margin: "0 0 8px" }}>
                This encounter is signed — new entries are recorded as amendments, alongside the original note.
              </p>
              <div style={{ marginBottom: 8 }}>
                <div style={vitalLabelStyle}>Note being amended</div>
                <select value={amendsNoteId} onChange={(e) => setAmendsNoteId(e.target.value)} style={{ ...FIELD_STYLE, width: "100%" }}>
                  <option value="">— Select a note —</option>
                  {notes.filter((n) => !n.amends_note_id).map((n) => (
                    <option key={n.id} value={n.id}>
                      {new Date(n.note_date).toLocaleDateString()} {n.chief_complaint ? `— ${n.chief_complaint}` : ""}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <div style={vitalLabelStyle}>Reason for amendment</div>
                <input placeholder="e.g. Corrected diagnosis after lab results" value={amendmentReason} onChange={(e) => setAmendmentReason(e.target.value)} style={{ ...FIELD_STYLE, width: "100%" }} />
              </div>
            </div>
          )}
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
                <div>
                  {noteTemplate && <div style={vitalLabelStyle}>{sections.subjective.label}</div>}
                  <textarea placeholder={sections.subjective.placeholder} value={draft.subjective} onChange={(e) => setDraft({ ...draft, subjective: e.target.value })} style={{ ...FIELD_STYLE, minHeight: 50 }} />
                </div>
                <div>
                  {noteTemplate && <div style={vitalLabelStyle}>{sections.objective.label}</div>}
                  <textarea placeholder={sections.objective.placeholder} value={draft.objective} onChange={(e) => setDraft({ ...draft, objective: e.target.value })} style={{ ...FIELD_STYLE, minHeight: 50 }} />
                </div>
                <div>
                  {noteTemplate && <div style={vitalLabelStyle}>{sections.assessment.label}</div>}
                  <textarea placeholder={sections.assessment.placeholder} value={draft.assessment} onChange={(e) => setDraft({ ...draft, assessment: e.target.value })} style={{ ...FIELD_STYLE, minHeight: 50 }} />
                </div>
                <div>
                  {noteTemplate && <div style={vitalLabelStyle}>{sections.plan.label}</div>}
                  <textarea placeholder={sections.plan.placeholder} value={draft.plan} onChange={(e) => setDraft({ ...draft, plan: e.target.value })} style={{ ...FIELD_STYLE, minHeight: 50 }} />
                </div>
                <div style={{ background: "#f7f9ff", border: "1px solid #dce4fb", borderRadius: 8, padding: 10 }}>
                  <div style={vitalLabelStyle}>Follow-up (optional)</div>
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                    <input
                      type="date"
                      value={draft.followUpDate}
                      onChange={(e) => setDraft({ ...draft, followUpDate: e.target.value })}
                      style={{ ...FIELD_STYLE, width: 160 }}
                    />
                    <input
                      placeholder="Reason (e.g. Recheck BP, review labs)"
                      value={draft.followUpReason}
                      onChange={(e) => setDraft({ ...draft, followUpReason: e.target.value })}
                      style={{ ...FIELD_STYLE, flex: 1, minWidth: 160 }}
                    />
                  </div>
                  <p style={{ fontSize: 10.5, color: "#888", margin: "6px 0 0" }}>
                    Set a date here and this patient shows up on the clinic's Follow-ups Due list until it's marked done.
                  </p>
                </div>
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
            {error && <p style={{ fontSize: 12, color: "crimson", margin: 0 }}>{error}</p>}
            <button onClick={save} disabled={pending} style={{ background: "#0c1730", color: "white", border: "none", borderRadius: 8, padding: "8px 14px", fontSize: 13, cursor: "pointer", justifySelf: "start", marginTop: 4 }}>
              {pending ? "Saving…" : isSignedEncounter ? "Save amendment" : "Save note"}
            </button>
          </div>
        </div>
      )}

      {notes.length === 0 ? (
        <p style={{ color: "#999", fontSize: 12.5 }}>No progress notes yet.</p>
      ) : (
        <div style={{ display: "grid", gap: 10 }}>
          {notes.map((n) => (
            <div key={n.id} style={{ background: "var(--card-bg)", border: "1px solid var(--card-border)", borderRadius: 10, padding: 14, fontSize: 13 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                <div style={{ fontWeight: 700 }}>{new Date(n.note_date).toLocaleDateString()} {n.chief_complaint ? `— ${n.chief_complaint}` : ""}</div>
                {!isSignedEncounter && (
                  <button onClick={() => remove(n.id)} disabled={pending} style={{ background: "none", border: "none", color: "#999", cursor: "pointer", fontSize: 12 }}>
                    Remove
                  </button>
                )}
              </div>
              {n.amends_note_id && (
                <div style={{ fontSize: 10.5, fontWeight: 700, color: "#8a6100", background: "#fff6e6", border: "1px solid #f0d998", borderRadius: 999, padding: "2px 8px", display: "inline-block", marginBottom: 6 }}>
                  AMENDMENT{n.amendment_reason ? `: ${n.amendment_reason}` : ""}
                </div>
              )}

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
    <span style={{ fontSize: 11, background: "#f0f4ff", color: "var(--text-heading)", border: "1px solid #c7d4f5", borderRadius: 999, padding: "2px 9px", fontWeight: 600 }}>
      {label} <span style={{ fontWeight: 400 }}>{value}</span>
    </span>
  );
}

const vitalLabelStyle: React.CSSProperties = { fontSize: 11, fontWeight: 600, color: "#666", marginBottom: 4 };
