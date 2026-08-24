import type { SupabaseClient } from "@supabase/supabase-js";
import type { MedicalCertificateData } from "./medical-certificate-document";

// Builds the payload for one issued certificate's PDF. Reads the
// certificate's own fields_snapshot/values (captured at issue time, per
// migration medical_certificate_issuance) rather than the live template —
// so a later template edit never changes what an already-issued
// certificate says.

function formatDatePretty(iso: string) {
  return new Date(`${iso}T00:00:00`).toLocaleDateString("en-PH", { year: "numeric", month: "long", day: "numeric" });
}
function formatDateTimePretty(iso: string) {
  return new Date(iso).toLocaleString("en-PH", { year: "numeric", month: "long", day: "numeric" });
}
function providerName(title: string | null, fullName: string | null) {
  if (!fullName) return "—";
  return title ? `${title} ${fullName}` : fullName;
}
function providerCredentials(prcLicense: string | null, ptrNumber: string | null) {
  const parts: string[] = [];
  if (prcLicense) parts.push(`PRC ${prcLicense}`);
  if (ptrNumber) parts.push(`PTR ${ptrNumber}`);
  return parts.length > 0 ? parts.join(" · ") : null;
}
function formatFieldValue(type: "text" | "textarea" | "date", raw: string) {
  if (!raw) return "";
  if (type === "date") {
    const d = new Date(`${raw}T00:00:00`);
    return isNaN(d.getTime()) ? raw : formatDatePretty(raw);
  }
  return raw;
}

export async function gatherMedicalCertificatePdfData(supabase: SupabaseClient, tenantId: string, certificateId: string): Promise<MedicalCertificateData> {
  const { data: c, error } = await supabase
    .from("medical_certificates")
    .select(
      "id, certificate_number, template_name, fields_snapshot, values, status, issued_at, voided_at, provider_id, " +
        "patients(first_name, middle_name, last_name, date_of_birth, sex, address_line1, address_line2, city, province), " +
        "user_profiles!medical_certificates_provider_id_fkey(full_name, title, prc_license, ptr_number)"
    )
    .eq("id", certificateId)
    .eq("tenant_id", tenantId)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!c) throw new Error("Certificate not found.");
  const cert: any = c;

  const patientRow: any = cert.patients;
  if (!patientRow) throw new Error("Patient record not found.");
  const provider: any = cert.user_profiles;

  const { data: clinicSettings } = await supabase
    .from("clinic_settings")
    .select("clinic_name, logo_path, address_line1, address_line2, city, province, postal_code, phone, mobile, email, website")
    .eq("tenant_id", tenantId)
    .maybeSingle();

  let logoUrl: string | null = null;
  if (clinicSettings?.logo_path) {
    const { data } = supabase.storage.from("clinic-logos").getPublicUrl(clinicSettings.logo_path);
    logoUrl = data.publicUrl;
  }

  let signatureImageUrl: string | null = null;
  const { data: sig } = await supabase
    .from("provider_signatures")
    .select("signature_path")
    .eq("tenant_id", tenantId)
    .eq("user_id", cert.provider_id ?? "")
    .eq("status", "approved")
    .order("reviewed_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (sig?.signature_path) {
    const { data: signed } = await supabase.storage.from("provider-signatures").createSignedUrl(sig.signature_path, 300);
    signatureImageUrl = signed?.signedUrl ?? null;
  }

  const fieldsSnapshot: { key: string; label: string; type: "text" | "textarea" | "date" }[] = cert.fields_snapshot ?? [];
  const values: Record<string, string> = cert.values ?? {};

  return {
    clinic: {
      name: clinicSettings?.clinic_name ?? "AngelClinic",
      logoUrl,
      addressLine1: clinicSettings?.address_line1 ?? null,
      addressLine2: clinicSettings?.address_line2 ?? null,
      city: clinicSettings?.city ?? null,
      province: clinicSettings?.province ?? null,
      postalCode: clinicSettings?.postal_code ?? null,
      phone: clinicSettings?.phone ?? null,
      mobile: clinicSettings?.mobile ?? null,
      email: clinicSettings?.email ?? null,
      website: clinicSettings?.website ?? null,
    },
    patient: {
      fullName: `${patientRow.last_name}, ${patientRow.first_name}${patientRow.middle_name ? " " + patientRow.middle_name : ""}`,
      dateOfBirth: formatDatePretty(patientRow.date_of_birth),
      sex: patientRow.sex,
    },
    patientAddress: [patientRow.address_line1, patientRow.address_line2, patientRow.city, patientRow.province].filter(Boolean).join(", ") || null,
    certificateNumber: cert.certificate_number,
    templateName: cert.template_name,
    fields: fieldsSnapshot.map((f) => ({ label: f.label, type: f.type, value: formatFieldValue(f.type, values[f.key] ?? "") })),
    providerName: providerName(provider?.title ?? null, provider?.full_name ?? null),
    providerCredentials: providerCredentials(provider?.prc_license ?? null, provider?.ptr_number ?? null),
    signatureImageUrl,
    issuedAt: formatDateTimePretty(cert.issued_at),
    voided: cert.status === "void",
    voidedAt: cert.voided_at ? formatDateTimePretty(cert.voided_at) : null,
  };
}
