"use client";

import { PortalErrorBoundary } from "@/components/portal-error-boundary";

export default function BookingError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return <PortalErrorBoundary error={error} reset={reset} message="We couldn't load booking for this provider right now." homeHref="/portal/find-a-doctor" homeLabel="Find a Doctor" />;
}
