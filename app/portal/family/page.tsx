import { requirePatientPortal } from "@/lib/require-patient-portal";
import { PortalShell } from "@/components/portal-shell";
import { BackLink } from "@/components/back-link";
import { FamilyList, type ManagerRow } from "./family-list";
import { HouseholdPanel, type LinkRequestRow, type LinkedAdultRow, type DependentOption } from "./household-panel";

// Family Profiles Phase 1.10 — "My Family": every profile this login can
// select (self + active co-managed dependents), each with its avatar, who
// else manages it, an [Open] shortcut into that profile's whole portal,
// and per-person photo management. Deliberately NOT added to the top-level
// portal nav (spec Part 23's six-tab nav is intentionally fixed) — reached
// from the Profile page's Family/Dependents section and from the profile
// chooser/Viewing banner's "Manage Family" link instead.
//
// Phase 2 (first slice): also the home for household linking — connecting
// to another adult's own separate MyCareDesk login by their Patient ID
// (with an accept/decline step on their end), and then, once linked,
// explicitly sharing access to specific family members with them. Linking
// alone grants nothing — see household-panel.tsx.
export default async function MyFamilyPage() {
  const { supabase, selectable, activeAccountId } = await requirePatientPortal();

  const [entries, { data: myAccount }, { data: requests }, { data: linkedAdults }] = await Promise.all([
    Promise.all(
      selectable.map(async (p) => {
        const { data } = await supabase.rpc("get_mycaredesk_account_managers", { p_account_id: p.accountId });
        return [p.accountId, (data as ManagerRow[]) ?? []] as const;
      })
    ),
    supabase.rpc("get_my_mycaredesk_account"),
    supabase.rpc("patient_list_my_adult_link_requests"),
    supabase.rpc("get_my_mycaredesk_linked_adults"),
  ]);
  const managersByAccount = Object.fromEntries(entries);

  const dependents: DependentOption[] = selectable.filter((p) => !p.isSelf).map((p) => ({ accountId: p.accountId, firstName: p.firstName, lastName: p.lastName }));

  return (
    <PortalShell>
      <BackLink href="/portal/profile" label="Profile" />
      <h1 style={{ fontSize: 22, marginBottom: 4 }}>My Family</h1>
      <p style={{ color: "#666", fontSize: 13, marginBottom: 20 }}>
        Everyone you can view or manage on MyCareDesk. Open a profile to see their portal, or add someone new.
      </p>
      <FamilyList selectable={selectable} activeAccountId={activeAccountId} managersByAccount={managersByAccount} />

      <div style={{ marginTop: 28 }}>
        <h2 style={{ fontSize: 15, marginBottom: 4 }}>Household</h2>
        <p style={{ color: "#666", fontSize: 12.5, marginBottom: 14 }}>
          Link to another adult's own MyCareDesk account (like a spouse) so you can share access to family members with each other. Linking never shares your own record —
          only what you explicitly choose to share.
        </p>
        <HouseholdPanel
          myPatientNumber={(myAccount as any)?.patient_number ?? null}
          requests={(requests as LinkRequestRow[]) ?? []}
          linkedAdults={(linkedAdults as LinkedAdultRow[]) ?? []}
          dependents={dependents}
          managersByAccount={managersByAccount}
        />
      </div>
    </PortalShell>
  );
}
