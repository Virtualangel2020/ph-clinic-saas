// Shared shape for clinic_settings' Patient Access & Payments default
// columns. set_clinic_patient_access_defaults takes every field in one
// call (it's a single settings row), so every sub-page that saves ANY of
// these must fetch and pass through the FULL current row — never a
// partial one — or a save from, say, the Booking page would silently
// blank out the Messaging/HMO defaults nobody touched. Each settings
// sub-page fetches this full row and spreads it unchanged except for the
// specific fields that page owns.
export type ClinicPatientAccessRow = {
  default_booking_type: string;
  default_prioritize_scheduled: boolean;
  booking_cutoff_minutes: number;
  max_advance_booking_days: number;
  default_arrival_reminder_enabled: boolean;
  default_arrival_reminder_minutes: number;
  default_appointment_instructions: string | null;
  default_messaging_enabled: boolean;
  default_messaging_audience: string;
  default_messaging_availability_mode: string;
  default_messaging_before_days: number | null;
  default_messaging_after_days: number | null;
  default_messaging_outside_hours_behavior: string;
  default_messaging_disclaimer: string | null;
  accept_hmo: boolean;
  accept_yakap: boolean;
  yakap_instructions: string | null;
};

export const CLINIC_PATIENT_ACCESS_COLUMNS =
  "default_booking_type, default_prioritize_scheduled, booking_cutoff_minutes, max_advance_booking_days, default_arrival_reminder_enabled, default_arrival_reminder_minutes, default_appointment_instructions, default_messaging_enabled, default_messaging_audience, default_messaging_availability_mode, default_messaging_before_days, default_messaging_after_days, default_messaging_outside_hours_behavior, default_messaging_disclaimer, accept_hmo, accept_yakap, yakap_instructions";

export const CLINIC_PATIENT_ACCESS_DEFAULTS: ClinicPatientAccessRow = {
  default_booking_type: "both",
  default_prioritize_scheduled: false,
  booking_cutoff_minutes: 0,
  max_advance_booking_days: 30,
  default_arrival_reminder_enabled: false,
  default_arrival_reminder_minutes: 15,
  default_appointment_instructions: null,
  default_messaging_enabled: false,
  default_messaging_audience: "all_established",
  default_messaging_availability_mode: "always",
  default_messaging_before_days: null,
  default_messaging_after_days: null,
  default_messaging_outside_hours_behavior: "allow_queue",
  default_messaging_disclaimer: "Portal messaging is not intended for emergencies.",
  accept_hmo: false,
  accept_yakap: false,
  yakap_instructions: null,
};

export function toDefaultsActionInput(row: ClinicPatientAccessRow) {
  return {
    defaultBookingType: row.default_booking_type,
    defaultPrioritizeScheduled: row.default_prioritize_scheduled,
    bookingCutoffMinutes: row.booking_cutoff_minutes,
    maxAdvanceBookingDays: row.max_advance_booking_days,
    defaultArrivalReminderEnabled: row.default_arrival_reminder_enabled,
    defaultArrivalReminderMinutes: row.default_arrival_reminder_minutes,
    defaultAppointmentInstructions: row.default_appointment_instructions,
    defaultMessagingEnabled: row.default_messaging_enabled,
    defaultMessagingAudience: row.default_messaging_audience,
    defaultMessagingAvailabilityMode: row.default_messaging_availability_mode,
    defaultMessagingBeforeDays: row.default_messaging_before_days,
    defaultMessagingAfterDays: row.default_messaging_after_days,
    defaultMessagingOutsideHoursBehavior: row.default_messaging_outside_hours_behavior,
    defaultMessagingDisclaimer: row.default_messaging_disclaimer,
    acceptHmo: row.accept_hmo,
    acceptYakap: row.accept_yakap,
    yakapInstructions: row.yakap_instructions,
  };
}

// Same passthrough problem exists for provider overrides:
// set_provider_patient_access_settings takes every override field in one
// call, so a page that only edits (say) messaging must pass through the
// provider's existing booking/HMO override fields unchanged rather than
// nulling them out.
export type ProviderOverrideRow = {
  provider_id: string;
  booking_type: string | null;
  prioritize_scheduled: boolean | null;
  booking_cutoff_minutes: number | null;
  max_advance_booking_days: number | null;
  arrival_reminder_enabled: boolean | null;
  arrival_reminder_minutes: number | null;
  custom_instructions: string | null;
  accept_hmo: boolean | null;
  accept_yakap: boolean | null;
  messaging_enabled: boolean | null;
  messaging_audience: string | null;
  messaging_availability_mode: string | null;
  messaging_before_days: number | null;
  messaging_after_days: number | null;
  messaging_outside_hours_behavior: string | null;
  messaging_disclaimer: string | null;
};

export function emptyOverride(providerId: string): ProviderOverrideRow {
  return {
    provider_id: providerId,
    booking_type: null,
    prioritize_scheduled: null,
    booking_cutoff_minutes: null,
    max_advance_booking_days: null,
    arrival_reminder_enabled: null,
    arrival_reminder_minutes: null,
    custom_instructions: null,
    accept_hmo: null,
    accept_yakap: null,
    messaging_enabled: null,
    messaging_audience: null,
    messaging_availability_mode: null,
    messaging_before_days: null,
    messaging_after_days: null,
    messaging_outside_hours_behavior: null,
    messaging_disclaimer: null,
  };
}

export function toOverrideActionInput(row: ProviderOverrideRow) {
  return {
    providerId: row.provider_id,
    bookingType: row.booking_type,
    prioritizeScheduled: row.prioritize_scheduled,
    bookingCutoffMinutes: row.booking_cutoff_minutes,
    maxAdvanceBookingDays: row.max_advance_booking_days,
    arrivalReminderEnabled: row.arrival_reminder_enabled,
    arrivalReminderMinutes: row.arrival_reminder_minutes,
    customInstructions: row.custom_instructions,
    acceptHmo: row.accept_hmo,
    acceptYakap: row.accept_yakap,
    messagingEnabled: row.messaging_enabled,
    messagingAudience: row.messaging_audience,
    messagingAvailabilityMode: row.messaging_availability_mode,
    messagingBeforeDays: row.messaging_before_days,
    messagingAfterDays: row.messaging_after_days,
    messagingOutsideHoursBehavior: row.messaging_outside_hours_behavior,
    messagingDisclaimer: row.messaging_disclaimer,
  };
}

export function isOverrideCustomized(row: ProviderOverrideRow | null | undefined): boolean {
  if (!row) return false;
  return Object.entries(row).some(([k, v]) => k !== "provider_id" && v !== null);
}
