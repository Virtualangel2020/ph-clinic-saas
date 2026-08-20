import { requireAdmin } from "@/lib/require-admin";
import { ExternalProviderManager } from "./external-provider-manager";

// Manages external_providers — the "Other Providers" category on the
// public /find-a-doctor page, for real providers who aren't on AngelClinic.
// AngelClinic's own providers manage their own listing themselves (Settings
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

  return (
    <div>
      <h1 style={{ fontSize: 24, marginBottom: 4 }}>Provider Directory</h1>
      <p style={{ color: "#666", marginBottom: 24, maxWidth: 640 }}>
        Manually-entered listings for real, verified providers who aren't AngelClinic users — shown under "Other
        Providers" on the public Find a Doctor page. Never scraped, never fabricated — only add someone here if
        you've actually verified their information.
      </p>
      <ExternalProviderManager providers={(providers as any) ?? []} photoUrls={photoUrls} />
    </div>
  );
}
