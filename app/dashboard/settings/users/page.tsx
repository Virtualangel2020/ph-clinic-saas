import { requireClinicAdmin } from "@/lib/require-clinic-admin";
import { StaffInviteForm } from "./staff-invite-form";
import { PermissionsGrid } from "./permissions-grid";

// Part 63: Clinic Admin manages their own clinic's staff and grants
// granular permissions on top of each role's baseline — instead of every
// account defaulting to full clinic access.
export default async function UsersPage() {
  const { supabase, profile } = await requireClinicAdmin();

  const [{ data: staff }, { data: permissionDefs }] = await Promise.all([
    supabase
      .from("user_profiles")
      .select("id, full_name, role, is_active, created_at")
      .eq("tenant_id", profile.tenant_id)
      .order("created_at"),
    supabase.from("permission_definitions").select("key, label, description, module_key, default_value").order("module_key"),
  ]);

  const staffIds = (staff ?? []).map((s) => s.id);
  const { data: userPermissions } = staffIds.length
    ? await supabase.from("user_permissions").select("user_id, permission_key, is_enabled").in("user_id", staffIds)
    : { data: [] as { user_id: string; permission_key: string; is_enabled: boolean }[] };

  return (
    <div style={{ maxWidth: 880, display: "grid", gap: 24 }}>
      <div>
        <h1 style={{ fontSize: 22, marginBottom: 4 }}>Users & Permissions</h1>
        <p style={{ color: "#666", fontSize: 13 }}>
          Invite staff directly — no need to go through Virtual Angel Systems for every hire. Reception can never
          edit signed notes or prescriptions; grant individual staff exactly what they need.
        </p>
      </div>

      <StaffInviteForm staff={staff ?? []} />

      <PermissionsGrid staff={(staff ?? []).filter((s) => s.role !== "clinic_admin")} permissionDefs={permissionDefs ?? []} userPermissions={userPermissions ?? []} />
    </div>
  );
}
