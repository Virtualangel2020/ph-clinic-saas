import { requirePatientPortal } from "@/lib/require-patient-portal";
import { PortalShell } from "@/components/portal-shell";
import { BackLink } from "@/components/back-link";
import { FamilyList, type ManagerRow } from "./family-list";

// Family Profiles Phase 1.10 — "My Family": every profile this login can
// select (self + active co-managed dependents), each with its avatar, who
// else manages it, an [Open] shortcut into that profile's whole portal,
// and per-person photo management. Deliberately NOT added to the top-level
// portal nav (spec Part 23's six-tab nav is intentionally fixed) — reached
// from the Profile page's Family/Dependents section and from the profile
// chooser/Viewing banner's "Manage Family" link instead.
export default async function MyFamilyPage() {
  const { supabase, selectable, activeAccountId } = await requirePatientPortal();

  const entries = await Promise.all(
    selectable.map(async (p) => {
      const { data } = await supabase.rpc("get_mycaredesk_account_managers", { p_account_id: p.accountId });
      return [p.accountId, (data as ManagerRow[]) ?? []] as const;
    })
  );
  const managersByAccount = Object.fromEntries(entries);

  return (
    <PortalShell>
      <BackLink href="/portal/profile" label="Profile" />
      <h1 style={{ fontSize: 22, marginBottom: 4 }}>My Family</h1>
      <p style={{ color: "#666", fontSize: 13, marginBottom: 20 }}>
        Everyone you can view or manage on MyCareDesk. Open a profile to see their portal, or add someone new.
      </p>
      <FamilyList selectable={selectable} activeAccountId={activeAccountId} managersByAccount={managersByAccount} />
    </PortalShell>
  );
}
