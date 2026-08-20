import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { SiteNav } from "@/components/public/site-nav";
import { SiteFooter } from "@/components/public/site-footer";
import { DirectorySearch } from "./directory-search";

const NAVY = "#0c1730";
const GOLD = "#e6c66b";

// Turned off for now at Angel's request — she wants to focus on the core
// system until there are more providers on AngelClinic or the brand is
// better known, then revisit this. renderDirectory() below still has the
// full working page (schema, admin Provider Directory tool at
// app/admin/providers-directory, and the /find-a-doctor UI are all
// untouched) — turning this back on later is: call renderDirectory()
// here instead of redirecting, and restore the two nav links in
// site-nav.tsx/site-footer.tsx.
export default async function FindADoctorPage() {
  redirect("/");
}

async function renderDirectory() {
  const supabase = await createClient();

  const [{ data: providers }, { data: externalProviders }] = await Promise.all([
    supabase.rpc("public_list_directory_providers"),
    supabase
      .from("external_providers")
      .select("id, full_name, credentials, specialty, subspecialty, clinic_name, hospital, address, city, contact_number, photo_path, schedule_text, source, source_url")
      .eq("is_active", true)
      .order("full_name"),
  ]);

  const externalWithPhotos = (externalProviders ?? []).map((p: any) => ({
    ...p,
    photo_url: p.photo_path ? supabase.storage.from("external-provider-photos").getPublicUrl(p.photo_path).data.publicUrl : null,
  }));

  return (
    <div style={{ background: "#faf9f6" }}>
      <SiteNav />

      <section style={{ background: `linear-gradient(180deg, ${NAVY} 0%, #14213f 100%)`, color: "#f4f5f7", padding: "56px 24px 44px", textAlign: "center" }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: GOLD, letterSpacing: 0.5, textTransform: "uppercase", marginBottom: 10 }}>Find a Doctor</div>
        <h1 style={{ fontSize: 32, margin: "0 0 12px" }}>Find a Provider</h1>
        <p style={{ color: "rgba(244,245,247,0.8)", fontSize: 15, maxWidth: 560, margin: "0 auto" }}>
          Search AngelClinic providers who've made their profile public. Providers control whether they're listed
          here — nothing is added without their consent.
        </p>
      </section>

      <main style={{ maxWidth: 900, margin: "0 auto", padding: "44px 24px 72px" }}>
        <DirectorySearch providers={(providers as any) ?? []} externalProviders={externalWithPhotos as any} />
      </main>

      <SiteFooter />
    </div>
  );
}

// Referenced so it isn't flagged as dead code / an unused export while
// disabled — see the comment above FindADoctorPage.
void renderDirectory;
