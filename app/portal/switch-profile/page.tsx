import { redirect } from "next/navigation";
import { PortalShell } from "@/components/portal-shell";
import { getMyCaredeskProfileSelection } from "@/lib/require-patient-portal";
import { ProfileChooser } from "@/app/portal/profile-chooser";

// Family Profiles Phase 1.6/1.7: the destination requirePatientPortal()
// redirects every /portal/* page to whenever a login can reach more than
// one MyCareDesk profile and no mcd_active_profile cookie is set yet — the
// actual "Netflix-style" post-login landing state, per spec. Also reachable
// any time afterward via "Switch Profile" in the portal shell's Viewing
// banner, which is why this deliberately does NOT call requirePatientPortal()
// itself (that would redirect straight back here in a loop the moment a
// profile is already active) — it resolves the raw selectable list instead
// and renders the chooser regardless of whether a choice has already been
// made.
export default async function SwitchProfilePage() {
  const { user, selectable } = await getMyCaredeskProfileSelection();
  if (!user) redirect("/portal/login");

  // No MyCareDesk platform identity at all yet — nothing to choose between.
  // Send them back to the portal, which already handles the 0-profile case
  // gracefully on its own.
  if (selectable.length === 0) redirect("/portal");

  return (
    <PortalShell>
      <ProfileChooser selectable={selectable} />
    </PortalShell>
  );
}
