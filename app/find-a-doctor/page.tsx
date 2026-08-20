import { createClient } from "@/lib/supabase/server";
import { SiteNav } from "@/components/public/site-nav";
import { SiteFooter } from "@/components/public/site-footer";
import { DirectorySearch } from "./directory-search";

const NAVY = "#0c1730";
const GOLD = "#e6c66b";

// Part 62-67: public Find-a-Doctor directory. This is intentionally a
// SECONDARY feature — the primary purpose of the public site is selling
// AngelClinic subscriptions to clinics, not building a consumer directory
// product. Combines real AngelClinic providers who opted in
// (public_directory_enabled=true) with an "External Providers" category
// that is architecture-ready but genuinely empty right now — see
// external_providers table comment. Nothing here is scraped or fabricated.
export default async function FindADoctorPage() {
  const supabase = await createClient();

  const [{ data: providers }, { data: externalProviders }] = await Promise.all([
    supabase.rpc("public_list_directory_providers"),
    supabase
      .from("external_providers")
      .select("id, full_name, credentials, specialty, subspecialty, clinic_name, hospital, city, contact_number, source, source_url")
      .eq("is_active", true)
      .order("full_name"),
  ]);

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
        <DirectorySearch providers={(providers as any) ?? []} externalProviders={(externalProviders as any) ?? []} />
      </main>

      <SiteFooter />
    </div>
  );
}
