"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { BrandHeader } from "@/components/brand-header";
import { activateByOtpAction } from "../actions";

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

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!accountId) return setError("This link is missing information — ask your clinic to resend the code.");
    if (password.length < 8) return setError("Password must be at least 8 characters.");
    if (password !== confirm) return setError("Passwords don't match.");
    setLoading(true);
    try {
      await activateByOtpAction(accountId, code.trim(), password);
      router.push("/portal");
      router.refresh();
    } catch (e: any) {
      setError(e.message);
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
        <input
          type="password"
          placeholder="Choose a password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          style={{ padding: 10, borderRadius: 8, border: "1px solid #ccc" }}
        />
        <input
          type="password"
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
          style={{ padding: 10, borderRadius: 8, border: "none", background: "#2563eb", color: "white", fontWeight: 600, cursor: "pointer" }}
        >
          {loading ? "Verifying…" : "Activate account"}
        </button>
      </form>
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
