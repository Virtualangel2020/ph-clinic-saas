"use server";

import { revalidatePath } from "next/cache";
import { requireClinicAdmin } from "@/lib/require-clinic-admin";

// ── Progress note templates ──────────────────────────────────────────────
// patient_progress_notes has FIXED columns (subjective, objective,
// assessment, plan) — there is no flexible/jsonb storage for note content
// itself. So `sections` here always has exactly 4 entries, one per fixed
// column, and only relabels/reprompts them (label + placeholder) rather
// than defining new fields. `based_on` is just a style label
// (soap/expanded/custom) for the admin's own reference.

export async function saveNoteTemplateAction(input: {
  id: string | null;
  name: string;
  basedOn: "soap" | "expanded" | "custom";
  sections: { key: string; label: string; placeholder: string }[];
  isDefault: boolean;
  isActive: boolean;
}) {
  const { supabase } = await requireClinicAdmin();
  const { error } = await supabase.rpc("set_note_template", {
    p_id: input.id,
    p_name: input.name,
    p_based_on: input.basedOn,
    p_sections: input.sections,
    p_is_default: input.isDefault,
    p_is_active: input.isActive,
  });
  if (error) throw new Error(error.message);
  revalidatePath("/dashboard/settings/note-templates");
}

export async function deleteNoteTemplateAction(id: string) {
  const { supabase } = await requireClinicAdmin();
  const { error } = await supabase.rpc("delete_note_template", { p_id: id });
  if (error) throw new Error(error.message);
  revalidatePath("/dashboard/settings/note-templates");
}
