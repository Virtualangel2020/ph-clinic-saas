import { requireClinicMember } from "@/lib/require-clinic-member";
import { ModulePlaceholder } from "@/components/emr/module-placeholder";

export default async function Page() {
  await requireClinicMember();
  return <ModulePlaceholder title="Appearance" phase="Phase 8" blurb="Light/Dark/System theme, persisted per account, ships in a later polish phase." />;
}
