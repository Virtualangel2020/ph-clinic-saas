import { requireClinicMember } from "@/lib/require-clinic-member";
import { ModulePlaceholder } from "@/components/emr/module-placeholder";

// This route is no longer linked from the nav — per user decision, patient
// alerts (ECW-style red/yellow/blue sticky notes) moved into each
// patient's own chart instead of a global list, since an alert is only
// ever useful in the context of the specific patient it's about. Kept
// alive (not deleted) so an old bookmark/link doesn't 404.
export default async function Page() {
  await requireClinicMember();
  return (
    <ModulePlaceholder
      title="Alerts"
      phase="Moved"
      blurb="Patient alerts now live inside each patient's own chart as sticky notes at the top of the record (red = clinical/safety, yellow = billing/administrative, blue = general) — open a patient to view or add one, instead of a shared list here."
      backHref="/dashboard/patients"
      backLabel="Patients"
    />
  );
}
