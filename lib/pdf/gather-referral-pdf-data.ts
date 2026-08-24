import type { SupabaseClient } from "@supabase/supabase-js";
import type { ReferralLetterData } from "./referral-letter-document";

// Builds the payload for one referral's printable letter. Deliberately
// separate from gather-encounter-pdf-data.ts — a referral letter is a
// short clinical note (reason + summary), not a combined encounter
// export — but it reuses that file's ClinicInfo/PatientInfo shapes.

function formatDatePretty(iso: string) {
  return new Date(`${iso}T00:00:00`).toLocaleDateString("en-PH", { year: "numeric", month: "long", day: "numeric" });
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

export async function gatherReferralPdfData(supabase: SupabaseClient, tenantId: string, referralId: string): Promise<ReferralLetterData> {
  const { data: r, error } = await supabase
    .from("referrals")
    .select(
      "id, destination_type, specialty_requested, reason, clinical_summary, urgency, created_at, " +
        "external_destination_name, " +
        "patients(first_name, middle_name, last_name, date_of_birth, sex), " +
        "sending_provider:user_profiles!referrals_sending_provider_id_fkey(full_name, title, prc_license, ptr_number), " +
        "receiving_provider:user_profiles!referrals_receiving_provider_id_fkey(full_name, title), " +
        "external_providers(full_name, credentials, clinic_name, city)"
    )
    .eq("id", referralId)
    .eq("sending_tenant_id", tenantId)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!r) throw new Error("Referral not found.");
  const referral: any = r;

  const patientRow: any = referral.patients;
  if (!patientRow) throw new Error("Patient record not found.");

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

  const sp: any = referral.sending_provider;
  const rp: any = referral.receiving_provider;
  const ep: any = referral.external_providers;

  let destinationLabel: string;
  let destinationDetail: string | null;
  if (referral.destination_type === "internal") {
    destinationLabel = providerName(rp?.title ?? null, rp?.full_name ?? null);
    destinationDetail = null;
  } else if (ep) {
    destinationLabel = ep.full_name;
    destinationDetail = [ep.credentials, ep.clinic_name, ep.city].filter(Boolean).join(", ") || null;
  } else {
    destinationLabel = referral.external_destination_name ?? "External provider";
    destinationDetail = null;
  }

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
    referringProviderName: providerName(sp?.title ?? null, sp?.full_name ?? null),
    referringProviderCredentials: providerCredentials(sp?.prc_license ?? null, sp?.ptr_number ?? null),
    destinationLabel,
    destinationDetail,
    specialtyRequested: referral.specialty_requested,
    urgency: referral.urgency as "routine" | "urgent",
    reason: referral.reason,
    clinicalSummary: referral.clinical_summary,
    referralDate: formatDatePretty(referral.created_at.slice(0, 10)),
  };
}
