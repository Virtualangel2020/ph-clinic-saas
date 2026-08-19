import { requireClinicMember } from "@/lib/require-clinic-member";
import { ModulePlaceholder } from "@/components/emr/module-placeholder";

export default async function Page() {
  await requireClinicMember();
  return <ModulePlaceholder title="Security" phase="—" blurb="Password policy, session timeout, and MFA-required roles already exist under the hood (clinic_settings) — a dedicated editor for them is coming soon." />;
}
