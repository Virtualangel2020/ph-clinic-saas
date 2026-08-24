"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { searchPatientsAction, type PatientSearchResult } from "../../patients/actions";
import { addLabOrderAction, type OrderType } from "../actions";

function age(dob: string) {
  const b = new Date(dob);
  const now = new Date();
  let a = now.getFullYear() - b.getFullYear();
  const m = now.getMonth() - b.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < b.getDate())) a--;
  return a;
}

const ORDER_TYPE_LABEL: Record<OrderType, string> = {
  lab: "Lab",
  imaging: "Imaging",
  procedure: "Procedure",
  referral_related: "Referral-related",
  other: "Other",
};

const FIELD_STYLE: React.CSSProperties = { border: "1px solid var(--input-border)", borderRadius: 8, padding: "8px 10px", fontSize: 13, fontFamily: "inherit", width: "100%", boxSizing: "border-box" };
const labelStyle: React.CSSProperties = { fontSize: 11, fontWeight: 600, color: "#666", marginBottom: 4 };

export function NewOrderClient() {
  const router = useRouter();
  const [patient, setPatient] = useState<PatientSearchResult | null>(null);
  const [q, setQ] = useState("");
  const [results, setResults] = useState<PatientSearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [orderType, setOrderType] = useState<OrderType>("lab");
  const [tests, setTests] = useState<string[]>([""]);
  const [priority, setPriority] = useState("routine");
  const [notes, setNotes] = useState("");
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

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

  function updateTest(i: number, value: string) {
    setTests((prev) => prev.map((t, idx) => (idx === i ? value : t)));
  }
  function addTestRow() {
    setTests((prev) => [...prev, ""]);
  }
  function removeTestRow(i: number) {
    setTests((prev) => prev.filter((_, idx) => idx !== i));
  }

  function placeOrder() {
    if (!patient) return;
    const cleaned = tests.map((t) => t.trim()).filter(Boolean);
    if (cleaned.length === 0) {
      setError("Add at least one item.");
      return;
    }
    setError(null);
    startTransition(async () => {
      try {
        await addLabOrderAction(
          patient.id,
          null,
          priority,
          notes,
          cleaned.map((testName) => ({ testName })),
          orderType
        );
        router.push(`/dashboard/patients/${patient.id}?tab=orders_results`);
      } catch (e: any) {
        setError(e.message || "Couldn't place that order.");
      }
    });
  }

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

      <div style={{ background: "var(--card-bg)", border: "1px solid var(--card-border)", borderRadius: 10, padding: 16, display: "grid", gap: 10 }}>
        <div>
          <div style={labelStyle}>Order Type</div>
          <select value={orderType} onChange={(e) => setOrderType(e.target.value as OrderType)} style={FIELD_STYLE}>
            {(Object.keys(ORDER_TYPE_LABEL) as OrderType[]).map((t) => (
              <option key={t} value={t}>
                {ORDER_TYPE_LABEL[t]}
              </option>
            ))}
          </select>
        </div>

        <div>
          <div style={labelStyle}>{orderType === "lab" ? "Tests" : "Items"}</div>
          <div style={{ display: "grid", gap: 6 }}>
            {tests.map((t, i) => (
              <div key={i} style={{ display: "flex", gap: 6 }}>
                <input
                  placeholder={orderType === "lab" ? "e.g. CBC, Lipid panel" : orderType === "imaging" ? "e.g. Chest X-ray" : "e.g. Wound dressing"}
                  value={t}
                  onChange={(e) => updateTest(i, e.target.value)}
                  style={FIELD_STYLE}
                />
                {tests.length > 1 && (
                  <button onClick={() => removeTestRow(i)} style={{ background: "none", border: "none", color: "#999", cursor: "pointer", fontSize: 16, padding: "0 6px" }}>
                    ×
                  </button>
                )}
              </div>
            ))}
          </div>
          <button onClick={addTestRow} style={{ marginTop: 6, fontSize: 12, color: "var(--text-heading)", background: "none", border: "none", cursor: "pointer", fontWeight: 600 }}>
            + Add another {orderType === "lab" ? "test" : "item"}
          </button>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 2fr", gap: 10 }}>
          <div>
            <div style={labelStyle}>Priority</div>
            <select value={priority} onChange={(e) => setPriority(e.target.value)} style={FIELD_STYLE}>
              <option value="routine">Routine</option>
              <option value="stat">STAT</option>
            </select>
          </div>
          <div>
            <div style={labelStyle}>Notes</div>
            <input placeholder="Optional" value={notes} onChange={(e) => setNotes(e.target.value)} style={FIELD_STYLE} />
          </div>
        </div>

        {error && <p style={{ fontSize: 12, color: "#a12a2a", margin: 0 }}>{error}</p>}
        <button onClick={placeOrder} disabled={pending} style={{ background: "#0c1730", color: "white", border: "none", borderRadius: 8, padding: "9px 16px", fontSize: 13, cursor: "pointer", justifySelf: "start" }}>
          {pending ? "Placing…" : "Place order"}
        </button>
      </div>
    </div>
  );
}
