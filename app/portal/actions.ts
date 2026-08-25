"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { normalizePhMobile } from "@/lib/patient-portal/send";
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
export async function activateByTokenAction(token: string, password: string) {
  const supabase = await createClient();

  const { data: invite, error: verifyError } = await supabase.rpc("verify_patient_portal_invite_token", { p_token: token.trim() });
  if (verifyError) throw new Error(verifyError.message);

  const isEmail = invite.contact_value.includes("@");
  const admin = createAdminClient();
  const { data: created, error: createError } = await admin.auth.admin.createUser(
    isEmail
      ? { email: invite.contact_value, password, email_confirm: true }
      : { phone: normalizePhMobile(invite.contact_value), password, phone_confirm: true }
  );
  if (createError) {
    if (/already.*regist|already exist/i.test(createError.message)) {
      throw new Error("An account with this contact info already exists on AngelClinic — please contact your clinic for help activating your portal access.");
    }
    throw new Error(createError.message);
  }

  const { error: finalizeError } = await supabase.rpc("finalize_patient_portal_activation", {
    p_account_id: invite.account_id,
    p_auth_user_id: created.user!.id,
  });
  if (finalizeError) throw new Error(finalizeError.message);

  const { error: signInError } = await supabase.auth.signInWithPassword(
    isEmail ? { email: invite.contact_value, password } : { phone: normalizePhMobile(invite.contact_value), password }
  );
  if (signInError) throw new Error("Account activated, but automatic sign-in failed — please sign in manually.");
}

export async function activateByOtpAction(accountId: string, code: string, password: string) {
  const supabase = await createClient();

  const { data: invite, error: verifyError } = await supabase.rpc("verify_patient_portal_otp", { p_account_id: accountId, p_code: code });
  if (verifyError) throw new Error(verifyError.message);

  const phone = normalizePhMobile(invite.contact_value);
  const admin = createAdminClient();
  const { data: created, error: createError } = await admin.auth.admin.createUser({
    phone,
    password,
    phone_confirm: true,
  });
  if (createError) {
    if (/already.*regist|already exist/i.test(createError.message)) {
      throw new Error("An account with this mobile number already exists on AngelClinic — please contact your clinic for help activating your portal access.");
    }
    throw new Error(createError.message);
  }

  const { error: finalizeError } = await supabase.rpc("finalize_patient_portal_activation", {
    p_account_id: invite.account_id,
    p_auth_user_id: created.user!.id,
  });
  if (finalizeError) throw new Error(finalizeError.message);

  const { error: signInError } = await supabase.auth.signInWithPassword({ phone, password });
  if (signInError) throw new Error("Account activated, but automatic sign-in failed — please sign in manually.");
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
