// Pure helpers that turn provider_schedules (recurring weekly working
// hours) + provider_date_availability (one-off/flexible additions) +
// provider_time_blocks (one-off day-off/lunch/holiday subtractions) into
// per-provider, per-date availability the grid can shade — light = working,
// dark = not, matching the "gray outside working hours" look the user
// pointed at in her ECW reference screenshot. A provider who hasn't set up
// anything yet gets no shading at all (not "everything gray") so
// existing/unconfigured clinics aren't disrupted.
//
// This is the INTERNAL "is the provider here" view. Whether any given
// range is also patient-bookable is a separate flag on each range (see
// bookable-slots.ts for the patient-facing slot math, which is what
// actually cares about that flag) — a provider being physically at the
// clinic does not by itself mean patients can self-book that time.

import { weekdayMon0 } from "./date-utils";

export type ScheduleRow = { id: string; provider_id: string; day_of_week: number; start_time: string; end_time: string; patient_bookable: boolean };
export type DateAvailabilityRow = { id: string; provider_id: string; avail_date: string; start_time: string; end_time: string; patient_bookable: boolean };
export type TimeBlockRow = { id: string; provider_id: string; block_date: string; start_time: string; end_time: string; reason: string | null };

export type AvailRange = { startMin: number; endMin: number; patientBookable: boolean };
export type DayAvailability = {
  configured: boolean;
  ranges: AvailRange[];
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
  dateAvailability: DateAvailabilityRow[],
  timeBlocks: TimeBlockRow[]
): Record<string, Record<string, DayAvailability>> {
  const configuredProviders = new Set<string>();
  const weeklyByProviderDay = new Map<string, ScheduleRow[]>();
  for (const s of schedules) {
    configuredProviders.add(s.provider_id);
    const key = `${s.provider_id}:${s.day_of_week}`;
    if (!weeklyByProviderDay.has(key)) weeklyByProviderDay.set(key, []);
    weeklyByProviderDay.get(key)!.push(s);
  }
  const dateByProviderDate = new Map<string, DateAvailabilityRow[]>();
  for (const d of dateAvailability) {
    configuredProviders.add(d.provider_id);
    const key = `${d.provider_id}:${d.avail_date}`;
    if (!dateByProviderDate.has(key)) dateByProviderDate.set(key, []);
    dateByProviderDate.get(key)!.push(d);
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
      const weekly = weeklyByProviderDay.get(`${providerId}:${dow}`) ?? [];
      const oneOff = dateByProviderDate.get(`${providerId}:${date}`) ?? [];
      const ranges: AvailRange[] = [
        ...weekly.map((r) => ({ startMin: timeToMin(r.start_time), endMin: timeToMin(r.end_time), patientBookable: r.patient_bookable })),
        ...oneOff.map((r) => ({ startMin: timeToMin(r.start_time), endMin: timeToMin(r.end_time), patientBookable: r.patient_bookable })),
      ].sort((a, b) => a.startMin - b.startMin);
      const blocks = (blocksByProviderDate.get(`${providerId}:${date}`) ?? []).map((b) => ({
        id: b.id,
        startMin: timeToMin(b.start_time),
        endMin: timeToMin(b.end_time),
        reason: b.reason,
      }));
      result[providerId][date] = { configured, ranges, blocks };
    }
  }
  return result;
}
