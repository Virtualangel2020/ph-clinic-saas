import { requireClinicAdmin } from "@/lib/require-clinic-admin";
import { BackLink } from "@/components/back-link";
import { SecurityForm } from "./security-form";

// Clinic-wide security policy — admin-only, mirrors clinic-profile's
// server-component-reads-then-hands-to-client-form pattern.
export default async function SecurityPage() {
  const { supabase } = await requireClinicAdmin();

  const { data: settings } = await supabase
    .from("clinic_settings")
    .select("mfa_required_roles, password_min_length, session_timeout_minutes")
    .maybeSingle();

  return (
    <div style={{ maxWidth: 640 }}>
      <BackLink href="/dashboard/settings" label="Settings" />
      <h1 style={{ fontSize: 22, marginBottom: 4 }}>Security</h1>
      <p style={{ color: "#666", fontSize: 13, marginBottom: 20 }}>
        Set the password and session policy for everyone in your clinic, and choose which roles must have
        multi-factor authentication enabled. Changes here apply going forward — they don't retroactively log out
        anyone who's already signed in.
      </p>
      <SecurityForm settings={settings ?? null} />
    </div>
  );
}
