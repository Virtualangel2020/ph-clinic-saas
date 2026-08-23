// Pure date helpers shared by the server page and the client calendar view.
// The whole app is PH-only, so "today"/day boundaries are always computed
// against Asia/Manila (UTC+8) rather than whatever timezone the server
// happens to be running in (Vercel functions default to UTC, which would
// otherwise show the wrong "today" for several hours every PH morning).

export const PH_OFFSET = "+08:00";

export function todayPh(): string {
  const ph = new Date(Date.now() + 8 * 60 * 60 * 1000);
  return ph.toISOString().slice(0, 10);
}

// A YYYY-MM-DD string, moved by `days` calendar days (pure date math, DST-free).
export function addDays(dateStr: string, days: number): string {
  const d = new Date(`${dateStr}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

// 0 = Monday .. 6 = Sunday (matches how the week/month grids are laid out).
export function weekdayMon0(dateStr: string): number {
  const d = new Date(`${dateStr}T00:00:00Z`);
  const jsDay = d.getUTCDay(); // 0 = Sunday
  return (jsDay + 6) % 7;
}

export function startOfWeek(dateStr: string): string {
  return addDays(dateStr, -weekdayMon0(dateStr));
}

export function startOfMonth(dateStr: string): string {
  return dateStr.slice(0, 7) + "-01";
}

// First day of the displayed month grid (the Monday on/before the 1st).
export function monthGridStart(dateStr: string): string {
  return startOfWeek(startOfMonth(dateStr));
}

// Exclusive end of the displayed month grid — always 42 days (6 full weeks)
// so the grid height never jumps between months.
export function monthGridEnd(dateStr: string): string {
  return addDays(monthGridStart(dateStr), 42);
}

// A local PH-wall-clock day boundary, as a real instant, for range queries.
export function phDayStart(dateStr: string): string {
  return `${dateStr}T00:00:00${PH_OFFSET}`;
}

export function formatDayLabel(dateStr: string): string {
  const d = new Date(`${dateStr}T00:00:00${PH_OFFSET}`);
  return d.toLocaleDateString("en-PH", { weekday: "short", month: "short", day: "numeric", timeZone: "Asia/Manila" });
}

export function formatMonthLabel(dateStr: string): string {
  const d = new Date(`${dateStr}T00:00:00${PH_OFFSET}`);
  return d.toLocaleDateString("en-PH", { month: "long", year: "numeric", timeZone: "Asia/Manila" });
}

export function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString("en-PH", { hour: "numeric", minute: "2-digit", hour12: true, timeZone: "Asia/Manila" });
}

// Combine a YYYY-MM-DD + HH:mm (both PH wall-clock) into an ISO instant.
export function toIsoInstant(dateStr: string, timeStr: string): string {
  return new Date(`${dateStr}T${timeStr}:00${PH_OFFSET}`).toISOString();
}

// Inverse of toIsoInstant, for pre-filling an edit form from a stored ISO instant.
export function isoToPhDateTime(iso: string): { date: string; time: string } {
  const d = new Date(iso);
  const ph = new Date(d.getTime() + 8 * 60 * 60 * 1000);
  const date = ph.toISOString().slice(0, 10);
  const time = ph.toISOString().slice(11, 16);
  return { date, time };
}
