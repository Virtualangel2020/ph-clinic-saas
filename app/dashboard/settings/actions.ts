"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireClinicAdmin } from "@/lib/require-clinic-admin";
import { requireClinicMember } from "@/lib/require-clinic-member";

// Every RPC called from this file re-checks is_clinic_admin()/tenant scope
// itself (see migration emr_phase1_foundation/emr_phase1_storage_and_rpcs)
// — these actions carry no elevated privilege of their own except where
// creating a brand-new auth user genuinely requires the service-role key
// (same pattern as app/admin/actions.ts).

async function siteOrigin() {
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host");
  const proto = h.get("x-forwarded-proto") ?? "https";
  return `${proto}://${host}`;
}

// ── Clinic Profile & Branding (Part 19) ─────────────────────────────────

export async function setClinicBrandingAction(input: {
  clinicName: string;
  logoPath: string | null;
  addressLine1: string;
  addressLine2: string;
  city: string;
  province: string;
  postalCode: string;
  phone: string;
  mobile: string;
  email: string;
  website: string;
}) {
  const { supabase } = await requireClinicAdmin();
  const { error } = await supabase.rpc("set_clinic_branding", {
    p_clinic_name: input.clinicName || null,
    p_logo_path: input.logoPath,
    p_address_line1: input.addressLine1 || null,
    p_address_line2: input.addressLine2 || null,
    p_city: input.city || null,
    p_province: input.province || null,
    p_postal_code: input.postalCode || null,
    p_phone: input.phone || null,
    p_mobile: input.mobile || null,
    p_email: input.email || null,
    p_website: input.website || null,
  });
  if (error) throw new Error(error.message);
  revalidatePath("/dashboard/settings/clinic-profile");
  revalidatePath("/dashboard");
}

export async function uploadClinicLogoAction(formData: FormData) {
  const { supabase, profile } = await requireClinicAdmin();
  const file = formData.get("file") as File | null;
  if (!file || file.size === 0) throw new Error("Choose a logo image first.");
  if (!["image/png", "image/jpeg", "image/svg+xml", "image/webp"].includes(file.type)) {
    throw new Error("Logo must be a PNG, JPG, WEBP, or SVG image.");
  }
  if (file.size > 3 * 1024 * 1024) throw new Error("Logo must be under 3MB.");

  const ext = file.name.split(".").pop() || "png";
  const path = `${profile.tenant_id}/logo-${Date.now()}.${ext}`;
  const { error } = await supabase.storage.from("clinic-logos").upload(path, file, { upsert: true });
  if (error) throw new Error(error.message);

  revalidatePath("/dashboard/settings/clinic-profile");
  return path;
}

// ── Provider credentials & signatures (Parts 21-23) ─────────────────────

export async function requestCredentialChangeAction(fieldKey: string, newValue: string) {
  const { supabase } = await requireClinicMember();
  const { error } = await supabase.rpc("request_provider_credential_change", {
    p_field_key: fieldKey,
    p_new_value: newValue,
  });
  if (error) throw new Error(error.message);
  revalidatePath("/dashboard/settings/providers");
}

export async function reviewCredentialChangeAction(requestId: string, approve: boolean, note: string) {
  const { supabase } = await requireClinicAdmin();
  const { error } = await supabase.rpc("review_provider_credential_change", {
    p_request_id: requestId,
    p_approve: approve,
    p_note: note || null,
  });
  if (error) throw new Error(error.message);
  revalidatePath("/dashboard/settings/providers");
}

export async function uploadSignatureAction(formData: FormData) {
  const { supabase, user, profile } = await requireClinicMember();
  const file = formData.get("file") as File | null;
  if (!file || file.size === 0) throw new Error("Choose a signature image first.");
  if (!["image/png", "image/jpeg", "image/webp"].includes(file.type)) {
    throw new Error("Signature must be a PNG, JPG, or WEBP image.");
  }
  if (file.size > 1 * 1024 * 1024) throw new Error("Signature image must be under 1MB.");

  const ext = file.name.split(".").pop() || "png";
  const path = `${profile.tenant_id}/${user.id}/${Date.now()}.${ext}`;
  const { error: uploadError } = await supabase.storage.from("provider-signatures").upload(path, file);
  if (uploadError) throw new Error(uploadError.message);

  const { error: rpcError } = await supabase.rpc("request_provider_signature", { p_signature_path: path });
  if (rpcError) throw new Error(rpcError.message);

  revalidatePath("/dashboard/settings/providers");
}

export async function reviewSignatureAction(signatureId: string, approve: boolean, note: string) {
  const { supabase } = await requireClinicAdmin();
  const { error } = await supabase.rpc("review_provider_signature", {
    p_signature_id: signatureId,
    p_approve: approve,
    p_note: note || null,
  });
  if (error) throw new Error(error.message);
  revalidatePath("/dashboard/settings/providers");
}

// ── Users & Permissions (Part 63) ───────────────────────────────────────

// Clinic Admin invites their own staff directly — no need to go through
// Virtual Angel Systems for every hire. Mirrors app/admin/actions.ts's
// inviteStaffAction (including the "already has an account elsewhere"
// fallback) but scoped to the caller's own tenant via clinic_invite_staff.
export async function clinicInviteStaffAction(input: {
  email: string;
  fullName: string;
  role: "clinic_admin" | "doctor" | "reception" | "staff";
}) {
  const { supabase } = await requireClinicAdmin();
  const origin = await siteOrigin();
  const admin = createAdminClient();

  const invited = await admin.auth.admin.inviteUserByEmail(input.email, {
    redirectTo: `${origin}/auth/callback?next=/auth/set-password`,
    data: { full_name: input.fullName },
  });

  let userId: string;
  const alreadyExists =
    !!invited.error && (invited.error.status === 422 || /already.*regist|already exist/i.test(invited.error.message));

  if (invited.error && !alreadyExists) {
    throw new Error(invited.error.message);
  }

  if (alreadyExists) {
    const { data: existingId, error: lookupError } = await supabase.rpc("admin_lookup_user_id_by_email", {
      p_email: input.email,
    });
    if (lookupError || !existingId) throw new Error("That email already has an account, but it couldn't be looked up — please try again.");
    userId = existingId;
  } else {
    if (!invited.data?.user) throw new Error("Invite did not return a user — please try again.");
    userId = invited.data.user.id;
  }

  const { error: profileError } = await supabase.rpc("clinic_invite_staff", {
    p_user_id: userId,
    p_full_name: input.fullName,
    p_role: input.role,
  });
  if (profileError) throw new Error(profileError.message);

  if (alreadyExists) {
    await supabase.auth.resetPasswordForEmail(input.email, {
      redirectTo: `${origin}/auth/callback?next=/auth/set-password`,
    });
  }

  revalidatePath("/dashboard/settings/users");
}

export async function setUserPermissionAction(userId: string, permissionKey: string, enabled: boolean) {
  const { supabase } = await requireClinicAdmin();
  const { error } = await supabase.rpc("set_user_permission", {
    p_user_id: userId,
    p_permission_key: permissionKey,
    p_enabled: enabled,
  });
  if (error) throw new Error(error.message);
  revalidatePath("/dashboard/settings/users");
}
