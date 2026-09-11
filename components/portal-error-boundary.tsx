"use client";

import Link from "next/link";
import { useEffect } from "react";

// Shared UI for every app/portal/**/error.tsx boundary.
//
// WHY THIS EXISTS (root cause of "Application error: a server-side
// exception has occurred / Digest: 800866611"): the Patient Portal had NO
// error.tsx anywhere — confirmed by a full search of the app directory.
// Individual pages (find-a-doctor, find-a-doctor/[id], book/[providerId])
// had their own try/catch around specific RPC calls, but a try/catch
// inside a page's own function body can ONLY catch exceptions thrown
// during that function's own synchronous/awaited work. It can never catch:
//   - an exception thrown by a nested async Server Component rendered as a
//     child (e.g. <PortalShell> itself, which independently resolves the
//     signed-in patient's active profile on every portal page — a bug
//     inside that resolution would crash every page that renders it, and
//     no per-page try/catch could ever see it)
//   - a page's own code that runs AFTER its try/catch block ends (found
//     one real instance of this: app/portal/find-a-doctor/[id]/page.tsx
//     called resolveEffectiveSettings(d.clinic, d.override) — and derived
//     several other values from the fetched data — OUTSIDE its try/catch,
//     so an exception there was never caught; fixed alongside this)
// With no error.tsx at any /portal/* segment, any exception in either of
// those categories has nowhere to be caught and falls all the way through
// to Next.js's own generic, unbranded crash page — exactly the "Digest:
// ..." screen Angel kept seeing, and exactly why the friendly
// PortalDataError component "wasn't catching it": it was never in the
// exception's path in the first place.
//
// error.tsx is the actual Next.js App Router mechanism for this: Next
// automatically logs the real, unredacted error server-side (visible in
// Vercel's Runtime Logs, searchable by the same digest shown to the
// patient) BEFORE handing this component only the redacted
// {message, digest} shape — so nothing sensitive ever reaches the browser
// while the real cause stays fully diagnosable from the server side.
export function PortalErrorBoundary({
  error,
  reset,
  message,
  homeHref = "/portal",
  homeLabel = "Portal Home",
}: {
  error: Error & { digest?: string };
  reset: () => void;
  message: string;
  homeHref?: string;
  homeLabel?: string;
}) {
  useEffect(() => {
    // Next.js already logs the full server-side error automatically; this
    // just makes sure the digest is easy to spot in the browser console
    // too, for a screen-share/support-call situation.
    console.error(`[Patient Portal] ${message} (digest: ${error.digest ?? "n/a"})`);
  }, [error, message]);

  return (
    <div style={{ minHeight: "60vh", display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
      <div style={{ maxWidth: 420, textAlign: "center", background: "white", border: "1px solid #eee", borderRadius: 14, padding: "32px 28px" }}>
        <div style={{ fontSize: 32, marginBottom: 12 }}>😕</div>
        <h1 style={{ fontSize: 17, margin: "0 0 8px", color: "var(--text-heading, #222)" }}>{message}</h1>
        <p style={{ fontSize: 13, color: "#888", margin: "0 0 22px" }}>
          This has been logged so we can look into it. Nothing you were working on was lost.
        </p>
        <div style={{ display: "flex", gap: 10, justifyContent: "center", flexWrap: "wrap" }}>
          <button
            onClick={reset}
            style={{ background: "var(--brand-primary)", color: "white", fontWeight: 700, fontSize: 13, padding: "10px 20px", borderRadius: 8, border: "none", cursor: "pointer" }}
          >
            Try Again
          </button>
          <Link
            href={homeHref}
            style={{ background: "white", color: "var(--brand-primary)", fontWeight: 700, fontSize: 13, padding: "10px 20px", borderRadius: 8, border: "1px solid #ddd", textDecoration: "none" }}
          >
            {homeLabel}
          </Link>
        </div>
        {error.digest && <p style={{ fontSize: 10.5, color: "#bbb", marginTop: 18, marginBottom: 0 }}>Reference: {error.digest}</p>}
      </div>
    </div>
  );
}
