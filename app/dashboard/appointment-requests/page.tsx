import { requireClinicMember } from "@/lib/require-clinic-member";
import { ModulePlaceholder } from "@/components/emr/module-placeholder";

// The "A" jellybean was repurposed from Alerts to Appointment Requests
// (patient alerts moved into each patient's own chart as sticky notes —
// see PatientAlertsBanner). This is where patients' portal-submitted
// requests to book/reschedule will land for staff to accept, propose a
// different time, or decline — never auto-confirmed. The underlying table
// (patient_appointment_requests) already exists so the jellybean count is
// real; the request-submission flow itself is Phase 7 of the scheduling
// upgrade.
export default async function Page() {
  await requireClinicMember();
  return (
    <ModulePlaceholder
      title="Appointment Requests"
      phase="Phase 7"
      blurb="Appointment requests submitted by patients through the Patient Portal will land here for staff to accept, propose a different time, or decline — a request is never auto-confirmed. This ships alongside the rest of the Patient Portal appointment-booking workflow."
    />
  );
}
