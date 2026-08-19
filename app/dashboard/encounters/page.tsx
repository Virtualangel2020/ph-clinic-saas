import { requireClinicMember } from "@/lib/require-clinic-member";
import { ModulePlaceholder } from "@/components/emr/module-placeholder";

export default async function Page() {
  await requireClinicMember();
  return <ModulePlaceholder title="Encounters" phase="Phase 3" blurb="The single encounter workspace — vitals, progress notes, orders, prescriptions, and referrals without leaving the patient — ships in Phase 3." />;
}
