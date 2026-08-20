"use client";

import { useState, useTransition } from "react";
import { submitAppointmentRequestAction } from "./actions";

const inputStyle: React.CSSProperties = { width: "100%", padding: "9px 11px", borderRadius: 8, border: "1px solid #ddd", fontSize: 13.5, boxSizing: "border-box" };
const labelStyle: React.CSSProperties = { fontSize: 12, fontWeight: 600, color: "#333", marginBottom: 4, display: "block" };

export function AppointmentRequestForm({ provider, onClose }: { provider: { id: string; full_name: string }; onClose: () => void }) {
  const [form, setForm] = useState({ patientName: "", patientPhone: "", patientEmail: "", reason: "", preferredDate: "", preferredTime: "" });
  const [pending, startTransition] = useTransition();
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");

  function set<K extends keyof typeof form>(key: K, value: string) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    startTransition(async () => {
      try {
        await submitAppointmentRequestAction({ providerId: provider.id, ...form });
        setSent(true);
      } catch (err: any) {
        setError(err.message || "Something went wrong — please try again.");
      }
    });
  }

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(12,23,48,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 50, padding: 20 }}>
      <div style={{ background: "white", borderRadius: 14, padding: 26, maxWidth: 420, width: "100%", maxHeight: "88vh", overflowY: "auto" }}>
        {sent ? (
          <>
            <h3 style={{ fontSize: 17, margin: "0 0 8px", color: "#0c1730" }}>Request sent</h3>
            <p style={{ color: "#666", fontSize: 13.5, margin: "0 0 18px" }}>
              {provider.full_name}'s clinic will reach out to confirm your appointment — this is a request, not a
              confirmed booking.
            </p>
            <button onClick={onClose} style={{ background: "#0c1730", color: "#e6c66b", fontWeight: 700, fontSize: 13, padding: "9px 18px", borderRadius: 8, border: "none", cursor: "pointer" }}>
              Close
            </button>
          </>
        ) : (
          <form onSubmit={submit}>
            <h3 style={{ fontSize: 17, margin: "0 0 4px", color: "#0c1730" }}>Request an appointment</h3>
            <p style={{ color: "#888", fontSize: 12.5, margin: "0 0 16px" }}>
              with {provider.full_name} — this sends a request to the clinic; it does not book a confirmed slot.
            </p>
            <div style={{ display: "grid", gap: 12 }}>
              <div>
                <label style={labelStyle}>Your name *</label>
                <input required style={inputStyle} value={form.patientName} onChange={(e) => set("patientName", e.target.value)} />
              </div>
              <div>
                <label style={labelStyle}>Phone *</label>
                <input required style={inputStyle} value={form.patientPhone} onChange={(e) => set("patientPhone", e.target.value)} />
              </div>
              <div>
                <label style={labelStyle}>Email</label>
                <input type="email" style={inputStyle} value={form.patientEmail} onChange={(e) => set("patientEmail", e.target.value)} />
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))", gap: 10 }}>
                <div>
                  <label style={labelStyle}>Preferred date</label>
                  <input type="date" style={inputStyle} value={form.preferredDate} onChange={(e) => set("preferredDate", e.target.value)} />
                </div>
                <div>
                  <label style={labelStyle}>Preferred time</label>
                  <input placeholder="e.g. Morning" style={inputStyle} value={form.preferredTime} onChange={(e) => set("preferredTime", e.target.value)} />
                </div>
              </div>
              <div>
                <label style={labelStyle}>Reason for visit</label>
                <textarea style={{ ...inputStyle, minHeight: 60, fontFamily: "inherit" }} value={form.reason} onChange={(e) => set("reason", e.target.value)} />
              </div>
            </div>

            {error && <p style={{ color: "crimson", fontSize: 12.5, margin: "12px 0 0" }}>{error}</p>}

            <div style={{ display: "flex", gap: 10, marginTop: 18 }}>
              <button
                type="submit"
                disabled={pending}
                style={{ flex: 1, background: "#0c1730", color: "#e6c66b", fontWeight: 700, fontSize: 13, padding: "10px 16px", borderRadius: 8, border: "none", cursor: pending ? "default" : "pointer", opacity: pending ? 0.7 : 1 }}
              >
                {pending ? "Sending…" : "Send Request"}
              </button>
              <button type="button" onClick={onClose} style={{ background: "none", color: "#666", fontSize: 13, padding: "10px 16px", borderRadius: 8, border: "1px solid #ddd", cursor: "pointer" }}>
                Cancel
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
