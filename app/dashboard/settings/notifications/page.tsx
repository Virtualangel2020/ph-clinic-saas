import { requireClinicMember } from "@/lib/require-clinic-member";
import { ModulePlaceholder } from "@/components/emr/module-placeholder";

export default async function Page() {
  await requireClinicMember();
  return <ModulePlaceholder title="Notifications" phase="Phase 6" blurb="Configuring which events raise an alert ships alongside Alerts in Phase 6." />;
}
