// Clinic-default + provider-override resolution — the read-side mirror of
// the write-side pattern established in
// app/dashboard/settings/patient-access/shared.ts. Any surface that needs
// to know "what does this provider actually do" (public provider
// profile, Find a Doctor filters, the Patient Portal booking flow) goes
// through this instead of re-implementing the null-means-inherit logic
// inline — a NULL column on provider_patient_access_settings always means
// "use the clinic_settings value," never a hardcoded fallback.

export type ClinicDefaultsRow = {
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
  cancellation_policy: any;
  cancellation_policy_version: number;
  accept_online_payments: boolean;
};

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
  cancellation_policy: any | null;
  cancellation_policy_version: number | null;
} | null | undefined;

export type EffectivePatientAccessSettings = {
  bookingType: string;
  prioritizeScheduled: boolean;
  bookingCutoffMinutes: number;
  maxAdvanceBookingDays: number;
  arrivalReminderEnabled: boolean;
  arrivalReminderMinutes: number;
  customInstructions: string | null;
  acceptHmo: boolean;
  acceptYakap: boolean;
  messagingEnabled: boolean;
  messagingAudience: string;
  messagingAvailabilityMode: string;
  messagingBeforeDays: number | null;
  messagingAfterDays: number | null;
  messagingOutsideHoursBehavior: string;
  messagingDisclaimer: string | null;
  cancellationPolicy: any;
  cancellationPolicyVersion: number;
  acceptOnlinePayments: boolean;
};

function pick<T>(override: T | null | undefined, fallback: T): T {
  return override === null || override === undefined ? fallback : override;
}

export function resolveEffectiveSettings(clinic: ClinicDefaultsRow, override: ProviderOverrideRow): EffectivePatientAccessSettings {
  return {
    bookingType: pick(override?.booking_type, clinic.default_booking_type),
    prioritizeScheduled: pick(override?.prioritize_scheduled, clinic.default_prioritize_scheduled),
    bookingCutoffMinutes: pick(override?.booking_cutoff_minutes, clinic.booking_cutoff_minutes),
    maxAdvanceBookingDays: pick(override?.max_advance_booking_days, clinic.max_advance_booking_days),
    arrivalReminderEnabled: pick(override?.arrival_reminder_enabled, clinic.default_arrival_reminder_enabled),
    arrivalReminderMinutes: pick(override?.arrival_reminder_minutes, clinic.default_arrival_reminder_minutes),
    customInstructions: pick(override?.custom_instructions, clinic.default_appointment_instructions),
    acceptHmo: pick(override?.accept_hmo, clinic.accept_hmo),
    acceptYakap: pick(override?.accept_yakap, clinic.accept_yakap),
    messagingEnabled: pick(override?.messaging_enabled, clinic.default_messaging_enabled),
    messagingAudience: pick(override?.messaging_audience, clinic.default_messaging_audience),
    messagingAvailabilityMode: pick(override?.messaging_availability_mode, clinic.default_messaging_availability_mode),
    messagingBeforeDays: pick(override?.messaging_before_days, clinic.default_messaging_before_days),
    messagingAfterDays: pick(override?.messaging_after_days, clinic.default_messaging_after_days),
    messagingOutsideHoursBehavior: pick(override?.messaging_outside_hours_behavior, clinic.default_messaging_outside_hours_behavior),
    messagingDisclaimer: pick(override?.messaging_disclaimer, clinic.default_messaging_disclaimer),
    // Cancellation policy is a wholesale override (not a field merge) —
    // see set_cancellation_policy.
    cancellationPolicy: override?.cancellation_policy ?? clinic.cancellation_policy,
    cancellationPolicyVersion: override?.cancellation_policy_version ?? clinic.cancellation_policy_version,
    acceptOnlinePayments: clinic.accept_online_payments,
  };
}

export const BOOKING_TYPE_PATIENT_WORDING: Record<string, string> = {
  walk_in: "Walk-ins welcome — no appointment needed.",
  appointment: "By appointment only — book a time online.",
  both: "Walk-ins welcome, or book ahead to reserve a time.",
  appointment_request: "Request a preferred time — the clinic will confirm.",
  flexible: "General hours shown — contact the clinic to check availability.",
};

export const BOOKING_TYPE_LABEL: Record<string, string> = {
  walk_in: "Walk-In Only",
  appointment: "Appointment Only",
  both: "Walk-In + Appointment",
  appointment_request: "Appointment Request",
  flexible: "Flexible / Variable Schedule",
};

// Whether this provider's booking type supports the real slot-picking
// flow at all (vs. walk-in-only / flexible, which never show a calendar).
export function supportsSlotBooking(bookingType: string): boolean {
  return bookingType === "appointment" || bookingType === "both" || bookingType === "appointment_request";
}
