import { AllergiesSection } from "./allergies-section";
import { MedicationsSection } from "./medications-section";
import { CareCoordinationSection } from "./care-coordination-section";

// "Patient History" tab — the clinical background/context that isn't tied
// to one visit: allergies, current medications, and who else is involved
// in this patient's care. Encounter-by-encounter history lives in its own
// Encounters tab; this is the standing-facts view.
export function PatientHistoryTab(props: {
  patientId: string;
  allergies: React.ComponentProps<typeof AllergiesSection>["allergies"];
  medications: React.ComponentProps<typeof MedicationsSection>["medications"];
  primaryProvider: React.ComponentProps<typeof CareCoordinationSection>["primaryProvider"];
  sharingPreference: React.ComponentProps<typeof CareCoordinationSection>["sharingPreference"];
}) {
  return (
    <div>
      <CareCoordinationSection patientId={props.patientId} primaryProvider={props.primaryProvider} sharingPreference={props.sharingPreference} />
      <AllergiesSection patientId={props.patientId} allergies={props.allergies} />
      <MedicationsSection patientId={props.patientId} medications={props.medications} />
    </div>
  );
}
