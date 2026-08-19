import { requireClinicMember } from "@/lib/require-clinic-member";
import { ModulePlaceholder } from "@/components/emr/module-placeholder";

export default async function Page() {
  await requireClinicMember();
  return <ModulePlaceholder title="Calendar" phase="Phase 3" blurb="Day/week/month scheduling, walk-ins, multi-provider calendar, and provider availability ship in Phase 3." />;
}
