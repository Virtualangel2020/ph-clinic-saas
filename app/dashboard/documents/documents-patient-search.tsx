"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { searchPatientsAction, type PatientSearchResult } from "../patients/actions";

function age(dob: string) {
  const b = new Date(dob);
  const now = new Date();
  let a = now.getFullYear() - b.getFullYear();
  const m = now.getMonth() - b.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < b.getDate())) a--;
  return a;
}

// Patient-first gate for the global Documents tab (spec §10): staff search
// for and select a patient BEFORE any documents render, so nobody lands on
// a wall of every patient's files by default. Same searchPatientsAction
// used by the master-detail Patients list — name, mobile, Patient ID, or
// date of birth.
export function DocumentsPatientSearch() {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [results, setResults] = useState<PatientSearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (timer.current) clearTimeout(timer.current);
    if (q.trim().length < 2) {
      setResults([]);
      return;
    }
    timer.current = setTimeout(async () => {
      setSearching(true);
      try {
        setResults(await searchPatientsAction(q));
      } finally {
        setSearching(false);
      }
    }, 250);
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, [q]);

  return (
    <div style={{ maxWidth: 520 }}>
      <div style={{ background: "var(--card-bg)", border: "1px solid var(--card-border)", borderRadius: 12, padding: 24 }}>
        <h2 style={{ fontSize: 15, marginBottom: 4 }}>Search Patient</h2>
        <p style={{ fontSize: 12.5, color: "#888", marginBottom: 12 }}>
          Search by name, date of birth, mobile number, or Patient ID to open that patient's document folders.
        </p>
        <input
          autoFocus
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="e.g. Maria Santos, AC-1048, 08/23/1985…"
          style={{ width: "100%", boxSizing: "border-box", border: "1px solid var(--input-border)", borderRadius: 8, padding: "10px 12px", fontSize: 13.5 }}
        />

        {searching && <p style={{ fontSize: 12, color: "#999", marginTop: 10 }}>Searching…</p>}

        {results.length > 0 && (
          <div style={{ marginTop: 12, display: "grid", gap: 6 }}>
            {results.map((p) => (
              <button
                key={p.id}
                onClick={() => router.push(`/dashboard/documents?patient=${p.id}`)}
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  textAlign: "left",
                  background: "#f7f7f9",
                  border: "1px solid #eee",
                  borderRadius: 8,
                  padding: "10px 12px",
                  cursor: "pointer",
                  fontSize: 13,
                }}
              >
                <span>
                  <strong>
                    {p.last_name}, {p.first_name}
                  </strong>
                  <span style={{ color: "#888", marginLeft: 8, fontSize: 12 }}>
                    {p.sex} · {age(p.date_of_birth)}y · {p.patient_code ?? "—"}
                  </span>
                </span>
                <span style={{ color: "#bbb" }}>›</span>
              </button>
            ))}
          </div>
        )}

        {!searching && q.trim().length >= 2 && results.length === 0 && (
          <p style={{ fontSize: 12.5, color: "#999", marginTop: 10 }}>No matching patients.</p>
        )}
      </div>
    </div>
  );
}
