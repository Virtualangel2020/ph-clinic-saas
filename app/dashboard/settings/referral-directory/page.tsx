import { requireClinicMember } from "@/lib/require-clinic-member";
import { BackLink } from "@/components/back-link";
import { PublicProfileToggle } from "../providers/public-profile-toggle";

// This is the real "referral directory" feature — there is no separate
// referral-network dataset behind it. It edits the same public_* columns
// on user_profiles that feed two consumers:
//  1. search_angelclinic_providers — used by Records Exchange's "Send to
//     AngelClinic Provider" flow (app/dashboard/encounters/*) to find a
//     colleague by name/specialty/subspecialty/clinic. That search runs
//     over every active doctor and does NOT check public_directory_enabled,
//     so this toggle does not hide you from colleagues internally.
//  2. public_list_directory_providers — powers the public /find-a-doctor
//     page. That page is currently disabled clinic-wide, but the profile
//     data is kept current here so it's ready when/if it's turned back on.
export default async function ReferralDirectoryPage() {
  const { profile } = await requireClinicMember();

  return (
    <div style={{ maxWidth: 640 }}>
      <BackLink href="/dashboard/settings" label="Settings" />
      <h1 style={{ fontSize: 22, marginBottom: 4 }}>Referral Directory Profile</h1>
      <p style={{ color: "#666", fontSize: 13, marginBottom: 20 }}>
        This is how your specialty, bio, and consultation details appear when a colleague looks you up to send
        records through Records Exchange — that search covers every active doctor regardless of the setting
        below. Turning on "Show my profile publicly" additionally lists you on AngelClinic's public Find a
        Doctor page once/if that page is enabled for this clinic; it does not change your visibility to
        colleagues internally.
      </p>

      <PublicProfileToggle profile={profile as any} />
    </div>
  );
}
