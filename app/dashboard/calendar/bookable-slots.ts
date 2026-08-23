// Patient-bookable slot math — the engine behind the green/red/gray month
// dots and the "Available Times" list. Deliberately separate from
// availability.ts's internal shading: only ranges flagged patient_bookable
// count here, and slots are sliced to the requested appointment TYPE's
// duration (chosen by the patient/receptionist before this runs), not a
// fixed duration stored on the schedule itself.

import type { AvailRange, DayAvailability } from "./availability";

export type Slot = { startMin: number; endMin: number };

// A slot survives only if its FULL duration avoids every cut (block or
// existing appointment) — no partial-overlap slots ever get offered.
export function computeBookableSlots(bookableRanges: { startMin: number; endMin: number }[], cuts: { startMin: number; endMin: number }[], slotMinutes: number): Slot[] {
  if (slotMinutes <= 0) return [];
  const slots: Slot[] = [];
  for (const range of bookableRanges) {
    for (let t = range.startMin; t + slotMinutes <= range.endMin; t += slotMinutes) {
      const slotEnd = t + slotMinutes;
      const overlaps = cuts.some((c) => t < c.endMin && slotEnd > c.startMin);
      if (!overlaps) slots.push({ startMin: t, endMin: slotEnd });
    }
  }
  return slots.sort((a, b) => a.startMin - b.startMin);
}

export type DateBookingStatus = "green" | "red" | "gray";

// gray  = no patient-bookable ranges on this date at all (not opened for
//         online booking — regardless of whether the provider is working)
// red   = patient-bookable ranges exist, but every slot that fits is taken
// green = at least one bookable slot remains
export function classifyDate(bookableRanges: AvailRange[], cuts: { startMin: number; endMin: number }[], slotMinutes: number): DateBookingStatus {
  const openRanges = bookableRanges.filter((r) => r.patientBookable);
  if (openRanges.length === 0) return "gray";
  const slots = computeBookableSlots(openRanges, cuts, slotMinutes);
  return slots.length > 0 ? "green" : "red";
}

// Convenience: pull the cuts (blocks + non-cancelled booked appointments)
// out of a DayAvailability + an appointment list already filtered to one
// provider/date.
export function cutsFor(avail: DayAvailability | undefined, bookedRanges: { startMin: number; endMin: number }[]): { startMin: number; endMin: number }[] {
  const blockCuts = (avail?.blocks ?? []).map((b) => ({ startMin: b.startMin, endMin: b.endMin }));
  return [...blockCuts, ...bookedRanges];
}
