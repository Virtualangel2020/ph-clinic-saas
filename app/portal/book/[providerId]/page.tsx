import { notFound } from "next/navigation";
import { requirePatientPortal } from "@/lib/require-patient-portal";
import { PortalShell } from "@/components/portal-shell";
import { BackLink } from "@/components/back-link";
import { resolveEffectiveSettings, supportsSlotBooking } from "@/lib/patient-access";
import { BookingWizard } from "./booking-wizard";

// Real self-service booking (spec §49-54) — the actual multi-step wizard,
// available to authenticated Patient Portal patients. Reads through the
// SAME public_get_provider_profile RPC the public profile page uses, so
// this can never offer something the profile didn't already advertise.
export default async function PortalBookPage({ params }: { params: Promise<{ providerId: string }> }) {
  const { providerId } = await params;
  const { supabase, account } = await requirePatientPortal();
  const patientId = (account as any).patient_id as string;

  const { data } = await supabase.rpc("public_get_provider_profile", { p_provider_id: providerId });
  if (!data) notFound();

  const d = data as any;
  const effective = resolveEffectiveSettings(d.clinic, d.override);

  if (!supportsSlotBooking(effective.bookingType)) {
    return (
      <PortalShell>
        <BackLink href="/portal" label="Portal Home" />
        <h1 style={{ fontSize: 20, marginBottom: 8 }}>
          {d.provider.title ? `${d.provider.title} ` : ""}
          {d.provider.full_name}
        </h1>
        <p style={{ fontSize: 13.5, color: "#666" }}>
          {effective.bookingType === "walk_in"
            ? "This provider accepts walk-ins — no appointment needed."
            : "This provider doesn't take online bookings — please contact the clinic directly."}
        </p>
      </PortalShell>
    );
  }

  return (
    <PortalShell>
      <BackLink href="/portal" label="Portal Home" />
      <h1 style={{ fontSize: 20, marginBottom: 2 }}>
        Book with {d.provider.title ? `${d.provider.title} ` : ""}
        {d.provider.full_name}
      </h1>
      <p style={{ fontSize: 12.5, color: "#888", marginBottom: 18 }}>{d.clinic.clinic_name}</p>

      <BookingWizard
        patientId={patientId}
        provider={{ id: d.provider.id, fullName: d.provider.full_name, title: d.provider.title }}
        clinicName={d.clinic.clinic_name}
        effective={effective}
        services={d.services ?? []}
        hmos={d.accepted_hmos ?? []}
        financialActive={!!d.clinic.financial_active}
      />
    </PortalShell>
  );
}
