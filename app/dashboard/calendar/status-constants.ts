// Shared appointment-status vocabulary (Phase 1: Status + settings
// foundation — see migration scheduling_phase1_foundation). Single source of
// truth for the 10-value status lifecycle so the Settings > Calendar color
// picker, the calendar chips, and the appointment form's status buttons
// can't drift out of sync with each other or with the DB CHECK constraint.

export const STATUS_LIST = [
  "scheduled",
  "confirmed",
  "checked_in",
  "waiting",
  "with_provider",
  "completed",
  "cancelled",
  "no_show",
  "walk_in",
  "late_cancellation",
] as const;

export type AppointmentStatus = (typeof STATUS_LIST)[number];

export const STATUS_LABEL: Record<string, string> = {
  scheduled: "Scheduled",
  confirmed: "Confirmed",
  checked_in: "Checked In",
  waiting: "Waiting",
  with_provider: "With Provider",
  completed: "Completed",
  cancelled: "Cancelled",
  no_show: "No-show",
  walk_in: "Walk-in",
  late_cancellation: "Late Cancellation",
};

// Non-color-only indicator: a short glyph shown next to the color dot so
// status is never conveyed by color alone (colorblind-safe). Paired with
// the text label everywhere it's rendered.
export const STATUS_GLYPH: Record<string, string> = {
  scheduled: "○",
  confirmed: "◐",
  checked_in: "●",
  waiting: "◷",
  with_provider: "◉",
  completed: "✓",
  cancelled: "✕",
  no_show: "▲",
  walk_in: "◆",
  late_cancellation: "✕",
};

export const DEFAULT_STATUS_COLORS: Record<string, string> = {
  scheduled: "#8ea9db",
  confirmed: "#4a86e8",
  checked_in: "#93c47d",
  waiting: "#f6b26b",
  with_provider: "#c27ba0",
  completed: "#6aa84f",
  cancelled: "#999999",
  no_show: "#cc0000",
  walk_in: "#a64d79",
  late_cancellation: "#e69138",
};

export const DEFAULT_AVAILABILITY_COLORS: Record<string, string> = {
  unavailable: "#4b5563",
  available: "#e5e7eb",
};

// Statuses that stop the normal forward-progress button row — the visit is
// over one way or another, only a manual re-open (not built here) would
// move it further.
export const TERMINAL_STATUSES = new Set(["completed", "cancelled", "no_show", "late_cancellation"]);

// The "next step" progression offered as quick-action buttons on an
// in-progress appointment. Cancel / no-show / late-cancellation are
// separate destructive-ish actions, not part of the forward flow.
export const STATUS_FLOW: { key: AppointmentStatus; label: string }[] = [
  { key: "scheduled", label: "Scheduled" },
  { key: "confirmed", label: "Confirmed" },
  { key: "checked_in", label: "Checked In" },
  { key: "waiting", label: "Waiting" },
  { key: "with_provider", label: "With Provider" },
  { key: "completed", label: "Completed" },
];

export function statusColor(colors: Record<string, string> | undefined, status: string): string {
  return colors?.[status] ?? DEFAULT_STATUS_COLORS[status] ?? "#888";
}
