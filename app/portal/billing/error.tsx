"use client";

import { PortalErrorBoundary } from "@/components/portal-error-boundary";

export default function BillingError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return <PortalErrorBoundary error={error} reset={reset} message="We couldn't load your billing information right now." />;
}
