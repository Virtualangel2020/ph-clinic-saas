"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { searchPatientsAction, type PatientSearchResult } from "../../patients/actions";
import { ReferralForm } from "../referral-form";

function age(dob: string) {
  const b = new Date(dob);
  const now = new Date();
  let a = now.getFullYear() - b.getFullYear();
  const m = now.getMonth() - b.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < b.getDate())) a--;
  return a;
}

// Global "+ New Referral" entry point (spec §22-25): search-patient-first,
// then place the referral. Once a patient is picked, this embeds the exact
// same ReferralForm (../referral-form.tsx) the patient chart's Referrals
// tab uses — no separate creation path, just a different starting point
// for staff who don't already have a chart open.
export function NewReferralClient() {
  const router = useRouter();
  const [patient, setPatient] = useState<PatientSearchResult | null>(null);
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

  if (!patient) {
    return (
      <div style={{ maxWidth: 520 }}>
        <div style={{ background: "var(--card-bg)", border: "1px solid var(--card-border)", borderRadius: 12, padding: 24 }}>
          <h2 style={{ fontSize: 15, marginBottom: 4 }}>Search Patient</h2>
          <input
            autoFocus
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="e.g. Maria Santos, AC-1048, 08/23/1985…"
            style={{ width: "100%", boxSizing: "border-box", border: "1px solid var(--input-border)", borderRadius: 8, padding: "10px 12px", fontSize: 13.5, marginTop: 10 }}
          />
          {searching && <p style={{ fontSize: 12, color: "#999", marginTop: 10 }}>Searching…</p>}
          {results.length > 0 && (
            <div style={{ marginTop: 12, display: "grid", gap: 6 }}>
              {results.map((p) => (
                <button
                  key={p.id}
                  onClick={() => setPatient(p)}
                  style={{ display: "flex", justifyContent: "space-between", alignItems: "center", textAlign: "left", background: "#f7f7f9", border: "1px solid #eee", borderRadius: 8, padding: "10px 12px", cursor: "pointer", fontSize: 13 }}
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
        </div>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 560 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", background: "#f7f7f9", border: "1px solid #eee", borderRadius: 10, padding: "10px 14px", marginBottom: 14 }}>
        <div style={{ fontSize: 13.5, fontWeight: 700 }}>
          {patient.last_name}, {patient.first_name}
          <span style={{ color: "#888", marginLeft: 8, fontWeight: 500, fontSize: 12 }}>
            {patient.sex} · {age(patient.date_of_birth)}y · {patient.patient_code ?? "—"}
          </span>
        </div>
        <button onClick={() => setPatient(null)} style={{ background: "none", border: "none", color: "#999", cursor: "pointer", fontSize: 12 }}>
          Change patient
        </button>
      </div>

      <ReferralForm patientId={patient.id} onDone={() => router.push(`/dashboard/patients/${patient.id}?tab=referrals`)} />
    </div>
  );
}
