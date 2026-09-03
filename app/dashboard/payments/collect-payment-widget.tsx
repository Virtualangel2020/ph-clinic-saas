"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { searchPatientsAction, startPatientChargeOnlinePaymentAction, type PatientSearchResult } from "../patients/actions";
import { getPatientOpenChargesAction, type OpenChargeRow } from "./actions";

// "Collect a Payment" — the main working part of the Payments page: find a
// patient, see their open charges, send a PayMongo payment link for one.
// Sending the link reuses startPatientChargeOnlinePaymentAction unchanged
// (same server action the per-patient Billing tab's "Pay Online" button
// calls) — this widget is just a faster way to reach it without opening the
// full chart first, e.g. while a patient is at the front desk.

function peso(n: number) {
  return `₱${n.toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function age(dob: string) {
  const b = new Date(dob);
  const now = new Date();
  let a = now.getFullYear() - b.getFullYear();
  const m = now.getMonth() - b.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < b.getDate())) a--;
  return a;
}

const FIELD_STYLE: React.CSSProperties = {
  width: "100%",
  boxSizing: "border-box",
  border: "1px solid var(--input-border)",
  borderRadius: 8,
  padding: "10px 12px",
  fontSize: 13.5,
};

export function CollectPaymentWidget({ acceptOnline }: { acceptOnline: boolean }) {
  const [patient, setPatient] = useState<PatientSearchResult | null>(null);
  const [q, setQ] = useState("");
  const [results, setResults] = useState<PatientSearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [charges, setCharges] = useState<OpenChargeRow[] | null>(null);
  const [loadingCharges, setLoadingCharges] = useState(false);
  const [pending, startTransition] = useTransition();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [linkByCharge, setLinkByCharge] = useState<Record<string, string>>({});
  const [copiedId, setCopiedId] = useState<string | null>(null);
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

  function pickPatient(p: PatientSearchResult) {
    setPatient(p);
    setQ("");
    setResults([]);
    setError(null);
    setLinkByCharge({});
    setLoadingCharges(true);
    getPatientOpenChargesAction(p.id)
      .then(setCharges)
      .catch((e: any) => setError(e.message || "Couldn't load this patient's balance."))
      .finally(() => setLoadingCharges(false));
  }

  function changePatient() {
    setPatient(null);
    setCharges(null);
    setError(null);
    setLinkByCharge({});
  }

  function sendLink(chargeId: string) {
    if (!patient) return;
    setError(null);
    setBusyId(chargeId);
    startTransition(async () => {
      try {
        const url = await startPatientChargeOnlinePaymentAction(chargeId, patient.id);
        setLinkByCharge((prev) => ({ ...prev, [chargeId]: url }));
        window.open(url, "_blank", "noopener,noreferrer");
      } catch (e: any) {
        setError(e.message || "Couldn't start an online payment for this charge.");
      } finally {
        setBusyId(null);
      }
    });
  }

  function copyLink(chargeId: string, url: string) {
    navigator.clipboard?.writeText(url).then(() => {
      setCopiedId(chargeId);
      setTimeout(() => setCopiedId((id) => (id === chargeId ? null : id)), 1800);
    });
  }

  if (!acceptOnline) {
    return (
      <div style={{ background: "var(--card-bg)", border: "1px solid var(--card-border)", borderRadius: 12, padding: 24 }}>
        <h2 style={{ fontSize: 15, marginTop: 0, marginBottom: 8 }}>Collect a Payment</h2>
        <p style={{ fontSize: 13, color: "#888", margin: 0 }}>
          Online Payments is currently off. Turn it on under Settings → Payments to send patients PayMongo payment
          links from here.
        </p>
      </div>
    );
  }

  return (
    <div style={{ background: "var(--card-bg)", border: "1px solid var(--card-border)", borderRadius: 12, padding: 24 }}>
      <h2 style={{ fontSize: 15, marginTop: 0, marginBottom: 4 }}>Collect a Payment</h2>
      <p style={{ fontSize: 12.5, color: "#888", marginTop: 0, marginBottom: 14 }}>
        Find a patient, pick one of their open charges, and send them a PayMongo payment link.
      </p>

      {!patient ? (
        <div>
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="e.g. Maria Santos, AC-1048, 08/23/1985…"
            style={FIELD_STYLE}
          />
          {searching && <p style={{ fontSize: 12, color: "#999", marginTop: 10 }}>Searching…</p>}
          {results.length > 0 && (
            <div style={{ marginTop: 10, display: "grid", gap: 6 }}>
              {results.map((p) => (
                <button
                  key={p.id}
                  onClick={() => pickPatient(p)}
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
        </div>
      ) : (
        <div>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              background: "#f7f7f9",
              border: "1px solid #eee",
              borderRadius: 10,
              padding: "10px 14px",
              marginBottom: 14,
            }}
          >
            <div style={{ fontSize: 13.5, fontWeight: 700 }}>
              {patient.last_name}, {patient.first_name}
              <span style={{ color: "#888", fontWeight: 400, marginLeft: 8, fontSize: 12 }}>
                {patient.sex} · {age(patient.date_of_birth)}y · {patient.patient_code ?? "—"}
              </span>
            </div>
            <button onClick={changePatient} style={{ background: "none", border: "none", color: "#2563eb", cursor: "pointer", fontSize: 12.5 }}>
              Change patient
            </button>
          </div>

          {loadingCharges ? (
            <p style={{ fontSize: 13, color: "#888" }}>Loading balance…</p>
          ) : !charges || charges.length === 0 ? (
            <p style={{ fontSize: 13, color: "#888", margin: 0 }}>No open charges for this patient — nothing to collect right now.</p>
          ) : (
            <div style={{ display: "grid", gap: 8 }}>
              {charges.map((c) => (
                <div
                  key={c.id}
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    gap: 10,
                    border: "1px solid #eee",
                    borderRadius: 8,
                    padding: "10px 12px",
                  }}
                >
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{c.description}</div>
                    <div style={{ fontSize: 12, color: "#888" }}>{peso(c.remainingPhp)}{c.remainingPhp !== c.amountPhp ? ` of ${peso(c.amountPhp)}` : ""}</div>
                  </div>
                  <div style={{ display: "flex", gap: 6, flexShrink: 0, alignItems: "center" }}>
                    {linkByCharge[c.id] && (
                      <button
                        onClick={() => copyLink(c.id, linkByCharge[c.id])}
                        style={{ background: "none", border: "1px solid #ddd", borderRadius: 6, padding: "6px 10px", cursor: "pointer", fontSize: 11.5, color: "#555" }}
                      >
                        {copiedId === c.id ? "Copied!" : "Copy link"}
                      </button>
                    )}
                    <button
                      onClick={() => sendLink(c.id)}
                      disabled={pending && busyId === c.id}
                      style={{ background: "#0c1730", color: "#e6c66b", border: "none", borderRadius: 6, padding: "7px 12px", cursor: "pointer", fontSize: 11.5, fontWeight: 600 }}
                    >
                      {pending && busyId === c.id ? "Opening…" : linkByCharge[c.id] ? "Send Again" : "Send Payment Link"}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {error && <p style={{ color: "#a12a2a", fontSize: 12.5, marginTop: 12, marginBottom: 0 }}>{error}</p>}
    </div>
  );
}
