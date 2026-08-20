import { requireAdmin } from "@/lib/require-admin";
import { SiteContentForm } from "./site-content-form";

export default async function SiteContentPage() {
  const { supabase } = await requireAdmin();

  const [{ data: site }, { data: promotions }] = await Promise.all([
    supabase.from("site_content").select("*").maybeSingle(),
    supabase.from("promotions").select("id, label, code, is_active").order("created_at", { ascending: false }),
  ]);

  return (
    <div>
      <h1 style={{ fontSize: 24, marginBottom: 4 }}>Public Site Content</h1>
      <p style={{ color: "#666", marginBottom: 24 }}>
        Edit the copy shown on the public marketing site — homepage hero, welcome message, promo banner, demo CTA,
        About Us, and the Security page intro. Changes apply immediately, no deploy needed.
      </p>
      <SiteContentForm site={site as any} promotions={(promotions as any) ?? []} />
    </div>
  );
}
