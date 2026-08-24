"use client";

import { useState } from "react";
import Link from "next/link";
import { ActiveProblemsSection, type ProblemRow } from "./active-problems-section";
import { PrescriptionsSection, type PrescriptionRow } from "./prescriptions-section";
import { LabSection, type LabOrderRow } from "./lab-section";

type EncounterRow = {
  id: string;
  encounter_date: string;
  encounter_type: string | null;
  chief_complaint: string | null;
  status: string;
  signed_at: string | null;
  provider_name: string | null;
};

type SubTabKey = "problems" | "prescriptions" | "orders_results" | "encounters";
const SUBTABS: { key: SubTabKey; label: string }[] = [
  { key: "problems", label: "Active Problems" },
  { key: "prescriptions", label: "Prescriptions" },
  { key: "orders_results", label: "Orders & Results" },
  { key: "encounters", label: "Recent Encounters" },
];

// Clinical tab — a single consolidated "what's going on with this patient
// clinically" snapshot. Every subtab below reuses the SAME components and
// data the chart's own dedicated Prescriptions / Orders & Results /
// Encounters tabs use (never a second copy) — this tab exists purely as
// a faster one-screen view, the same way Overview > Profile already shows
// a quick appointment summary while a full Appointments view also exists.
// Recent Encounters here deliberately matches the outside Encounters
// tab's own status/type labeling exactly (✓ Signed / Completed / Open).
export function ClinicalTab({
  patientId,
  problems,
  prescriptions,
  labOrders,
  encounters,
}: {
  patientId: string;
  problems: ProblemRow[];
  prescriptions: PrescriptionRow[];
  labOrders: LabOrderRow[];
  encounters: EncounterRow[];
}) {
  const [sub, setSub] = useState<SubTabKey>("problems");

  return (
    <div>
      <div style={{ display: "flex", gap: 4, marginBottom: 16, flexWrap: "wrap" }}>
        {SUBTABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setSub(t.key)}
            style={{
              background: sub === t.key ? "#0c1730" : "transparent",
              color: sub === t.key ? "#e6c66b" : "#555",
              border: `1px solid ${sub === t.key ? "#0c1730" : "var(--input-border)"}`,
              borderRadius: 999,
              padding: "6px 14px",
              fontSize: 12.5,
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            {t.label}
          </button>
        ))}
      </div>

      {sub === "problems" && <ActiveProblemsSection patientId={patientId} problems={problems} />}
      {sub === "prescriptions" && <PrescriptionsSection patientId={patientId} prescriptions={prescriptions} />}
      {sub === "orders_results" && <LabSection patientId={patientId} labOrders={labOrders} />}
      {sub === "encounters" && <RecentEncounters patientId={patientId} encounters={encounters} />}
    </div>
  );
}

function RecentEncounters({ patientId, encounters }: { patientId: string; encounters: EncounterRow[] }) {
  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
        <h2 style={{ fontSize: 15 }}>Recent Encounters</h2>
        <Link href={`/dashboard/patients/${patientId}?tab=encounters`} style={{ fontSize: 12.5, color: "var(--text-heading)", fontWeight: 600, textDecoration: "none" }}>
          View full history →
        </Link>
      </div>
      {encounters.length === 0 ? (
        <p style={{ color: "#999", fontSize: 12.5 }}>No encounters recorded yet.</p>
      ) : (
        <div style={{ display: "grid", gap: 8 }}>
          {encounters.slice(0, 15).map((e) => (
            <Link
              key={e.id}
              href={`/dashboard/encounters/${e.id}`}
              style={{ display: "flex", justifyContent: "space-between", alignItems: "center", background: "var(--card-bg)", border: "1px solid var(--card-border)", borderRadius: 10, padding: "10px 14px", textDecoration: "none", gap: 10 }}
            >
              <div>
                <div style={{ fontWeight: 700, fontSize: 13, color: "var(--text-heading)" }}>
                  {new Date(e.encounter_date).toLocaleDateString()}
                  {e.encounter_type && (
                    <span style={{ marginLeft: 8, fontSize: 11, color: "#888", border: "1px solid var(--input-border)", borderRadius: 999, padding: "1px 7px", fontWeight: 400 }}>
                      {e.encounter_type}
                    </span>
                  )}
                </div>
                <div style={{ fontSize: 12, color: "#555", marginTop: 2 }}>{e.chief_complaint || "—"}</div>
                <div style={{ fontSize: 11, color: "#999", marginTop: 2 }}>{e.provider_name ?? "Unknown provider"}</div>
              </div>
              <div style={{ fontSize: 11, fontWeight: 700, color: e.signed_at ? "#0c1730" : e.status === "closed" ? "#1a7f37" : "#8a6100", whiteSpace: "nowrap" }}>
                {e.signed_at ? "✓ Signed" : e.status === "closed" ? "Completed" : "Open"}
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
