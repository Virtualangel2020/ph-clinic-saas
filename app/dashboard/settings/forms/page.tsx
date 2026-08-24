import { requireClinicAdmin } from "@/lib/require-clinic-admin";
import { BackLink } from "@/components/back-link";
import { FormTemplatesClient } from "./forms-client";

// Forms & Registration template builder. Clinic Admins define the fields
// their clinic wants captured on intake forms, and the text used on consent
// / acknowledgement documents. This is a configurable OVERLAY for now — it
// does NOT yet drive the actual in-app patient registration form
// (savePatientAction in app/dashboard/patients/actions.ts still uses its own
// fixed field set) or a patient-facing portal. Wiring intake templates into
// registration is a larger integration left for later; this page only sets
// up the templates for printing/reference ahead of that.
export default async function FormsSettingsPage() {
  const { supabase, profile } = await requireClinicAdmin();

  const [{ data: templates }, { data: entitlement }, { data: clinicSettings }] = await Promise.all([
    supabase
      .from("intake_form_templates")
      .select("id, name, category, fields_config, is_active, version, is_required")
      .eq("tenant_id", profile.tenant_id)
      .order("created_at"),
    supabase
      .from("tenant_entitlements")
      .select("feature_key")
      .eq("tenant_id", profile.tenant_id)
      .eq("feature_key", "forms_acknowledgements")
      .eq("status", "active")
      .maybeSingle(),
    supabase
      .from("clinic_settings")
      .select("clinic_name, logo_path, address_line1, address_line2, city, province, postal_code, phone, mobile, email")
      .maybeSingle(),
  ]);

  let logoUrl: string | null = null;
  if (clinicSettings?.logo_path) {
    const { data } = supabase.storage.from("clinic-logos").getPublicUrl(clinicSettings.logo_path);
    logoUrl = data.publicUrl;
  }
  const clinicName = clinicSettings?.clinic_name || "Your Clinic Name";
  const addressLine = [clinicSettings?.address_line1, clinicSettings?.address_line2, clinicSettings?.city, clinicSettings?.province, clinicSettings?.postal_code].filter(Boolean).join(", ");
  const contactLine = [clinicSettings?.phone || clinicSettings?.mobile, clinicSettings?.email].filter(Boolean).join(" · ");

  return (
    <div style={{ maxWidth: 1180 }}>
      <BackLink href="/dashboard/settings" label="Settings" />
      <h1 style={{ fontSize: 22, marginBottom: 4 }}>Forms & Registration</h1>
      <p style={{ color: "#666", fontSize: 13, marginBottom: 20 }}>
        Define the intake and consent form templates your clinic uses. These are for printing and reference, and —
        on plans with Patient Forms enabled — can be assigned directly to a patient's chart or Patient Portal for
        them to complete electronically. They don't auto-generate the in-app "New Patient" form, which currently
        uses its own fixed set of fields.
      </p>
      {!entitlement && (
        <div style={{ background: "#fff7e6", border: "1px solid #e6c66b", borderRadius: 10, padding: "12px 16px", fontSize: 12.5, color: "#7a5c12", marginBottom: 18 }}>
          Patient Forms (assigning these to a patient's chart or Patient Portal) isn&apos;t included on this clinic&apos;s
          current plan yet — templates below can still be built and printed for reference. Reach out to Virtual
          Angel Systems to add the full add-on.
        </div>
      )}
      <FormTemplatesClient
        initialTemplates={(templates as any) ?? []}
        canAssign={!!entitlement}
        clinicName={clinicName}
        logoUrl={logoUrl}
        addressLine={addressLine}
        contactLine={contactLine}
      />
    </div>
  );
}
