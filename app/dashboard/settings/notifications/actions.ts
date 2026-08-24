"use server";

import { revalidatePath } from "next/cache";
import { requireClinicMember } from "@/lib/require-clinic-member";

// Personal notification preferences (which events raise an alert, and how).
// This is a per-user preference, not a clinic-wide policy, so it only
// requires clinic membership — not admin — unlike most of settings/actions.ts.
//
// NOTE: saving here does not yet cause anything to be delivered. There is
// no staff-facing notification pipeline in this app yet (patient portal
// sends — lib/patient-portal/send.ts — are a separate, patient-only system).
// This just persists what the user wants, ready for delivery once that
// pipeline exists.

export type NotificationPrefInput = {
  eventKey: string;
  inApp: boolean;
  email: boolean;
};

export async function saveNotificationPreferencesAction(prefs: NotificationPrefInput[]) {
  const { supabase } = await requireClinicMember();

  const { error } = await supabase.rpc("set_notification_preferences", {
    p_prefs: prefs.map((p) => ({ eventKey: p.eventKey, inApp: p.inApp, email: p.email })),
  });
  if (error) throw new Error(error.message);

  revalidatePath("/dashboard/settings/notifications");
}
