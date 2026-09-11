"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { BrandHeader } from "@/components/brand-header";
import { LoadingButton } from "@/components/loading/loading-button";
import { PasswordInput } from "@/components/password-input";

// Free patient self-registration — a permanent, platform-level MyCareDesk
// account independent of any one clinic (see migrations-pending/
// mycaredesk_platform_account.sql for why). Minimal fields only, no health
// questionnaire: that's the separate, optional, progressively-completable
// Health Profile at /portal/health-profile, reachable from the welcome
// screen this redirects to.
//
// Split out of page.tsx (which now checks maintenance mode server-side
// before rendering this) so a client component can still hold all the form
// state/behavior unchanged.
export function PatientSignupForm() {
  const router = useRouter();
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [dateOfBirth, setDateOfBirth] = useState("");
  const [sex, setSex] = useState("female");
  const [mobilePhone, setMobilePhone] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [status, setStatus] = useState<"idle" | "submitting" | "already-registered" | "flow-conflict" | "check-email" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState("");

  // Angel: "Do NOT turn confirmation into Register → Email → Confirm →
  // Login again → More verification." The account-creation RPC needs a
  // real session (it reads auth.uid()) — which doesn't exist yet if this
  // Supabase project requires email confirmation before a session is
  // issued. So: stash everything the RPC needs in the auth user's own
  // metadata at signUp() time, and actually call the RPC from
  // /portal/finish-signup, which the confirmation link (via
  // emailRedirectTo below → /auth/callback) lands on once a session
  // exists — whether that's immediately (confirmation off) or after the
  // patient clicks the emailed link (confirmation on). Either way this
  // page never has to guess which mode is active.
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

    // Guard against the metadata-clobbering bug: if this email already has
    // an unconfirmed clinic signup in flight, calling signUp() here would
    // silently overwrite it with patient fields (and vice versa on the
    // clinic form) — both flows share the same mutable
    // auth.users.user_metadata blob keyed only by email. Block instead of
    // clobbering.
    const { data: conflict } = await supabase.rpc("check_signup_flow_conflict", { p_email: email, p_intended_kind: "mycaredesk_patient" });
    if (conflict) {
      setStatus("flow-conflict");
      return;
    }

    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback?next=/portal/finish-signup`,
        data: {
          account_kind: "mycaredesk_patient",
          full_name: `${firstName} ${lastName}`,
          first_name: firstName,
          last_name: lastName,
          date_of_birth: dateOfBirth,
          sex,
          mobile_phone: mobilePhone,
        },
      },
    });

    if (error) {
      setStatus("error");
      setErrorMsg(error.message);
      return;
    }

    // An email that's already a confirmed account comes back "successful"
    // with an empty identities array — the real anti-enumeration signal.
    // (A brand-new signup that still needs confirmation ALSO has no
    // session yet, which is why that alone can't be used to detect this.)
    if (data.user?.identities && data.user.identities.length === 0) {
      setStatus("already-registered");
      return;
    }

    if (data.session) {
      // Confirmation isn't required for this project — session exists
      // immediately, so finish account creation right now instead of
      // waiting on a click that isn't coming.
      const { error: accountError } = await supabase.rpc("self_register_mycaredesk_account", {
        p_first_name: firstName,
        p_last_name: lastName,
        p_date_of_birth: dateOfBirth,
        p_sex: sex,
        p_mobile_phone: mobilePhone,
        p_email: email,
      });
      if (accountError) {
        setStatus("error");
        setErrorMsg(accountError.message);
        return;
      }
      // /portal (the dashboard) shows a graceful onboarding version of
      // itself for a brand-new patient with no clinic relationship yet —
      // no separate Welcome page needed.
      router.push("/portal");
      router.refresh();
      return;
    }

    setStatus("check-email");
  }

  if (status === "check-email") {
    return (
      <main style={{ maxWidth: 420, margin: "80px auto", padding: 24 }}>
        <div style={{ marginBottom: 24 }}>
          <BrandHeader />
        </div>
        <div style={{ background: "white", border: "1px solid #eee", borderRadius: 12, padding: 24 }}>
          <h1 style={{ fontSize: 18, marginTop: 0 }}>Check your email</h1>
          <p style={{ color: "#333", fontSize: 14, marginBottom: 4 }}>
            We sent a confirmation link to <strong>{email}</strong>.
          </p>
          <p style={{ color: "#666", fontSize: 13 }}>Click it and you'll be taken straight into your MyCareDesk account — no need to sign in again first.</p>
        </div>
      </main>
    );
  }

  if (status === "already-registered") {
    return (
      <main style={{ maxWidth: 420, margin: "80px auto", padding: 24 }}>
        <div style={{ marginBottom: 24 }}>
          <BrandHeader />
        </div>
        <div style={{ background: "#fff7e6", border: "1px solid #e6c66b", borderRadius: 12, padding: 24 }}>
          <h1 style={{ fontSize: 18, marginTop: 0 }}>You already have an account</h1>
          <p style={{ color: "#333", fontSize: 14, marginBottom: 16 }}>
            <strong>{email}</strong> already has a MyCareDesk login. Sign in instead.
          </p>
          <a
            href="/portal/login"
            style={{ display: "inline-block", padding: "9px 16px", borderRadius: 8, background: "var(--brand-primary)", color: "#fff", fontWeight: 700, fontSize: 13, textDecoration: "none" }}
          >
            Sign in →
          </a>
        </div>
      </main>
    );
  }

  if (status === "flow-conflict") {
    return (
      <main style={{ maxWidth: 420, margin: "80px auto", padding: 24 }}>
        <div style={{ marginBottom: 24 }}>
          <BrandHeader />
        </div>
        <div style={{ background: "#fff7e6", border: "1px solid #e6c66b", borderRadius: 12, padding: 24 }}>
          <h1 style={{ fontSize: 18, marginTop: 0 }}>You're already partway through signing up</h1>
          <p style={{ color: "#333", fontSize: 14, marginBottom: 16 }}>
            <strong>{email}</strong> is already partway through creating a clinic account. Check your email for that
            confirmation link, or contact support if you meant to create a patient account instead.
          </p>
          <button
            type="button"
            onClick={() => setStatus("idle")}
            style={{ padding: "9px 16px", borderRadius: 8, border: "1px solid #ccc", background: "white", fontWeight: 600, fontSize: 13, cursor: "pointer" }}
          >
            ← Back
          </button>
        </div>
      </main>
    );
  }

  return (
    <main style={{ maxWidth: 440, margin: "50px auto", padding: 24 }}>
      <div style={{ marginBottom: 20 }}>
        <BrandHeader />
      </div>
      <a href="/create-account" style={{ display: "inline-block", fontSize: 13, color: "#888", textDecoration: "none", marginBottom: 12 }}>
        ← Back
      </a>
      <h1 style={{ fontSize: 22 }}>Create your free MyCareDesk account</h1>
      <p style={{ color: "#666", fontSize: 13, marginBottom: 16 }}>
        Just the basics for now — you can find a doctor right away, and fill in your Health Profile whenever you're ready.
      </p>
      <form onSubmit={submit} style={{ display: "grid", gap: 12 }}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <input required placeholder="First name" value={firstName} onChange={(e) => setFirstName(e.target.value)} style={input} />
          <input required placeholder="Last name" value={lastName} onChange={(e) => setLastName(e.target.value)} style={input} />
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <label style={{ fontSize: 12, color: "#666" }}>
            Date of birth
            <input required type="date" value={dateOfBirth} onChange={(e) => setDateOfBirth(e.target.value)} style={{ ...input, width: "100%", marginTop: 4, boxSizing: "border-box" }} />
          </label>
          <label style={{ fontSize: 12, color: "#666" }}>
            Sex
            <select value={sex} onChange={(e) => setSex(e.target.value)} style={{ ...input, width: "100%", marginTop: 4, boxSizing: "border-box" }}>
              <option value="female">Female</option>
              <option value="male">Male</option>
              <option value="other">Other</option>
            </select>
          </label>
        </div>
        <input required placeholder="Mobile number" value={mobilePhone} onChange={(e) => setMobilePhone(e.target.value)} style={input} />
        <input required type="email" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} style={input} />
        <PasswordInput required placeholder="Password" value={password} onChange={(e) => setPassword(e.target.value)} style={input} />
        <PasswordInput required placeholder="Confirm password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} style={input} />
        {errorMsg && <p style={{ color: "crimson", fontSize: 13 }}>{errorMsg}</p>}
        <LoadingButton
          type="submit"
          loading={status === "submitting"}
          loadingText="Creating your account..."
          style={{ padding: 11, borderRadius: 8, border: "none", background: "var(--brand-primary)", color: "white", fontWeight: 700, fontSize: 14 }}
        >
          Create free account →
        </LoadingButton>
      </form>
      <p style={{ fontSize: 12, color: "#999", marginTop: 16 }}>
        Already have a MyCareDesk account? <a href="/portal/login" style={{ color: "var(--brand-primary)" }}>Sign in instead</a>.
      </p>
    </main>
  );
}

const input: React.CSSProperties = { padding: 10, borderRadius: 8, border: "1px solid #ccc", fontSize: 14 };
