import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { BrandHeader } from "@/components/brand-header";
import { HealthProfileForm } from "./health-profile-form";
import { AccountSetupPanel } from "./account-setup-panel";
import { AccessRequestsPanel } from "./access-requests-panel";
import { FamilyPanel } from "./family-panel";

// Spec Part 4 (optional, progressively-completable Patient Health Profile)
// and Part 3's "MyCareDesk account" migration doc: this page is reachable
// two ways — (1) right after free self-registration, where the platform
// account already exists, and (2) by an EXISTING staff-invited Patient
// Portal user discovering it organically, who may not have a platform
// account yet. AccountSetupPanel handles case (2) inline rather than
// bouncing them somewhere else.
//
// ?for=<accountId> switches which family member's profile is shown (see
// FamilyPanel / mycaredesk_family_dependent_accounts migration) — defaults
// to the signed-in owner's own account.
export default async function HealthProfilePage({ searchParams }: { searchParams: Promise<{ for?: string }> }) {
  const { for: forParam } = await searchParams;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/portal/login");

  const { data: account } = await supabase.rpc("get_my_mycaredesk_account");

  if (!account) {
    // Prefill suggestions from whatever per-clinic patient record they're
    // already known by, if any — saves re-typing what a clinic already has
    // on file. Best-effort only; the setup panel works with nothing too.
    const { data: existingPatient } = await supabase
      .from("patient_portal_accounts")
      .select("patients(first_name, last_name, date_of_birth, sex, mobile_phone, email)")
      .eq("auth_user_id", user.id)
      .eq("status", "active")
      .limit(1)
      .maybeSingle();

    return (
      <main style={{ maxWidth: 440, margin: "50px auto", padding: 24 }}>
        <div style={{ marginBottom: 20 }}>
          <BrandHeader />
        </div>
        <h1 style={{ fontSize: 20 }}>Set up your MyCareDesk account</h1>
        <p style={{ color: "#666", fontSize: 13, marginBottom: 16 }}>
          One quick step before you can fill in a Health Profile — this creates your permanent MyCareDesk account, separate from any one clinic.
        </p>
        <AccountSetupPanel prefill={(existingPatient as any)?.patients ?? null} email={user.email ?? ""} />
      </main>
    );
  }

  const { data: family } = await supabase.rpc("get_my_mycaredesk_family");
  const familyList = (family as any[]) ?? [];

  // Only accept ?for= when it's actually the owner or one of their
  // dependents — anything else silently falls back to the owner's own
  // account rather than erroring.
  const validIds = new Set([account.id, ...familyList.map((f) => f.id)]);
  const activeAccountId = forParam && validIds.has(forParam) ? forParam : account.id;
  const activeAccount = activeAccountId === account.id ? account : familyList.find((f) => f.id === activeAccountId);

  const { data: profile } = await supabase.from("mycaredesk_health_profiles").select("*").eq("mycaredesk_account_id", activeAccountId).maybeSingle();
  const { data: accessRequests } = await supabase.rpc("patient_list_my_access_requests");

  return (
    <main style={{ maxWidth: 560, margin: "40px auto", padding: 24 }}>
      <div style={{ marginBottom: 20 }}>
        <BrandHeader />
      </div>
      <Link href="/portal/welcome" style={{ display: "inline-block", fontSize: 13, color: "#888", textDecoration: "none", marginBottom: 12 }}>
        ← Back
      </Link>
      <h1 style={{ fontSize: 22, marginBottom: 4 }}>Health Profile</h1>
      <p style={{ color: "#666", fontSize: 13, marginBottom: 20 }}>
        Fill in as much as you know — nothing here is required. Once you're seen by a MyCareDesk provider, they'll be able to see this so you don't have to repeat it at check-in.
      </p>
      <FamilyPanel owner={account} family={familyList} activeAccountId={activeAccountId} />
      <AccessRequestsPanel requests={(accessRequests as any) ?? []} />
      <HealthProfileForm key={activeAccountId} initial={profile as any} forAccountId={activeAccountId === account.id ? null : activeAccountId} forName={activeAccountId === account.id ? null : `${activeAccount?.first_name ?? ""} ${activeAccount?.last_name ?? ""}`.trim()} />
    </main>
  );
}
