import { requireClinicAdmin } from "@/lib/require-clinic-admin";
import { BackLink } from "@/components/back-link";
import { FormTemplatesClient } from "./forms-client";

// Forms & Registration template builder. Clinic Admins define the fields
// their clinic wants captured on intake forms, and the text used on consent
// / acknowledgement documents. This is a configurable OVERLAY for now — it
// does NOT yet drive the actual in-app patient registration form
// (savePatientAction in app/dashboard/patients/actions.ts still uses its own
// fixed field set) or a patient-facing portal. Wiring intake templates into
// registration is a larger integration left for later; this page only sets
// up the templates for printing/reference ahead of that.
export default async function FormsSettingsPage() {
  const { supabase, profile } = await requireClinicAdmin();

  const { data: templates } = await supabase
    .from("intake_form_templates")
    .select("id, name, category, fields_config, is_active")
    .eq("tenant_id", profile.tenant_id)
    .order("created_at");

  return (
    <div style={{ maxWidth: 760 }}>
      <BackLink href="/dashboard/settings" label="Settings" />
      <h1 style={{ fontSize: 22, marginBottom: 4 }}>Forms & Registration</h1>
      <p style={{ color: "#666", fontSize: 13, marginBottom: 20 }}>
        Define the intake and consent form templates your clinic uses. These are for printing and reference — and for
        the patient portal once that's available — but they don't yet auto-generate the in-app "New Patient" form,
        which currently uses its own fixed set of fields.
      </p>
      <FormTemplatesClient initialTemplates={(templates as any) ?? []} />
    </div>
  );
}
