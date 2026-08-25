import { notFound } from "next/navigation";
import { requirePatientPortal } from "@/lib/require-patient-portal";
import { PortalShell } from "@/components/portal-shell";
import { BackLink } from "@/components/back-link";
import { PatientThread } from "./patient-thread";

// Patient side of a provider thread (spec §29-34). Reached either from a
// provider's profile "Send a Message" link, or from /portal/messages. The
// live eligibility check (messaging_enabled + audience + appointment
// window + hours) happens server-side via portal_get_messaging_status —
// the SAME resolution the profile page's locked-badge decision is based
// on — so a patient can never see a working composer here that the
// profile page told them was unavailable, or vice versa.
export default async function PortalMessageThreadPage({ params }: { params: Promise<{ providerId: string }> }) {
  const { providerId } = await params;
  const { supabase } = await requirePatientPortal();

  const [{ data: status, error: statusError }, { data: messages }] = await Promise.all([
    supabase.rpc("portal_get_messaging_status", { p_provider_id: providerId }),
    supabase.rpc("portal_get_provider_thread", { p_provider_id: providerId }),
  ]);

  if (statusError || !status) notFound();

  return (
    <PortalShell>
      <BackLink href="/portal/messages" label="My Messages" />
      <h1 style={{ fontSize: 20, marginBottom: 2 }}>
        {(status as any).providerTitle ? `${(status as any).providerTitle} ` : ""}
        {(status as any).providerName}
      </h1>
      <p style={{ fontSize: 12.5, color: "#888", marginBottom: 18 }}>Message thread</p>

      <PatientThread providerId={providerId} status={status as any} initialMessages={(messages as any[]) ?? []} />
    </PortalShell>
  );
}
