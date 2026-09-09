"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { BrandHeader } from "@/components/brand-header";
import { PasswordInput } from "@/components/password-input";
import { activateByTokenAction, requestPortalInviteResendAction } from "../actions";

// Handles both an emailed activation link (?token=... in the URL, already
// filled in) and a staff-relayed in-person code (patient types it in
// themselves) — same lookup either way, see migration
// patient_portal_manual_channel.
function ActivateForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [code, setCode] = useState(searchParams.get("token") ?? "");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const [showResend, setShowResend] = useState(false);
  const [resendEmail, setResendEmail] = useState("");
  const [resendLoading, setResendLoading] = useState(false);
  const [resendMessage, setResendMessage] = useState<string | null>(null);

  async function handleResend(e: React.FormEvent) {
    e.preventDefault();
    setResendLoading(true);
    setResendMessage(null);
    const result = await requestPortalInviteResendAction({ contact: resendEmail });
    setResendMessage(result.message);
    setResendLoading(false);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (password.length < 8) return setError("Password must be at least 8 characters.");
    if (password !== confirm) return setError("Passwords don't match.");
    setLoading(true);
    try {
      const result = await activateByTokenAction(code.trim(), password);
      if (result?.error) {
        setError(result.error);
        setLoading(false);
        return;
      }
      router.push("/portal");
      router.refresh();
    } catch (e: any) {
      setError(e.message ?? "Something went wrong. Please try again.");
      setLoading(false);
    }
  }

  return (
    <main style={{ maxWidth: 380, margin: "80px auto", padding: 24 }}>
      <div style={{ marginBottom: 24 }}>
        <BrandHeader />
      </div>
      <h1 style={{ fontSize: 22 }}>Activate your Patient Portal</h1>
      <p style={{ color: "#666", fontSize: 13, marginTop: 6 }}>
        Enter the code your clinic gave you (or the one from your activation email), then set a password.
      </p>
      <form onSubmit={handleSubmit} style={{ display: "grid", gap: 12, marginTop: 16 }}>
        <input
          placeholder="Activation code"
          value={code}
          onChange={(e) => setCode(e.target.value)}
          required
          style={{ padding: 10, borderRadius: 8, border: "1px solid #ccc", fontFamily: "monospace", letterSpacing: 1 }}
        />
        <PasswordInput
          placeholder="Choose a password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          style={{ padding: 10, borderRadius: 8, border: "1px solid #ccc" }}
        />
        <PasswordInput
          placeholder="Confirm password"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          required
          style={{ padding: 10, borderRadius: 8, border: "1px solid #ccc" }}
        />
        {error && <p style={{ color: "crimson", fontSize: 13 }}>{error}</p>}
        <button
          type="submit"
          disabled={loading}
          style={{ padding: 10, borderRadius: 8, border: "none", background: "var(--brand-primary)", color: "white", fontWeight: 600, cursor: "pointer" }}
        >
          {loading ? "Activating…" : "Activate account"}
        </button>
      </form>

      <div style={{ marginTop: 18, textAlign: "center" }}>
        {!showResend ? (
          <button
            type="button"
            onClick={() => setShowResend(true)}
            style={{ background: "none", border: "none", color: "#888", fontSize: 12.5, textDecoration: "underline", cursor: "pointer", padding: 0 }}
          >
            Didn't get an email, or has your code expired? Send a new one
          </button>
        ) : (
          <form onSubmit={handleResend} style={{ marginTop: 4, textAlign: "left", background: "#f7f9fb", border: "1px solid #dde6ee", borderRadius: 8, padding: 12 }}>
            <p style={{ fontSize: 12, color: "#666", marginTop: 0, marginBottom: 8 }}>
              Enter the email your clinic has on file and we'll send a new activation link.
            </p>
            <div style={{ display: "flex", gap: 8 }}>
              <input
                type="email"
                placeholder="Your email"
                value={resendEmail}
                onChange={(e) => setResendEmail(e.target.value)}
                required
                style={{ flex: 1, padding: 9, borderRadius: 8, border: "1px solid #ccc", fontSize: 13 }}
              />
              <button
                type="submit"
                disabled={resendLoading}
                style={{ padding: "9px 14px", borderRadius: 8, border: "none", background: "var(--brand-primary)", color: "white", fontWeight: 600, fontSize: 12.5, cursor: "pointer", whiteSpace: "nowrap" }}
              >
                {resendLoading ? "Sending…" : "Send new code"}
              </button>
            </div>
            {resendMessage && <p style={{ fontSize: 12, color: "#1a7f37", marginTop: 8, marginBottom: 0 }}>{resendMessage}</p>}
          </form>
        )}
      </div>
    </main>
  );
}

export default function ActivatePage() {
  return (
    <Suspense fallback={null}>
      <ActivateForm />
    </Suspense>
  );
}
