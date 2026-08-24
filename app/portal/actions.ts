"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { normalizePhMobile } from "@/lib/patient-portal/send";
import { requirePatientPortal } from "@/lib/require-patient-portal";

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
