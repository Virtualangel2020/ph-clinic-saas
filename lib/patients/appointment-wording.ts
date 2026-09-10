// Shared "how do we describe this appointment to the patient" wording —
// previously inline only in app/portal/appointments/page.tsx, now also
// needed by the dashboard's "Coming Up" card (spec Part 33/Design #6:
// "same data everywhere"). A flexible-arrival or walk-in-intent row's
// start_at/end_at is that day's whole clinic-hours window, never a
// personal slot (see appointments.booking_mode), so it's described as a
// window/date rather than an exact time — this is the one piece of
// booking-mode-aware copy that must never drift between the two places
// it's shown.

function fmtDate(iso: string) {
  return new Date(iso).toLocaleString("en-PH", { dateStyle: "medium", timeStyle: "short" });
}
function fmtDateOnly(iso: string) {
  return new Date(iso).toLocaleDateString("en-PH", { dateStyle: "medium" });
}
function fmtTimeOnly(iso: string) {
  return new Date(iso).toLocaleTimeString("en-PH", { timeStyle: "short" });
}

export type AppointmentWording = {
  headline: string;
  subline: string | null;
};

export function appointmentWording(a: {
  booking_mode?: string | null;
  start_at: string;
  end_at: string;
  expected_arrival_at?: string | null;
}): AppointmentWording {
  const bookingMode = a.booking_mode ?? "scheduled";
  if (bookingMode === "flexible_arrival") {
    return {
      headline: fmtDateOnly(a.start_at),
      subline: `Flexible arrival: ${fmtTimeOnly(a.start_at)}–${fmtTimeOnly(a.end_at)}${a.expected_arrival_at ? ` · Planned arrival ~${fmtTimeOnly(a.expected_arrival_at)}` : ""} — not a guaranteed time`,
    };
  }
  if (bookingMode === "walk_in_intent") {
    return {
      headline: fmtDateOnly(a.start_at),
      subline: `Walk-in — available ${fmtTimeOnly(a.start_at)}–${fmtTimeOnly(a.end_at)} — not a guaranteed time`,
    };
  }
  return { headline: fmtDate(a.start_at), subline: null };
}
