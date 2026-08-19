"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { BrandHeader } from "@/components/brand-header";

// This REPLACES the old anonymous "Request Access" form for new clinics.
// Create-account-first, pay-to-unlock: an account here just gets someone a
// place to pick a plan and pay at /get-started — nothing about their
// clinic exists yet (no tenant, no portal access) until payment clears.
// See /get-started for the plan-selection + payment step, and migration
// 025_self_serve_signup for the provisioning logic this feeds into.
function SignupForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const plan = searchParams.get("plan");
  const cycle = searchParams.get("cycle");

  const [clinicName, setClinicName] = useState("");
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [status, setStatus] = useState<"idle" | "submitting" | "check-email" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState("");

  function nextUrl() {
    const params = new URLSearchParams();
    if (plan) params.set("plan", plan);
    if (cycle) params.set("cycle", cycle);
    const qs = params.toString();
    return `/get-started${qs ? `?${qs}` : ""}`;
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErrorMsg("");

    if (password !== confirmPassword) {
      setErrorMsg("Passwords don't match.");
      return;
    }
    if (password.length < 8) {
      setErrorMsg("Password should be at least 8 characters.");
      return;
    }

    setStatus("submitting");
    const supabase = createClient();
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { full_name: fullName, phone, clinic_name: clinicName },
        emailRedirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(nextUrl())}`,
      },
    });

    if (error) {
      setStatus("error");
      setErrorMsg(error.message);
      return;
    }

    if (data.session) {
      // Email confirmation is off on this project — already signed in.
      router.push(nextUrl());
      router.refresh();
      return;
    }

    // Email confirmation is required — they'll land on /get-started once
    // they click the link in their inbox.
    setStatus("check-email");
  }

  if (status === "check-email") {
    return (
      <main style={{ maxWidth: 420, margin: "80px auto", padding: 24 }}>
        <div style={{ marginBottom: 24 }}>
          <BrandHeader />
        </div>
        <div style={{ background: "#f0f9f0", border: "1px solid #bfe3bf", borderRadius: 12, padding: 24 }}>
          <h1 style={{ fontSize: 18, marginTop: 0 }}>Check your email</h1>
          <p style={{ color: "#333", fontSize: 14 }}>
            We sent a confirmation link to <strong>{email}</strong>. Click it to continue — it'll take you straight
            to choosing your plan and paying.
          </p>
        </div>
      </main>
    );
  }

  return (
    <main style={{ maxWidth: 420, margin: "60px auto", padding: 24 }}>
      <div style={{ marginBottom: 24 }}>
        <BrandHeader />
      </div>
      <h1 style={{ fontSize: 22 }}>Create your account</h1>
      <p style={{ color: "#666", fontSize: 13, marginBottom: 16 }}>
        Set up your login first. You'll pick a plan and pay on the next screen — your clinic's portal goes live the
        moment payment is received.
      </p>
      <form onSubmit={submit} style={{ display: "grid", gap: 12 }}>
        <input required placeholder="Clinic name" value={clinicName} onChange={(e) => setClinicName(e.target.value)} style={input} />
        <input required placeholder="Your full name" value={fullName} onChange={(e) => setFullName(e.target.value)} style={input} />
        <input required type="email" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} style={input} />
        <input required placeholder="Phone number" value={phone} onChange={(e) => setPhone(e.target.value)} style={input} />
        <input
          required
          type="password"
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          style={input}
        />
        <input
          required
          type="password"
          placeholder="Confirm password"
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          style={input}
        />
        {errorMsg && <p style={{ color: "crimson", fontSize: 13 }}>{errorMsg}</p>}
        <button type="submit" disabled={status === "submitting"} style={submitBtn}>
          {status === "submitting" ? "Creating account..." : "Create account →"}
        </button>
      </form>
      <p style={{ fontSize: 12, color: "#999", marginTop: 16 }}>
        Already have a portal account? <a href="/login" style={{ color: "#2563eb" }}>Sign in instead</a>.
      </p>
    </main>
  );
}

export default function SignupPage() {
  return (
    <Suspense fallback={null}>
      <SignupForm />
    </Suspense>
  );
}

const input: React.CSSProperties = { padding: 10, borderRadius: 8, border: "1px solid #ccc", fontSize: 14 };
const submitBtn: React.CSSProperties = {
  padding: 11,
  borderRadius: 8,
  border: "none",
  background: "#0c1730",
  color: "#e6c66b",
  fontWeight: 700,
  fontSize: 14,
  cursor: "pointer",
};
