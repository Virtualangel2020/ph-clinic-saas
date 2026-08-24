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
}) {
  const { supabase } = await requireClinicAdmin();
  const { error } = await supabase.rpc("set_intake_form_template", {
    p_id: input.id,
    p_name: input.name,
    p_category: input.category,
    p_fields_config: input.fieldsConfig,
    p_is_active: input.isActive,
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
