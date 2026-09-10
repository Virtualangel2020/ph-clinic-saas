"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requirePatientPortal } from "@/lib/require-patient-portal";

// Booking is deliberately lighter than requirePatientPortal(): a
// self-registered patient (platform mycaredesk_accounts identity only, no
// clinic relationship yet) must be able to reach and complete a booking —
// per Angel, "the only time patient's account gets linked to a provider
// is if they book with this certain doctor." requirePatientPortal()
// requires that clinic link to ALREADY exist, which is exactly backwards
// for a first-time booking. This only confirms there's a signed-in
// session; self_book_ensure_clinic_patient (called below, before the real
// booking RPCs) is what actually creates the clinic-side link on demand.
async function requireSignedIn() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Please sign in first.");
  return { supabase, user };
}

// Availability read — deliberately does NOT require portal auth (the RPC
// itself is gated to public_directory_enabled providers only, same as
// the profile) so a not-yet-logged-in visitor bounced to /portal/login
// can still preview a calendar once they land here. No patient identity
// is ever returned, only bare busy time ranges.
export async function fetchProviderAvailabilityAction(providerId: string, startDate: string, endDate: string) {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("public_get_provider_availability", { p_provider_id: providerId, p_start_date: startDate, p_end_date: endDate });
  if (error) throw new Error(error.message);
  return data as {
    schedules: { day_of_week: number; start_time: string; end_time: string; patient_bookable: boolean }[];
    date_availability: { avail_date: string; start_time: string; end_time: string; patient_bookable: boolean }[];
    time_blocks: { block_date: string; start_time: string; end_time: string }[];
    busy: { start_at: string; end_at: string }[];
    flexible_arrival_daily_counts: { date: string; count: number }[];
  } | null;
}

// Read-only pre-check the wizard uses to decide whether to show the
// "your profile will be shared with this provider" consent step — true
// only the first time this patient connects with this provider's clinic;
// once self_book_ensure_clinic_patient has run for them, later bookings
// with the SAME provider skip the consent step (they've already agreed).
export async function checkExistingClinicLinkAction(providerId: string): Promise<boolean> {
  const { supabase } = await requireSignedIn();
  const { data, error } = await supabase.rpc("self_book_check_existing_link", { p_provider_id: providerId });
  if (error) throw new Error(error.message);
  return !!data;
}

export async function bookAppointmentAction(input: {
  providerId: string;
  appointmentTypeId: string;
  startAt: string;
  paymentMethod: string;
  hmoId: string | null;
  notes?: string;
}): Promise<{ id: string; patientId: string }> {
  const { supabase } = await requireSignedIn();

  // First contact with this clinic? This creates the patients row +
  // active patient_portal_accounts link from the caller's own
  // mycaredesk_accounts data. Already connected (booked before, staff
  // invited them, or they claimed a dedup match)? Idempotent — returns
  // that same patient, never a second one.
  const { data: patientId, error: ensureError } = await supabase.rpc("self_book_ensure_clinic_patient", { p_provider_id: input.providerId });
  if (ensureError) throw new Error(ensureError.message);

  const { data, error } = await supabase.rpc("portal_book_appointment", {
    p_provider_id: input.providerId,
    p_appointment_type_id: input.appointmentTypeId,
    p_start_at: input.startAt,
    p_payment_method: input.paymentMethod,
    p_hmo_id: input.hmoId,
    p_notes: input.notes || null,
  });
  if (error) throw new Error(error.message);
  revalidatePath("/portal/appointments");
  return { id: data as string, patientId: patientId as string };
}

// Booking counterpart to bookAppointmentAction for the two new booking
// styles (spec Parts 5-6) — same self_book_ensure_clinic_patient
// first-contact step, then portal_book_flexible_or_walkin instead of
// portal_book_appointment. windowStart/windowEnd are that day's published
// clinic-hours (computed client-side from the same availability data the
// calendar already fetched — see the RPC's own comment on why this isn't
// a security boundary).
export async function bookFlexibleOrWalkInAction(input: {
  providerId: string;
  appointmentTypeId: string;
  bookingMode: "flexible_arrival" | "walk_in_intent";
  windowStart: string;
  windowEnd: string;
  expectedArrivalAt?: string | null;
  paymentMethod: string;
  hmoId: string | null;
  notes?: string;
}): Promise<{ id: string; patientId: string }> {
  const { supabase } = await requireSignedIn();

  const { data: patientId, error: ensureError } = await supabase.rpc("self_book_ensure_clinic_patient", { p_provider_id: input.providerId });
  if (ensureError) throw new Error(ensureError.message);

  const { data, error } = await supabase.rpc("portal_book_flexible_or_walkin", {
    p_provider_id: input.providerId,
    p_appointment_type_id: input.appointmentTypeId,
    p_booking_mode: input.bookingMode,
    p_window_start: input.windowStart,
    p_window_end: input.windowEnd,
    p_expected_arrival_at: input.bookingMode === "flexible_arrival" ? input.expectedArrivalAt || null : null,
    p_notes: input.notes || null,
    p_payment_method: input.paymentMethod,
    p_hmo_id: input.hmoId,
  });
  if (error) throw new Error(error.message);
  revalidatePath("/portal/appointments");
  return { id: data as string, patientId: patientId as string };
}

export async function submitPortalAppointmentRequestAction(input: { providerId: string; appointmentTypeName: string; preferredDate: string; preferredTime: string; reason: string }) {
  const { supabase } = await requireSignedIn();

  const { error: ensureError } = await supabase.rpc("self_book_ensure_clinic_patient", { p_provider_id: input.providerId });
  if (ensureError) throw new Error(ensureError.message);

  const { data, error } = await supabase.rpc("portal_submit_appointment_request", {
    p_provider_id: input.providerId,
    p_appointment_type_name: input.appointmentTypeName,
    p_preferred_date: input.preferredDate || null,
    p_preferred_time: input.preferredTime || null,
    p_reason: input.reason || null,
  });
  if (error) throw new Error(error.message);
  return data as string;
}

// Patient Dashboard's "Schedule Follow-Up" deep link (Task #136, spec Part
// 19/Design #3) — called once a real appointment id exists from either
// bookAppointmentAction or bookFlexibleOrWalkInAction above, never before.
// patient_schedule_follow_up re-verifies both the follow-up and the
// appointment belong to the calling patient and that the follow-up hasn't
// already been resolved some other way in the meantime; best-effort from
// the wizard's point of view — a failure here never undoes the booking
// that already succeeded.
export async function scheduleFollowUpAction(followUpId: string, appointmentId: string): Promise<{ ok: boolean; error?: string }> {
  const { supabase } = await requireSignedIn();
  const { error } = await supabase.rpc("patient_schedule_follow_up", { p_follow_up_id: followUpId, p_appointment_id: appointmentId });
  if (error) return { ok: false, error: error.message };
  revalidatePath("/portal");
  return { ok: true };
}

export async function recordPolicyAcknowledgementAction(input: { patientId: string; appointmentId: string | null; policyVersion: number; policySnapshot: any }) {
  const { supabase } = await requirePatientPortal();
  const { data, error } = await supabase.rpc("record_patient_policy_acknowledgement", {
    p_patient_id: input.patientId,
    p_appointment_id: input.appointmentId,
    p_policy_version: input.policyVersion,
    p_policy_snapshot: input.policySnapshot,
    p_created_via: "portal_booking",
  });
  if (error) throw new Error(error.message);
  return data as string;
}
