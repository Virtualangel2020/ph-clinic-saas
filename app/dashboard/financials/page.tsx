import { requireClinicMember } from "@/lib/require-clinic-member";
import { ModulePlaceholder } from "@/components/emr/module-placeholder";

export default async function Page() {
  await requireClinicMember();
  return <ModulePlaceholder title="Financials" phase="Phase 7" blurb="The Financial Tracker add-on ships in Phase 7 — visible here because it's part of your plan." />;
}
