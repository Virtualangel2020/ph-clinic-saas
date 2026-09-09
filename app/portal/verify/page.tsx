"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { BrandHeader } from "@/components/brand-header";
import { PasswordInput } from "@/components/password-input";
import { activateByOtpAction, requestPortalInviteResendAction } from "../actions";

// The automated-SMS activation path (paid SMS add-on): the text carries
// this link with the account id (?a=...) plus a 6-digit code in the
// message body itself, which the patient types in here.
function VerifyForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const accountId = searchParams.get("a") ?? "";
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const [resendLoading, setResendLoading] = useState(false);
  const [resendMessage, setResendMessage] = useState<string | null>(null);

  async function handleResend() {
    if (!accountId) return;
    setResendLoading(true);
    setResendMessage(null);
    const result = await requestPortalInviteResendAction({ accountId });
    setResendMessage(result.message);
    setResendLoading(false);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!accountId) return setError("This link is missing information — ask your clinic to resend the code.");
    if (password.length < 8) return setError("Password must be at least 8 characters.");
    if (password !== confirm) return setError("Passwords don't match.");
    setLoading(true);
    try {
      const result = await activateByOtpAction(accountId, code.trim(), password);
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
      <h1 style={{ fontSize: 22 }}>Verify your number</h1>
      <p style={{ color: "#666", fontSize: 13, marginTop: 6 }}>Enter the 6-digit code we texted you, then set a password.</p>
      <form onSubmit={handleSubmit} style={{ display: "grid", gap: 12, marginTop: 16 }}>
        <input
          placeholder="6-digit code"
          value={code}
          onChange={(e) => setCode(e.target.value)}
          inputMode="numeric"
          required
          style={{ padding: 10, borderRadius: 8, border: "1px solid #ccc", fontFamily: "monospace", letterSpacing: 3, textAlign: "center", fontSize: 18 }}
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
          {loading ? "Verifying…" : "Activate account"}
        </button>
      </form>

      <div style={{ marginTop: 16, textAlign: "center" }}>
        <button
          type="button"
          onClick={handleResend}
          disabled={resendLoading || !accountId}
          style={{ background: "none", border: "none", color: "#888", fontSize: 12.5, textDecoration: "underline", cursor: "pointer", padding: 0 }}
        >
          {resendLoading ? "Sending…" : "Didn't get a text? Send a new code"}
        </button>
        {resendMessage && <p style={{ fontSize: 12, color: "#1a7f37", marginTop: 8 }}>{resendMessage}</p>}
      </div>
    </main>
  );
}

export default function VerifyPage() {
  return (
    <Suspense fallback={null}>
      <VerifyForm />
    </Suspense>
  );
}
