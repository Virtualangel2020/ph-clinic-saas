import { requireClinicMember } from "@/lib/require-clinic-member";
import { ModulePlaceholder } from "@/components/emr/module-placeholder";

export default async function Page() {
  await requireClinicMember();
  return <ModulePlaceholder title="Patients" phase="Phase 2" blurb="The full patient chart — demographics, emergency contacts, guardians, visit history, timeline, allergies, and medications — ships in Phase 2." />;
}
