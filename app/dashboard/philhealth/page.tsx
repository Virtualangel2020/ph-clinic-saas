import { requireClinicMember } from "@/lib/require-clinic-member";
import { ModulePlaceholder } from "@/components/emr/module-placeholder";

export default async function Page() {
  await requireClinicMember();
  return <ModulePlaceholder title="PhilHealth" phase="Phase 2" blurb="PhilHealth management ships alongside the patient chart in Phase 2." />;
}
