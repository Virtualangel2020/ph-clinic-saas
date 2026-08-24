import { requireClinicMember } from "@/lib/require-clinic-member";
import { BackLink } from "@/components/back-link";
import { AppearanceForm } from "./appearance-form";

// Real light/dark/system toggle, persisted per account (user_profiles.
// theme_preference) and applied via CSS custom properties scoped to the
// EMR shell (see app/globals.css's [data-emr-theme] rules and
// components/emr/emr-shell.tsx). Covers the nav, top bar, page background,
// card surfaces, borders, and heading text across the dashboard — status
// colors (success/error/warning) and the brand navy/gold stay literal on
// purpose since they already read fine in both themes.
export default async function AppearancePage() {
  const { profile } = await requireClinicMember();
  const initialTheme = ((profile as any).theme_preference as "light" | "dark" | "system" | undefined) ?? "system";

  return (
    <div style={{ maxWidth: 640 }}>
      <BackLink href="/dashboard/settings" label="Settings" />
      <h1 style={{ fontSize: 22, marginBottom: 4 }}>Appearance</h1>
      <p style={{ color: "#666", marginBottom: 20, fontSize: 13 }}>
        Choose how the dashboard looks on this account. This applies to the EMR itself, not the public site.
      </p>
      <AppearanceForm initialTheme={initialTheme} />
    </div>
  );
}
