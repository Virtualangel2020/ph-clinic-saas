// Shared bounds for real date-of-birth fields only (Angel: "minimum year
// 1900, maximum current year, no future DOB" — patient signup, dependent/
// family creation, provider-created patient, personal info, account
// setup, patient search). Every <input type="date"> for an actual DOB
// should pass min={DOB_MIN_DATE} max={dobMaxDate()} — this is the
// browser-level guardrail; the real enforcement lives server-side (see
// migrations-pending/dob_year_range_validation*.sql), since a min/max
// attribute alone can always be bypassed by typing a date directly.
// Deliberately NOT used on non-DOB date pickers (appointments, documents,
// prescriptions, billing, follow-ups, etc.).
export const DOB_MIN_DATE = "1900-01-01";

export function dobMaxDate(): string {
  return new Date().toISOString().slice(0, 10);
}
