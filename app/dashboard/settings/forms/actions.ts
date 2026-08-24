"use server";

import { revalidatePath } from "next/cache";
import { requireClinicAdmin } from "@/lib/require-clinic-admin";

// ── Intake / consent form templates ──────────────────────────────────────
// Clinic-defined templates for intake forms and consent/acknowledgement
// documents. fields_config shape depends on category:
//   intake:  [{ key, label, type: "text"|"date"|"select"|"checkbox"|"textarea", required, options? }]
//   consent: [{ key: "body", type: "richtext", label: "Consent Text", value }]
// This is an overlay for print/reference (and a future patient portal) — it
// is not yet wired into savePatientAction's fixed registration fields.

export async function saveIntakeFormTemplateAction(input: {
  id: string | null;
  name: string;
  category: "intake" | "consent" | "other";
  fieldsConfig: any[];
  isActive: boolean;
  isRequired?: boolean;
}) {
  const { supabase } = await requireClinicAdmin();
  const { error } = await supabase.rpc("set_intake_form_template", {
    p_id: input.id,
    p_name: input.name,
    p_category: input.category,
    p_fields_config: input.fieldsConfig,
    p_is_active: input.isActive,
    p_is_required: input.isRequired ?? false,
  });
  if (error) throw new Error(error.message);
  revalidatePath("/dashboard/settings/forms");
}

export async function deleteIntakeFormTemplateAction(id: string) {
  const { supabase } = await requireClinicAdmin();
  const { error } = await supabase.rpc("delete_intake_form_template", { p_id: id });
  if (error) throw new Error(error.message);
  revalidatePath("/dashboard/settings/forms");
}

// Duplicate an existing template so an admin can build a variant without
// disturbing the original's version history. New copy starts inactive.
export async function duplicateIntakeFormTemplateAction(id: string) {
  const { supabase } = await requireClinicAdmin();
  const { data, error } = await supabase.rpc("duplicate_intake_form_template", { p_id: id });
  if (error) throw new Error(error.message);
  revalidatePath("/dashboard/settings/forms");
  return data as string;
}

// Assign a template directly to a patient from the template library — the
// exact same assign_form_to_patient RPC the patient chart's Forms tab
// calls (app/dashboard/patients/actions.ts), just reachable from a second
// place per spec §39-43. Same patient_forms rows either way.
export async function assignTemplateToPatientFromSettingsAction(templateId: string, patientId: string) {
  const { supabase } = await requireClinicAdmin();
  const { error } = await supabase.rpc("assign_form_to_patient", {
    p_patient_id: patientId,
    p_template_id: templateId,
    p_is_required: null,
  });
  if (error) throw new Error(error.message);
  revalidatePath(`/dashboard/patients/${patientId}`);
}
