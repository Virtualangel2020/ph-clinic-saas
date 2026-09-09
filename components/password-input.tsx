"use client";

import { useState } from "react";

// Angel: "no option to see what password I'm typing" — a plain drop-in
// replacement for <input type="password">. Accepts the same props (style,
// placeholder, value, onChange, required, autoComplete, etc.) and adds a
// show/hide eye toggle, used everywhere a patient or staff member sets or
// enters a password (sign in, sign up, activate, verify, set password).
export function PasswordInput({ style, ...props }: React.InputHTMLAttributes<HTMLInputElement>) {
  const [visible, setVisible] = useState(false);

  return (
    <div style={{ position: "relative" }}>
      <input {...props} type={visible ? "text" : "password"} style={{ ...style, paddingRight: 40, width: "100%", boxSizing: "border-box" }} />
      <button
        type="button"
        onClick={() => setVisible((v) => !v)}
        aria-label={visible ? "Hide password" : "Show password"}
        tabIndex={-1}
        style={{
          position: "absolute",
          right: 4,
          top: "50%",
          transform: "translateY(-50%)",
          background: "none",
          border: "none",
          color: "#888",
          fontSize: 12.5,
          fontWeight: 600,
          cursor: "pointer",
          padding: "6px 8px",
        }}
      >
        {visible ? "Hide" : "Show"}
      </button>
    </div>
  );
}
