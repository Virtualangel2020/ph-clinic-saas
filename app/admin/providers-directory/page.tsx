import { requireAdmin } from "@/lib/require-admin";
import { ExternalProviderManager } from "./external-provider-manager";

// Manages external_providers — the "Other Providers" category on the
// public /find-a-doctor page, for real providers who aren't on MyCareDesk.
// MyCareDesk's own providers manage their own listing themselves (Settings
// → Providers & Credentials → Public directory listing) — that's their own
// account data, not something Superadmin edits on their behalf. This page
// is only for the manually-curated external category.
export default async function ProvidersDirectoryPage() {
  const { supabase } = await requireAdmin();

  const { data: providers } = await supabase
    .from("external_providers")
    .select("*")
    .order("created_at", { ascending: false });

  const photoUrls: Record<string, string> = {};
  for (const p of providers ?? []) {
    if (p.photo_path) {
      const { data } = supabase.storage.from("external-provider-photos").getPublicUrl(p.photo_path);
      photoUrls[p.id] = data.publicUrl;
    }
  }

  // For the "Link to MyCareDesk provider" dropdown — controlled admin
  // linking only (never auto-merge by name, per spec). Platform admins
  // already have full read access to user_profiles via the "platform
  // admins manage all profiles" RLS policy, so this is a direct read, no
  // new RPC needed.
  const { data: linkableProviders } = await supabase
    .from("user_profiles")
    .select("id, full_name, specialty, tenant_id")
    .in("role", ["doctor", "clinic_admin"])
    .eq("is_active", true)
    .order("full_name");

  return (
    <div>
      <h1 style={{ fontSize: 24, marginBottom: 4 }}>Provider Directory</h1>
      <p style={{ color: "#666", marginBottom: 24, maxWidth: 640 }}>
        Manually-entered listings for real, verified providers who aren't MyCareDesk users — shown under "External
        Providers" on the public Find a Doctor page. Never scraped, never fabricated — only add someone here if
        you've actually verified their information. If one of these doctors later joins MyCareDesk, link their
        listing to their real account instead of leaving a duplicate-looking entry — linked listings are hidden
        from the public External section automatically.
      </p>
      <ExternalProviderManager providers={(providers as any) ?? []} photoUrls={photoUrls} linkableProviders={(linkableProviders as any) ?? []} />
    </div>
  );
}
