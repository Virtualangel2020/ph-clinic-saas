"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { BrandHeader } from "@/components/brand-header";
import { PasswordInput } from "@/components/password-input";
import { activateByTokenAction, requestPortalInviteResendAction, checkActivationTokenAction } from "../actions";

// Two genuinely different arrivals land here, and Angel was right that
// they shouldn't look the same:
//
// 1. LINK FLOW — a real emailed/texted activation link (?token=...). The
//    secure token IS the credential; the patient should never have to
//    read it off the email and retype it. No code field — just "your
//    portal is ready, choose a password." The token is checked (without
//    being consumed) as soon as the page loads so an expired/reused link
//    shows a clear message immediately, not only after typing a password.
// 2. MANUAL FLOW — no token in the URL at all, because staff read a code
//    aloud in person (migration patient_portal_manual_channel) and there
//    was never an email/text to click through. This is the ONLY case
//    that still needs a code-entry field, and it's clearly labeled as
//    such rather than the old one-size-fits-all copy.
function ActivateForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const urlToken = searchParams.get("token") ?? "";
  const isLinkFlow = urlToken.length > 0;

  const [manualCode, setManualCode] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const [tokenCheck, setTokenCheck] = useState<"checking" | "valid" | "invalid">(isLinkFlow ? "checking" : "valid");

  useEffect(() => {
    if (!isLinkFlow) return;
    let cancelled = false;
    checkActivationTokenAction(urlToken).then((result) => {
      if (!cancelled) setTokenCheck(result.valid ? "valid" : "invalid");
    });
    return () => {
      cancelled = true;
    };
  }, [isLinkFlow, urlToken]);

  const [showResend, setShowResend] = useState(false);
  const [resendContact, setResendContact] = useState("");
  const [resendLoading, setResendLoading] = useState(false);
  const [resendMessage, setResendMessage] = useState<string | null>(null);

  async function handleResend(e: React.FormEvent) {
    e.preventDefault();
    setResendLoading(true);
    setResendMessage(null);
    const result = await requestPortalInviteResendAction({ contact: resendContact });
    setResendMessage(result.message);
    setResendLoading(false);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (password.length < 8) return setError("Password must be at least 8 characters.");
    if (password !== confirm) return setError("Passwords don't match.");
    const codeToUse = isLinkFlow ? urlToken : manualCode.trim();
    if (!codeToUse) return setError("Enter the code your clinic gave you.");
    setLoading(true);
    try {
      const result = await activateByTokenAction(codeToUse, password);
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

  const resendForm = (
    <form onSubmit={handleResend} style={{ marginTop: 4, textAlign: "left", background: "#f7f9fb", border: "1px solid #dde6ee", borderRadius: 8, padding: 12 }}>
      <p style={{ fontSize: 12, color: "#666", marginTop: 0, marginBottom: 8 }}>
        Enter the email or mobile number your clinic has on file and we'll send new activation instructions.
      </p>
      <div style={{ display: "flex", gap: 8 }}>
        <input
          placeholder="Email or mobile"
          value={resendContact}
          onChange={(e) => setResendContact(e.target.value)}
          required
          style={{ flex: 1, padding: 9, borderRadius: 8, border: "1px solid #ccc", fontSize: 13 }}
        />
        <button
          type="submit"
          disabled={resendLoading}
          style={{ padding: "9px 14px", borderRadius: 8, border: "none", background: "var(--brand-primary)", color: "white", fontWeight: 600, fontSize: 12.5, cursor: "pointer", whiteSpace: "nowrap" }}
        >
          {resendLoading ? "Sending…" : "Send new link"}
        </button>
      </div>
      {resendMessage && <p style={{ fontSize: 12, color: "#1a7f37", marginTop: 8, marginBottom: 0 }}>{resendMessage}</p>}
    </form>
  );

  if (isLinkFlow && tokenCheck === "checking") {
    return (
      <main style={{ maxWidth: 380, margin: "80px auto", padding: 24, textAlign: "center" }}>
        <div style={{ marginBottom: 24 }}>
          <BrandHeader />
        </div>
        <p style={{ color: "#666", fontSize: 13.5 }}>Checking your activation link…</p>
      </main>
    );
  }

  if (isLinkFlow && tokenCheck === "invalid") {
    return (
      <main style={{ maxWidth: 380, margin: "80px auto", padding: 24 }}>
        <div style={{ marginBottom: 24 }}>
          <BrandHeader />
        </div>
        <h1 style={{ fontSize: 21 }}>This activation link has expired</h1>
        <p style={{ color: "#666", fontSize: 13.5, marginTop: 6, marginBottom: 16 }}>
          Activation links are only good for 24 hours, and can only be used once. Enter your email or mobile below and we'll send a new one.
        </p>
        {resendForm}
      </main>
    );
  }

  return (
    <main style={{ maxWidth: 380, margin: "80px auto", padding: 24 }}>
      <div style={{ marginBottom: 24 }}>
        <BrandHeader />
      </div>
      <h1 style={{ fontSize: 22 }}>Activate your Patient Portal</h1>
      <p style={{ color: "#666", fontSize: 13, marginTop: 6 }}>
        {isLinkFlow ? "Your MyCareDesk Patient Portal is ready. Choose a password to activate your account." : "Enter the activation code your clinic gave you in person, then set a password."}
      </p>
      <form onSubmit={handleSubmit} style={{ display: "grid", gap: 12, marginTop: 16 }}>
        {!isLinkFlow && (
          <input
            placeholder="Activation code"
            value={manualCode}
            onChange={(e) => setManualCode(e.target.value)}
            required
            style={{ padding: 10, borderRadius: 8, border: "1px solid #ccc", fontFamily: "monospace", letterSpacing: 1 }}
          />
        )}
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

      {!isLinkFlow && (
        <div style={{ marginTop: 18, textAlign: "center" }}>
          {!showResend ? (
            <button
              type="button"
              onClick={() => setShowResend(true)}
              style={{ background: "none", border: "none", color: "#888", fontSize: 12.5, textDecoration: "underline", cursor: "pointer", padding: 0 }}
            >
              Don't have a code, or has it expired? Send activation instructions
            </button>
          ) : (
            resendForm
          )}
        </div>
      )}
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
