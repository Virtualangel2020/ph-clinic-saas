"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { searchAngelClinicProvidersAction, checkSharingAuthorizedAction, type DirectoryProvider } from "../patients/care-coordination-actions";
import { sendRecordsTransferAction } from "./records-exchange-actions";

export type SelectableEncounterRow = {
  id: string;
  patient_id: string;
  patient_name: string | null;
  provider_name: string | null;
  encounter_type: string | null;
  chief_complaint: string | null;
  status: string;
  signed_at: string | null;
  encounter_date: string;
};

const CARD_STYLE: React.CSSProperties = { display: "flex", alignItems: "center", gap: 12, background: "white", border: "1px solid #e2e2e5", borderRadius: 10, padding: "12px 14px" };

// Multi-select + combined PDF export (spec §3-5, §14). Reused by both the
// date-organized default view and the Search Encounters results — the
// selected-date view can list many different patients' visits together, so
// the single-patient export rule is enforced here client-side (a friendly,
// immediate check) AND again server-side in the export route (a real
// PHI-mixing guard, not just UX).
export function EncounterSelectionList({
  rows,
  showDate = false,
  emptyMessage = "No encounters found.",
  clinicName,
}: {
  rows: SelectableEncounterRow[];
  showDate?: boolean;
  emptyMessage?: string;
  clinicName?: string;
}) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState<"print" | "download" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [sendOpen, setSendOpen] = useState(false);

  const selectedRows = rows.filter((r) => selected.has(r.id));
  const distinctPatients = new Set(selectedRows.map((r) => r.patient_id));
  const spansMultiplePatients = distinctPatients.size > 1;

  function toggle(id: string) {
    setError(null);
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function selectAll() {
    setError(null);
    setSelected(new Set(rows.map((r) => r.id)));
  }

  function clearSelection() {
    setError(null);
    setSelected(new Set());
  }

  async function exportPdf(mode: "print" | "download") {
    if (selectedRows.length === 0 || spansMultiplePatients) return;
    setError(null);
    setBusy(mode);
    try {
      const res = await fetch("/api/encounters/export-pdf", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ encounterIds: selectedRows.map((r) => r.id) }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error || "Couldn't generate the PDF.");
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      if (mode === "print") {
        window.open(url, "_blank", "noopener,noreferrer");
      } else {
        const patientName = (selectedRows[0]?.patient_name ?? "encounters").replace(/[^a-z0-9]+/gi, "-").toLowerCase();
        const a = document.createElement("a");
        a.href = url;
        a.download = `${patientName}-encounters.pdf`;
        document.body.appendChild(a);
        a.click();
        a.remove();
      }
      setTimeout(() => URL.revokeObjectURL(url), 30000);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy(null);
    }
  }

  const exportDisabled = selectedRows.length === 0 || spansMultiplePatients || busy !== null;
  const sendDisabled = selectedRows.length === 0 || spansMultiplePatients;

  return (
    <div>
      {rows.length > 0 && (
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 8, marginBottom: 10 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <button onClick={selectAll} style={LINK_BUTTON}>Select All</button>
            <button onClick={clearSelection} style={LINK_BUTTON}>Clear Selection</button>
            <span style={{ fontSize: 12, color: "#888" }}>{selected.size} selected</span>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <button onClick={() => exportPdf("print")} disabled={exportDisabled} style={{ ...ACTION_BUTTON, ...(exportDisabled ? ACTION_DISABLED : {}) }}>
              {busy === "print" ? "Opening…" : "Print"}
            </button>
            <button onClick={() => exportPdf("download")} disabled={exportDisabled} style={{ ...ACTION_BUTTON, ...(exportDisabled ? ACTION_DISABLED : {}) }}>
              {busy === "download" ? "Preparing…" : "Download PDF"}
            </button>
            <button
              onClick={() => setSendOpen(true)}
              disabled={sendDisabled}
              style={{ ...ACTION_BUTTON, background: "white", color: "#0c1730", border: "1px solid #0c1730", ...(sendDisabled ? { ...ACTION_DISABLED, border: "1px solid #ddd" } : {}) }}
            >
              Send to AngelClinic Provider
            </button>
          </div>
        </div>
      )}

      {sendOpen && (
        <SendToProviderPanel
          patientId={selectedRows[0]?.patient_id ?? ""}
          patientName={selectedRows[0]?.patient_name ?? "this patient"}
          encounterIds={selectedRows.map((r) => r.id)}
          clinicName={clinicName ?? "your clinic"}
          onClose={() => setSendOpen(false)}
          onSent={() => {
            setSendOpen(false);
            setSelected(new Set());
          }}
        />
      )}

      {spansMultiplePatients && (
        <div style={{ fontSize: 12, color: "#8a6100", background: "#fff6e6", border: "1px solid #f0d998", borderRadius: 8, padding: "8px 12px", marginBottom: 10 }}>
          Select encounters for a single patient to export together — {distinctPatients.size} different patients are currently selected.
        </div>
      )}
      {error && <div style={{ fontSize: 12, color: "crimson", marginBottom: 10 }}>{error}</div>}

      {rows.length === 0 ? (
        <div style={{ background: "white", border: "1px solid #e2e2e5", borderRadius: 12, padding: 24, color: "#888", fontSize: 13 }}>{emptyMessage}</div>
      ) : (
        <div style={{ display: "grid", gap: 8 }}>
          {rows.map((r) => (
            <div key={r.id} style={CARD_STYLE}>
              <input type="checkbox" checked={selected.has(r.id)} onChange={() => toggle(r.id)} style={{ width: 16, height: 16, cursor: "pointer", flexShrink: 0 }} />
              <Link href={`/dashboard/encounters/${r.id}`} style={{ flex: 1, display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, textDecoration: "none", color: "inherit", minWidth: 0 }}>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontWeight: 700, fontSize: 14, color: "#0c1730" }}>
                    {r.patient_name ?? "Unknown patient"}
                    {r.encounter_type && <span style={{ marginLeft: 8, fontSize: 11, color: "#888", border: "1px solid #ddd", borderRadius: 999, padding: "1px 7px", fontWeight: 400 }}>{r.encounter_type}</span>}
                  </div>
                  <div style={{ fontSize: 12, color: "#888", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                    {showDate && `${new Date(r.encounter_date).toLocaleDateString()} · `}
                    {r.provider_name ? `${r.provider_name}` : "Unassigned"}
                    {r.chief_complaint ? ` · ${r.chief_complaint}` : ""}
                  </div>
                </div>
                <div style={{ fontSize: 11, fontWeight: 700, color: r.signed_at ? "#0c1730" : r.status === "closed" ? "#1a7f37" : "#8a6100", whiteSpace: "nowrap" }}>
                  {r.signed_at ? "✓ Signed" : r.status === "closed" ? "Completed" : "Open"}
                </div>
              </Link>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

const LINK_BUTTON: React.CSSProperties = { background: "none", border: "none", color: "#0c1730", fontWeight: 600, fontSize: 12, cursor: "pointer", padding: 0 };
const ACTION_BUTTON: React.CSSProperties = { background: "#0c1730", color: "white", border: "none", borderRadius: 8, padding: "7px 14px", fontSize: 12.5, fontWeight: 600, cursor: "pointer" };
const ACTION_DISABLED: React.CSSProperties = { background: "#eceef2", color: "#aaa", cursor: "not-allowed" };

// "Send Selected" → choose provider → confirmation screen → "Send
// Securely" (spec §14) — internal provider-to-provider sharing, never
// email. Picking a provider doesn't send anything; the confirmation step
// (patient / sending clinic / receiving provider / record count /
// authorization status) is the actual point of no return.
function SendToProviderPanel({
  patientId,
  patientName,
  encounterIds,
  clinicName,
  onClose,
  onSent,
}: {
  patientId: string;
  patientName: string;
  encounterIds: string[];
  clinicName: string;
  onClose: () => void;
  onSent: () => void;
}) {
  const [step, setStep] = useState<"pick" | "confirm">("pick");
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<DirectoryProvider[]>([]);
  const [searching, setSearching] = useState(false);
  const [searched, setSearched] = useState(false);
  const [picked, setPicked] = useState<DirectoryProvider | null>(null);
  const [authorized, setAuthorized] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function runSearch() {
    setSearching(true);
    try {
      setResults(await searchAngelClinicProvidersAction(query));
      setSearched(true);
    } finally {
      setSearching(false);
    }
  }

  async function pick(p: DirectoryProvider) {
    setPicked(p);
    setAuthorized(await checkSharingAuthorizedAction(patientId, p.id));
    setStep("confirm");
  }

  async function sendSecurely() {
    if (!picked) return;
    setSending(true);
    setError(null);
    try {
      await sendRecordsTransferAction(patientId, encounterIds, picked.id);
      onSent();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSending(false);
    }
  }

  return (
    <div style={{ background: "white", border: "1px solid #c7d4f5", borderRadius: 10, padding: 16, marginBottom: 12 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
        <h3 style={{ fontSize: 14, margin: 0 }}>Send to AngelClinic Provider</h3>
        <button onClick={onClose} style={{ background: "none", border: "none", color: "#999", cursor: "pointer", fontSize: 12 }}>Cancel</button>
      </div>

      {step === "pick" ? (
        <div>
          <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && runSearch()}
              placeholder="Search by name, specialty, or clinic…"
              style={{ border: "1px solid #ddd", borderRadius: 8, padding: "8px 10px", fontSize: 13, flex: 1 }}
            />
            <button onClick={runSearch} disabled={searching} style={ACTION_BUTTON}>{searching ? "…" : "Search"}</button>
          </div>
          {searched && (
            <div style={{ maxHeight: 240, overflowY: "auto", border: "1px solid #eee", borderRadius: 8 }}>
              {results.length === 0 && <div style={{ padding: 12, fontSize: 12.5, color: "#999" }}>No providers found.</div>}
              {results.map((p) => (
                <button
                  key={p.id}
                  onClick={() => pick(p)}
                  style={{ display: "block", width: "100%", textAlign: "left", padding: "9px 12px", border: "none", borderBottom: "1px solid #f2f2f2", background: "white", cursor: "pointer", fontSize: 13 }}
                >
                  {p.title ? `${p.title} ` : ""}{p.full_name}
                  <div style={{ fontSize: 11, color: "#888" }}>{[p.specialty, p.clinic_name].filter(Boolean).join(" · ")}</div>
                </button>
              ))}
            </div>
          )}
        </div>
      ) : (
        picked && (
          <div>
            <div style={{ display: "grid", gap: 6, fontSize: 13, marginBottom: 12 }}>
              <Row label="Patient" value={patientName} />
              <Row label="Sending clinic" value={clinicName} />
              <Row label="Receiving provider" value={`${picked.title ? picked.title + " " : ""}${picked.full_name}${picked.clinic_name ? ` (${picked.clinic_name})` : ""}`} />
              <Row label="Records" value={`${encounterIds.length} encounter${encounterIds.length === 1 ? "" : "s"}`} />
              <Row
                label="Authorization"
                value={authorized ? "✓ Verified — active sharing preference on file" : "Not on file — sending anyway will still record who authorized this send"}
              />
            </div>
            {error && <p style={{ fontSize: 11.5, color: "crimson", marginBottom: 8 }}>{error}</p>}
            <div style={{ display: "flex", gap: 8 }}>
              <button onClick={sendSecurely} disabled={sending} style={ACTION_BUTTON}>{sending ? "Sending…" : "Send Securely"}</button>
              <button onClick={() => setStep("pick")} disabled={sending} style={{ background: "white", border: "1px solid #ddd", borderRadius: 8, padding: "7px 14px", fontSize: 12.5, cursor: "pointer" }}>
                Back
              </button>
            </div>
          </div>
        )
      )}
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
      <span style={{ color: "#888" }}>{label}</span>
      <span style={{ fontWeight: 600, color: "#0c1730", textAlign: "right" }}>{value}</span>
    </div>
  );
}
