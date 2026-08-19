import { requireClinicMember } from "@/lib/require-clinic-member";
import { ModulePlaceholder } from "@/components/emr/module-placeholder";

export default async function Page() {
  await requireClinicMember();
  return <ModulePlaceholder title="Referral Directory Profile" phase="Phase 5" blurb="Your clinic's public referral-network listing (specialty, accepting referrals, contact) ships with Referrals in Phase 5." />;
}
