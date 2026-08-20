import { requireClinicAdmin } from "@/lib/require-clinic-admin";
import { BackLink } from "@/components/back-link";
import { ClinicProfileForm } from "./clinic-profile-form";

// Part 19: ONE clinic profile as the source of truth. Every generated
// document (prescription, referral, etc., once those ship) will read
// clinic_settings directly rather than asking a provider to re-type it.
export default async function ClinicProfilePage() {
  const { supabase } = await requireClinicAdmin();

  const { data: settings } = await supabase
    .from("clinic_settings")
    .select("clinic_name, logo_path, address_line1, address_line2, city, province, postal_code, phone, mobile, email, website")
    .maybeSingle();

  let logoUrl: string | null = null;
  if (settings?.logo_path) {
    const { data } = supabase.storage.from("clinic-logos").getPublicUrl(settings.logo_path);
    logoUrl = data.publicUrl;
  }

  return (
    <div style={{ maxWidth: 640 }}>
      <BackLink href="/dashboard/settings" label="Settings" />
      <h1 style={{ fontSize: 22, marginBottom: 4 }}>Clinic Profile & Branding</h1>
      <p style={{ color: "#666", fontSize: 13, marginBottom: 20 }}>
        This is the one source of truth for your clinic's official details. Once documents (prescriptions,
        referrals, and more) ship, they pull your logo and contact details from here automatically — no one has to
        type them in each time.
      </p>
      <ClinicProfileForm settings={settings ?? null} logoUrl={logoUrl} />
    </div>
  );
}
