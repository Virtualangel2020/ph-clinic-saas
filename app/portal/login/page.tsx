"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { BrandHeader } from "@/components/brand-header";

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

function LoginForm() {
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const searchParams = useSearchParams();
  const next = searchParams.get("next") || "/portal";

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const supabase = createClient();
    const isEmail = identifier.includes("@");
    const { error } = await supabase.auth.signInWithPassword(
      isEmail ? { email: identifier.trim(), password } : { phone: normalizePhMobile(identifier), password }
    );

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
      <h1 style={{ fontSize: 22 }}>Patient Portal sign in</h1>
      <form onSubmit={handleSubmit} style={{ display: "grid", gap: 12, marginTop: 16 }}>
        <input
          placeholder="Email or mobile number"
          value={identifier}
          onChange={(e) => setIdentifier(e.target.value)}
          required
          style={{ padding: 10, borderRadius: 8, border: "1px solid #ccc" }}
        />
        <input
          type="password"
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          style={{ padding: 10, borderRadius: 8, border: "1px solid #ccc" }}
        />
        {error && <p style={{ color: "crimson", fontSize: 13 }}>{error}</p>}
        <button
          type="submit"
          disabled={loading}
          style={{ padding: 10, borderRadius: 8, border: "none", background: "#2563eb", color: "white", fontWeight: 600, cursor: "pointer" }}
        >
          {loading ? "Signing in..." : "Sign in"}
        </button>
      </form>
      <p style={{ fontSize: 12.5, color: "#888", marginTop: 16 }}>
        Haven't activated yet? Use the code or link your clinic gave you at <a href="/portal/activate">/portal/activate</a>.
      </p>
    </main>
  );
}

export default function PortalLoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginForm />
    </Suspense>
  );
}
