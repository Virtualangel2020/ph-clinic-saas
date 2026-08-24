"use client";

import { useRouter } from "next/navigation";

// One consistent "go back" affordance used across every drill-down page —
// Superadmin client detail, EMR settings sub-pages, module placeholders,
// the patient chart's tabs, etc. `href` is still required and still means
// "the meaningful parent screen" (e.g. Patients list, or a specific
// patient's chart) — it's the safe landing spot when there's nowhere
// real to go back to.
//
// Behavior: if the browser actually has in-app history to go back to
// (same-origin referrer + a non-trivial history stack — the two things a
// fresh tab / direct link / bookmark never has), use real browser history
// via router.back(). That's what makes "Patient Chart → Document → Back"
// land back on the Patient Chart tab the user was actually on, and
// "Calendar → Patient Appointment → Back" land back on the Calendar view
// (not just the Calendar root) — router.back() restores the exact prior
// scroll/query-param state, which a hardcoded href never could.
//
// Otherwise (no usable in-app history — e.g. someone opened this page
// directly from a bookmark or a new tab) fall back to `href`, so Back
// never dead-ends outside the app or throws the user onto an empty tab.
// This can't create a loop: it's real browser history, not a synthetic
// stack we maintain ourselves.
export function BackLink({ href, label }: { href: string; label: string }) {
  const router = useRouter();

  function handleClick(e: React.MouseEvent) {
    e.preventDefault();
    const hasInAppHistory =
      typeof window !== "undefined" &&
      window.history.length > 1 &&
      typeof document !== "undefined" &&
      document.referrer &&
      document.referrer.startsWith(window.location.origin);

    if (hasInAppHistory) {
      router.back();
    } else {
      router.push(href);
    }
  }

  return (
    <a
      href={href}
      onClick={handleClick}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 4,
        fontSize: 13,
        color: "#666",
        textDecoration: "none",
        marginBottom: 14,
        cursor: "pointer",
      }}
    >
      ← {label}
    </a>
  );
}
