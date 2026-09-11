import { redirect, notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { PortalShell } from "@/components/portal-shell";
import { BackLink } from "@/components/back-link";
import { resolveEffectiveSettings } from "@/lib/patient-access";
import { BookingWizard } from "./booking-wizard";
import { PortalDataError } from "@/components/portal-data-error";
import { getMaintenanceStatus } from "@/lib/maintenance";
import { MaintenanceNotice } from "@/components/maintenance-notice";

// Real self-service booking (spec §49-54) — the actual multi-step wizard,
// available to any signed-in patient, whether or not they already have a
// clinic relationship. Deliberately NOT gated by requirePatientPortal():
// that requires an ALREADY-ACTIVE clinic-side patient_portal_accounts
// row, which is exactly backwards for a first-time booking — per Angel,
// booking with a provider is what's SUPPOSED to create that link, not
// something that requires it to already exist. Only a signed-in session
// is required here; self_book_ensure_clinic_patient (called from the
// booking actions once the patient actually confirms) creates the
// clinic-side patient + portal link on demand at that point. Reads
// through the SAME public_get_provider_profile RPC the public profile
// page uses, so this can never offer something the profile didn't
// already advertise.
export default async function PortalBookPage({
  params,
  searchParams,
}: {
  params: Promise<{ providerId: string }>;
  searchParams: Promise<{ followUpId?: string; appointmentTypeId?: string }>;
}) {
  const { providerId } = await params;
  const { followUpId, appointmentTypeId } = await searchParams;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect(`/portal/login?next=/portal/book/${providerId}`);

  const maintenance = await getMaintenanceStatus(supabase);
  if (maintenance.isEnabled) return <MaintenanceNotice message={maintenance.message} />;

  let d: any;
  let effective: ReturnType<typeof resolveEffectiveSettings>;
  try {
    const { data, error } = await supabase.rpc("public_get_provider_profile", { p_provider_id: providerId });
    if (error) throw error;
    if (!data) notFound();
    d = data;
    effective = resolveEffectiveSettings(d.clinic, d.override);
  } catch (err) {
    if ((err as any)?.digest === "NEXT_NOT_FOUND") throw err;
    console.error(`[portal/book/${providerId}] failed to load provider/booking settings:`, err);
    return (
      <PortalShell>
        <BackLink href="/portal" label="Portal Home" />
        <PortalDataError message="We couldn't load booking for this provider right now." />
      </PortalShell>
    );
  }

  if (!effective.onlineBookingEnabled) {
    return (
      <PortalShell>
        <BackLink href="/portal" label="Portal Home" />
        <h1 style={{ fontSize: 20, marginBottom: 8 }}>
          {d.provider.title ? `${d.provider.title} ` : ""}
          {d.provider.full_name}
        </h1>
        <p style={{ fontSize: 13.5, color: "#666" }}>
          {effective.bookingStyle === "walk_in"
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

      {followUpId && (
        <div style={{ background: "#eef6fb", border: "1px solid #b9d9ec", borderRadius: 10, padding: "10px 14px", marginBottom: 16, fontSize: 12.5, color: "#2a5674" }}>
          Scheduling your requested follow-up visit. Once you confirm a booking below, it'll be marked scheduled.
        </div>
      )}

      <BookingWizard
        provider={{ id: d.provider.id, fullName: d.provider.full_name, title: d.provider.title }}
        clinicName={d.clinic.clinic_name}
        effective={effective}
        services={d.services ?? []}
        hmos={d.accepted_hmos ?? []}
        financialActive={!!d.clinic.financial_active}
        followUpId={followUpId ?? null}
        presetAppointmentTypeId={appointmentTypeId ?? null}
      />
    </PortalShell>
  );
}
