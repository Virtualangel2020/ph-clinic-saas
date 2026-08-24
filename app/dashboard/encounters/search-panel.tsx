"use client";

import { useState, useTransition } from "react";
import { searchEncountersAction, type EncounterSearchFilter, type EncounterSearchRow } from "./actions";
import { EncounterSelectionList, type SelectableEncounterRow } from "./encounter-selection-list";

type Provider = { id: string; full_name: string; title: string | null };
type ApptType = { id: string; name: string };

const FIELD_STYLE: React.CSSProperties = { border: "1px solid #ddd", borderRadius: 8, padding: "8px 10px", fontSize: 13, fontFamily: "inherit" };
const labelStyle: React.CSSProperties = { fontSize: 11.5, fontWeight: 600, color: "#666", marginBottom: 4 };
const PAGE_SIZE = 25;

function toSelectable(rows: EncounterSearchRow[]): SelectableEncounterRow[] {
  return rows.map((r) => ({
    id: r.id,
    patient_id: r.patient_id,
    patient_name: r.patient_name,
    provider_name: r.provider_name,
    encounter_type: r.encounter_type,
    chief_complaint: r.chief_complaint,
    status: r.status,
    signed_at: r.signed_at,
    encounter_date: r.encounter_date,
  }));
}

// Search Encounters (spec §20) — for finding older notes without loading a
// patient's or the clinic's full history: date range + provider + type,
// paginated with "Load more" like every other list in this module.
export function SearchPanel({ providers, appointmentTypes, clinicName }: { providers: Provider[]; appointmentTypes: ApptType[]; clinicName?: string }) {
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [providerId, setProviderId] = useState("");
  const [encounterType, setEncounterType] = useState("");
  const [status, setStatus] = useState("");
  const [rows, setRows] = useState<EncounterSearchRow[]>([]);
  const [hasMore, setHasMore] = useState(false);
  const [searched, setSearched] = useState(false);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function filter(offset: number): EncounterSearchFilter {
    return { from, to, providerId, encounterType, status, offset, limit: PAGE_SIZE };
  }

  function runSearch() {
    setError(null);
    startTransition(async () => {
      try {
        const result = await searchEncountersAction(filter(0));
        setRows(result.rows);
        setHasMore(result.hasMore);
        setSearched(true);
      } catch (e: any) {
        setError(e.message);
      }
    });
  }

  function loadMore() {
    setError(null);
    startTransition(async () => {
      try {
        const result = await searchEncountersAction(filter(rows.length));
        setRows((prev) => [...prev, ...result.rows]);
        setHasMore(result.hasMore);
      } catch (e: any) {
        setError(e.message);
      }
    });
  }

  return (
    <div>
      <div style={{ background: "white", border: "1px solid #e2e2e5", borderRadius: 12, padding: 16, marginBottom: 14 }}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 10, marginBottom: 10 }}>
          <div>
            <div style={labelStyle}>From date</div>
            <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} style={{ ...FIELD_STYLE, width: "100%", boxSizing: "border-box" }} />
          </div>
          <div>
            <div style={labelStyle}>To date</div>
            <input type="date" value={to} onChange={(e) => setTo(e.target.value)} style={{ ...FIELD_STYLE, width: "100%", boxSizing: "border-box" }} />
          </div>
          <div>
            <div style={labelStyle}>Provider</div>
            <select value={providerId} onChange={(e) => setProviderId(e.target.value)} style={{ ...FIELD_STYLE, width: "100%", boxSizing: "border-box" }}>
              <option value="">All providers</option>
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
            <select value={encounterType} onChange={(e) => setEncounterType(e.target.value)} style={{ ...FIELD_STYLE, width: "100%", boxSizing: "border-box" }}>
              <option value="">All types</option>
              {appointmentTypes.map((t) => (
                <option key={t.id} value={t.name}>
                  {t.name}
                </option>
              ))}
            </select>
          </div>
        </div>
        <button onClick={runSearch} disabled={pending} style={{ background: "#0c1730", color: "white", border: "none", borderRadius: 8, padding: "8px 16px", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
          {pending && !searched ? "Searching…" : "Search"}
        </button>
      </div>

      {error && <div style={{ fontSize: 12.5, color: "crimson", marginBottom: 10 }}>{error}</div>}

      {searched && (
        <div style={{ opacity: pending ? 0.6 : 1 }}>
          <EncounterSelectionList rows={toSelectable(rows)} showDate emptyMessage="No encounters match this search." clinicName={clinicName} />
          {hasMore && (
            <button
              onClick={loadMore}
              disabled={pending}
              style={{ marginTop: 12, background: "white", border: "1px solid #ddd", borderRadius: 8, padding: "8px 16px", fontSize: 12.5, fontWeight: 600, cursor: "pointer", color: "#0c1730" }}
            >
              {pending ? "Loading…" : "Load more"}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
