"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { searchPatientsAction, recentPatientsAction, type PatientSearchResult } from "./actions";

// Same whole-years-elapsed logic as the old patient-list.tsx's age()
// helper (and the patient chart's own copy in [id]/page.tsx) — kept
// identical so the number shown here never disagrees with the chart.
function age(dob: string) {
  const b = new Date(dob);
  const now = new Date();
  let a = now.getFullYear() - b.getFullYear();
  const m = now.getMonth() - b.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < b.getDate())) a--;
  return a;
}

function formatDob(dob: string) {
  const d = new Date(`${dob}T00:00:00`);
  if (Number.isNaN(d.getTime())) return "—";
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${mm}/${dd}/${d.getFullYear()}`;
}

function initials(p: PatientSearchResult) {
  const f = p.first_name?.trim().charAt(0) ?? "";
  const l = p.last_name?.trim().charAt(0) ?? "";
  return (f + l).toUpperCase() || "?";
}

// Left pane of the Patients master-detail layout: search box + Add Patient
// link + result list (search results once 2+ chars are typed, Recent
// Patients otherwise). Selecting a card updates ?patient= via client-side
// navigation so the right pane (server-rendered) re-renders without a full
// page reload.
export function PatientSearchPanel() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const selectedId = searchParams.get("patient");

  const [q, setQ] = useState("");
  const [debouncedQ, setDebouncedQ] = useState("");
  const [results, setResults] = useState<PatientSearchResult[]>([]);
  const [loading, setLoading] = useState(true);
  const [showArchived, setShowArchived] = useState(false);

  const isSearching = debouncedQ.trim().length >= 2;

  useEffect(() => {
    const t = setTimeout(() => setDebouncedQ(q), 250);
    return () => clearTimeout(t);
  }, [q]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    const query = debouncedQ.trim();
    const run = query.length >= 2 ? searchPatientsAction(query) : recentPatientsAction();
    run
      .then((rows) => {
        if (!cancelled) setResults(rows);
      })
      .catch(() => {
        if (!cancelled) setResults([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [debouncedQ]);

  const visible = results.filter((p) => (showArchived ? true : p.is_active));

  function selectPatient(id: string) {
    router.push(`/dashboard/patients?patient=${id}`, { scroll: false });
  }

  return (
    <div>
      <input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Search by name, mobile, Patient ID, or DOB…"
        style={{
          width: "100%",
          boxSizing: "border-box",
          border: "1px solid var(--input-border)",
          borderRadius: 8,
          padding: "9px 12px",
          fontSize: 13.5,
          marginBottom: 10,
        }}
      />

      <Link
        href="/dashboard/patients/new"
        style={{
          display: "block",
          textAlign: "center",
          background: "#0c1730",
          color: "white",
          borderRadius: 8,
          padding: "9px 16px",
          fontSize: 13.5,
          fontWeight: 600,
          textDecoration: "none",
          marginBottom: 18,
        }}
      >
        + Add New Patient
      </Link>

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10, gap: 8, flexWrap: "wrap" }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: "var(--text-heading)", textTransform: "uppercase", letterSpacing: 0.3 }}>
          {isSearching ? "Search Results" : "Recent Patients"}
        </div>
        <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: "#888" }}>
          <input type="checkbox" checked={showArchived} onChange={(e) => setShowArchived(e.target.checked)} />
          Show archived
        </label>
      </div>

      {loading ? (
        <div style={{ color: "#888", fontSize: 13, padding: "12px 4px" }}>Loading…</div>
      ) : visible.length === 0 ? (
        <div style={{ background: "var(--card-bg)", border: "1px solid var(--card-border)", borderRadius: 12, padding: 20, color: "#888", fontSize: 13 }}>
          {isSearching ? "No patients match your search." : "No recent patients yet."}
        </div>
      ) : (
        <div style={{ display: "grid", gap: 8 }}>
          {visible.map((p) => {
            const isSelected = p.id === selectedId;
            const fullName = [p.first_name, p.middle_name ? `${p.middle_name.charAt(0)}.` : "", p.last_name].filter(Boolean).join(" ");
            return (
              <button
                key={p.id}
                type="button"
                onClick={() => selectPatient(p.id)}
                style={{
                  display: "flex",
                  gap: 12,
                  alignItems: "flex-start",
                  textAlign: "left",
                  width: "100%",
                  font: "inherit",
                  cursor: "pointer",
                  background: isSelected ? "var(--card-border)" : "var(--card-bg)",
                  border: `1px solid ${isSelected ? "#0c1730" : "var(--card-border)"}`,
                  borderRadius: 10,
                  padding: "12px 14px",
                  opacity: p.is_active ? 1 : 0.6,
                }}
              >
                <div
                  style={{
                    flexShrink: 0,
                    width: 36,
                    height: 36,
                    borderRadius: "50%",
                    background: "#0c1730",
                    color: "white",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: 13,
                    fontWeight: 700,
                  }}
                >
                  {initials(p)}
                </div>
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                    <div style={{ fontWeight: 700, fontSize: 14, color: "var(--text-heading)" }}>{fullName}</div>
                    <span
                      style={{
                        fontSize: 10.5,
                        fontWeight: 700,
                        padding: "2px 8px",
                        borderRadius: 999,
                        color: p.is_active ? "#1a7a3c" : "#a12a2a",
                        background: p.is_active ? "rgba(26,122,60,0.12)" : "rgba(161,42,42,0.12)",
                      }}
                    >
                      {p.is_active ? "Active" : "Archived"}
                    </span>
                  </div>
                  <div style={{ fontSize: 12, color: "#888", marginTop: 2 }}>
                    {p.sex || "—"} | {formatDob(p.date_of_birth)} | {age(p.date_of_birth)} years old
                  </div>
                  <div style={{ fontSize: 12, color: "#888" }}>Patient ID: {p.patient_code ?? "—"}</div>
                  <div style={{ fontSize: 12, color: "#888" }}>Mobile: {p.mobile_phone || "—"}</div>
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
