import { requireClinicAdmin } from "@/lib/require-clinic-admin";
import { BackLink } from "@/components/back-link";
import { MedicalCertificateTemplateForm } from "./medical-certificate-template-form";

// Part 35-38: Medical Certificate is CORE (not an add-on). This is the
// template builder half of it — Clinic Admin sets up the fields, clinic
// branding + provider credentials auto-populate at issuance time. Actual
// issuance (picking a patient, filling it out, generating a numbered,
// signed PDF, voiding one issued in error) lives in each patient's chart
// under Clinical > Certificates — see migration
// medical_certificate_issuance and certificates-section.tsx.
export default async function MedicalCertificatesSettingsPage() {
  const { supabase, profile } = await requireClinicAdmin();

  const [{ data: templates }, { data: clinicSettings }, { data: providerProfile }, { data: signature }] = await Promise.all([
    supabase.from("medical_certificate_templates").select("id, name, based_on, fields_config, is_active").eq("tenant_id", profile.tenant_id).order("created_at"),
    supabase
      .from("clinic_settings")
      .select("clinic_name, logo_path, address_line1, address_line2, city, province, postal_code, phone, mobile, email")
      .maybeSingle(),
    supabase.from("user_profiles").select("title, prc_license, ptr_number").eq("id", profile.id).maybeSingle(),
    supabase.from("provider_signatures").select("signature_path").eq("user_id", profile.id).eq("status", "approved").order("reviewed_at", { ascending: false }).limit(1).maybeSingle(),
  ]);

  let logoUrl: string | null = null;
  if (clinicSettings?.logo_path) {
    const { data } = supabase.storage.from("clinic-logos").getPublicUrl(clinicSettings.logo_path);
    logoUrl = data.publicUrl;
  }
  let signatureImageUrl: string | null = null;
  if (signature?.signature_path) {
    const { data } = await supabase.storage.from("provider-signatures").createSignedUrl(signature.signature_path, 3600);
    signatureImageUrl = data?.signedUrl ?? null;
  }
  const clinicName = clinicSettings?.clinic_name || "Your Clinic Name";
  const addressLine = [clinicSettings?.address_line1, clinicSettings?.address_line2, clinicSettings?.city, clinicSettings?.province, clinicSettings?.postal_code].filter(Boolean).join(", ");
  const contactLine = [clinicSettings?.phone || clinicSettings?.mobile, clinicSettings?.email].filter(Boolean).join(" · ");
  const providerName = [providerProfile?.title, profile.full_name].filter(Boolean).join(" ") || profile.full_name || "";
  const providerCredentials = [providerProfile?.prc_license ? `PRC ${providerProfile.prc_license}` : null, providerProfile?.ptr_number ? `PTR ${providerProfile.ptr_number}` : null].filter(Boolean).join(" · ") || null;

  return (
    <div style={{ maxWidth: 1180 }}>
      <BackLink href="/dashboard/settings" label="Settings" />
      <h1 style={{ fontSize: 22, marginBottom: 4 }}>Medical Certificates</h1>
      <p style={{ color: "#666", fontSize: 13, marginBottom: 20 }}>
        Set up your certificate template now. Clinic branding and the issuing provider's credentials/signature will
        auto-populate every certificate once issuance is available — you won't re-enter them per patient.
      </p>
      <div style={{ background: "#eaf7ee", border: "1px solid #bfe6c9", borderRadius: 10, padding: "12px 16px", fontSize: 12.5, color: "#1a7f37", marginBottom: 20 }}>
        Issuing is live — open any patient's chart, go to Clinical → Certificates, and issue against a template
        below. Each certificate gets its own number and PDF, and can be voided (but never deleted) if issued in
        error.
      </div>
      <MedicalCertificateTemplateForm
        initialTemplates={(templates as any) ?? []}
        clinicName={clinicName}
        logoUrl={logoUrl}
        addressLine={addressLine}
        contactLine={contactLine}
        providerName={providerName}
        providerCredentials={providerCredentials}
        signatureImageUrl={signatureImageUrl}
      />
    </div>
  );
}
