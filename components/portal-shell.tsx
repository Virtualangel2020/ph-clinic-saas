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
//
// Hardened as part of the Find a Doctor crash investigation (Digest
// 800866611): this is the ONE component every single /portal/* page
// renders, and it previously had zero error handling of its own — a
// hiccup in get_my_mycaredesk_account/get_my_mycaredesk_family (or the
// per-profile signed-photo-URL lookup) would throw during this component's
// render, which no page-level try/catch could ever see (see
// portal-error-boundary.tsx for the full explanation of why not). The new
// app/portal/error.tsx boundary is real protection now, but there's no
// reason this specific, extremely-high-traffic component should ever need
// to fall back on that — it degrades to "no Viewing banner, plain nav"
// instead of taking the whole page down. Every page still renders and
// still works while this is degraded; only the persistent "Viewing: X"
// banner (and Switch Profile) is temporarily unavailable.
export async function PortalShell({ children }: { children: React.ReactNode }) {
  let activeProfile = null;
  let canSwitch = false;
  try {
    const selection = await getMyCaredeskProfileSelection();
    activeProfile = selection.activeProfile;
    canSwitch = selection.selectable.length > 1;
  } catch (err) {
    console.error("[PortalShell] PROFILE_RESOLUTION_FAILED — rendering degraded shell (no Viewing banner):", err);
  }

  return (
    <PortalShellClient activeProfile={activeProfile} canSwitch={canSwitch}>
      {children}
    </PortalShellClient>
  );
}
