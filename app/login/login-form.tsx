"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { BrandHeader } from "@/components/brand-header";
import { LoadingButton } from "@/components/loading/loading-button";
import { PasswordInput } from "@/components/password-input";

// Minimal email/password sign-in for clinic staff/providers. Honors ?next=
// so anywhere that bounces someone here (requireAdmin, /dashboard/billing,
// an "already have an account" prompt mid-signup) can send them back to
// exactly where they were trying to go instead of always landing on
// /dashboard. Previously had no way for a patient who landed here by
// mistake to find their way to the right sign-in, and no visible sign-up
// path at all — the toggle and the links at the bottom fix both.
//
// Split out of page.tsx (which now checks maintenance mode server-side
// before rendering this) so a client component can still hold all the form
// state/behavior unchanged.
export function LoginForm() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const searchParams = useSearchParams();
  const next = searchParams.get("next") || "/dashboard";

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const supabase = createClient();
    const { error } = await supabase.auth.signInWithPassword({ email, password });

    setLoading(false);
    if (error) {
      setError(error.message);
      return;
    }
    router.push(next);
    router.refresh();
  }

  return (
    <main style={{ maxWidth: 360, margin: "80px auto", padding: 24 }}>
      <div style={{ marginBottom: 24 }}>
        <BrandHeader />
      </div>

      <div style={{ display: "flex", gap: 4, background: "#f0f0f0", borderRadius: 10, padding: 4, marginBottom: 20 }}>
        <div style={{ flex: 1, textAlign: "center", padding: "8px 0", borderRadius: 7, background: "white", fontWeight: 700, fontSize: 13, color: "var(--brand-primary)" }}>
          I'm a Provider / Staff
        </div>
        <Link
          href="/portal/login"
          style={{ flex: 1, textAlign: "center", padding: "8px 0", borderRadius: 7, fontWeight: 600, fontSize: 13, color: "#666", textDecoration: "none" }}
        >
          I'm a Patient
        </Link>
      </div>

      <h1 style={{ fontSize: 22 }}>Sign in</h1>
      <form onSubmit={handleSubmit} style={{ display: "grid", gap: 12, marginTop: 16 }}>
        <input
          type="email"
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          style={{ padding: 10, borderRadius: 8, border: "1px solid var(--brand-border)" }}
        />
        <PasswordInput
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          style={{ padding: 10, borderRadius: 8, border: "1px solid var(--brand-border)" }}
        />
        {error && <p style={{ color: "crimson", fontSize: 13 }}>{error}</p>}
        <LoadingButton
          type="submit"
          loading={loading}
          loadingText="Signing in..."
          style={{
            padding: 10,
            borderRadius: 8,
            border: "none",
            background: "var(--brand-primary)",
            color: "white",
            fontWeight: 600,
          }}
        >
          Sign in
        </LoadingButton>
      </form>
      <p style={{ fontSize: 12.5, color: "#888", marginTop: 16 }}>
        New patient? <Link href="/patient-signup" style={{ color: "var(--brand-primary)" }}>Create a free MyCareDesk account</Link>.
      </p>
      <p style={{ fontSize: 12.5, color: "#888", marginTop: 4 }}>
        Setting up a new clinic? <Link href="/signup" style={{ color: "var(--brand-primary)" }}>Start here</Link>.
      </p>
    </main>
  );
}
