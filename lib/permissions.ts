import type { SupabaseClient } from "@supabase/supabase-js";

// Receptionist-level roles ("reception" in the app_role enum) are
// restricted from clinical note content (SOAP narrative + vitals) by
// default — spec: "Do not allow receptionist-level roles to access
// clinical note content unless their clinic role specifically permits
// it." Gated via the encounters.view_clinical_content permission key
// (default false), so a specific reception user can be individually
// granted access via Settings > Users without changing their role.
//
// Every other role (doctor, clinic_admin, staff, platform_admin) is
// unaffected — this only ever restricts "reception".
export async function canViewClinicalContent(supabase: SupabaseClient, userId: string, role: string): Promise<boolean> {
  if (role !== "reception") return true;
  const { data } = await supabase.rpc("user_has_permission", { p_user_id: userId, p_key: "encounters.view_clinical_content" });
  return !!data;
}
