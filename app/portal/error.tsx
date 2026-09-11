"use client";

import { PortalErrorBoundary } from "@/components/portal-error-boundary";

// Portal-wide safety net. Catches anything not caught by a more specific
// error.tsx further down the tree — including an exception thrown inside
// <PortalShell> itself (its active-profile resolution runs on every single
// /portal/* page; before this file existed, a bug there had nowhere to be
// caught and fell straight through to Next's generic crash page). See
// components/portal-error-boundary.tsx for the full explanation.
export default function PortalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return <PortalErrorBoundary error={error} reset={reset} message="We couldn't load this page right now." />;
}
