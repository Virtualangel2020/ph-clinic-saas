"use server";

import { revalidatePath } from "next/cache";
import { headers, cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { normalizePhMobile, sendPortalEmail, sendPortalSms, logPortalSendAttempt } from "@/lib/patient-portal/send";
import { requirePatientPortal, getMyCaredeskProfileSelection, ACTIVE_PROFILE_COOKIE } from "@/lib/require-patient-portal";

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

// Pre-check for the link-flow /portal/activate screen (Angel: don't make
// a patient who arrived through a real activation link deal with a code
// field or find out it's expired only AFTER typing a password). Verifies
// the token WITHOUT consuming it or creating anything — same read-only
// RPC activateByTokenAction itself calls right before actually acting on
// it — so this is safe to call as often as the page mounts.
export async function checkActivationTokenAction(token: string): Promise<{ valid: boolean }> {
  const trimmed = token.trim();
  if (!trimmed) return { valid: false };
  try {
    const supabase = await createClient();
    const { data, error } = await supabase.rpc("verify_patient_portal_invite_token", { p_token: trimmed });
    return { valid: !error && !!data };
  } catch (e) {
    console.error("checkActivationTokenAction failed:", e);
    return { valid: false };
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
// that page's URL).
//
// The PATIENT-FACING message is always the same generic wording
// regardless of whether anything matched — Angel confirmed this is fine
// for privacy ("public-facing wording can remain generic where needed").
// What changed after the nicole.islani18@gmail.com test failed silently:
// every attempt now writes a row to patient_portal_send_log (migration
// mycaredesk_portal_send_log) — no_match / sent / failed, with the real
// error message — so this is verifiable after the fact instead of a
// black box. Query it directly (Supabase SQL editor or the MCP tool)
// with: select * from patient_portal_send_log order by created_at desc.
export async function requestPortalInviteResendAction(opts: { contact?: string; accountId?: string }): Promise<{ message: string }> {
  const generic = "If an eligible MyCareDesk invitation exists for this contact, we'll send new activation instructions — check your email or messages in a minute (including spam/junk).";
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
      await logPortalSendAttempt({
        accountId: accountId || null,
        event: "resend",
        channel: contact?.includes("@") ? "email" : "sms",
        contactValue: contact || accountId || "",
        status: "failed",
        errorMessage: error.message,
      });
      return { message: generic };
    }

    const rows = (matches as any[]) ?? [];
    if (rows.length === 0) {
      await logPortalSendAttempt({
        accountId: accountId || null,
        event: "resend",
        channel: contact?.includes("@") ? "email" : "sms",
        contactValue: contact || accountId || "",
        status: "no_match",
      });
    }

    const origin = await siteOrigin();
    for (const m of rows) {
      try {
        if (m.channel === "email" && m.raw_token) {
          const link = `${origin}/portal/activate?token=${m.raw_token}`;
          await sendPortalEmail({
            toEmail: m.contact_value,
            toName: m.patient_name,
            subject: `Activate your ${m.clinic_name} Patient Portal`,
            html: `<p><strong>MyCareDesk</strong><br/>by Virtual Angel Systems</p><p>Hi ${m.patient_name},</p><p>Here's a new secure link to activate your ${m.clinic_name} Patient Portal and choose your password:</p><p><a href="${link}">Activate My Account</a></p><p>This link expires in 24 hours and can only be used once. If you weren't expecting this, you can safely ignore this email.</p>`,
          });
        } else if (m.channel === "sms" && m.otp) {
          const link = `${origin}/portal/verify?a=${m.account_id}`;
          await sendPortalSms({
            toPhone: m.contact_value,
            message: `${m.clinic_name}: Your new Patient Portal code is ${m.otp}. Activate here: ${link} (expires in 10 min)`,
          });
        } else {
          continue;
        }
        await logPortalSendAttempt({
          accountId: m.account_id,
          event: "resend",
          channel: m.channel,
          contactValue: m.contact_value,
          status: "sent",
        });
      } catch (sendErr: any) {
        // Don't let one failed send (e.g. the platform's email provider
        // isn't configured/enabled yet — see app/admin/settings) change
        // the patient-facing response — it stays generic either way. But
        // log it for real, since this is exactly the kind of failure that
        // otherwise looks identical to "everything worked."
        console.error("resend_patient_portal_invite: send failed:", sendErr);
        await logPortalSendAttempt({
          accountId: m.account_id,
          event: "resend",
          channel: m.channel,
          contactValue: m.contact_value,
          status: "failed",
          errorMessage: sendErr?.message ?? String(sendErr),
        });
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
  if (!account) throw new Error("You're not connected with a clinic yet, so there's nothing to pay.");
  const patientId = account.patient_id;
  const { createPatientChargeCheckoutSession } = await import("@/lib/patient-paymongo");
  const tenantId = account.tenant_id;

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

// Patient Dashboard (Phase 2, spec Part 25's "Appointment Rescheduled/
// Cancelled" card) — dismisses one appointment_status_events row once the
// patient has seen it, so it never lingers on the dashboard after that
// (Angel's no-stale-cards principle). patient_acknowledge_status_event
// re-verifies the row is really this patient's own.
export async function acknowledgeStatusEventAction(eventId: string) {
  const { supabase } = await requirePatientPortal();
  const { error } = await supabase.rpc("patient_acknowledge_status_event", { p_id: eventId });
  if (error) throw new Error(error.message);
  revalidatePath("/portal");
}

// Profile photo — identity-level (stored on mycaredesk_accounts, not a
// per-clinic patients row), so this works the same whether or not the
// patient has connected with a clinic yet. requirePatientPortal() only
// redirects if not signed in at all — exactly what's needed here, since a
// brand-new 0-clinic patient must still be able to set this from their
// Profile page. Private bucket: only the profile's own login, an active
// co-manager, and clinic staff actually connected to it can ever read it
// back (see patient-photos storage policies + get_patient_photo_path for
// the staff-side chart read).
//
// Family Profiles Phase 1.9: optional `forAccountId` in the form data lets
// a manager upload a DEPENDENT's photo instead of their own — from the My
// Family screen, where each dependent has no login of their own to do this
// itself. Re-validated server-side via is_selectable_mycaredesk_profile
// (the same real security boundary setActiveProfileCookie uses) rather
// than trusted from the form — a manager's access can be revoked between
// page loads. Defaults to the caller's own account when absent, preserving
// exact prior behavior for the plain Profile-page upload widget.
export async function uploadMyPhotoAction(formData: FormData) {
  const { supabase } = await requirePatientPortal();
  const { data: mycaredeskAccount } = await supabase.rpc("get_my_mycaredesk_account");
  if (!mycaredeskAccount) throw new Error("Set up your MyCareDesk account first — see Health Profile.");

  let targetAccountId = (mycaredeskAccount as any).id as string;
  const forAccountId = (formData.get("forAccountId") as string | null)?.trim() || null;
  if (forAccountId && forAccountId !== targetAccountId) {
    const { data: ok, error: checkError } = await supabase.rpc("is_selectable_mycaredesk_profile", { p_account_id: forAccountId });
    if (checkError) throw new Error(checkError.message);
    if (!ok) throw new Error("You don't have access to that profile.");
    targetAccountId = forAccountId;
  }

  const file = formData.get("file") as File | null;
  if (!file || file.size === 0) throw new Error("Choose a photo first.");
  if (!["image/png", "image/jpeg", "image/webp"].includes(file.type)) {
    throw new Error("Photo must be a PNG, JPG, or WEBP image.");
  }
  if (file.size > 3 * 1024 * 1024) throw new Error("Photo must be under 3MB.");

  const ext = file.name.split(".").pop() || "jpg";
  const path = `${targetAccountId}/${Date.now()}.${ext}`;
  const { error: uploadError } = await supabase.storage.from("patient-photos").upload(path, file);
  if (uploadError) throw new Error(uploadError.message);

  const { error: updateError } = await supabase.from("mycaredesk_accounts").update({ photo_path: path }).eq("id", targetAccountId);
  if (updateError) throw new Error(updateError.message);

  revalidatePath("/portal/profile");
  revalidatePath("/portal/family");
  revalidatePath("/portal", "layout");
}

// Family Profiles Phase 1.5: "Netflix-style" profile switch. Sets which
// MyCareDesk identity (the login's own, or a co-managed dependent) is
// currently active — every /portal/* page resolves its clinic-scoped data
// FROM this (see requirePatientPortal), and every write action that takes
// p_for_account_id should be passed this value going forward (Phase 1.8).
//
// is_selectable_mycaredesk_profile is the actual security boundary here —
// re-checked server-side against live data on every switch — not just
// "the id came from a chooser tile the server itself rendered a moment
// ago," since a manager's access to a dependent can be revoked between
// page loads. The cookie itself carries no authorization weight: every
// RPC that reads it back via p_for_account_id re-validates independently
// (see _resolve_portal_patient_id) — this cookie is a UI convenience for
// "which tile is highlighted," not a trust boundary, which is why a long
// expiry is fine here.
//
// BUG FIX: this used to call requirePatientPortal() here, which redirects
// to /portal/switch-profile whenever needsProfileChoice is true — which is
// EXACTLY the state every first-time pick starts from (2+ profiles, no
// cookie set yet). That made requirePatientPortal() immediately redirect
// back to the chooser the caller had just submitted a tile from, before
// this function ever reached the is_selectable_mycaredesk_profile check or
// set the cookie — a self-redirect loop that made every profile tile
// (including "You") look like it just hung. Uses the non-redirecting
// getMyCaredeskProfileSelection() instead — the same lookup the chooser
// page itself uses — which only confirms a session exists.
async function setActiveProfileCookie(accountId: string) {
  const { supabase, user } = await getMyCaredeskProfileSelection();
  if (!user) throw new Error("Please sign in first.");

  const { data: ok, error } = await supabase.rpc("is_selectable_mycaredesk_profile", { p_account_id: accountId });
  if (error) throw new Error(error.message);
  if (!ok) throw new Error("You don't have access to that profile.");

  const cookieStore = await cookies();
  cookieStore.set(ACTIVE_PROFILE_COOKIE, accountId, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
  });

  revalidatePath("/portal", "layout");
}

// Used directly as a <form action={setActiveProfileAction.bind(null, id)}>
// — the profile-chooser tiles submit a real form, so the redirect below is
// the standard, well-supported Next.js pattern (form action + redirect).
export async function setActiveProfileAction(accountId: string): Promise<void> {
  await setActiveProfileCookie(accountId);
  redirect("/portal");
}

// Used for the one imperative (non-form) call site — right after creating
// a new dependent from the chooser's "+ Add Family Member" form, where the
// caller needs to await completion and then navigate itself via
// useRouter(). Deliberately does NOT call redirect(): calling a
// server-action redirect from client code that invoked it directly (rather
// than through a <form action>) is not the pattern Next.js's redirect
// mechanism is designed for, so this leaves navigation to the caller.
export async function setActiveProfileNoRedirectAction(accountId: string): Promise<void> {
  await setActiveProfileCookie(accountId);
}
