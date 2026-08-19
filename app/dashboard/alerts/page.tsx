import { requireClinicMember } from "@/lib/require-clinic-member";
import { ModulePlaceholder } from "@/components/emr/module-placeholder";

export default async function Page() {
  await requireClinicMember();
  return <ModulePlaceholder title="Alerts" phase="Phase 6" blurb="Clinical/administrative alerts (allergy warnings, unsigned notes, overdue follow-ups) ship in Phase 6." />;
}
