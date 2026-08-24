"use client";

import { useState, useTransition } from "react";
import { saveClinicSecurityAction } from "./actions";

type Settings = {
  mfa_required_roles: string[] | null;
  password_min_length: number | null;
  session_timeout_minutes: number | null;
} | null;

// Only clinic-facing roles are offered here — platform_admin isn't a
// clinic role and has nothing to do with a given clinic's MFA policy.
const CLINIC_ROLES: { value: string; label: string }[] = [
  { value: "clinic_admin", label: "Clinic Admin" },
  { value: "doctor", label: "Doctor" },
  { value: "staff", label: "Staff" },
  { value: "reception", label: "Reception" },
];

const DEFAULT_TIMEOUT_MINUTES = 30;

export function SecurityForm({ settings }: { settings: Settings }) {
  const [mfaRoles, setMfaRoles] = useState<string[]>(settings?.mfa_required_roles ?? []);
  const [passwordMinLength, setPasswordMinLength] = useState(String(settings?.password_min_length ?? 12));
  const [timeoutEnabled, setTimeoutEnabled] = useState(settings?.session_timeout_minutes != null);
  const [sessionTimeout, setSessionTimeout] = useState(
    String(settings?.session_timeout_minutes ?? DEFAULT_TIMEOUT_MINUTES)
  );
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);

  function toggleRole(role: string) {
    setMfaRoles((prev) => (prev.includes(role) ? prev.filter((r) => r !== role) : [...prev, role]));
  }

  function save() {
    setMessage(null);

    const parsedLength = Number(passwordMinLength);
    if (!Number.isFinite(parsedLength) || parsedLength < 8 || parsedLength > 64) {
      setMessage("Error: Password minimum length must be between 8 and 64.");
      return;
    }

    let parsedTimeout: number | null = null;
    if (timeoutEnabled) {
      parsedTimeout = Number(sessionTimeout);
      if (!Number.isFinite(parsedTimeout) || parsedTimeout < 5 || parsedTimeout > 1440) {
        setMessage("Error: Session timeout must be between 5 and 1440 minutes.");
        return;
      }
    }

    startTransition(async () => {
      try {
        await saveClinicSecurityAction(mfaRoles, parsedLength, parsedTimeout);
        setMessage("Saved.");
      } catch (e: any) {
        setMessage(`Error: ${e.message}`);
      }
    });
  }

  return (
    <div style={{ background: "var(--card-bg)", border: "1px solid var(--card-border)", borderRadius: 12, padding: 24, display: "grid", gap: 18 }}>
      <div>
        <div style={label}>Password minimum length</div>
        <input
          type="number"
          min={8}
          max={64}
          value={passwordMinLength}
          onChange={(e) => setPasswordMinLength(e.target.value)}
          style={{ ...inputStyle, maxWidth: 140 }}
        />
        <p style={hint}>Between 8 and 64 characters. Applies the next time a password is set or changed.</p>
      </div>

      <div>
        <div style={label}>Session timeout</div>
        <div style={{ display: "grid", gap: 8 }}>
          <label style={radioRow}>
            <input type="radio" checked={!timeoutEnabled} onChange={() => setTimeoutEnabled(false)} />
            <span style={{ fontSize: 13 }}>No forced timeout</span>
          </label>
          <label style={radioRow}>
            <input type="radio" checked={timeoutEnabled} onChange={() => setTimeoutEnabled(true)} />
            <span style={{ fontSize: 13 }}>Sign out after inactivity of</span>
            <input
              type="number"
              min={5}
              max={1440}
              value={sessionTimeout}
              onChange={(e) => setSessionTimeout(e.target.value)}
              onFocus={() => setTimeoutEnabled(true)}
              disabled={!timeoutEnabled}
              style={{ ...inputStyle, width: 90, padding: "6px 8px" }}
            />
            <span style={{ fontSize: 13, color: "#555" }}>minutes</span>
          </label>
        </div>
        <p style={hint}>Between 5 and 1440 minutes (24 hours). This is a policy setting for sessions going forward — it doesn't sign out anyone already logged in.</p>
      </div>

      <div>
        <div style={label}>Roles that require MFA</div>
        <div style={{ display: "grid", gap: 8 }}>
          {CLINIC_ROLES.map((role) => (
            <label key={role.value} style={radioRow}>
              <input type="checkbox" checked={mfaRoles.includes(role.value)} onChange={() => toggleRole(role.value)} />
              <span style={{ fontSize: 13 }}>{role.label}</span>
            </label>
          ))}
        </div>
        <p style={hint}>Anyone in a checked role will be required to set up MFA. This applies going forward, not retroactively to an active session.</p>
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 12, marginTop: 4 }}>
        <button onClick={save} disabled={pending} style={buttonStyle}>
          {pending ? "Saving..." : "Save"}
        </button>
        {message && <span style={{ fontSize: 12, color: message.startsWith("Error") ? "crimson" : "#1a7f37" }}>{message}</span>}
      </div>
    </div>
  );
}

const label: React.CSSProperties = { fontSize: 12, fontWeight: 600, color: "#555", marginBottom: 6 };
const hint: React.CSSProperties = { fontSize: 11, color: "#999", margin: "6px 0 0" };
const inputStyle: React.CSSProperties = { width: "100%", boxSizing: "border-box", padding: "9px 10px", borderRadius: 6, border: "1px solid var(--input-border)", fontSize: 13 };
const buttonStyle: React.CSSProperties = { padding: "9px 18px", borderRadius: 8, border: "none", background: "#0c1730", color: "#e6c66b", fontWeight: 700, fontSize: 13, cursor: "pointer" };
const radioRow: React.CSSProperties = { display: "flex", alignItems: "center", gap: 8 };
