"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { normalizePhMobile, sendPortalEmail, sendPortalSms } from "@/lib/patient-portal/send";
import { requirePatientPortal } from "@/lib/require-patient-portal";

// Same per-file helper used in app/dashboard/patients/actions.ts,
// app/dashboard/settings/actions.ts, and app/admin/actions.ts (not
// centralized in this codebase — kept consistent with that convention).
async function siteOrigin() {
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host");
  const proto = h.get("x-forwarded-proto") ?? "https";
  return `${proto}://${host}`;
}

// Public (pre-auth) activation flows. No session exists yet at this point
// — the invite token/OTP itself is the credential (same trust model as any
// password-reset link), verified by the RPCs in migration
// patient_portal_accounts. Account creation goes through the service-role
// admin client, mirroring how staff invites already work in
// app/dashboard/settings/actions.ts — there's no RLS-respecting way to
// create an auth user on someone else's behalf.

// Handles both the emailed activation link AND a staff-relayed in-person
// code (migration patient_portal_manual_channel) — either way this is a
// token lookup, and the contact_value it resolves to may be an email or a
// PH mobile number depending on which the patient had on file.
//
// Returns { error } instead of throwing. Next.js redacts the message of
// any error THROWN out of a Server Action in production ("An error
// occurred in the Server Components render...") to avoid leaking internal
// details — which meant every failure here (an expired code, a duplicate
// account, a real misconfiguration) showed the patient the exact same
// useless generic message. Returning a plain value instead is the
// supported way to get a real, safe message in front of the user.
export async function activateByTokenAction(token: string, password: string): Promise<{ error: string } | undefined> {
  try {
    const supabase = await createClient();

    const { data: invite, error: verifyError } = await supabase.rpc("verify_patient_portal_invite_token", { p_token: token.trim() });
    if (verifyError) return { error: verifyError.message };
    if (!invite) return { error: "That activation code is invalid or has expired. Please double-check it or ask your clinic to resend it." };

    const isEmail = invite.contact_value.includes("@");
    const admin = createAdminClient();
    const { data: created, error: createError } = await admin.auth.admin.createUser(
      isEmail
        ? { email: invite.contact_value, password, email_confirm: true }
        : { phone: normalizePhMobile(invite.contact_value), password, phone_confirm: true }
    );
    if (createError) {
      if (/already.*regist|already exist/i.test(createError.message)) {
        return { error: "An account with this contact info already exists on MyCareDesk — please contact your clinic for help activating your portal access." };
      }
      return { error: createError.message };
    }

    const { error: finalizeError } = await supabase.rpc("finalize_patient_portal_activation", {
      p_account_id: invite.account_id,
      p_auth_user_id: created.user!.id,
    });
    if (finalizeError) return { error: finalizeError.message };

    const { error: signInError } = await supabase.auth.signInWithPassword(
      isEmail ? { email: invite.contact_value, password } : { phone: normalizePhMobile(invite.contact_value), password }
    );
    if (signInError) return { error: "Account activated, but automatic sign-in failed — please sign in manually." };
  } catch (e: any) {
    console.error("activateByTokenAction failed:", e);
    return { error: "Something went wrong activating your account. Please try again, or contact your clinic if it keeps happening." };
  }
}

// Same return-instead-of-throw reasoning as activateByTokenAction above.
export async function activateByOtpAction(accountId: string, code: string, password: string): Promise<{ error: string } | undefined> {
  try {
    const supabase = await createClient();

    const { data: invite, error: verifyError } = await supabase.rpc("verify_patient_portal_otp", { p_account_id: accountId, p_code: code });
    if (verifyError) return { error: verifyError.message };
    if (!invite) return { error: "That code is invalid or has expired. Please double-check it or ask your clinic to resend it." };

    const phone = normalizePhMobile(invite.contact_value);
    const admin = createAdminClient();
    const { data: created, error: createError } = await admin.auth.admin.createUser({
      phone,
      password,
      phone_confirm: true,
    });
    if (createError) {
      if (/already.*regist|already exist/i.test(createError.message)) {
        return { error: "An account with this mobile number already exists on MyCareDesk — please contact your clinic for help activating your portal access." };
      }
      return { error: createError.message };
    }

    const { error: finalizeError } = await supabase.rpc("finalize_patient_portal_activation", {
      p_account_id: invite.account_id,
      p_auth_user_id: created.user!.id,
    });
    if (finalizeError) return { error: finalizeError.message };

    const { error: signInError } = await supabase.auth.signInWithPassword({ phone, password });
    if (signInError) return { error: "Account activated, but automatic sign-in failed — please sign in manually." };
  } catch (e: any) {
    console.error("activateByOtpAction failed:", e);
    return { error: "Something went wrong activating your account. Please try again, or contact your clinic if it keeps happening." };
  }
}

// Patient self-service "I didn't get the code" — previously the only way
// to get a fresh activation link/OTP was to ask clinic staff to click
// Resend from the dashboard. Callable from /portal/activate (by the email
// the patient types in) and /portal/verify (by the account id already in
// that page's URL). Always returns the same generic message regardless of
// whether anything matched, same anti-enumeration shape as a
// password-reset request — see migration
// mycaredesk_portal_invite_resend for why the underlying RPC is
// service_role-only rather than something the browser could call
// directly (it looks up by an easily-guessable value and hands back a
// live activation secret, so it must never be reachable from the client).
export async function requestPortalInviteResendAction(opts: { contact?: string; accountId?: string }): Promise<{ message: string }> {
  const generic = "If that matches a pending invite, we've sent a new code — check your email or messages in a minute (including spam/junk).";
  const contact = opts.contact?.trim();
  const accountId = opts.accountId?.trim();
  if (!contact && !accountId) return { message: generic };

  try {
    const admin = createAdminClient();
    const { data: matches, error } = await admin.rpc("resend_patient_portal_invite", {
      p_contact: contact || null,
      p_account_id: accountId || null,
    });
    if (error) {
      console.error("resend_patient_portal_invite failed:", error);
      return { message: generic };
    }

    const origin = await siteOrigin();
    for (const m of (matches as any[]) ?? []) {
      try {
        if (m.channel === "email" && m.raw_token) {
          const link = `${origin}/portal/activate?token=${m.raw_token}`;
          await sendPortalEmail({
            toEmail: m.contact_value,
            toName: m.patient_name,
            subject: `Your ${m.clinic_name} Patient Portal activation link`,
            html: `<p>Hi ${m.patient_name},</p><p>Here's a new activation link for your ${m.clinic_name} Patient Portal:</p><p><a href="${link}">Activate your account</a></p><p>This link expires in 24 hours. If you didn't request this, you can safely ignore this email.</p>`,
          });
        } else if (m.channel === "sms" && m.otp) {
          const link = `${origin}/portal/verify?a=${m.account_id}`;
          await sendPortalSms({
            toPhone: m.contact_value,
            message: `${m.clinic_name}: Your new Patient Portal code is ${m.otp}. Activate here: ${link} (expires in 10 min)`,
          });
        }
      } catch (sendErr) {
        // Don't let one failed send (e.g. provider not configured) change
        // the response — the message stays generic either way.
        console.error("resend_patient_portal_invite: send failed:", sendErr);
      }
    }
  } catch (e) {
    console.error("requestPortalInviteResendAction failed:", e);
  }

  return { message: generic };
}

// ── Authenticated portal actions (spec §15) ───────────────────────────────
// Everything below requires an active patient_portal_accounts session.

export async function portalDocumentSignedUrlAction(storagePath: string): Promise<string> {
  const { supabase } = await requirePatientPortal();
  const { data, error } = await supabase.storage.from("patient-documents").createSignedUrl(storagePath, 300);
  if (error || !data?.signedUrl) throw new Error(error?.message || "Couldn't generate a link for this file.");
  return data.signedUrl;
}

// Patient Forms (spec §13-14): the patient completing their OWN assigned
// form. Calls the exact same complete_patient_form RPC staff use to
// complete a form on a patient's behalf — the RPC itself distinguishes
// the two callers via patient_portal_accounts vs. tenant staff membership.
export async function completeMyFormAction(formId: string, responses: Record<string, any>, signatureName?: string) {
  const { supabase } = await requirePatientPortal();
  const { error } = await supabase.rpc("complete_patient_form", {
    p_id: formId,
    p_responses: responses,
    p_signature_name: signatureName || null,
  });
  if (error) throw new Error(error.message);
  revalidatePath("/portal/forms");
  revalidatePath("/portal");
}

// My Billing — "Pay Now" (spec §16, §38). Mirrors
// startPatientChargeOnlinePaymentAction (app/dashboard/patients/actions.ts)
// exactly, except scoped to the PATIENT'S OWN account.patient_id rather
// than a staff-supplied patientId — a patient can never pay someone
// else's charge. Same rule as the staff version: this only opens a
// PayMongo checkout page and records the attempt; only the verified
// webhook ever marks anything Paid.
export async function startMyChargeOnlinePaymentAction(chargeId: string): Promise<string> {
  const { supabase, account } = await requirePatientPortal();
  const patientId = (account as any).patient_id;
  const { createPatientChargeCheckoutSession } = await import("@/lib/patient-paymongo");
  const tenantId = (account as any).tenant_id;

  const { data: clinicSettings } = await supabase.from("clinic_settings").select("accept_online_payments").eq("tenant_id", tenantId).maybeSingle();
  if (!clinicSettings?.accept_online_payments) {
    throw new Error("Online payments aren't available for this clinic right now.");
  }

  const { data: charge, error: chargeError } = await supabase
    .from("patient_charges")
    .select("id, description, amount_php, status, patient_id")
    .eq("id", chargeId)
    .eq("patient_id", patientId)
    .single();
  if (chargeError || !charge) throw new Error("Charge not found.");
  if (charge.status === "void") throw new Error("This charge has been voided.");

  const { data: existingPayments } = await supabase.from("patient_charge_payments").select("amount_php").eq("charge_id", chargeId);
  const alreadyPaid = ((existingPayments as any[]) ?? []).reduce((sum, p) => sum + Number(p.amount_php), 0);
  const remaining = Number(charge.amount_php) - alreadyPaid;
  if (remaining <= 0) throw new Error("This charge is already fully paid.");

  const origin = await siteOrigin();
  const { sessionId, checkoutUrl } = await createPatientChargeCheckoutSession({
    description: charge.description,
    amountPhp: remaining,
    successUrl: `${origin}/portal/billing?paid=1`,
  });

  const { error: recordError } = await supabase.rpc("record_patient_charge_checkout_session", {
    p_charge_id: chargeId,
    p_amount_php: remaining,
    p_checkout_session_id: sessionId,
    p_checkout_url: checkoutUrl,
  });
  if (recordError) throw new Error(recordError.message);

  return checkoutUrl;
}

// Records & Authorizations (spec §44) — the patient reviewing a pending
// sharing-authorization request their clinic sent them, and either
// acknowledging/authorizing it or declining it. patient_respond_sharing_request
// re-checks this is really their own active portal account server-side.
export async function respondToSharingRequestAction(requestId: string, approve: boolean) {
  const { supabase } = await requirePatientPortal();
  const { error } = await supabase.rpc("patient_respond_sharing_request", { p_id: requestId, p_approve: approve });
  if (error) throw new Error(error.message);
  revalidatePath("/portal/authorizations");
  revalidatePath("/portal");
}
