"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { checkAppointmentConflictsAction, saveAppointmentAction, setAppointmentStatusAction, type AppointmentConflict } from "./actions";
import { isoToPhDateTime, toIsoInstant } from "./date-utils";
import { STATUS_FLOW, TERMINAL_STATUSES } from "./status-constants";

type Patient = { id: string; first_name: string; middle_name: string | null; last_name: string; mobile_phone: string | null };
type Provider = { id: string; full_name: string; title: string | null };
type ApptType = { id: string; name: string; color: string; default_duration_minutes: number };
type CancellationReason = { id: string; label: string };

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

export function AppointmentForm({
  defaultDate,
  defaultTime,
  editing,
  providers,
  appointmentTypes,
  patients,
  allowDoubleBooking,
  cancellationReasons,
  onClose,
}: {
  defaultDate: string;
  defaultTime?: string;
  editing: EditingAppointment | null;
  providers: Provider[];
  appointmentTypes: ApptType[];
  patients: Patient[];
  allowDoubleBooking: boolean;
  cancellationReasons: CancellationReason[];
  onClose: () => void;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [conflicts, setConflicts] = useState<AppointmentConflict[] | null>(null);
  const [checkingConflicts, setCheckingConflicts] = useState(false);
  // Which status the "cancel / late-cancellation" reason picker is currently
  // open for — null when it's not showing.
  const [reasonPromptFor, setReasonPromptFor] = useState<string | null>(null);
  const [reasonChoice, setReasonChoice] = useState("");

  const initialDt = editing ? isoToPhDateTime(editing.start_at) : { date: defaultDate, time: defaultTime ?? "09:00" };
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

  function doSave(startAt: string, endAt: string) {
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

  // Pre-flight: check for a same-provider overlap before submitting, so a
  // double-booking is a warning the user confirms rather than a silent
  // overwrite or a surprise server-side rejection. Server RPCs re-check
  // this themselves regardless (hard block when double-booking is off).
  function save() {
    setError(null);
    setConflicts(null);
    if (!patientId) return setError("Select a patient.");
    if (!date || !time) return setError("Set a date and time.");
    const startAt = toIsoInstant(date, time);
    const endAt = new Date(new Date(startAt).getTime() + duration * 60000).toISOString();

    if (!providerId) return doSave(startAt, endAt);

    setCheckingConflicts(true);
    checkAppointmentConflictsAction(providerId, startAt, endAt, editing?.id ?? null)
      .then((found) => {
        setCheckingConflicts(false);
        if (found.length > 0) {
          setConflicts(found);
        } else {
          doSave(startAt, endAt);
        }
      })
      .catch((e: any) => {
        setCheckingConflicts(false);
        setError(e.message);
      });
  }

  function bookAnyway() {
    const startAt = toIsoInstant(date, time);
    const endAt = new Date(new Date(startAt).getTime() + duration * 60000).toISOString();
    setConflicts(null);
    doSave(startAt, endAt);
  }

  function changeStatus(status: string, reason?: string) {
    if (!editing) return;
    startTransition(async () => {
      try {
        await setAppointmentStatusAction(editing.id, status, reason);
        setReasonPromptFor(null);
        setReasonChoice("");
        router.refresh();
        onClose();
      } catch (e: any) {
        setError(e.message);
      }
    });
  }

  // Cancel / late-cancellation always route through the structured reasons
  // dropdown (Settings > Scheduling & Calendar) instead of a free-text
  // browser prompt, so cancellation data stays reportable.
  function requestStatusWithReason(status: string) {
    setReasonChoice(cancellationReasons[0]?.label ?? "");
    setReasonPromptFor(status);
  }

  function confirmReasonAndChangeStatus() {
    if (!reasonPromptFor) return;
    changeStatus(reasonPromptFor, reasonChoice || undefined);
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

        {conflicts && conflicts.length > 0 && (
          <div style={{ background: "#fff6e6", border: "1px solid #f0d998", borderRadius: 8, padding: "10px 12px", fontSize: 12.5, color: "#8a6100" }}>
            <div style={{ fontWeight: 700, marginBottom: 4 }}>
              {allowDoubleBooking ? "This provider is already booked at that time." : "Scheduling conflict — double-booking is off for this clinic."}
            </div>
            <div style={{ marginBottom: 8 }}>
              {conflicts.map((c) => (
                <div key={c.id}>
                  {c.patient_last_name}, {c.patient_first_name} — already scheduled then.
                </div>
              ))}
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              {allowDoubleBooking && (
                <button onClick={bookAnyway} disabled={pending} style={{ background: "#0c1730", color: "white", border: "none", borderRadius: 6, padding: "6px 12px", fontSize: 12, cursor: "pointer", fontWeight: 600 }}>
                  Book anyway
                </button>
              )}
              <button onClick={() => setConflicts(null)} disabled={pending} style={{ background: "white", color: "#8a6100", border: "1px solid #f0d998", borderRadius: 6, padding: "6px 12px", fontSize: 12, cursor: "pointer" }}>
                Choose a different time
              </button>
            </div>
          </div>
        )}

        {reasonPromptFor && (
          <div style={{ background: "#fdecec", border: "1px solid #f3c2c2", borderRadius: 8, padding: "10px 12px", fontSize: 12.5 }}>
            <div style={{ fontWeight: 700, color: "#a12a2a", marginBottom: 6 }}>
              Reason for {reasonPromptFor === "late_cancellation" ? "late cancellation" : "cancelling"}
            </div>
            {cancellationReasons.length > 0 ? (
              <select value={reasonChoice} onChange={(e) => setReasonChoice(e.target.value)} style={{ ...FIELD_STYLE, marginBottom: 8 }}>
                {cancellationReasons.map((r) => (
                  <option key={r.id} value={r.label}>
                    {r.label}
                  </option>
                ))}
              </select>
            ) : (
              <input
                value={reasonChoice}
                onChange={(e) => setReasonChoice(e.target.value)}
                placeholder="Reason (optional)"
                style={{ ...FIELD_STYLE, marginBottom: 8 }}
              />
            )}
            <div style={{ display: "flex", gap: 8 }}>
              <button onClick={confirmReasonAndChangeStatus} disabled={pending} style={{ background: "#a12a2a", color: "white", border: "none", borderRadius: 6, padding: "6px 12px", fontSize: 12, cursor: "pointer", fontWeight: 600 }}>
                Confirm
              </button>
              <button onClick={() => setReasonPromptFor(null)} disabled={pending} style={{ background: "white", color: "#666", border: "1px solid #ddd", borderRadius: 6, padding: "6px 12px", fontSize: 12, cursor: "pointer" }}>
                Back
              </button>
            </div>
          </div>
        )}

        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
          <button onClick={save} disabled={pending || checkingConflicts} style={{ background: "#0c1730", color: "white", border: "none", borderRadius: 8, padding: "9px 16px", fontSize: 13, cursor: "pointer", fontWeight: 600 }}>
            {checkingConflicts ? "Checking…" : editing ? "Save changes" : "Book appointment"}
          </button>

          {editing && !TERMINAL_STATUSES.has(editing.status) && (
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
              <button onClick={() => requestStatusWithReason("late_cancellation")} disabled={pending} style={{ background: "#fff6e6", color: "#8a6100", border: "1px solid #f0d998", borderRadius: 8, padding: "8px 12px", fontSize: 12.5, cursor: "pointer" }}>
                Late cancellation
              </button>
              <button onClick={() => requestStatusWithReason("cancelled")} disabled={pending} style={{ background: "#fdecec", color: "#a12a2a", border: "1px solid #f3c2c2", borderRadius: 8, padding: "8px 12px", fontSize: 12.5, cursor: "pointer" }}>
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
