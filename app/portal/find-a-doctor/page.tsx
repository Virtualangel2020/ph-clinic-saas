import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { PortalShell } from "@/components/portal-shell";
import { BackLink } from "@/components/back-link";
import { DirectorySearch } from "@/app/find-a-doctor/directory-search";

// In-portal "Find a Doctor" (bug fix — the portal nav used to point
// straight at the public marketing page at /find-a-doctor, which renders
// the public SiteNav/SiteFooter instead of PortalShell. The patient's
// session was never actually touched, but losing the portal chrome mid-
// click reads exactly like being kicked out of the account. This page
// reuses the SAME directory data/RPC and the SAME DirectorySearch UI as
// the public page — not a second copy — just rendered inside PortalShell,
// with profile links kept inside the portal (basePath) and the booking CTA
// pointed straight at the real in-portal booking flow (bookHref) instead
// of the public "no account needed" request form a signed-in patient
// never needs.
export default async function PortalFindADoctorPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/portal/login?next=/portal/find-a-doctor");

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

  const providersWithPhotos = ((providers as any[]) ?? []).map((p) => ({
    ...p,
    photo_url: p.public_photo_path ? supabase.storage.from("provider-photos").getPublicUrl(p.public_photo_path).data.publicUrl : null,
  }));

  return (
    <PortalShell>
      <BackLink href="/portal" label="Portal Home" />
      <h1 style={{ fontSize: 22, marginBottom: 4 }}>Find a Doctor</h1>
      <p style={{ color: "#666", fontSize: 13, marginBottom: 20 }}>
        Search MyCareDesk providers who've made their profile public. Providers control whether they're listed here — nothing is added without their consent.
      </p>
      <DirectorySearch providers={providersWithPhotos as any} externalProviders={externalWithPhotos as any} basePath="/portal/find-a-doctor" bookHref={(id) => `/portal/book/${id}`} />
    </PortalShell>
  );
}
