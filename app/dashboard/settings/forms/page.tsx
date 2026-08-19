import { requireClinicMember } from "@/lib/require-clinic-member";
import { ModulePlaceholder } from "@/components/emr/module-placeholder";

export default async function Page() {
  await requireClinicMember();
  return <ModulePlaceholder title="Forms & Registration" phase="Phase 2" blurb="Patient registration form builder and starter consent/acknowledgement forms ship in Phase 2." />;
}
