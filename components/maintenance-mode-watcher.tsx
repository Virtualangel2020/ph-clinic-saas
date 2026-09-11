"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

// Angel's spec item 19: someone ALREADY signed in and working (staff or
// patient) shouldn't hit a sudden server error or blank page the moment
// maintenance mode flips on mid-session — they should see a clear,
// friendly notice instead, and nothing they're doing should be silently
// destroyed. Deliberately the simplest thing that could work, per her own
// "do not build a complicated hard-lock system unless necessary": this
// polls the same public, already-existing maintenance_settings row
// (no new table, no new admin control) every 60s, and shows a dismissible
// banner — it never blocks navigation, never discards unsaved form state,
// and never forces a reload. Dismissing just hides it until the next poll
// tick or page load; it deliberately does NOT remember the dismissal
// forever, so a still-ongoing update stays visible again next visit.
// Mounted once each in PortalShellClient and EmrShell, so it covers both
// the Patient Portal and the staff dashboard with one component.
const POLL_MS = 60_000;

export function MaintenanceModeWatcher() {
  const [notice, setNotice] = useState<{ message: string } | null>(null);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const supabase = createClient();

    async function check() {
      const { data } = await supabase.from("maintenance_settings").select("is_enabled, message").eq("id", true).maybeSingle();
      if (cancelled) return;
      if ((data as any)?.is_enabled) {
        setNotice((prev) => {
          const message = (data as any).message || "MyCareDesk is currently being updated.";
          // A NEW maintenance window (message changed, or wasn't showing
          // before) should re-surface even if an earlier one was dismissed.
          if (!prev || prev.message !== message) setDismissed(false);
          return { message };
        });
      } else {
        setNotice(null);
        setDismissed(false);
      }
    }

    check();
    const id = setInterval(check, POLL_MS);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, []);

  if (!notice || dismissed) return null;

  return (
    <div
      role="status"
      style={{
        background: "#fff7e6",
        border: "1px solid #e6c66b",
        borderRadius: 10,
        color: "#7a5c12",
        fontSize: 12.5,
        padding: "10px 16px",
        marginBottom: 16,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        gap: 14,
        textAlign: "center",
      }}
    >
      <span>
        <strong>System update in progress.</strong> {notice.message} Some features may be temporarily unavailable — please save your work as you go.
      </span>
      <button
        onClick={() => setDismissed(true)}
        aria-label="Dismiss"
        style={{ background: "transparent", border: "none", color: "#7a5c12", fontWeight: 700, cursor: "pointer", fontSize: 14, lineHeight: 1, flexShrink: 0 }}
      >
        ✕
      </button>
    </div>
  );
}
