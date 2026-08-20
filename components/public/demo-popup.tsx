"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

const DISMISS_KEY = "ac_demo_popup_dismissed";

// Part 46: a dismissible "Request a Demo" popup — separate from the Master
// Demo (self-serve) account. Shows once per browser session, after a short
// delay so it doesn't interrupt someone who just landed on the page, and
// never shows again this session once dismissed (sessionStorage, not
// tracked server-side — this is just UI politeness, not a lead system).
export function DemoPopup() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    try {
      if (sessionStorage.getItem(DISMISS_KEY)) return;
    } catch {
      return;
    }
    const t = setTimeout(() => setVisible(true), 25000);
    return () => clearTimeout(t);
  }, []);

  function dismiss() {
    setVisible(false);
    try {
      sessionStorage.setItem(DISMISS_KEY, "1");
    } catch {}
  }

  if (!visible) return null;

  return (
    <div
      style={{
        position: "fixed",
        bottom: 24,
        left: 24,
        zIndex: 40,
        background: "#0c1730",
        color: "#f4f5f7",
        borderRadius: 14,
        padding: "18px 20px",
        maxWidth: 300,
        boxShadow: "0 12px 32px rgba(12,23,48,0.35)",
        border: "1px solid rgba(230,198,107,0.3)",
      }}
    >
      <button
        onClick={dismiss}
        aria-label="Dismiss"
        style={{ position: "absolute", top: 8, right: 10, background: "none", border: "none", color: "rgba(244,245,247,0.5)", fontSize: 14, cursor: "pointer" }}
      >
        ✕
      </button>
      <div style={{ fontWeight: 700, fontSize: 14.5, marginBottom: 6 }}>Curious how AngelClinic works?</div>
      <p style={{ fontSize: 12.5, color: "rgba(244,245,247,0.75)", lineHeight: 1.5, margin: "0 0 14px" }}>
        We'll walk you through it — no pressure, just a quick look.
      </p>
      <Link
        href="/request-demo"
        onClick={dismiss}
        style={{ display: "inline-block", background: "#e6c66b", color: "#0c1730", fontWeight: 700, fontSize: 12.5, padding: "8px 14px", borderRadius: 7, textDecoration: "none" }}
      >
        Request a Demo →
      </Link>
    </div>
  );
}
