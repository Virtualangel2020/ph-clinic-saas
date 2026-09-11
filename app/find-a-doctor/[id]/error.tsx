"use client";

import { PortalErrorBoundary } from "@/components/portal-error-boundary";

export default function PublicProviderProfileError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return <PortalErrorBoundary error={error} reset={reset} message="We couldn't load this provider's profile right now." homeHref="/find-a-doctor" homeLabel="Find a Doctor" />;
}
