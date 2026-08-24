import { requireClinicAdmin } from "@/lib/require-clinic-admin";
import { BackLink } from "@/components/back-link";
import { NoteTemplatesClient } from "./note-templates-client";

// Progress note template builder. patient_progress_notes has FIXED columns
// (subjective, objective, assessment, plan) — there is no flexible/jsonb
// storage for note content itself, so a template can only relabel/reprompt
// those same 4 concepts (rename "Objective" to "Findings", tweak the
// placeholder hint, etc.) — it can't invent new fields. Exactly one
// template per tenant may be is_default=true (enforced by a partial unique
// index at the DB level); the default's labels/placeholders are what the
// patient-chart note composer actually shows.
export default async function NoteTemplatesSettingsPage() {
  const { supabase, profile } = await requireClinicAdmin();

  const [{ data: templates }, { data: clinicSettings }, { data: providerProfile }, { data: signature }] = await Promise.all([
    supabase.from("note_templates").select("id, name, based_on, sections, is_default, is_active").eq("tenant_id", profile.tenant_id).order("created_at"),
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
      <h1 style={{ fontSize: 22, marginBottom: 4 }}>Progress Note Templates</h1>
      <p style={{ color: "#666", fontSize: 13, marginBottom: 20 }}>
        Customize how the Subjective, Objective, Assessment, and Plan sections are labeled and prompted when your
        providers write a progress note. Mark one template as the clinic default — it's the one providers see when
        charting a patient.
      </p>
      <NoteTemplatesClient
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
