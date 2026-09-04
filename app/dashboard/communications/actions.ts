"use server";

import { revalidatePath } from "next/cache";
import { requireClinicMember } from "@/lib/require-clinic-member";
import { sendPortalEmail, sendPortalSms } from "@/lib/patient-portal/send";

// Sends a one-off Email or SMS to a single patient from the Communications
// page's compose widget, then logs the attempt (sent or failed) via the
// log_patient_communication RPC so it shows up in the page's history —
// same audit-trail shape as patient billing (add_patient_charge, etc).
// Sending itself is the SAME sendPortalEmail/sendPortalSms functions the
// Patient Portal invite flow already uses — no new provider integration,
// just a new place to reach the existing one from. If Resend/Semaphore
// isn't turned on with a real key yet, this logs a "failed" row with that
// exact reason and re-throws so the compose widget shows it.

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

// Pre-fills the compose widget's "to" field once a patient is picked —
// searchPatientsAction's own result type doesn't carry email (it's used in
// several other places that don't need it), so this is its own small
// lookup rather than widening that shared type.
export async function getPatientContactAction(patientId: string): Promise<{ email: string | null; mobilePhone: string | null }> {
  const { supabase, profile } = await requireClinicMember();
  const { data, error } = await supabase
    .from("patients")
    .select("email, mobile_phone")
    .eq("id", patientId)
    .eq("tenant_id", profile.tenant_id)
    .maybeSingle();
  if (error || !data) throw new Error("Patient not found.");
  return { email: data.email ?? null, mobilePhone: data.mobile_phone ?? null };
}

export async function sendPatientCommunicationAction(
  patientId: string,
  channel: "email" | "sms",
  toAddress: string,
  subject: string,
  message: string
): Promise<void> {
  const { supabase, profile } = await requireClinicMember();

  const to = toAddress.trim();
  const body = message.trim();
  if (!body) throw new Error("Write a message first.");
  if (channel === "email" && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to)) throw new Error("Enter a valid email address.");
  if (channel === "sms" && to.replace(/\D/g, "").length < 7) throw new Error("Enter a valid phone number.");

  const { data: patient, error: patientError } = await supabase
    .from("patients")
    .select("id, first_name, last_name")
    .eq("id", patientId)
    .eq("tenant_id", profile.tenant_id)
    .maybeSingle();
  if (patientError || !patient) throw new Error("Patient not found.");

  let status: "sent" | "failed" = "sent";
  let sendError: string | null = null;
  try {
    if (channel === "email") {
      await sendPortalEmail({
        toEmail: to,
        toName: `${patient.first_name} ${patient.last_name}`,
        subject: subject.trim() || "Message from your clinic",
        html: `<p>${escapeHtml(body).replace(/\n/g, "<br/>")}</p>`,
      });
    } else {
      await sendPortalSms({ toPhone: to, message: body });
    }
  } catch (e: any) {
    status = "failed";
    sendError = e?.message || "Couldn't send this message.";
  }

  const { error: logError } = await supabase.rpc("log_patient_communication", {
    p_patient_id: patientId,
    p_channel: channel,
    p_to_address: to,
    p_subject: channel === "email" ? subject.trim() || null : null,
    p_message: body,
    p_status: status,
    p_error: sendError,
  });
  if (logError) throw new Error(logError.message);

  revalidatePath("/dashboard/communications");
  if (sendError) throw new Error(sendError);
}
