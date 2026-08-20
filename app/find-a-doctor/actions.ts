"use server";

import { createClient } from "@/lib/supabase/server";

// Public — no auth required. RLS on public_appointment_requests only lets
// this succeed if the target provider actually has
// public_booking_mode='request' AND public_directory_enabled=true (see
// migration public_site_and_commercial_v3), so this can't be used to spam
// a provider who hasn't opted in to public requests.
export async function submitAppointmentRequestAction(input: {
  providerId: string;
  patientName: string;
  patientPhone: string;
  patientEmail: string;
  reason: string;
  preferredDate: string;
  preferredTime: string;
}) {
  if (!input.patientName.trim() || !input.patientPhone.trim()) {
    throw new Error("Please enter your name and phone number.");
  }

  const supabase = await createClient();

  // user_profiles has no anon-read RLS policy by design (Part 62-67), so
  // tenant_id can't be looked up with a direct table query here — instead
  // we resolve it via the same public, hand-picked RPC used to render the
  // directory, never trusting a client-supplied tenant id.
  const { data: providers } = await supabase.rpc("public_list_directory_providers");
  const provider = (providers ?? []).find((p: any) => p.id === input.providerId);
  if (!provider) throw new Error("This provider isn't accepting public requests right now.");

  const { error } = await supabase.from("public_appointment_requests").insert({
    tenant_id: provider.tenant_id,
    provider_user_id: input.providerId,
    patient_name: input.patientName.trim(),
    patient_phone: input.patientPhone.trim(),
    patient_email: input.patientEmail.trim() || null,
    reason: input.reason.trim() || null,
    preferred_date: input.preferredDate || null,
    preferred_time: input.preferredTime || null,
  });
  if (error) throw new Error(error.message);
}
