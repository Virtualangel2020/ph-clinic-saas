import { requireClinicMember } from "@/lib/require-clinic-member";
import { ModulePlaceholder } from "@/components/emr/module-placeholder";

export default async function Page() {
  await requireClinicMember();
  return <ModulePlaceholder title="Prescriptions" phase="Phase 4" blurb="The prescription generator, pulling clinic branding and provider credentials automatically, ships alongside Orders/Results in Phase 4." />;
}
