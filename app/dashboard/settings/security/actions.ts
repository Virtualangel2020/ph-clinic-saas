"use server";

import { revalidatePath } from "next/cache";
import { requireClinicAdmin } from "@/lib/require-clinic-admin";

// Clinic-wide security policy (password minimum length, session timeout,
// MFA-required roles). set_clinic_security() does the real validation
// (password length 8-64, timeout 5-1440 minutes) and raises a friendly
// Postgres exception on bad input — we just surface error.message.
export async function saveClinicSecurityAction(
  mfaRequiredRoles: string[],
  passwordMinLength: number,
  sessionTimeoutMinutes: number | null
) {
  const { supabase } = await requireClinicAdmin();

  const { error } = await supabase.rpc("set_clinic_security", {
    p_mfa_required_roles: mfaRequiredRoles,
    p_password_min_length: passwordMinLength,
    p_session_timeout_minutes: sessionTimeoutMinutes,
  });
  if (error) throw new Error(error.message);

  revalidatePath("/dashboard/settings/security");
}
