"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { BrandHeader } from "@/components/brand-header";
import { LoadingButton } from "@/components/loading/loading-button";
import { PasswordInput } from "@/components/password-input";

// A patient's login identity is whichever they had on file at activation
// (email or PH mobile) — see app/portal/actions.ts. Digits-only input is
// treated as a phone number and normalized the same way activation does.
function normalizePhMobile(raw: string): string {
  const digits = raw.replace(/\D/g, "");
  if (digits.startsWith("63")) return digits;
  if (digits.startsWith("0")) return "63" + digits.slice(1);
  if (digits.length === 10) return "63" + digits;
  return digits;
}

// Split out of page.tsx (which now checks maintenance mode server-side
// before rendering this) so a client component can still hold all the form
// state/behavior unchanged.
export function PortalLoginForm() {
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const searchParams = useSearchParams();
  const explicitNext = searchParams.get("next");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const supabase = createClient();
    const isEmail = identifier.includes("@");
    const { error } = await supabase.auth.signInWithPassword(
      isEmail ? { email: identifier.trim(), password } : { phone: normalizePhMobile(identifier), password }
    );

    if (error) {
      setLoading(false);
      setError(error.message);
      return;
    }

    // /portal (the dashboard) now handles both cases on its own — a
    // clinic-connected patient sees their real dashboard, and a brand-new
    // self-registered patient (platform mycaredesk_accounts identity only,
    // no clinic relationship yet) sees a graceful onboarding version of the
    // SAME page, with the normal portal nav still fully visible. There's no
    // need to pre-branch here anymore (see requirePatientPortal).
    setLoading(false);
    router.push(explicitNext || "/portal");
    router.refresh();
  }

  return (
    <main style={{ maxWidth: 360, margin: "80px auto", padding: 24 }}>
      <div style={{ marginBottom: 24 }}>
        <BrandHeader />
      </div>

      <div style={{ display: "flex", gap: 4, background: "#f0f0f0", borderRadius: 10, padding: 4, marginBottom: 20 }}>
        <div style={{ flex: 1, textAlign: "center", padding: "8px 0", borderRadius: 7, background: "white", fontWeight: 700, fontSize: 13, color: "var(--brand-primary)" }}>
          I'm a Patient
        </div>
        <Link
          href="/login"
          style={{ flex: 1, textAlign: "center", padding: "8px 0", borderRadius: 7, fontWeight: 600, fontSize: 13, color: "#666", textDecoration: "none" }}
        >
          I'm a Provider / Staff
        </Link>
      </div>

      <h1 style={{ fontSize: 22 }}>Patient Portal sign in</h1>
      <form onSubmit={handleSubmit} style={{ display: "grid", gap: 12, marginTop: 16 }}>
        <input
          placeholder="Email or mobile number"
          value={identifier}
          onChange={(e) => setIdentifier(e.target.value)}
          required
          style={{ padding: 10, borderRadius: 8, border: "1px solid #ccc" }}
        />
        <PasswordInput
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          style={{ padding: 10, borderRadius: 8, border: "1px solid #ccc" }}
        />
        {error && <p style={{ color: "crimson", fontSize: 13 }}>{error}</p>}
        <LoadingButton
          type="submit"
          loading={loading}
          loadingText="Signing in..."
          style={{ padding: 10, borderRadius: 8, border: "none", background: "var(--brand-primary)", color: "white", fontWeight: 600 }}
        >
          Sign in
        </LoadingButton>
      </form>
      <p style={{ fontSize: 12.5, color: "#888", marginTop: 16 }}>
        Haven't activated yet? Use the code or link your clinic gave you at <a href="/portal/activate" style={{ color: "var(--brand-primary)" }}>/portal/activate</a>.
      </p>
      <p style={{ fontSize: 12.5, color: "#888", marginTop: 8 }}>
        New patient, not yet connected to a clinic? <a href="/patient-signup" style={{ color: "var(--brand-primary)" }}>Create a free MyCareDesk account</a>.
      </p>
    </main>
  );
}
