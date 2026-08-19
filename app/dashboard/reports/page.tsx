import { requireClinicMember } from "@/lib/require-clinic-member";
import { ModulePlaceholder } from "@/components/emr/module-placeholder";

export default async function Page() {
  await requireClinicMember();
  return <ModulePlaceholder title="Reports" phase="Phase 6" blurb="Core operational reports (visits, volume, referrals, HMO vs cash) ship in Phase 6." />;
}
