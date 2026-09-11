"use client";

import { PortalErrorBoundary } from "@/components/portal-error-boundary";

export default function ProviderProfileError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return <PortalErrorBoundary error={error} reset={reset} message="We couldn't load this provider's profile right now." homeHref="/portal/find-a-doctor" homeLabel="Find a Doctor" />;
}
