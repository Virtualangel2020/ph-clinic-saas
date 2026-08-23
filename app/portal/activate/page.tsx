"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { BrandHeader } from "@/components/brand-header";
import { activateByTokenAction } from "../actions";

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

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (password.length < 8) return setError("Password must be at least 8 characters.");
    if (password !== confirm) return setError("Passwords don't match.");
    setLoading(true);
    try {
      await activateByTokenAction(code.trim(), password);
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
          {loading ? "Activating…" : "Activate account"}
        </button>
      </form>
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
