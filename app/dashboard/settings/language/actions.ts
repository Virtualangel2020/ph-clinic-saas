"use server";

import { revalidatePath } from "next/cache";
import { requireClinicMember } from "@/lib/require-clinic-member";

export async function saveLanguagePreferenceAction(language: "en" | "fil") {
  const { supabase } = await requireClinicMember();
  const { error } = await supabase.rpc("set_user_preferences", { p_theme: null, p_language: language });
  if (error) throw new Error(error.message);
  revalidatePath("/dashboard/settings/language");
}
