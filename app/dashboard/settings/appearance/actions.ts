"use server";

import { revalidatePath } from "next/cache";
import { requireClinicMember } from "@/lib/require-clinic-member";

// Personal preference, not a clinic-wide policy — any signed-in clinic
// member sets their own. Calls the shared set_user_preferences RPC (also
// used by the Language settings page) with the other field left
// unchanged (RPC coalesces a null param to the existing value).
export async function saveThemePreferenceAction(theme: "light" | "dark" | "system") {
  const { supabase } = await requireClinicMember();
  const { error } = await supabase.rpc("set_user_preferences", { p_theme: theme, p_language: null });
  if (error) throw new Error(error.message);
  revalidatePath("/dashboard", "layout");
}
