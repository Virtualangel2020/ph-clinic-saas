import { requireClinicMember } from "@/lib/require-clinic-member";
import { ModulePlaceholder } from "@/components/emr/module-placeholder";

export default async function Page() {
  await requireClinicMember();
  return <ModulePlaceholder title="Patient Portal" phase="Phase 7" blurb="Patient-facing accounts, messaging, and requests ship as an add-on in Phase 7 — visible here because it's part of your plan." />;
}
