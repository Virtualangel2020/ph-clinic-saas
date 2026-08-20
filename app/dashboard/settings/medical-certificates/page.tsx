import { requireClinicAdmin } from "@/lib/require-clinic-admin";
import { BackLink } from "@/components/back-link";
import { MedicalCertificateTemplateForm } from "./medical-certificate-template-form";

// Part 35-38: Medical Certificate is CORE (not an add-on). This is the
// template builder half of it — Clinic Admin sets up the fields, clinic
// branding + provider credentials auto-populate at issuance time. Actual
// issuance (picking a patient, filling it out, finalize-and-lock,
// amendment/reissue) is blocked on the patient/encounter chart existing
// (Phase 2) — that part is NOT built yet, this page only covers setup.
export default async function MedicalCertificatesSettingsPage() {
  const { supabase, profile } = await requireClinicAdmin();

  const { data: templates } = await supabase
    .from("medical_certificate_templates")
    .select("id, name, based_on, fields_config, is_active")
    .eq("tenant_id", profile.tenant_id)
    .order("created_at");

  return (
    <div style={{ maxWidth: 720 }}>
      <BackLink href="/dashboard/settings" label="Settings" />
      <h1 style={{ fontSize: 22, marginBottom: 4 }}>Medical Certificates</h1>
      <p style={{ color: "#666", fontSize: 13, marginBottom: 20 }}>
        Set up your certificate template now. Clinic branding and the issuing provider's credentials/signature will
        auto-populate every certificate once issuance is available — you won't re-enter them per patient.
      </p>
      <div style={{ background: "#fff7e6", border: "1px solid #e6c66b", borderRadius: 10, padding: "12px 16px", fontSize: 12.5, color: "#7a5c12", marginBottom: 20 }}>
        Issuing an actual certificate for a patient isn't available yet — that depends on the patient chart, which
        is coming in a later phase. This page only sets up the template ahead of time.
      </div>
      <MedicalCertificateTemplateForm initialTemplates={(templates as any) ?? []} />
    </div>
  );
}
