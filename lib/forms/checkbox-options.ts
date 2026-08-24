// Shared between the Forms & Registration template builder, its live
// preview, and every place a real form actually gets filled out (patient
// chart FormsSection, Patient Portal PortalFormsClient). A checkbox field
// with no options configured stays the original single Yes/No toggle
// (responses[key] is a boolean) — this is purely additive, so existing
// templates/responses keep working unchanged. A checkbox field WITH
// options becomes a multi-select group (responses[key] is a string[] of
// the selected option labels); if the selected set includes an "Other" /
// "Others" option, an extra free-text note is collected alongside it at
// responses[`${key}${OTHER_NOTE_SUFFIX}`].

export const OTHER_NOTE_SUFFIX = "__other_note";

export function parseCheckboxOptions(raw?: string | null): string[] {
  return (raw ?? "")
    .split(",")
    .map((o) => o.trim())
    .filter(Boolean);
}

export function isOtherOption(label: string): boolean {
  return /^others?$/i.test(label.trim());
}

export function otherNoteKey(fieldKey: string): string {
  return `${fieldKey}${OTHER_NOTE_SUFFIX}`;
}
