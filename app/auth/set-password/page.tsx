"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { BrandHeader } from "@/components/brand-header";

// Landing page right after someone accepts a staff invite. The
// invite/magic link already signed them into a real (if temporary)
// session via /auth/callback — this just asks them to set a password so
// they can sign in normally afterward.
export default function SetPasswordPage() {
  const [email, setEmail] = useState<string | null>(null);
  const [checking, setChecking] = useState(true);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data }) => {
      setEmail(data.user?.email ?? null);
      setChecking(false);
    });
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }
    if (password !== confirm) {
      setError("Passwords don't match.");
      return;
    }
    setLoading(true);
    setError(null);

    const supabase = createClient();
    const { error } = await supabase.auth.updateUser({ password });

    setLoading(false);
    if (error) {
      setError(error.message);
      return;
    }
    router.push("/dashboard");
    router.refresh();
  }

  if (checking) {
    return (
      <main style={{ maxWidth: 360, margin: "80px auto", padding: 24, textAlign: "center", color: "#888" }}>
        Loading...
      </main>
    );
  }

  if (!email) {
    return (
      <main style={{ maxWidth: 400, margin: "80px auto", padding: 24 }}>
        <div style={{ marginBottom: 24 }}>
          <BrandHeader />
        </div>
        <h1 style={{ fontSize: 20 }}>This link has expired</h1>
        <p style={{ color: "#666", fontSize: 14 }}>
          Invite links only work once and expire after a while. Ask whoever invited you to send a fresh one, or{" "}
          <a href="/login" style={{ color: "#2563eb" }}>sign in</a> if you already set a password.
        </p>
      </main>
    );
  }

  return (
    <main style={{ maxWidth: 360, margin: "80px auto", padding: 24 }}>
      <div style={{ marginBottom: 24 }}>
        <BrandHeader />
      </div>
      <h1 style={{ fontSize: 22 }}>Set your password</h1>
      <p style={{ color: "#666", fontSize: 14, marginBottom: 16 }}>
        Welcome — signing in as <strong>{email}</strong>. Choose a password to finish setting up your account.
      </p>
      <form onSubmit={handleSubmit} style={{ display: "grid", gap: 12 }}>
        <input
          type="password"
          placeholder="New password (min. 8 characters)"
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
          style={{
            padding: 10,
            borderRadius: 8,
            border: "none",
            background: "#0c1730",
            color: "#e6c66b",
            fontWeight: 700,
            cursor: "pointer",
          }}
        >
          {loading ? "Saving..." : "Set password & continue"}
        </button>
      </form>
    </main>
  );
}
