import { requireClinicMember } from "@/lib/require-clinic-member";
import { ModulePlaceholder } from "@/components/emr/module-placeholder";

export default async function Page() {
  await requireClinicMember();
  return <ModulePlaceholder title="Documents" phase="Phase 4" blurb="The structured per-patient document center ships in Phase 4." />;
}
