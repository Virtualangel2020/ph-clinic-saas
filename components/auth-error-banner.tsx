"use client";

import { useEffect, useState } from "react";

// Supabase Auth redirects failed magic-link / invite / signup-confirmation
// attempts to the project's Site URL with the error in a HASH fragment
// (e.g. #error=access_denied&error_code=otp_expired&error_description=...).
// A hash never reaches the server, so no server-side route can catch this —
// it has to be read client-side, here, mounted globally in the root layout
// so it catches the error no matter which page the Site URL happens to be
// pointed at.
//
// The single most common cause: the link was already used once (Supabase
// invite/signup links are single-use) — often because the first click
// landed somewhere broken and the person went back to the email and
// clicked it again, which is exactly what a stale otp_expired error
// usually means in practice, not that they waited too long.
export function AuthErrorBanner() {
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!window.location.hash) return;
    const params = new URLSearchParams(window.location.hash.slice(1));
    const error = params.get("error");
    if (!error) return;

    const code = params.get("error_code");
    if (code === "otp_expired") {
      setMessage(
        "This link has already been used or has expired. If you clicked it more than once, only the first click works — ask whoever sent it to send you a fresh one."
      );
    } else {
      setMessage(params.get("error_description")?.replace(/\+/g, " ") || "That link isn't valid anymore.");
    }

    // Clean the error out of the URL so a refresh/share doesn't repeat it.
    window.history.replaceState(null, "", window.location.pathname + window.location.search);
  }, []);

  if (!message) return null;

  return (
    <div
      style={{
        background: "#fff3f3",
        borderBottom: "1px solid #f3c2c2",
        color: "#8a1f1f",
        fontSize: 13,
        padding: "10px 20px",
        textAlign: "center",
      }}
    >
      {message}{" "}
      <button
        onClick={() => setMessage(null)}
        style={{ marginLeft: 10, background: "none", border: "none", color: "#8a1f1f", textDecoration: "underline", cursor: "pointer", fontSize: 13 }}
      >
        Dismiss
      </button>
    </div>
  );
}
