"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { startEncounterAction } from "./actions";

type Patient = { id: string; first_name: string; middle_name: string | null; last_name: string; mobile_phone: string | null };
type Provider = { id: string; full_name: string; title: string | null };
type ApptType = { id: string; name: string };
type TodaysAppointment = { id: string; patient_id: string; provider_id: string | null; start_at: string; status: string; patients: { first_name: string; last_name: string } | null };
type EncounterRow = {
  id: string;
  encounter_date: string;
  encounter_type: string | null;
  chief_complaint: string | null;
  status: string;
  created_at: string;
  patients: { id: string; first_name: string; last_name: string } | null;
  user_profiles: { full_name: string } | null;
};

const FIELD_STYLE: React.CSSProperties = { border: "1px solid #ddd", borderRadius: 8, padding: "8px 10px", fontSize: 13, fontFamily: "inherit", width: "100%", boxSizing: "border-box" };
const labelStyle: React.CSSProperties = { fontSize: 11.5, fontWeight: 600, color: "#666", marginBottom: 4 };

export function EncountersClient({
  encounters,
  providers,
  patients,
  appointmentTypes,
  todaysAppointments,
  prefillPatientId,
}: {
  encounters: EncounterRow[];
  providers: Provider[];
  patients: Patient[];
  appointmentTypes: ApptType[];
  todaysAppointments: TodaysAppointment[];
  prefillPatientId: string | null;
}) {
  const [open, setOpen] = useState(!!prefillPatientId);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const prefillPatient = prefillPatientId ? patients.find((p) => p.id === prefillPatientId) ?? null : null;
  const [appointmentId, setAppointmentId] = useState("");
  const [patientId, setPatientId] = useState(prefillPatientId ?? "");
  const [patientQuery, setPatientQuery] = useState(prefillPatient ? `${prefillPatient.last_name}, ${prefillPatient.first_name}` : "");
  const [showPatientList, setShowPatientList] = useState(false);
  const [providerId, setProviderId] = useState(providers[0]?.id ?? "");
  const [encounterType, setEncounterType] = useState(appointmentTypes[0]?.name ?? "");
  const [chiefComplaint, setChiefComplaint] = useState("");

  const filteredPatients = useMemo(() => {
    const q = patientQuery.trim().toLowerCase();
    if (!q) return patients.slice(0, 8);
    return patients.filter((p) => `${p.first_name} ${p.middle_name ?? ""} ${p.last_name}`.toLowerCase().includes(q)).slice(0, 8);
  }, [patients, patientQuery]);

  function pickTodaysAppointment(id: string) {
    setAppointmentId(id);
    if (!id) return;
    const appt = todaysAppointments.find((a) => a.id === id);
    if (!appt) return;
    setPatientId(appt.patient_id);
    setPatientQuery(appt.patients ? `${appt.patients.last_name}, ${appt.patients.first_name}` : "");
    if (appt.provider_id) setProviderId(appt.provider_id);
  }

  async function start() {
    setError(null);
    if (!patientId) return setError("Select a patient.");
    setPending(true);
    try {
      await startEncounterAction({ patientId, providerId, appointmentId, encounterType, chiefComplaint });
      // startEncounterAction redirects on success — nothing else to do here.
    } catch (e: any) {
      setError(e.message);
      setPending(false);
    }
  }

  return (
    <div>
      <div style={{ marginBottom: 14 }}>
        {!open ? (
          <button onClick={() => setOpen(true)} style={{ background: "#0c1730", color: "white", border: "none", borderRadius: 8, padding: "9px 16px", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
            + New encounter
          </button>
        ) : (
          <div style={{ background: "white", border: "1px solid #e2e2e5", borderRadius: 10, padding: 16 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
              <h3 style={{ fontSize: 14.5 }}>New encounter</h3>
              <button onClick={() => setOpen(false)} style={{ background: "none", border: "none", color: "#999", cursor: "pointer", fontSize: 13 }}>
                Close
              </button>
            </div>
            <div style={{ display: "grid", gap: 10, maxWidth: 520 }}>
              {todaysAppointments.length > 0 && (
                <div>
                  <div style={labelStyle}>Link to today's appointment (optional)</div>
                  <select value={appointmentId} onChange={(e) => pickTodaysAppointment(e.target.value)} style={FIELD_STYLE}>
                    <option value="">— Walk-in / not on today's calendar —</option>
                    {todaysAppointments.map((a) => (
                      <option key={a.id} value={a.id}>
                        {new Date(a.start_at).toLocaleTimeString("en-PH", { hour: "numeric", minute: "2-digit", hour12: true, timeZone: "Asia/Manila" })} — {a.patients ? `${a.patients.last_name}, ${a.patients.first_name}` : "Unknown"}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div style={{ position: "relative" }}>
                <div style={labelStyle}>Patient</div>
                <input
                  value={patientQuery}
                  onChange={(e) => {
                    setPatientQuery(e.target.value);
                    setPatientId("");
                    setAppointmentId("");
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
                  <div style={labelStyle}>Visit type</div>
                  <select value={encounterType} onChange={(e) => setEncounterType(e.target.value)} style={FIELD_STYLE}>
                    <option value="">—</option>
                    {appointmentTypes.map((t) => (
                      <option key={t.id} value={t.name}>
                        {t.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <div style={labelStyle}>Chief complaint</div>
                <input value={chiefComplaint} onChange={(e) => setChiefComplaint(e.target.value)} style={FIELD_STYLE} />
              </div>

              {error && <div style={{ fontSize: 12.5, color: "crimson" }}>{error}</div>}

              <button onClick={start} disabled={pending} style={{ background: "#0c1730", color: "white", border: "none", borderRadius: 8, padding: "9px 16px", fontSize: 13, fontWeight: 600, cursor: "pointer", justifySelf: "start" }}>
                {pending ? "Starting…" : "Start encounter"}
              </button>
            </div>
          </div>
        )}
      </div>

      {encounters.length === 0 ? (
        <div style={{ background: "white", border: "1px solid #e2e2e5", borderRadius: 12, padding: 24, color: "#888", fontSize: 13 }}>
          No encounters yet — start one above, or from a patient's chart.
        </div>
      ) : (
        <div style={{ display: "grid", gap: 8 }}>
          {encounters.map((e) => (
            <Link
              key={e.id}
              href={`/dashboard/encounters/${e.id}`}
              style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, background: "white", border: "1px solid #e2e2e5", borderRadius: 10, padding: "13px 16px", textDecoration: "none" }}
            >
              <div>
                <div style={{ fontWeight: 700, fontSize: 14, color: "#0c1730" }}>
                  {e.patients ? `${e.patients.last_name}, ${e.patients.first_name}` : "Unknown patient"}
                  {e.encounter_type && <span style={{ marginLeft: 8, fontSize: 11, color: "#888", border: "1px solid #ddd", borderRadius: 999, padding: "1px 7px", fontWeight: 400 }}>{e.encounter_type}</span>}
                </div>
                <div style={{ fontSize: 12, color: "#888" }}>
                  {new Date(e.encounter_date).toLocaleDateString()} {e.user_profiles ? `· ${e.user_profiles.full_name}` : ""} {e.chief_complaint ? `· ${e.chief_complaint}` : ""}
                </div>
              </div>
              <div style={{ fontSize: 11, fontWeight: 700, color: e.status === "closed" ? "#1a7f37" : "#8a6100", whiteSpace: "nowrap" }}>
                {e.status === "closed" ? "Closed" : "Open"}
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
