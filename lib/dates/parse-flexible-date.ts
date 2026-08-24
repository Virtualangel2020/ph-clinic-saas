// Turns a loosely-typed date-of-birth search term into a strict
// YYYY-MM-DD (or null if it doesn't look like a date at all) so patient
// search can match DOB without forcing staff to type ISO dates. Names can
// be misspelled or shared between patients — DOB is often the fastest,
// least ambiguous way to find the right chart, so this accepts the
// formats Philippine clinic staff actually type.
//
// Supported:
//   08/23/1985, 8/23/1985   (M/D/YYYY — US-style, what the app's date
//                             inputs already produce)
//   1985-08-23              (ISO, what the DB stores)
//   August 23, 1985 / Aug 23 1985 / 23 August 1985

const MONTHS: Record<string, number> = {
  jan: 1, january: 1,
  feb: 2, february: 2,
  mar: 3, march: 3,
  apr: 4, april: 4,
  may: 5,
  jun: 6, june: 6,
  jul: 7, july: 7,
  aug: 8, august: 8,
  sep: 9, sept: 9, september: 9,
  oct: 10, october: 10,
  nov: 11, november: 11,
  dec: 12, december: 12,
};

function pad2(n: number) {
  return String(n).padStart(2, "0");
}

function isValidDate(year: number, month: number, day: number) {
  if (month < 1 || month > 12 || day < 1 || day > 31) return false;
  if (year < 1900 || year > new Date().getFullYear()) return false;
  const d = new Date(Date.UTC(year, month - 1, day));
  return d.getUTCFullYear() === year && d.getUTCMonth() === month - 1 && d.getUTCDate() === day;
}

export function parseFlexibleDate(raw: string): string | null {
  const s = raw.trim();
  if (!s) return null;

  // ISO: YYYY-MM-DD
  let m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (m) {
    const [, y, mo, d] = m;
    if (isValidDate(+y, +mo, +d)) return `${y}-${pad2(+mo)}-${pad2(+d)}`;
  }

  // M/D/YYYY or MM-DD-YYYY (US-style, matches the app's own date inputs)
  m = s.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/);
  if (m) {
    const [, mo, d, y] = m;
    if (isValidDate(+y, +mo, +d)) return `${y}-${pad2(+mo)}-${pad2(+d)}`;
  }

  // "August 23, 1985" / "Aug 23 1985" / "August 23 1985"
  m = s.match(/^([A-Za-z]+)\.?\s+(\d{1,2})(?:st|nd|rd|th)?,?\s+(\d{4})$/);
  if (m) {
    const [, monName, d, y] = m;
    const mo = MONTHS[monName.toLowerCase()];
    if (mo && isValidDate(+y, mo, +d)) return `${y}-${pad2(mo)}-${pad2(+d)}`;
  }

  // "23 August 1985" / "23rd Aug 1985"
  m = s.match(/^(\d{1,2})(?:st|nd|rd|th)?\s+([A-Za-z]+)\.?,?\s+(\d{4})$/);
  if (m) {
    const [, d, monName, y] = m;
    const mo = MONTHS[monName.toLowerCase()];
    if (mo && isValidDate(+y, mo, +d)) return `${y}-${pad2(mo)}-${pad2(+d)}`;
  }

  return null;
}
