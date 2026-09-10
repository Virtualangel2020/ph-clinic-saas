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
  } | null;
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
