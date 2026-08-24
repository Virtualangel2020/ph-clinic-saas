"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { searchPatientEncountersAction, type EncounterHistoryFilter, type EncounterHistoryRow } from "../actions";

type Provider = { id: string; full_name: string; title: string | null };
type ApptType = { id: string; name: string };

const PAGE_SIZE = 20;

const RANGE_OPTIONS: { key: EncounterHistoryFilter["rangeKey"]; label: string }[] = [
  { key: "all", label: "All" },
  { key: "30d", label: "Last 30 Days" },
  { key: "3m", label: "Last 3 Months" },
  { key: "6m", label: "Last 6 Months" },
  { key: "1y", label: "Last Year" },
];

const FIELD_STYLE: React.CSSProperties = { border: "1px solid #ddd", borderRadius: 6, padding: "5px 8px", fontSize: 12, fontFamily: "inherit" };

// Patient-chart Encounters — this is deliberately the OTHER of the two ways
// to reach encounter info (see spec: "OPTION 1 — From Patient Chart" vs
// "OPTION 2 — Main Encounters Module"). This view needs no date selected
// first: most-recent-first, optional light filters, paginated with "Load
// More" rather than ever pulling the patient's whole history at once.
export function EncounterHistorySection({
  patientId,
  initialRows,
  initialHasMore,
  providers,
  appointmentTypes,
}: {
  patientId: string;
  initialRows: EncounterHistoryRow[];
  initialHasMore: boolean;
  providers: Provider[];
  appointmentTypes: ApptType[];
}) {
  const [rows, setRows] = useState(initialRows);
  const [hasMore, setHasMore] = useState(initialHasMore);
  const [rangeKey, setRangeKey] = useState<EncounterHistoryFilter["rangeKey"]>("all");
  const [providerId, setProviderId] = useState("");
  const [encounterType, setEncounterType] = useState("");
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function runFilter(next: Partial<{ rangeKey: EncounterHistoryFilter["rangeKey"]; providerId: string; encounterType: string }>) {
    const merged = { rangeKey, providerId, encounterType, ...next };
    setRangeKey(merged.rangeKey);
    setProviderId(merged.providerId);
    setEncounterType(merged.encounterType);
    setError(null);
    startTransition(async () => {
      try {
        const result = await searchPatientEncountersAction({
          patientId,
          rangeKey: merged.rangeKey,
          providerId: merged.providerId,
          encounterType: merged.encounterType,
          offset: 0,
          limit: PAGE_SIZE,
        });
        setRows(result.rows);
        setHasMore(result.hasMore);
      } catch (e: any) {
        setError(e.message);
      }
    });
  }

  function loadMore() {
    setError(null);
    startTransition(async () => {
      try {
        const result = await searchPatientEncountersAction({
          patientId,
          rangeKey,
          providerId,
          encounterType,
          offset: rows.length,
          limit: PAGE_SIZE,
        });
        setRows((prev) => [...prev, ...result.rows]);
        setHasMore(result.hasMore);
      } catch (e: any) {
        setError(e.message);
      }
    });
  }

  return (
    <div style={{ marginTop: 28 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8, flexWrap: "wrap", gap: 8 }}>
        <h2 style={{ fontSize: 15 }}>Encounters</h2>
        <Link href={`/dashboard/encounters?patient=${patientId}`} style={{ fontSize: 12.5, color: "#0c1730", fontWeight: 600, textDecoration: "none" }}>
          + New encounter
        </Link>
      </div>

      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 12 }}>
        {RANGE_OPTIONS.map((r) => (
          <button
            key={r.key}
            onClick={() => runFilter({ rangeKey: r.key })}
            disabled={pending}
            style={{
              border: "1px solid #ddd",
              borderRadius: 999,
              padding: "4px 11px",
              fontSize: 11.5,
              fontWeight: 600,
              cursor: "pointer",
              background: rangeKey === r.key ? "#0c1730" : "white",
              color: rangeKey === r.key ? "#e6c66b" : "#555",
            }}
          >
            {r.label}
          </button>
        ))}
        {providers.length > 0 && (
          <select value={providerId} onChange={(e) => runFilter({ providerId: e.target.value })} disabled={pending} style={FIELD_STYLE}>
            <option value="">All providers</option>
            {providers.map((p) => (
              <option key={p.id} value={p.id}>
                {p.title ? `${p.title} ` : ""}
                {p.full_name}
              </option>
            ))}
          </select>
        )}
        {appointmentTypes.length > 0 && (
          <select value={encounterType} onChange={(e) => runFilter({ encounterType: e.target.value })} disabled={pending} style={FIELD_STYLE}>
            <option value="">All types</option>
            {appointmentTypes.map((t) => (
              <option key={t.id} value={t.name}>
                {t.name}
              </option>
            ))}
          </select>
        )}
      </div>

      {error && <p style={{ color: "crimson", fontSize: 12.5, marginBottom: 10 }}>{error}</p>}

      {rows.length === 0 ? (
        <p style={{ color: "#999", fontSize: 12.5 }}>{pending ? "Loading…" : "No visits recorded yet for this filter."}</p>
      ) : (
        <div style={{ display: "grid", gap: 8, opacity: pending ? 0.6 : 1 }}>
          {rows.map((e) => (
            <Link
              key={e.id}
              href={`/dashboard/encounters/${e.id}`}
              style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, background: "white", border: "1px solid #e2e2e5", borderRadius: 10, padding: "11px 14px", textDecoration: "none", fontSize: 13 }}
            >
              <div>
                <span style={{ fontWeight: 700, color: "#0c1730" }}>{new Date(e.encounter_date).toLocaleDateString()}</span>
                {e.encounter_type && <span style={{ marginLeft: 8, fontSize: 11, color: "#888", border: "1px solid #ddd", borderRadius: 999, padding: "1px 7px" }}>{e.encounter_type}</span>}
                {e.chief_complaint && <span style={{ color: "#666", marginLeft: 8 }}>— {e.chief_complaint}</span>}
                {e.provider_name && <span style={{ color: "#999", marginLeft: 8, fontSize: 12 }}>· {e.provider_name}</span>}
              </div>
              <div style={{ fontSize: 11, fontWeight: 700, color: e.signed_at ? "#0c1730" : e.status === "closed" ? "#1a7f37" : "#8a6100" }}>
                {e.signed_at ? "✓ Signed" : e.status === "closed" ? "Completed" : "In Progress"}
              </div>
            </Link>
          ))}
        </div>
      )}

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
  );
}
