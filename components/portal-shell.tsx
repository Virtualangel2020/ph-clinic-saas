import { getMyCaredeskProfileSelection } from "@/lib/require-patient-portal";
import { PortalShellClient } from "@/components/portal-shell-client";

// Thin async Server Component wrapper: resolves the active MyCareDesk
// profile ONCE per request (React cache() — see
// resolveMyCaredeskProfileSelection) and hands it to the client shell for
// the persistent "Viewing: X" banner. Deliberately resolves this itself
// rather than requiring every page to pass an `activeProfile` prop down —
// a page author who forgets to pass a prop is exactly how "silent fallback
// to the account holder" bugs happen; a shell that always knows on its own
// can't have that failure mode. Every call site keeps working with zero
// changes: `<PortalShell>{children}</PortalShell>` is still the entire API.
export async function PortalShell({ children }: { children: React.ReactNode }) {
  const { activeProfile, selectable } = await getMyCaredeskProfileSelection();

  return (
    <PortalShellClient activeProfile={activeProfile} canSwitch={selectable.length > 1}>
      {children}
    </PortalShellClient>
  );
}
