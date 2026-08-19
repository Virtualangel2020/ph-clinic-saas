import { requireClinicMember } from "@/lib/require-clinic-member";
import { ModulePlaceholder } from "@/components/emr/module-placeholder";

export default async function Page() {
  await requireClinicMember();
  return <ModulePlaceholder title="Referrals" phase="Phase 5" blurb="The provider directory and internal/external referral workflow — search, select records, patient authorization, tracking — ships in Phase 5." />;
}
