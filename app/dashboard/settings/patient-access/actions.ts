"use server";

import { revalidatePath } from "next/cache";
import { requireClinicAdmin } from "@/lib/require-clinic-admin";

// Every action here just forwards to a SECURITY DEFINER RPC (see migration
// patient_access_and_payments_rpcs) — the RPC itself re-checks
// is_clinic_admin() and tenant scope, so nothing here carries any
// elevated privilege of its own. revalidatePath covers every page that
// reads this data so a save is reflected immediately everywhere
// (settings pages, and eventually the patient-facing preview).

const REVALIDATE_PATHS = [
  "/dashboard/settings/patient-access",
  "/dashboard/settings/patient-access/booking",
  "/dashboard/settings/patient-access/services",
  "/dashboard/settings/patient-access/coverage",
  "/dashboard/settings/patient-access/messaging",
  "/dashboard/settings/patient-access/cancellation",
];

function revalidateAll() {
  for (const p of REVALIDATE_PATHS) revalidatePath(p);
}

export async function setClinicPatientAccessDefaultsAction(input: {
  defaultBookingType: string;
  defaultPrioritizeScheduled: boolean;
  bookingCutoffMinutes: number;
  maxAdvanceBookingDays: number;
  defaultArrivalReminderEnabled: boolean;
  defaultArrivalReminderMinutes: number;
  defaultAppointmentInstructions: string | null;
  defaultMessagingEnabled: boolean;
  defaultMessagingAudience: string;
  defaultMessagingAvailabilityMode: string;
  defaultMessagingBeforeDays: number | null;
  defaultMessagingAfterDays: number | null;
  defaultMessagingOutsideHoursBehavior: string;
  defaultMessagingDisclaimer: string | null;
  acceptHmo: boolean;
  acceptYakap: boolean;
  yakapInstructions: string | null;
}) {
  const { supabase } = await requireClinicAdmin();
  const { error } = await supabase.rpc("set_clinic_patient_access_defaults", {
    p_default_booking_type: input.defaultBookingType,
    p_default_prioritize_scheduled: input.defaultPrioritizeScheduled,
    p_booking_cutoff_minutes: input.bookingCutoffMinutes,
    p_max_advance_booking_days: input.maxAdvanceBookingDays,
    p_default_arrival_reminder_enabled: input.defaultArrivalReminderEnabled,
    p_default_arrival_reminder_minutes: input.defaultArrivalReminderMinutes,
    p_default_appointment_instructions: input.defaultAppointmentInstructions,
    p_default_messaging_enabled: input.defaultMessagingEnabled,
    p_default_messaging_audience: input.defaultMessagingAudience,
    p_default_messaging_availability_mode: input.defaultMessagingAvailabilityMode,
    p_default_messaging_before_days: input.defaultMessagingBeforeDays,
    p_default_messaging_after_days: input.defaultMessagingAfterDays,
    p_default_messaging_outside_hours_behavior: input.defaultMessagingOutsideHoursBehavior,
    p_default_messaging_disclaimer: input.defaultMessagingDisclaimer,
    p_accept_hmo: input.acceptHmo,
    p_accept_yakap: input.acceptYakap,
    p_yakap_instructions: input.yakapInstructions,
  });
  if (error) throw new Error(error.message);
  revalidateAll();
}

export type ProviderOverrideInput = {
  providerId: string;
  bookingType: string | null;
  prioritizeScheduled: boolean | null;
  bookingCutoffMinutes: number | null;
  maxAdvanceBookingDays: number | null;
  arrivalReminderEnabled: boolean | null;
  arrivalReminderMinutes: number | null;
  customInstructions: string | null;
  acceptHmo: boolean | null;
  acceptYakap: boolean | null;
  messagingEnabled: boolean | null;
  messagingAudience: string | null;
  messagingAvailabilityMode: string | null;
  messagingBeforeDays: number | null;
  messagingAfterDays: number | null;
  messagingOutsideHoursBehavior: string | null;
  messagingDisclaimer: string | null;
};

// Passing every field as null reverts the provider to "Use Clinic
// Defaults" (the row still exists but every column inherits).
export async function setProviderPatientAccessSettingsAction(input: ProviderOverrideInput) {
  const { supabase } = await requireClinicAdmin();
  const { error } = await supabase.rpc("set_provider_patient_access_settings", {
    p_provider_id: input.providerId,
    p_booking_type: input.bookingType,
    p_prioritize_scheduled: input.prioritizeScheduled,
    p_booking_cutoff_minutes: input.bookingCutoffMinutes,
    p_max_advance_booking_days: input.maxAdvanceBookingDays,
    p_arrival_reminder_enabled: input.arrivalReminderEnabled,
    p_arrival_reminder_minutes: input.arrivalReminderMinutes,
    p_custom_instructions: input.customInstructions,
    p_accept_hmo: input.acceptHmo,
    p_accept_yakap: input.acceptYakap,
    p_messaging_enabled: input.messagingEnabled,
    p_messaging_audience: input.messagingAudience,
    p_messaging_availability_mode: input.messagingAvailabilityMode,
    p_messaging_before_days: input.messagingBeforeDays,
    p_messaging_after_days: input.messagingAfterDays,
    p_messaging_outside_hours_behavior: input.messagingOutsideHoursBehavior,
    p_messaging_disclaimer: input.messagingDisclaimer,
  });
  if (error) throw new Error(error.message);
  revalidateAll();
}

export async function revertProviderToClinicDefaultsAction(providerId: string) {
  return setProviderPatientAccessSettingsAction({
    providerId,
    bookingType: null,
    prioritizeScheduled: null,
    bookingCutoffMinutes: null,
    maxAdvanceBookingDays: null,
    arrivalReminderEnabled: null,
    arrivalReminderMinutes: null,
    customInstructions: null,
    acceptHmo: null,
    acceptYakap: null,
    messagingEnabled: null,
    messagingAudience: null,
    messagingAvailabilityMode: null,
    messagingBeforeDays: null,
    messagingAfterDays: null,
    messagingOutsideHoursBehavior: null,
    messagingDisclaimer: null,
  });
}

export async function setProviderMessagingHoursAction(providerId: string, hours: { dayOfWeek: number; startTime: string; endTime: string }[]) {
  const { supabase } = await requireClinicAdmin();
  const { error } = await supabase.rpc("set_provider_messaging_hours", {
    p_provider_id: providerId,
    p_hours: hours.map((h) => ({ day_of_week: h.dayOfWeek, start_time: h.startTime, end_time: h.endTime })),
  });
  if (error) throw new Error(error.message);
  revalidateAll();
}

export async function setProviderMessagingAllowedPatientsAction(providerId: string, patientIds: string[]) {
  const { supabase } = await requireClinicAdmin();
  const { error } = await supabase.rpc("set_provider_messaging_allowed_patients", { p_provider_id: providerId, p_patient_ids: patientIds });
  if (error) throw new Error(error.message);
  revalidateAll();
}

export async function setAppointmentTypeProvidersAction(appointmentTypeId: string, providerIds: string[]) {
  const { supabase } = await requireClinicAdmin();
  const { error } = await supabase.rpc("set_appointment_type_providers", { p_appointment_type_id: appointmentTypeId, p_provider_ids: providerIds });
  if (error) throw new Error(error.message);
  revalidateAll();
}

export async function setServiceAction(input: {
  id: string | null;
  name: string;
  color: string;
  durationMinutes: number;
  description: string;
  isActive: boolean;
  sortOrder: number;
  pricePhp: number | null;
  priceMaxPhp: number | null;
  priceType: string;
  showPriceToPatient: boolean;
  allowAdvancePayment: boolean;
  requireAdvancePayment: boolean;
  patientBookingEnabled: boolean;
  deliveryMode: string;
}) {
  const { supabase } = await requireClinicAdmin();
  const { data, error } = await supabase.rpc("set_appointment_type", {
    p_id: input.id,
    p_name: input.name,
    p_color: input.color,
    p_duration_minutes: input.durationMinutes,
    p_description: input.description || null,
    p_is_active: input.isActive,
    p_sort_order: input.sortOrder,
    p_price_php: input.pricePhp,
    p_price_max_php: input.priceMaxPhp,
    p_price_type: input.priceType,
    p_show_price_to_patient: input.showPriceToPatient,
    p_allow_advance_payment: input.allowAdvancePayment,
    p_require_advance_payment: input.requireAdvancePayment,
    p_patient_booking_enabled: input.patientBookingEnabled,
    p_delivery_mode: input.deliveryMode,
  });
  if (error) throw new Error(error.message);
  revalidateAll();
  revalidatePath("/dashboard/settings/calendar");
  return data as string;
}

export async function setClinicAcceptedHmoAction(input: {
  id: string | null;
  hmoName: string;
  isActive: boolean;
  verificationRequirement: string;
  patientInstructions: string | null;
  notes: string | null;
}) {
  const { supabase } = await requireClinicAdmin();
  const { error } = await supabase.rpc("set_clinic_accepted_hmo", {
    p_id: input.id,
    p_hmo_name: input.hmoName,
    p_is_active: input.isActive,
    p_verification_requirement: input.verificationRequirement,
    p_patient_instructions: input.patientInstructions,
    p_notes: input.notes,
  });
  if (error) throw new Error(error.message);
  revalidateAll();
}

export async function setProviderHmoAcceptanceAction(providerId: string, hmoIds: string[]) {
  const { supabase } = await requireClinicAdmin();
  const { error } = await supabase.rpc("set_provider_hmo_acceptance", { p_provider_id: providerId, p_hmo_ids: hmoIds });
  if (error) throw new Error(error.message);
  revalidateAll();
}

export async function setCancellationPolicyAction(scope: "clinic" | "provider", providerId: string | null, policy: any) {
  const { supabase } = await requireClinicAdmin();
  const { error } = await supabase.rpc("set_cancellation_policy", { p_scope: scope, p_provider_id: providerId, p_policy: policy });
  if (error) throw new Error(error.message);
  revalidateAll();
}

export async function setPatientAccessSetupCompletedAction(completed: boolean) {
  const { supabase } = await requireClinicAdmin();
  const { error } = await supabase.rpc("set_patient_access_setup_completed", { p_completed: completed });
  if (error) throw new Error(error.message);
  revalidateAll();
  revalidatePath("/dashboard/settings");
}
