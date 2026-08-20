import { requireClinicMember } from "@/lib/require-clinic-member";
import { ModulePlaceholder } from "@/components/emr/module-placeholder";

export default async function Page() {
  await requireClinicMember();
  return <ModulePlaceholder title="Schedules" phase="Phase 3" blurb="Provider working hours, breaks, blocked time, and leave configuration ship with Scheduling in Phase 3." backHref="/dashboard/settings" backLabel="Settings" />;
}
