"use client";

import { useState, useTransition } from "react";
import { inviteStaffAction, resendStaffInviteAction } from "@/app/admin/actions";

type StaffMember = { id: string; full_name: string | null; role: string; is_active: boolean; created_at: string };

const ROLES = [
  { value: "clinic_admin", label: "Clinic admin" },
  { value: "doctor", label: "Doctor" },
  { value: "staff", label: "Staff" },
] as const;

export function StaffPanel({ tenantId, staff }: { tenantId: string; staff: StaffMember[] }) {
  const [showForm, setShowForm] = useState(staff.length === 0);
  const [email, setEmail] = useState("");
  const [fullName, setFullName] = useState("");
  const [role, setRole] = useState<(typeof ROLES)[number]["value"]>("clinic_admin");
  const [pending, startTransition] = useTransition();
  const [resendingId, setResendingId] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  function resend(staffId: string) {
    setResendingId(staffId);
    startTransition(async () => {
      try {
        await resendStaffInviteAction(staffId, tenantId);
        setMessage("A fresh invite link was sent — the old one no longer works, only the new email will.");
      } catch (e: any) {
        setMessage(`Error: ${e.message}`);
      } finally {
        setResendingId(null);
      }
    });
  }

  function invite() {
    if (!email.trim() || !fullName.trim()) {
      setMessage("Error: name and email are required.");
      return;
    }
    startTransition(async () => {
      try {
        await inviteStaffAction({ tenantId, email: email.trim(), fullName: fullName.trim(), role });
        setEmail("");
        setFullName("");
        setMessage(`Invite sent to ${email.trim()}. They'll get an email with a link to set their password.`);
        setShowForm(false);
      } catch (e: any) {
        setMessage(`Error: ${e.message}`);
      }
    });
  }

  return (
    <div style={{ background: "white", border: "1px solid #e2e2e5", borderRadius: 12, padding: 20 }}>
      <h3 style={{ fontSize: 15, marginTop: 0, marginBottom: 14 }}>Staff accounts (portal access)</h3>

      {staff.length > 0 ? (
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12, marginBottom: 14 }}>
          <thead>
            <tr style={{ textAlign: "left", color: "#888" }}>
              <th style={{ padding: "4px 8px" }}>Name</th>
              <th style={{ padding: "4px 8px" }}>Role</th>
              <th style={{ padding: "4px 8px" }}>Invited</th>
              <th style={{ padding: "4px 8px" }}></th>
            </tr>
          </thead>
          <tbody>
            {staff.map((s) => (
              <tr key={s.id} style={{ borderTop: "1px solid #eee" }}>
                <td style={{ padding: "6px 8px" }}>{s.full_name || "—"}</td>
                <td style={{ padding: "6px 8px" }}>{s.role}</td>
                <td style={{ padding: "6px 8px" }}>{new Date(s.created_at).toLocaleDateString()}</td>
                <td style={{ padding: "6px 8px" }}>
                  <button
                    onClick={() => resend(s.id)}
                    disabled={pending && resendingId === s.id}
                    style={{ background: "none", border: "none", color: "#2563eb", fontSize: 12, cursor: "pointer", padding: 0 }}
                  >
                    {pending && resendingId === s.id ? "Sending..." : "Resend invite"}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <p style={{ fontSize: 12, color: "#888", marginBottom: 14 }}>
          No one at this clinic has portal access yet — invite the first person below.
        </p>
      )}

      {showForm ? (
        <div style={{ display: "grid", gap: 8 }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}>
            <input placeholder="Full name" value={fullName} onChange={(e) => setFullName(e.target.value)} style={selectStyle} />
            <input type="email" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} style={selectStyle} />
            <select value={role} onChange={(e) => setRole(e.target.value as any)} style={selectStyle}>
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
      {message && (
        <div style={{ fontSize: 12, color: message.startsWith("Error") ? "crimson" : "#1a7f37", marginTop: 8 }}>{message}</div>
      )}
    </div>
  );
}

const selectStyle: React.CSSProperties = { padding: "8px 10px", borderRadius: 8, border: "1px solid #ccc", fontSize: 13 };
const buttonStyle: React.CSSProperties = {
  padding: "8px 14px",
  borderRadius: 8,
  border: "none",
  background: "#2563eb",
  color: "white",
  fontWeight: 600,
  fontSize: 13,
  cursor: "pointer",
};
