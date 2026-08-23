"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { invitePatientToPortalAction, revokePatientPortalAccessAction } from "../actions";

type Account = {
  id: string;
  channel: "email" | "sms" | "manual";
  contact_value: string;
  status: "invited" | "active" | "revoked";
  invited_at: string | null;
  activated_at: string | null;
  revoked_at: string | null;
};

const CHANNEL_LABEL: Record<string, string> = { email: "EMAIL", sms: "SMS", manual: "IN-PERSON CODE" };

export function PortalSection({
  patientId,
  patientEmail,
  patientMobile,
  channels,
  account,
}: {
  patientId: string;
  patientEmail: string | null;
  patientMobile: string | null;
  channels: { email: boolean; sms: boolean };
  account: Account | null;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [code, setCode] = useState<string | null>(null);

  const hasContact = !!patientEmail || !!patientMobile;

  function invite(channel: "email" | "sms" | "manual") {
    setError(null);
    setNotice(null);
    setCode(null);
    startTransition(async () => {
      try {
        const result = await invitePatientToPortalAction(patientId, channel);
        if (channel === "manual" && result.code) {
          setCode(result.code);
        } else {
          setNotice(channel === "email" ? "Invite email sent." : "Invite SMS sent.");
        }
        router.refresh();
      } catch (e: any) {
        setError(e.message);
      }
    });
  }

  function revoke() {
    if (!account) return;
    if (!window.confirm("Revoke this patient's Patient Portal access?")) return;
    setError(null);
    startTransition(async () => {
      try {
        await revokePatientPortalAccessAction(account.id, patientId);
        router.refresh();
      } catch (e: any) {
        setError(e.message);
      }
    });
  }

  return (
    <div style={{ marginTop: 24 }}>
      <h2 style={{ fontSize: 15, marginBottom: 8 }}>Patient Portal</h2>
      <div style={{ background: "white", border: "1px solid #e2e2e5", borderRadius: 10, padding: 14 }}>
        {!channels.email && !channels.sms && (
          <div style={{ fontSize: 11.5, color: "#8a6100", background: "#fff6e6", border: "1px solid #f0d998", borderRadius: 8, padding: "8px 10px", marginBottom: 10 }}>
            Automatic email/SMS invites need the matching Communications add-on. Portal login itself always works —
            use an in-person code below, no add-on required.
          </div>
        )}

        {!account && (
          <>
            <p style={{ fontSize: 12.5, color: "#666", marginBottom: 10 }}>
              This patient hasn't been invited yet. Portal access lets them log in to authorize record requests and
              view what's been shared.
            </p>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <button
                onClick={() => invite("manual")}
                disabled={pending || !hasContact}
                title={!hasContact ? "This patient needs an email or mobile number on file first" : "Generate a code to read or show to the patient right now"}
                style={{ background: "#0c1730", color: "white", border: "none", borderRadius: 8, padding: "8px 14px", fontSize: 12.5, fontWeight: 600, cursor: hasContact ? "pointer" : "not-allowed", opacity: hasContact ? 1 : 0.5 }}
              >
                Generate in-person code
              </button>
              {channels.email && (
                <button
                  onClick={() => invite("email")}
                  disabled={pending || !patientEmail}
                  title={!patientEmail ? "This patient has no email on file" : undefined}
                  style={{ background: "#f0f4ff", color: "#0c1730", border: "1px solid #c7d4f5", borderRadius: 8, padding: "8px 14px", fontSize: 12.5, fontWeight: 600, cursor: patientEmail ? "pointer" : "not-allowed", opacity: patientEmail ? 1 : 0.5 }}
                >
                  Send email invite
                </button>
              )}
              {channels.sms && (
                <button
                  onClick={() => invite("sms")}
                  disabled={pending || !patientMobile}
                  title={!patientMobile ? "This patient has no mobile number on file" : undefined}
                  style={{ background: "#f0f4ff", color: "#0c1730", border: "1px solid #c7d4f5", borderRadius: 8, padding: "8px 14px", fontSize: 12.5, fontWeight: 600, cursor: patientMobile ? "pointer" : "not-allowed", opacity: patientMobile ? 1 : 0.5 }}
                >
                  Send SMS invite
                </button>
              )}
            </div>
          </>
        )}

        {account && account.status === "invited" && (
          <>
            <p style={{ fontSize: 12.5, color: "#8a6100", marginBottom: 10 }}>
              Invite created via {CHANNEL_LABEL[account.channel]}
              {account.channel !== "manual" ? ` to ${account.contact_value}` : ""}
              {account.invited_at ? ` on ${new Date(account.invited_at).toLocaleString()}` : ""} — awaiting activation.
            </p>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <button onClick={() => invite("manual")} disabled={pending} style={{ background: "#0c1730", color: "white", border: "none", borderRadius: 8, padding: "8px 14px", fontSize: 12.5, fontWeight: 600, cursor: "pointer" }}>
                Generate new in-person code
              </button>
              {account.channel !== "manual" && (
                <button onClick={() => invite(account.channel)} disabled={pending} style={{ background: "#f0f4ff", color: "#0c1730", border: "1px solid #c7d4f5", borderRadius: 8, padding: "8px 14px", fontSize: 12.5, fontWeight: 600, cursor: "pointer" }}>
                  Resend {account.channel}
                </button>
              )}
            </div>
          </>
        )}

        {account && account.status === "active" && (
          <>
            <p style={{ fontSize: 12.5, color: "#1a7f37", marginBottom: 10 }}>
              Active — logged in via {account.contact_value.includes("@") ? "email" : "mobile"} ({account.contact_value})
              {account.activated_at ? ` since ${new Date(account.activated_at).toLocaleDateString()}` : ""}.
            </p>
            <button onClick={revoke} disabled={pending} style={{ background: "#fdecec", color: "#a12a2a", border: "1px solid #f3c2c2", borderRadius: 8, padding: "8px 14px", fontSize: 12.5, fontWeight: 600, cursor: "pointer" }}>
              Revoke access
            </button>
          </>
        )}

        {account && account.status === "revoked" && (
          <>
            <p style={{ fontSize: 12.5, color: "#a12a2a", marginBottom: 10 }}>
              Access revoked{account.revoked_at ? ` on ${new Date(account.revoked_at).toLocaleDateString()}` : ""}.
            </p>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <button onClick={() => invite("manual")} disabled={pending || !hasContact} style={{ background: "#0c1730", color: "white", border: "none", borderRadius: 8, padding: "8px 14px", fontSize: 12.5, fontWeight: 600, cursor: "pointer" }}>
                Re-invite with in-person code
              </button>
            </div>
          </>
        )}

        {code && (
          <div style={{ marginTop: 12, background: "#f0f4ff", border: "1px solid #c7d4f5", borderRadius: 8, padding: "12px 14px" }}>
            <div style={{ fontSize: 11, color: "#666", marginBottom: 4 }}>Read or show this to the patient — expires in 24 hours:</div>
            <div style={{ fontSize: 22, fontWeight: 800, letterSpacing: 3, color: "#0c1730", fontFamily: "monospace" }}>{code}</div>
            <div style={{ fontSize: 11, color: "#666", marginTop: 6 }}>
              They enter it at <strong>{typeof window !== "undefined" ? window.location.origin : ""}/portal/activate</strong> to set their own password.
            </div>
          </div>
        )}

        {notice && <div style={{ fontSize: 12, color: "#1a7f37", marginTop: 8 }}>{notice}</div>}
        {error && <div style={{ fontSize: 12, color: "crimson", marginTop: 8 }}>{error}</div>}
      </div>
    </div>
  );
}
