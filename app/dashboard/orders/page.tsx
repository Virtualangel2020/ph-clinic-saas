import { requireClinicMember } from "@/lib/require-clinic-member";
import { ModulePlaceholder } from "@/components/emr/module-placeholder";

export default async function Page() {
  await requireClinicMember();
  return <ModulePlaceholder title="Orders" phase="Phase 4" blurb="Lab, imaging, procedure, and referral orders ship in Phase 4." />;
}
