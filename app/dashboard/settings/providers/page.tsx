import { requireClinicMember } from "@/lib/require-clinic-member";
import { BackLink } from "@/components/back-link";
import { ProviderCredentialsForm } from "./provider-credentials-form";
import { SignatureManager } from "./signature-manager";
import { SeatUsage } from "./seat-usage";
// Public directory listing is turned off for now (Angel wants to focus on
// the core system until there are more providers / the brand is better
// known) — see app/find-a-doctor/page.tsx. Re-import and render
// <PublicProfileToggle /> below to bring it back.
// import { PublicProfileToggle } from "./public-profile-toggle";

// Parts 21-23: provider credentials + signature. Per explicit instruction
// these no longer go through a Clinic Admin approval step — a provider's
// own edit/upload is live immediately (see migration
// provider_signature_and_credentials_no_approval). A non-admin only ever
// sees and edits their own record.
export default async function ProvidersPage() {
  const { supabase, user, profile } = await requireClinicMember();
  const isAdmin = profile.role === "clinic_admin" || profile.role === "platform_admin";

  let seatUsage: { used: number; total: number } | null = null;
  if (isAdmin) {
    const [{ count: doctorCount }, { data: subscription }] = await Promise.all([
      supabase.from("user_profiles").select("id", { count: "exact", head: true }).eq("role", "doctor"),
      supabase.from("subscriptions").select("provider_seats").eq("tenant_id", profile.tenant_id).maybeSingle(),
    ]);
    seatUsage = { used: doctorCount ?? 0, total: subscription?.provider_seats ?? 1 };
  }

  const { data: activeSignature } = await supabase
    .from("provider_signatures")
    .select("signature_path")
    .eq("user_id", user.id)
    .eq("status", "approved")
    .order("reviewed_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  let activeSignatureUrl: string | null = null;
  if (activeSignature) {
    const { data } = await supabase.storage.from("provider-signatures").createSignedUrl(activeSignature.signature_path, 3600);
    activeSignatureUrl = data?.signedUrl ?? null;
  }

  return (
    <div style={{ maxWidth: 720, display: "grid", gap: 24 }}>
      <div>
        <BackLink href="/dashboard/settings" label="Settings" />
        <h1 style={{ fontSize: 22, marginBottom: 4 }}>Providers & Credentials</h1>
        <p style={{ color: "#666", fontSize: 13, marginBottom: 20 }}>
          Your professional details and signature auto-populate every document — no re-entering them each time you
          sign something.
        </p>
      </div>

      <ProviderCredentialsForm profile={profile as any} />

      <SignatureManager activeSignatureUrl={activeSignatureUrl} />

      {isAdmin && seatUsage && <SeatUsage used={seatUsage.used} total={seatUsage.total} />}
    </div>
  );
}
