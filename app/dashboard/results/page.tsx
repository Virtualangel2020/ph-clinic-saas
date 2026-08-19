import { requireClinicMember } from "@/lib/require-clinic-member";
import { ModulePlaceholder } from "@/components/emr/module-placeholder";

export default async function Page() {
  await requireClinicMember();
  return <ModulePlaceholder title="Results" phase="Phase 4" blurb="Result upload, review, and patient-notified status ship in Phase 4." />;
}
