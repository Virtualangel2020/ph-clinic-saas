"use client";

import { useState, useTransition } from "react";
import { clinicInviteStaffAction } from "../actions";

type StaffMember = { id: string; full_name: string | null; role: string; is_active: boolean; created_at: string };

const ROLES = [
  { value: "clinic_admin", label: "Clinic admin" },
  { value: "doctor", label: "Provider" },
  { value: "reception", label: "Reception / Front desk" },
  { value: "staff", label: "Other staff" },
] as const;

export function StaffInviteForm({ staff }: { staff: StaffMember[] }) {
  const [showForm, setShowForm] = useState(staff.length <= 1);
  const [email, setEmail] = useState("");
  const [fullName, setFullName] = useState("");
  const [role, setRole] = useState<(typeof ROLES)[number]["value"]>("doctor");
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);

  function invite() {
    if (!email.trim() || !fullName.trim()) {
      setMessage("Error: name and email are required.");
      return;
    }
    startTransition(async () => {
      try {
        await clinicInviteStaffAction({ email: email.trim(), fullName: fullName.trim(), role });
        setEmail("");
        setFullName("");
        setMessage(`Invite sent to ${email.trim()}.`);
        setShowForm(false);
      } catch (e: any) {
        setMessage(`Error: ${e.message}`);
      }
    });
  }

  return (
    <div style={{ background: "white", border: "1px solid #e2e2e5", borderRadius: 12, padding: 24 }}>
      <h2 style={{ fontSize: 15, marginTop: 0, marginBottom: 14 }}>Staff</h2>

      {staff.length > 0 && (
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13, marginBottom: 14 }}>
          <thead>
            <tr style={{ textAlign: "left", color: "#888", fontSize: 11 }}>
              <th style={{ padding: "4px 8px" }}>Name</th>
              <th style={{ padding: "4px 8px" }}>Role</th>
              <th style={{ padding: "4px 8px" }}>Joined</th>
            </tr>
          </thead>
          <tbody>
            {staff.map((s) => (
              <tr key={s.id} style={{ borderTop: "1px solid #eee" }}>
                <td style={{ padding: "6px 8px" }}>{s.full_name || "—"}</td>
                <td style={{ padding: "6px 8px", textTransform: "capitalize" }}>{s.role.replace("_", " ")}</td>
                <td style={{ padding: "6px 8px" }}>{new Date(s.created_at).toLocaleDateString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {showForm ? (
        <div style={{ display: "grid", gap: 8 }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}>
            <input placeholder="Full name" value={fullName} onChange={(e) => setFullName(e.target.value)} style={inputStyle} />
            <input type="email" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} style={inputStyle} />
            <select value={role} onChange={(e) => setRole(e.target.value as any)} style={inputStyle}>
              {ROLES.map((r) => (
                <option key={r.value} value={r.value}>{r.label}</option>
              ))}
            </select>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <button onClick={invite} disabled={pending} style={buttonStyle}>
              {pending ? "Sending invite..." : "Send invite"}
            </button>
            {staff.length > 0 && (
              <button onClick={() => setShowForm(false)} style={{ ...buttonStyle, background: "#888" }}>Cancel</button>
            )}
          </div>
        </div>
      ) : (
        <button onClick={() => setShowForm(true)} style={{ ...buttonStyle, background: "white", color: "#2563eb", border: "1px solid #2563eb" }}>
          + Invite staff
        </button>
      )}
      {message && <div style={{ fontSize: 12, color: message.startsWith("Error") ? "crimson" : "#1a7f37", marginTop: 8 }}>{message}</div>}
    </div>
  );
}

const inputStyle: React.CSSProperties = { padding: "8px 10px", borderRadius: 8, border: "1px solid #ccc", fontSize: 13 };
const buttonStyle: React.CSSProperties = { padding: "8px 14px", borderRadius: 8, border: "none", background: "#0c1730", color: "#e6c66b", fontWeight: 700, fontSize: 13, cursor: "pointer" };
