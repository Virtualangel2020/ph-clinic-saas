"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { saveAppointmentAction, setAppointmentStatusAction } from "./actions";
import { isoToPhDateTime, toIsoInstant } from "./date-utils";

type Patient = { id: string; first_name: string; middle_name: string | null; last_name: string; mobile_phone: string | null };
type Provider = { id: string; full_name: string; title: string | null };
type ApptType = { id: string; name: string; color: string; default_duration_minutes: number };

type EditingAppointment = {
  id: string;
  patient_id: string;
  provider_id: string | null;
  appointment_type_id: string | null;
  start_at: string;
  end_at: string;
  status: string;
  notes: string | null;
};

const FIELD_STYLE: React.CSSProperties = { border: "1px solid #ddd", borderRadius: 8, padding: "8px 10px", fontSize: 13, fontFamily: "inherit", width: "100%", boxSizing: "border-box" };

const STATUS_FLOW: { key: string; label: string }[] = [
  { key: "scheduled", label: "Scheduled" },
  { key: "confirmed", label: "Confirmed" },
  { key: "checked_in", label: "Checked in" },
  { key: "completed", label: "Completed" },
];

export function AppointmentForm({
  defaultDate,
  editing,
  providers,
  appointmentTypes,
  patients,
  onClose,
}: {
  defaultDate: string;
  editing: EditingAppointment | null;
  providers: Provider[];
  appointmentTypes: ApptType[];
  patients: Patient[];
  onClose: () => void;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const initialDt = editing ? isoToPhDateTime(editing.start_at) : { date: defaultDate, time: "09:00" };
  const [patientId, setPatientId] = useState(editing?.patient_id ?? "");
  const [patientQuery, setPatientQuery] = useState(() => {
    if (!editing) return "";
    const p = patients.find((p) => p.id === editing.patient_id);
    return p ? `${p.last_name}, ${p.first_name}` : "";
  });
  const [showPatientList, setShowPatientList] = useState(false);
  const [providerId, setProviderId] = useState(editing?.provider_id ?? providers[0]?.id ?? "");
  const [typeId, setTypeId] = useState(editing?.appointment_type_id ?? appointmentTypes[0]?.id ?? "");
  const [date, setDate] = useState(initialDt.date);
  const [time, setTime] = useState(initialDt.time);
  const [duration, setDuration] = useState(() => {
    if (editing) return Math.max(5, Math.round((new Date(editing.end_at).getTime() - new Date(editing.start_at).getTime()) / 60000));
    return appointmentTypes[0]?.default_duration_minutes ?? 30;
  });
  const [notes, setNotes] = useState(editing?.notes ?? "");

  const filteredPatients = useMemo(() => {
    const q = patientQuery.trim().toLowerCase();
    if (!q) return patients.slice(0, 8);
    return patients.filter((p) => `${p.first_name} ${p.middle_name ?? ""} ${p.last_name}`.toLowerCase().includes(q)).slice(0, 8);
  }, [patients, patientQuery]);

  function pickType(id: string) {
    setTypeId(id);
    const t = appointmentTypes.find((t) => t.id === id);
    if (t) setDuration(t.default_duration_minutes);
  }

  function save() {
    setError(null);
    if (!patientId) return setError("Select a patient.");
    if (!date || !time) return setError("Set a date and time.");
    const startAt = toIsoInstant(date, time);
    const endAt = new Date(new Date(startAt).getTime() + duration * 60000).toISOString();
    startTransition(async () => {
      try {
        await saveAppointmentAction({
          id: editing?.id ?? null,
          patientId,
          providerId,
          appointmentTypeId: typeId,
          startAt,
          endAt,
          notes,
        });
        router.refresh();
        onClose();
      } catch (e: any) {
        setError(e.message);
      }
    });
  }

  function changeStatus(status: string) {
    if (!editing) return;
    startTransition(async () => {
      try {
        if (status === "cancelled") {
          const reason = window.prompt("Reason for cancelling (optional):") ?? "";
          await setAppointmentStatusAction(editing.id, "cancelled", reason);
        } else {
          await setAppointmentStatusAction(editing.id, status);
        }
        router.refresh();
        onClose();
      } catch (e: any) {
        setError(e.message);
      }
    });
  }

  return (
    <div style={{ background: "white", border: "1px solid #e2e2e5", borderRadius: 10, padding: 16, marginBottom: 16 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
        <h3 style={{ fontSize: 14.5 }}>{editing ? "Edit appointment" : "New appointment"}</h3>
        <button onClick={onClose} style={{ background: "none", border: "none", color: "#999", cursor: "pointer", fontSize: 13 }}>
          Close
        </button>
      </div>

      <div style={{ display: "grid", gap: 10, maxWidth: 560 }}>
        <div style={{ position: "relative" }}>
          <div style={labelStyle}>Patient</div>
          <input
            value={patientQuery}
            onChange={(e) => {
              setPatientQuery(e.target.value);
              setPatientId("");
              setShowPatientList(true);
            }}
            onFocus={() => setShowPatientList(true)}
            onBlur={() => setTimeout(() => setShowPatientList(false), 150)}
            placeholder="Search by name…"
            style={FIELD_STYLE}
          />
          {showPatientList && (
            <div style={{ position: "absolute", zIndex: 5, top: "100%", left: 0, right: 0, background: "white", border: "1px solid #ddd", borderRadius: 8, marginTop: 2, maxHeight: 200, overflowY: "auto", boxShadow: "0 4px 12px rgba(0,0,0,0.08)" }}>
              {filteredPatients.length === 0 ? (
                <div style={{ padding: "8px 12px", fontSize: 12.5, color: "#999" }}>No patients match.</div>
              ) : (
                filteredPatients.map((p) => (
                  <div
                    key={p.id}
                    onClick={() => {
                      setPatientId(p.id);
                      setPatientQuery(`${p.last_name}, ${p.first_name}`);
                      setShowPatientList(false);
                    }}
                    style={{ padding: "8px 12px", fontSize: 13, cursor: "pointer", borderBottom: "1px solid #f2f2f2" }}
                  >
                    {p.last_name}, {p.first_name} {p.middle_name ? p.middle_name.charAt(0) + "." : ""}
                    {p.mobile_phone && <span style={{ color: "#999", marginLeft: 6 }}>{p.mobile_phone}</span>}
                  </div>
                ))
              )}
            </div>
          )}
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 100px", gap: 10 }}>
          <div>
            <div style={labelStyle}>Date</div>
            <input type="date" value={date} onChange={(e) => setDate(e.target.value)} style={FIELD_STYLE} />
          </div>
          <div>
            <div style={labelStyle}>Time</div>
            <input type="time" value={time} onChange={(e) => setTime(e.target.value)} style={FIELD_STYLE} />
          </div>
          <div>
            <div style={labelStyle}>Mins</div>
            <input type="number" min={5} step={5} value={duration} onChange={(e) => setDuration(Number(e.target.value) || 30)} style={FIELD_STYLE} />
          </div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          <div>
            <div style={labelStyle}>Provider</div>
            <select value={providerId} onChange={(e) => setProviderId(e.target.value)} style={FIELD_STYLE}>
              <option value="">Unassigned</option>
              {providers.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.title ? `${p.title} ` : ""}
                  {p.full_name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <div style={labelStyle}>Type</div>
            <select value={typeId} onChange={(e) => pickType(e.target.value)} style={FIELD_STYLE}>
              <option value="">—</option>
              {appointmentTypes.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div>
          <div style={labelStyle}>Notes</div>
          <textarea value={notes} onChange={(e) => setNotes(e.target.value)} style={{ ...FIELD_STYLE, minHeight: 50 }} />
        </div>

        {error && <div style={{ fontSize: 12.5, color: "crimson" }}>{error}</div>}

        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
          <button onClick={save} disabled={pending} style={{ background: "#0c1730", color: "white", border: "none", borderRadius: 8, padding: "9px 16px", fontSize: 13, cursor: "pointer", fontWeight: 600 }}>
            {editing ? "Save changes" : "Book appointment"}
          </button>

          {editing && editing.status !== "cancelled" && editing.status !== "no_show" && editing.status !== "completed" && (
            <>
              {STATUS_FLOW.filter((s) => s.key !== editing.status).map((s) => (
                <button
                  key={s.key}
                  onClick={() => changeStatus(s.key)}
                  disabled={pending}
                  style={{ background: "#f0f4ff", color: "#0c1730", border: "1px solid #c7d4f5", borderRadius: 8, padding: "8px 12px", fontSize: 12.5, cursor: "pointer" }}
                >
                  Mark {s.label}
                </button>
              ))}
              <button onClick={() => changeStatus("no_show")} disabled={pending} style={{ background: "#fff6e6", color: "#8a6100", border: "1px solid #f0d998", borderRadius: 8, padding: "8px 12px", fontSize: 12.5, cursor: "pointer" }}>
                No-show
              </button>
              <button onClick={() => changeStatus("cancelled")} disabled={pending} style={{ background: "#fdecec", color: "#a12a2a", border: "1px solid #f3c2c2", borderRadius: 8, padding: "8px 12px", fontSize: 12.5, cursor: "pointer" }}>
                Cancel appointment
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

const labelStyle: React.CSSProperties = { fontSize: 11.5, fontWeight: 600, color: "#666", marginBottom: 4 };
