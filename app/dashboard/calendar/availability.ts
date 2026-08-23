// Pure helpers that turn provider_schedules (recurring weekly working
// hours) + provider_time_blocks (one-off day-off/lunch/holiday exceptions)
// into per-provider, per-date availability bands the grid can shade —
// light = available, dark = not, matching the "gray outside working hours"
// look the user pointed at in her ECW reference screenshot. A provider who
// hasn't set up any working hours yet gets no shading at all (not
// "everything gray") so existing/unconfigured clinics aren't disrupted.

import { weekdayMon0 } from "./date-utils";

export type ScheduleRow = { provider_id: string; day_of_week: number; start_time: string; end_time: string; is_active: boolean };
export type TimeBlockRow = { id: string; provider_id: string; block_date: string; start_time: string; end_time: string; reason: string | null };

export type DayAvailability = {
  configured: boolean;
  isDayOff: boolean;
  rangeStartMin: number | null;
  rangeEndMin: number | null;
  blocks: { id: string; startMin: number; endMin: number; reason: string | null }[];
};

export function timeToMin(t: string): number {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
}

export function buildAvailability(
  providerIds: string[],
  dates: string[],
  schedules: ScheduleRow[],
  timeBlocks: TimeBlockRow[]
): Record<string, Record<string, DayAvailability>> {
  const byProviderDay = new Map<string, ScheduleRow>();
  const configuredProviders = new Set<string>();
  for (const s of schedules) {
    configuredProviders.add(s.provider_id);
    byProviderDay.set(`${s.provider_id}:${s.day_of_week}`, s);
  }
  const blocksByProviderDate = new Map<string, TimeBlockRow[]>();
  for (const b of timeBlocks) {
    const key = `${b.provider_id}:${b.block_date}`;
    if (!blocksByProviderDate.has(key)) blocksByProviderDate.set(key, []);
    blocksByProviderDate.get(key)!.push(b);
  }

  const result: Record<string, Record<string, DayAvailability>> = {};
  for (const providerId of providerIds) {
    result[providerId] = {};
    const configured = configuredProviders.has(providerId);
    for (const date of dates) {
      const dow = weekdayMon0(date);
      const row = byProviderDay.get(`${providerId}:${dow}`);
      const blocks = (blocksByProviderDate.get(`${providerId}:${date}`) ?? []).map((b) => ({
        id: b.id,
        startMin: timeToMin(b.start_time),
        endMin: timeToMin(b.end_time),
        reason: b.reason,
      }));
      if (!configured) {
        result[providerId][date] = { configured: false, isDayOff: false, rangeStartMin: null, rangeEndMin: null, blocks };
        continue;
      }
      if (!row || !row.is_active) {
        result[providerId][date] = { configured: true, isDayOff: true, rangeStartMin: null, rangeEndMin: null, blocks };
      } else {
        result[providerId][date] = { configured: true, isDayOff: false, rangeStartMin: timeToMin(row.start_time), rangeEndMin: timeToMin(row.end_time), blocks };
      }
    }
  }
  return result;
}
