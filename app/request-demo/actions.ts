"use server";

import { createClient } from "@/lib/supabase/server";

// Public — no auth required. RLS on demo_requests only allows INSERT (see
// migration public_site_and_commercial_v2), so this can't be abused to read
// or edit other leads even though it runs with the caller's own (anonymous)
// session.
export async function submitDemoRequestAction(input: {
  fullName: string;
  clinicName: string;
  email: string;
  phone: string;
  location: string;
  specialty: string;
  providerCount: string;
  currentSystem: string;
  helpWith: string;
  message: string;
}) {
  if (!input.fullName.trim() || !input.clinicName.trim() || !input.email.trim()) {
    throw new Error("Please fill in your name, clinic name, and email.");
  }

  const supabase = await createClient();
  const { error } = await supabase.from("demo_requests").insert({
    full_name: input.fullName.trim(),
    clinic_name: input.clinicName.trim(),
    email: input.email.trim(),
    phone: input.phone.trim() || null,
    location: input.location.trim() || null,
    specialty: input.specialty.trim() || null,
    provider_count: input.providerCount || null,
    current_system: input.currentSystem.trim() || null,
    help_with: input.helpWith.trim() || null,
    message: input.message.trim() || null,
  });
  if (error) throw new Error(error.message);
}
