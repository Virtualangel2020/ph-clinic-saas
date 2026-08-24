"use client";

import { useState, useTransition } from "react";
import { reviewSignatureAction, reviewCredentialChangeAction } from "../actions";

type PendingSignature = { id: string; user_id: string; signature_path: string; requested_at: string; user_profiles: { full_name: string | null } | null };
type PendingCredential = { id: string; user_id: string; field_key: string; old_value: string | null; new_value: string; requested_at: string; user_profiles: { full_name: string | null } | null };

export function ApprovalQueue({
  pendingSignatures,
  pendingCredentials,
  signedUrlsByPath,
}: {
  pendingSignatures: PendingSignature[];
  pendingCredentials: PendingCredential[];
  signedUrlsByPath: Record<string, string>;
}) {
  const [pending, startTransition] = useTransition();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  function reviewSig(id: string, approve: boolean) {
    setBusyId(id);
    startTransition(async () => {
      try {
        await reviewSignatureAction(id, approve, approve ? "" : "Rejected by Clinic Admin");
        setMessage(approve ? "Signature approved." : "Signature rejected.");
      } catch (e: any) {
        setMessage(`Error: ${e.message}`);
      } finally {
        setBusyId(null);
      }
    });
  }

  function reviewCred(id: string, approve: boolean) {
    setBusyId(id);
    startTransition(async () => {
      try {
        await reviewCredentialChangeAction(id, approve, approve ? "" : "Rejected by Clinic Admin");
        setMessage(approve ? "Change approved." : "Change rejected.");
      } catch (e: any) {
        setMessage(`Error: ${e.message}`);
      } finally {
        setBusyId(null);
      }
    });
  }

  if (pendingSignatures.length === 0 && pendingCredentials.length === 0) {
    return (
      <div style={{ background: "var(--card-bg)", border: "1px solid var(--card-border)", borderRadius: 12, padding: 24 }}>
        <h2 style={{ fontSize: 15, marginTop: 0, marginBottom: 4 }}>Pending approvals</h2>
        <p style={{ fontSize: 13, color: "#888", margin: 0 }}>Nothing waiting on you right now.</p>
      </div>
    );
  }

  return (
    <div style={{ background: "var(--card-bg)", border: "1px solid var(--card-border)", borderRadius: 12, padding: 24 }}>
      <h2 style={{ fontSize: 15, marginTop: 0, marginBottom: 14 }}>Pending approvals</h2>

      {pendingSignatures.map((s) => (
        <div key={s.id} style={{ display: "flex", alignItems: "center", gap: 14, padding: "10px 0", borderBottom: "1px solid #f2f2f2" }}>
          <div style={{ width: 100, height: 44, border: "1px solid #eee", borderRadius: 6, display: "flex", alignItems: "center", justifyContent: "center", background: "#fafafa" }}>
            {signedUrlsByPath[s.signature_path] ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={signedUrlsByPath[s.signature_path]} alt="Proposed signature" style={{ maxWidth: "100%", maxHeight: "100%" }} />
            ) : (
              <span style={{ fontSize: 10, color: "#bbb" }}>—</span>
            )}
          </div>
          <div style={{ flex: 1, fontSize: 13 }}>
            <strong>{s.user_profiles?.full_name ?? "Unknown"}</strong> — new signature
            <div style={{ fontSize: 11, color: "#999" }}>Requested {new Date(s.requested_at).toLocaleDateString()}</div>
          </div>
          <button onClick={() => reviewSig(s.id, true)} disabled={pending && busyId === s.id} style={approveBtn}>Approve</button>
          <button onClick={() => reviewSig(s.id, false)} disabled={pending && busyId === s.id} style={rejectBtn}>Reject</button>
        </div>
      ))}

      {pendingCredentials.map((c) => (
        <div key={c.id} style={{ display: "flex", alignItems: "center", gap: 14, padding: "10px 0", borderBottom: "1px solid #f2f2f2" }}>
          <div style={{ flex: 1, fontSize: 13 }}>
            <strong>{c.user_profiles?.full_name ?? "Unknown"}</strong> — {c.field_key.replace(/_/g, " ")}:{" "}
            <span style={{ color: "#999", textDecoration: "line-through" }}>{c.old_value || "(empty)"}</span>{" "}
            → <strong>{c.new_value}</strong>
            <div style={{ fontSize: 11, color: "#999" }}>Requested {new Date(c.requested_at).toLocaleDateString()}</div>
          </div>
          <button onClick={() => reviewCred(c.id, true)} disabled={pending && busyId === c.id} style={approveBtn}>Approve</button>
          <button onClick={() => reviewCred(c.id, false)} disabled={pending && busyId === c.id} style={rejectBtn}>Reject</button>
        </div>
      ))}

      {message && <p style={{ fontSize: 12, color: message.startsWith("Error") ? "crimson" : "#1a7f37", marginTop: 12 }}>{message}</p>}
    </div>
  );
}

const approveBtn: React.CSSProperties = { padding: "6px 12px", borderRadius: 6, border: "none", background: "#1a7f37", color: "white", fontSize: 12, fontWeight: 600, cursor: "pointer" };
const rejectBtn: React.CSSProperties = { padding: "6px 12px", borderRadius: 6, border: "none", background: "#a12a2a", color: "white", fontSize: 12, fontWeight: 600, cursor: "pointer" };
