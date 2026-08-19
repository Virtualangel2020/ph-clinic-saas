import { requireClinicMember } from "@/lib/require-clinic-member";
import { ModulePlaceholder } from "@/components/emr/module-placeholder";

export default async function Page() {
  await requireClinicMember();
  return <ModulePlaceholder title="Communications" phase="Phase 7" blurb="Email, SMS, and WhatsApp communications ship in Phase 7 — visible here because at least one is part of your plan." />;
}
