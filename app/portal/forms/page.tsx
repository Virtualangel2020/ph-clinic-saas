import { requirePatientPortal } from "@/lib/require-patient-portal";
import { PortalShell } from "@/components/portal-shell";
import { PortalFormsClient } from "./portal-forms-client";

// My Forms (spec §13-15) — the patient-facing half of the Patient Forms
// add-on. Same patient_forms rows the chart's Forms tab shows; a patient
// here can only see and complete their OWN, via patient_forms_portal_read
// RLS + the complete_patient_form RPC's portal-account branch.
export default async function PortalFormsPage() {
  const { supabase, account } = await requirePatientPortal();
  const patientId = (account as any).patient_id;
  const tenantId = (account as any).tenant_id;

  const [{ data: forms }, { data: entitlement }] = await Promise.all([
    supabase.from("patient_forms").select("*").eq("patient_id", patientId).order("assigned_at", { ascending: false }),
    supabase.from("tenant_entitlements").select("feature_key").eq("tenant_id", tenantId).eq("feature_key", "forms_acknowledgements").eq("status", "active").maybeSingle(),
  ]);

  return (
    <PortalShell>
      <h1 style={{ fontSize: 20, marginBottom: 4 }}>My Forms</h1>
      <p style={{ color: "#666", fontSize: 13, marginBottom: 16 }}>Intake, consent, and history forms your clinic has asked you to complete.</p>
      {entitlement ? (
        <PortalFormsClient forms={(forms as any) ?? []} />
      ) : (
        <p style={{ color: "#999", fontSize: 12.5 }}>No forms have been assigned to you.</p>
      )}
    </PortalShell>
  );
}
