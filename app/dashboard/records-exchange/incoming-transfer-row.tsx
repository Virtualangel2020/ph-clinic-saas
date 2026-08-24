"use client";

import { useState, useTransition } from "react";
import {
  acceptRecordsTransferAction,
  declineRecordsTransferAction,
  fileRecordsTransferAction,
  getTransferPdfUrlAction,
} from "../encounters/records-exchange-actions";
import type { PatientInput } from "../patients/actions";

const STATUS_STYLE: Record<string, { bg: string; border: string; color: string; label: string }> = {
  sent: { bg: "#fff6e6", border: "#f0d998", color: "#8a6100", label: "Awaiting your review" },
  accepted: { bg: "#eaf7ee", border: "#bfe6c9", color: "#1a7f37", label: "Accepted" },
  declined: { bg: "#fbeaea", border: "#f0c2c2", color: "#a12a2a", label: "Declined" },
};

type Patient = { id: string; first_name: string; middle_name: string | null; last_name: string; date_of_birth: string; mobile_phone: string | null };

const FIELD_STYLE: React.CSSProperties = { border: "1px solid #ddd", borderRadius: 8, padding: "7px 9px", fontSize: 12.5, fontFamily: "inherit", width: "100%", boxSizing: "border-box" };

const EMPTY_NEW_PATIENT: PatientInput = {
  id: null,
  firstName: "",
  middleName: "",
  lastName: "",
  suffix: "",
  dateOfBirth: "",
  sex: "female",
  civilStatus: "",
  bloodType: "",
  mobilePhone: "",
  email: "",
  addressLine1: "",
  addressLine2: "",
  city: "",
  province: "",
  postalCode: "",
  emergencyContactName: "",
  emergencyContactRelationship: "",
  emergencyContactPhone: "",
  guardianName: "",
  guardianRelationship: "",
  guardianPhone: "",
  notes: "",
};

// Incoming Records review row (spec §15) — Review -> Accept/Decline ->
// File to Patient. Mirrors SentTransferRow's layout/status-badge styling
// but adds the two-stage action flow: while status is "sent" the receiver
// can Accept or Decline; once "accepted" (and not yet filed) a compact
// patient-match panel appears so staff can file the incoming PDF straight
// into this clinic's own patient-documents (never left sitting loose in a
// generic inbox — see the user's explicit "documents tab should be
// cleared" instruction elsewhere in this build).
export function IncomingTransferRow({
  transfer,
  patients,
}: {
  transfer: {
    id: string;
    patient_name: string;
    patient_dob: string;
    record_count: number;
    authorization_verified: boolean;
    status: string;
    sent_at: string;
    accepted_at: string | null;
    sending_provider_name: string;
    sending_clinic_name: string | null;
    filed_patient_id: string | null;
  };
  patients: Patient[];
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [filing, setFiling] = useState(false);
  const [mode, setMode] = useState<"match" | "new">("match");
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState("");
  const [newPatient, setNewPatient] = useState<PatientInput>(EMPTY_NEW_PATIENT);

  const s = STATUS_STYLE[transfer.status] ?? STATUS_STYLE.sent;
  const alreadyFiled = !!transfer.filed_patient_id;

  const suggestions = patients
    .filter((p) => {
      if (!query.trim()) {
        const [last, first] = transfer.patient_name.split(",").map((x) => x.trim().toLowerCase());
        return p.last_name.toLowerCase() === last && (!first || p.first_name.toLowerCase().startsWith(first));
      }
      const q = query.trim().toLowerCase();
      return `${p.first_name} ${p.last_name}`.toLowerCase().includes(q) || `${p.last_name} ${p.first_name}`.toLowerCase().includes(q);
    })
    .slice(0, 6);

  function viewPdf() {
    setError(null);
    startTransition(async () => {
      try {
        const url = await getTransferPdfUrlAction(transfer.id);
        window.open(url, "_blank", "noopener,noreferrer");
      } catch (e: any) {
        setError(e.message);
      }
    });
  }

  function accept() {
    setError(null);
    startTransition(async () => {
      try {
        await acceptRecordsTransferAction(transfer.id);
      } catch (e: any) {
        setError(e.message);
      }
    });
  }

  function decline() {
    if (!confirm(`Decline this record from Dr. ${transfer.sending_provider_name}? This can't be undone.`)) return;
    setError(null);
    startTransition(async () => {
      try {
        await declineRecordsTransferAction(transfer.id, "");
      } catch (e: any) {
        setError(e.message);
      }
    });
  }

  function fileIt() {
    setError(null);
    startTransition(async () => {
      try {
        await fileRecordsTransferAction(
          transfer.id,
          mode === "match" ? selectedId || null : null,
          mode === "new" ? newPatient : null,
          transfer.sending_clinic_name || "another clinic",
          transfer.sending_provider_name
        );
        setFiling(false);
      } catch (e: any) {
        setError(e.message);
      }
    });
  }

  return (
    <div style={{ background: "white", border: "1px solid #e2e2e5", borderRadius: 10, padding: 14 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12, flexWrap: "wrap" }}>
        <div>
          <div style={{ fontWeight: 700, fontSize: 14, color: "#0c1730" }}>{transfer.patient_name}</div>
          <div style={{ fontSize: 12, color: "#888" }}>
            DOB {new Date(transfer.patient_dob).toLocaleDateString()} · From Dr. {transfer.sending_provider_name}
            {transfer.sending_clinic_name ? ` · ${transfer.sending_clinic_name}` : ""} · {transfer.record_count} record
            {transfer.record_count === 1 ? "" : "s"} · Sent {new Date(transfer.sent_at).toLocaleDateString()}
          </div>
          <div style={{ fontSize: 11, color: transfer.authorization_verified ? "#1a7f37" : "#a12a2a", marginTop: 2 }}>
            {transfer.authorization_verified ? "✓ Patient authorized sharing with this provider" : "⚠ No active sharing authorization on file"}
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
          <span style={{ fontSize: 11, fontWeight: 700, color: s.color, background: s.bg, border: `1px solid ${s.border}`, borderRadius: 999, padding: "3px 10px" }}>
            {alreadyFiled ? "Filed" : s.label}
          </span>
          <button onClick={viewPdf} disabled={pending} style={{ fontSize: 12, color: "#0c1730", background: "none", border: "none", cursor: "pointer", fontWeight: 600 }}>
            View PDF
          </button>
          {transfer.status === "sent" && (
            <>
              <button
                onClick={accept}
                disabled={pending}
                style={{ fontSize: 12, fontWeight: 700, color: "white", background: "#1a7f37", border: "none", borderRadius: 6, padding: "6px 12px", cursor: "pointer" }}
              >
                Accept
              </button>
              <button
                onClick={decline}
                disabled={pending}
                style={{ fontSize: 12, fontWeight: 700, color: "#a12a2a", background: "white", border: "1px solid #f0c2c2", borderRadius: 6, padding: "6px 12px", cursor: "pointer" }}
              >
                Decline
              </button>
            </>
          )}
          {transfer.status === "accepted" && !alreadyFiled && !filing && (
            <button
              onClick={() => setFiling(true)}
              style={{ fontSize: 12, fontWeight: 700, color: "white", background: "#0c1730", border: "none", borderRadius: 6, padding: "6px 12px", cursor: "pointer" }}
            >
              File to Patient
            </button>
          )}
        </div>
      </div>

      {error && <p style={{ fontSize: 11.5, color: "crimson", marginTop: 6 }}>{error}</p>}

      {filing && (
        <div style={{ marginTop: 12, borderTop: "1px solid #eee", paddingTop: 12 }}>
          <div style={{ display: "flex", gap: 6, marginBottom: 10 }}>
            <TabBtn active={mode === "match"} onClick={() => setMode("match")} label="Match existing patient" />
            <TabBtn active={mode === "new"} onClick={() => setMode("new")} label="+ Add as new patient" />
          </div>

          {mode === "match" ? (
            <div>
              <input
                placeholder="Search your patients by name…"
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value);
                  setSelectedId("");
                }}
                style={FIELD_STYLE}
              />
              <div style={{ display: "grid", gap: 6, marginTop: 8, maxHeight: 160, overflowY: "auto" }}>
                {suggestions.length === 0 && <div style={{ fontSize: 12, color: "#999" }}>No matching patients — try "+ Add as new patient" instead.</div>}
                {suggestions.map((p) => (
                  <label
                    key={p.id}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 8,
                      fontSize: 12.5,
                      border: `1px solid ${selectedId === p.id ? "#0c1730" : "#eee"}`,
                      borderRadius: 8,
                      padding: "6px 10px",
                      cursor: "pointer",
                      background: selectedId === p.id ? "#f5f6fa" : "white",
                    }}
                  >
                    <input type="radio" name="patientMatch" checked={selectedId === p.id} onChange={() => setSelectedId(p.id)} />
                    <span>
                      {p.last_name}, {p.first_name} — DOB {new Date(p.date_of_birth).toLocaleDateString()}
                      {p.mobile_phone ? ` · ${p.mobile_phone}` : ""}
                    </span>
                  </label>
                ))}
              </div>
            </div>
          ) : (
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}>
              <input placeholder="First name" value={newPatient.firstName} onChange={(e) => setNewPatient({ ...newPatient, firstName: e.target.value })} style={FIELD_STYLE} />
              <input placeholder="Last name" value={newPatient.lastName} onChange={(e) => setNewPatient({ ...newPatient, lastName: e.target.value })} style={FIELD_STYLE} />
              <input type="date" value={newPatient.dateOfBirth} onChange={(e) => setNewPatient({ ...newPatient, dateOfBirth: e.target.value })} style={FIELD_STYLE} />
              <select value={newPatient.sex} onChange={(e) => setNewPatient({ ...newPatient, sex: e.target.value })} style={FIELD_STYLE}>
                <option value="female">Female</option>
                <option value="male">Male</option>
                <option value="other">Other</option>
              </select>
              <input placeholder="Mobile phone" value={newPatient.mobilePhone} onChange={(e) => setNewPatient({ ...newPatient, mobilePhone: e.target.value })} style={FIELD_STYLE} />
            </div>
          )}

          <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
            <button
              onClick={fileIt}
              disabled={pending || (mode === "match" ? !selectedId : !newPatient.firstName || !newPatient.lastName || !newPatient.dateOfBirth)}
              style={{ fontSize: 12.5, fontWeight: 700, color: "white", background: "#0c1730", border: "none", borderRadius: 6, padding: "7px 14px", cursor: "pointer" }}
            >
              {pending ? "Filing…" : "File This Record"}
            </button>
            <button
              onClick={() => setFiling(false)}
              disabled={pending}
              style={{ fontSize: 12.5, fontWeight: 600, color: "#666", background: "white", border: "1px solid #ddd", borderRadius: 6, padding: "7px 14px", cursor: "pointer" }}
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function TabBtn({ active, onClick, label }: { active: boolean; onClick: () => void; label: string }) {
  return (
    <button
      onClick={onClick}
      style={{
        fontSize: 12,
        fontWeight: 600,
        padding: "6px 12px",
        borderRadius: 6,
        border: active ? "1px solid #0c1730" : "1px solid #ddd",
        background: active ? "#0c1730" : "white",
        color: active ? "white" : "#666",
        cursor: "pointer",
      }}
    >
      {label}
    </button>
  );
}
