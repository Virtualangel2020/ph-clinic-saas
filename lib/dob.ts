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

// Real, verified bug (Angel: "I put my dob as 09/04/1988, but when saved
// it is showing 09/03/1988 ... same as my daughter's"): every DOB display
// across the app was built as `new Date(dob).toLocaleDateString()` (or an
// equivalent age() helper starting from `new Date(dob)`). A date-only
// string like "1988-09-04" is parsed by JS as UTC MIDNIGHT of that day —
// then formatting/reading it back with any LOCAL-timezone method
// (.toLocaleDateString(), .getFullYear(), .getMonth(), .getDate()) shifts
// it back a calendar day in any timezone behind UTC. Confirmed the
// underlying data was never wrong — the native <input type="date"> in the
// edit view (which just echoes the raw "YYYY-MM-DD" string with no Date
// object involved) showed the correct 09/04/1988 the whole time; only the
// read-only display line was affected. A birthdate is a calendar date,
// not a point in time, so it must never be run through a timezone
// conversion. These two helpers parse the "YYYY-MM-DD" string's
// components directly and never construct a Date from it — every DOB
// display and age calculation in the app should go through these instead
// of `new Date(dob)`.
function parseDobParts(dob: string): { y: number; m: number; d: number } | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(dob);
  if (!match) return null;
  return { y: Number(match[1]), m: Number(match[2]), d: Number(match[3]) };
}

// Matches the M/D/YYYY shape (no zero-padding) that
// `new Date(...).toLocaleDateString()` produced for a correct date under
// the default en-US locale — same look, just no timezone shift.
export function formatDob(dob: string | null | undefined): string {
  if (!dob) return "—";
  const parts = parseDobParts(dob);
  if (!parts) return dob;
  return `${parts.m}/${parts.d}/${parts.y}`;
}

export function calculateAge(dob: string | null | undefined): number | null {
  if (!dob) return null;
  const parts = parseDobParts(dob);
  if (!parts) return null;
  const now = new Date();
  const y = now.getFullYear();
  const m = now.getMonth() + 1;
  const d = now.getDate();
  let a = y - parts.y;
  if (m < parts.m || (m === parts.m && d < parts.d)) a--;
  return a;
}
