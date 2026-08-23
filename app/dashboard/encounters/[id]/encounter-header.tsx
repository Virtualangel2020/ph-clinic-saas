"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { setEncounterStatusAction, updateEncounterAction } from "../actions";

type Provider = { id: string; full_name: string; title: string | null };
type ApptType = { id: string; name: string };

const FIELD_STYLE: React.CSSProperties = { border: "1px solid #ddd", borderRadius: 8, padding: "8px 10px", fontSize: 13, fontFamily: "inherit", width: "100%", boxSizing: "border-box" };
const labelStyle: React.CSSProperties = { fontSize: 11.5, fontWeight: 600, color: "#666", marginBottom: 4 };

export function EncounterHeader({
  encounterId,
  patientId,
  status,
  providerId,
  encounterType,
  chiefComplaint,
  providers,
  appointmentTypes,
}: {
  encounterId: string;
  patientId: string;
  status: string;
  providerId: string | null;
  encounterType: string | null;
  chiefComplaint: string | null;
  providers: Provider[];
  appointmentTypes: ApptType[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [provider, setProvider] = useState(providerId ?? "");
  const [type, setType] = useState(encounterType ?? "");
  const [complaint, setComplaint] = useState(chiefComplaint ?? "");
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function save() {
    setError(null);
    startTransition(async () => {
      try {
        await updateEncounterAction(encounterId, patientId, provider, type, complaint);
        setSaved(true);
        setTimeout(() => setSaved(false), 1500);
        router.refresh();
      } catch (e: any) {
        setError(e.message);
      }
    });
  }

  function toggleStatus() {
    startTransition(async () => {
      try {
        await setEncounterStatusAction(encounterId, patientId, status === "closed" ? "open" : "closed");
        router.refresh();
      } catch (e: any) {
        setError(e.message);
      }
    });
  }

  return (
    <div style={{ background: "white", border: "1px solid #e2e2e5", borderRadius: 12, padding: 16, marginTop: 14, marginBottom: 20 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
        <span
          style={{
            fontSize: 11,
            fontWeight: 700,
            color: status === "closed" ? "#1a7f37" : "#8a6100",
            background: status === "closed" ? "#eaf7ee" : "#fff6e6",
            border: `1px solid ${status === "closed" ? "#bfe6c9" : "#f0d998"}`,
            borderRadius: 999,
            padding: "3px 10px",
          }}
        >
          {status === "closed" ? "Closed" : "Open visit"}
        </span>
        <button
          onClick={toggleStatus}
          disabled={pending}
          style={{ background: status === "closed" ? "#f0f4ff" : "#0c1730", color: status === "closed" ? "#0c1730" : "white", border: status === "closed" ? "1px solid #c7d4f5" : "none", borderRadius: 8, padding: "7px 14px", fontSize: 12.5, fontWeight: 600, cursor: "pointer" }}
        >
          {status === "closed" ? "Reopen encounter" : "Close encounter"}
        </button>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 10 }}>
        <div>
          <div style={labelStyle}>Provider</div>
          <select value={provider} onChange={(e) => setProvider(e.target.value)} onBlur={save} style={FIELD_STYLE}>
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
          <select value={type} onChange={(e) => setType(e.target.value)} onBlur={save} style={FIELD_STYLE}>
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
        <input value={complaint} onChange={(e) => setComplaint(e.target.value)} onBlur={save} style={FIELD_STYLE} />
      </div>

      {saved && <div style={{ fontSize: 11.5, color: "#1a7f37", marginTop: 6 }}>Saved.</div>}
      {error && <div style={{ fontSize: 11.5, color: "crimson", marginTop: 6 }}>{error}</div>}
    </div>
  );
}
