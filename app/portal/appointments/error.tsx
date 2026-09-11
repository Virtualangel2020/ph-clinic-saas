"use client";

import { PortalErrorBoundary } from "@/components/portal-error-boundary";

export default function AppointmentsError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return <PortalErrorBoundary error={error} reset={reset} message="We couldn't load your appointments right now." />;
}
