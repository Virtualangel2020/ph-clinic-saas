"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { searchPatientsAction, type PatientSearchResult } from "../patients/actions";
import { getPatientContactAction, sendPatientCommunicationAction } from "./actions";

// "Compose a Message" — find a patient, pick Email or SMS, write it, send
// it. Sending reuses sendPatientCommunicationAction, which itself reuses
// the same sendPortalEmail/sendPortalSms Patient Portal invites already
// use — this widget doesn't add a new send path, just a faster way to
// reach the existing one for an ad-hoc message (reminder, follow-up nudge,
// etc.) without opening the full chart.

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
  fontFamily: "inherit",
};

type Channel = "email" | "sms";

export function ComposeWidget({ emailConfigured, smsConfigured }: { emailConfigured: boolean; smsConfigured: boolean }) {
  const [patient, setPatient] = useState<PatientSearchResult | null>(null);
  const [q, setQ] = useState("");
  const [results, setResults] = useState<PatientSearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [channel, setChannel] = useState<Channel>("email");
  const [toAddress, setToAddress] = useState("");
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

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
    setSent(false);
    getPatientContactAction(p.id)
      .then(({ email, mobilePhone }) => {
        setToAddress((channel === "email" ? email : mobilePhone) ?? "");
      })
      .catch(() => {});
  }

  function changePatient() {
    setPatient(null);
    setToAddress("");
    setSubject("");
    setMessage("");
    setError(null);
    setSent(false);
  }

  function switchChannel(next: Channel) {
    setChannel(next);
    setSent(false);
    if (patient) {
      getPatientContactAction(patient.id)
        .then(({ email, mobilePhone }) => setToAddress((next === "email" ? email : mobilePhone) ?? ""))
        .catch(() => {});
    }
  }

  function send() {
    if (!patient) return;
    setError(null);
    startTransition(async () => {
      try {
        await sendPatientCommunicationAction(patient.id, channel, toAddress, subject, message);
        setSent(true);
        setMessage("");
      } catch (e: any) {
        setError(e.message || "Couldn't send this message.");
      }
    });
  }

  const channelReady = channel === "email" ? emailConfigured : smsConfigured;

  return (
    <div style={{ background: "var(--card-bg)", border: "1px solid var(--card-border)", borderRadius: 12, padding: 24 }}>
      <h2 style={{ fontSize: 15, marginTop: 0, marginBottom: 4 }}>Compose a Message</h2>
      <p style={{ fontSize: 12.5, color: "#888", marginTop: 0, marginBottom: 14 }}>
        Find a patient and send them a one-off email or SMS — a reminder, a follow-up nudge, anything that doesn't need
        the full Patient Portal thread.
      </p>

      <div style={{ display: "flex", gap: 6, marginBottom: 14 }}>
        {(["email", "sms"] as Channel[]).map((c) => (
          <button
            key={c}
            onClick={() => switchChannel(c)}
            style={{
              padding: "6px 14px",
              fontSize: 12.5,
              fontWeight: 700,
              borderRadius: 999,
              border: `1px solid ${channel === c ? "#0c1730" : "#ddd"}`,
              background: channel === c ? "#0c1730" : "transparent",
              color: channel === c ? "#e6c66b" : "#666",
              cursor: "pointer",
            }}
          >
            {c === "email" ? "Email" : "SMS"}
          </button>
        ))}
      </div>

      {!channelReady && (
        <div style={{ background: "#f2f2f2", border: "1px solid #ddd", borderRadius: 8, padding: "10px 12px", fontSize: 12.5, color: "#666", marginBottom: 14 }}>
          {channel === "email" ? "Email" : "SMS"} sending isn&apos;t turned on at the platform level yet — you can still
          fill this out, but Send will report an error until Resend/Semaphore is configured in Admin → Settings.
        </div>
      )}

      {!patient ? (
        <div>
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="e.g. Maria Santos, AC-1048, 08/23/1985…" style={FIELD_STYLE} />
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

          <div style={{ display: "grid", gap: 10 }}>
            <div>
              <div style={{ fontSize: 11, fontWeight: 600, color: "#666", marginBottom: 4 }}>{channel === "email" ? "To (email)" : "To (mobile number)"}</div>
              <input
                value={toAddress}
                onChange={(e) => setToAddress(e.target.value)}
                placeholder={channel === "email" ? "patient@email.com" : "0917 000 0000"}
                style={FIELD_STYLE}
              />
            </div>
            {channel === "email" && (
              <div>
                <div style={{ fontSize: 11, fontWeight: 600, color: "#666", marginBottom: 4 }}>Subject</div>
                <input value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="Message from your clinic" style={FIELD_STYLE} />
              </div>
            )}
            <div>
              <div style={{ fontSize: 11, fontWeight: 600, color: "#666", marginBottom: 4 }}>Message</div>
              <textarea
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                rows={4}
                placeholder={channel === "email" ? "Write your message…" : "Write your SMS (keep it short)…"}
                style={{ ...FIELD_STYLE, resize: "vertical" }}
              />
            </div>
            <div style={{ display: "flex", justifyContent: "flex-end", alignItems: "center", gap: 10 }}>
              {sent && <span style={{ fontSize: 12, color: "#1a7f37", fontWeight: 600 }}>Sent!</span>}
              <button
                onClick={send}
                disabled={pending || !toAddress.trim() || !message.trim()}
                style={{
                  background: "#0c1730",
                  color: "#e6c66b",
                  border: "none",
                  borderRadius: 8,
                  padding: "9px 18px",
                  cursor: pending ? "default" : "pointer",
                  fontSize: 12.5,
                  fontWeight: 700,
                  opacity: pending || !toAddress.trim() || !message.trim() ? 0.6 : 1,
                }}
              >
                {pending ? "Sending…" : `Send ${channel === "email" ? "Email" : "SMS"}`}
              </button>
            </div>
          </div>
        </div>
      )}

      {error && <p style={{ color: "#a12a2a", fontSize: 12.5, marginTop: 12, marginBottom: 0 }}>{error}</p>}
    </div>
  );
}
