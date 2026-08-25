import { requireClinicAdmin } from "@/lib/require-clinic-admin";
import { BackLink } from "@/components/back-link";
import { ServicesManager } from "./services-manager";

// Services & Fees (spec §7-10). Extends the existing appointment_types
// table (still the SAME table Settings → Calendar reads/writes — this
// page just exposes the pricing/booking/delivery-mode columns that page
// doesn't) rather than a second, parallel "services" concept. "Show Price
// to Patient" only controls what's shown publicly; the clinic can still
// bill internally regardless of that toggle (that's just the existing
// patient_charges flow, untouched by this page).
export default async function ServicesPage() {
  const { supabase, profile } = await requireClinicAdmin();
  const tenantId = profile.tenant_id;

  const [{ data: types }, { data: providers }, { data: eligibility }] = await Promise.all([
    supabase
      .from("appointment_types")
      .select(
        "id, name, color, default_duration_minutes, description, is_active, sort_order, price_php, price_max_php, price_type, show_price_to_patient, allow_advance_payment, require_advance_payment, patient_booking_enabled, delivery_mode"
      )
      .eq("tenant_id", tenantId)
      .order("sort_order"),
    supabase.from("user_profiles").select("id, full_name, title").eq("tenant_id", tenantId).eq("role", "doctor").eq("is_active", true).order("full_name"),
    supabase.from("appointment_type_providers").select("appointment_type_id, provider_id").eq("tenant_id", tenantId),
  ]);

  return (
    <div style={{ maxWidth: 780 }}>
      <BackLink href="/dashboard/settings/patient-access" label="Patient Access & Payments" />
      <h1 style={{ fontSize: 22, marginBottom: 4 }}>Services & Fees</h1>
      <p style={{ color: "#666", fontSize: 13, marginBottom: 20 }}>
        Every visit type your clinic offers, its price, and whether patients see that price and can book/pay online.
        &quot;Show Price to Patient&quot; only controls what&apos;s shown publicly — your clinic can still bill
        internally regardless.
      </p>

      <ServicesManager
        initialTypes={(types as any) ?? []}
        providers={(providers as any) ?? []}
        eligibility={(eligibility as any) ?? []}
      />
    </div>
  );
}
