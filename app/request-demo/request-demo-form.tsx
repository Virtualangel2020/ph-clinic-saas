"use client";

import { useState, useTransition } from "react";
import { submitDemoRequestAction } from "./actions";

const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: "10px 12px",
  borderRadius: 8,
  border: "1px solid #ddd",
  fontSize: 14,
  boxSizing: "border-box",
};
const labelStyle: React.CSSProperties = { fontSize: 12.5, fontWeight: 600, color: "#333", marginBottom: 5, display: "block" };

export function RequestDemoForm() {
  const [form, setForm] = useState({
    fullName: "",
    clinicName: "",
    email: "",
    phone: "",
    location: "",
    specialty: "",
    providerCount: "",
    currentSystem: "",
    helpWith: "",
    message: "",
  });
  const [pending, startTransition] = useTransition();
  const [status, setStatus] = useState<"idle" | "sent" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState("");

  function set<K extends keyof typeof form>(key: K, value: string) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    startTransition(async () => {
      try {
        await submitDemoRequestAction(form);
        setStatus("sent");
      } catch (err: any) {
        setErrorMsg(err.message || "Something went wrong — please try again.");
        setStatus("error");
      }
    });
  }

  if (status === "sent") {
    return (
      <div style={{ background: "white", border: "1px solid #e2e2e5", borderRadius: 14, padding: 36, textAlign: "center" }}>
        <h2 style={{ fontSize: 20, marginTop: 0, marginBottom: 8, color: "#0c1730" }}>Thanks — we've got it!</h2>
        <p style={{ color: "#666", fontSize: 14, margin: 0 }}>
          Someone from Virtual Angel Systems will reach out to {form.email} shortly to schedule your demo.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={submit} style={{ background: "white", border: "1px solid #e2e2e5", borderRadius: 14, padding: 28, display: "grid", gap: 14 }}>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
        <div>
          <label style={labelStyle}>Your name *</label>
          <input style={inputStyle} required value={form.fullName} onChange={(e) => set("fullName", e.target.value)} />
        </div>
        <div>
          <label style={labelStyle}>Clinic name *</label>
          <input style={inputStyle} required value={form.clinicName} onChange={(e) => set("clinicName", e.target.value)} />
        </div>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
        <div>
          <label style={labelStyle}>Email *</label>
          <input style={inputStyle} required type="email" value={form.email} onChange={(e) => set("email", e.target.value)} />
        </div>
        <div>
          <label style={labelStyle}>Phone</label>
          <input style={inputStyle} value={form.phone} onChange={(e) => set("phone", e.target.value)} />
        </div>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
        <div>
          <label style={labelStyle}>City / location</label>
          <input style={inputStyle} value={form.location} onChange={(e) => set("location", e.target.value)} />
        </div>
        <div>
          <label style={labelStyle}>Specialty</label>
          <input style={inputStyle} value={form.specialty} onChange={(e) => set("specialty", e.target.value)} />
        </div>
      </div>
      <div>
        <label style={labelStyle}>How many providers at your clinic?</label>
        <select style={inputStyle} value={form.providerCount} onChange={(e) => set("providerCount", e.target.value)}>
          <option value="">Select…</option>
          <option value="1">Just me</option>
          <option value="2-3">2–3</option>
          <option value="4-9">4–9</option>
          <option value="10+">10+</option>
        </select>
      </div>
      <div>
        <label style={labelStyle}>What system do you currently use, if any?</label>
        <input style={inputStyle} value={form.currentSystem} onChange={(e) => set("currentSystem", e.target.value)} />
      </div>
      <div>
        <label style={labelStyle}>What would you like help with?</label>
        <textarea style={{ ...inputStyle, minHeight: 70, fontFamily: "inherit" }} value={form.helpWith} onChange={(e) => set("helpWith", e.target.value)} />
      </div>
      <div>
        <label style={labelStyle}>Anything else we should know?</label>
        <textarea style={{ ...inputStyle, minHeight: 60, fontFamily: "inherit" }} value={form.message} onChange={(e) => set("message", e.target.value)} />
      </div>

      {status === "error" && <p style={{ color: "crimson", fontSize: 13, margin: 0 }}>{errorMsg}</p>}

      <button
        type="submit"
        disabled={pending}
        style={{
          background: "#0c1730",
          color: "#e6c66b",
          fontWeight: 700,
          fontSize: 14,
          padding: "12px 20px",
          borderRadius: 8,
          border: "none",
          cursor: pending ? "default" : "pointer",
          opacity: pending ? 0.7 : 1,
        }}
      >
        {pending ? "Sending…" : "Request My Demo →"}
      </button>
    </form>
  );
}
