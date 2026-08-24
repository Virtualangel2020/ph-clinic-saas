import { requireClinicMember } from "@/lib/require-clinic-member";
import { BackLink } from "@/components/back-link";
import { LanguageForm } from "./language-form";

// Preference storage only, by explicit scope decision — this app has no
// i18n layer and every UI string is hardcoded English across ~70 pages;
// translating that is a separate project. This page saves what the user
// wants for when that ships, rather than leaving the setting empty or
// faking a switcher that doesn't do anything.
export default async function LanguagePage() {
  const { profile } = await requireClinicMember();
  const initialLanguage = ((profile as any).language_preference as "en" | "fil" | undefined) ?? "en";

  return (
    <div style={{ maxWidth: 640 }}>
      <BackLink href="/dashboard/settings" label="Settings" />
      <h1 style={{ fontSize: 22, marginBottom: 4 }}>Language</h1>
      <p style={{ color: "#666", marginBottom: 20, fontSize: 13 }}>
        Your preferred interface language.
      </p>
      <LanguageForm initialLanguage={initialLanguage} />
    </div>
  );
}
