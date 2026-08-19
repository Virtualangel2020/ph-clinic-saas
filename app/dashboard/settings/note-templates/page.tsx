import { requireClinicMember } from "@/lib/require-clinic-member";
import { ModulePlaceholder } from "@/components/emr/module-placeholder";

export default async function Page() {
  await requireClinicMember();
  return <ModulePlaceholder title="Progress Note Templates" phase="Phase 3" blurb="The SOAP/Expanded/Custom note template builder ships with Encounters in Phase 3." />;
}
