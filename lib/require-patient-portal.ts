import { cache } from "react";
import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { getPortalUser } from "@/lib/auth/safe-get-user";

export type PatientPortalAccount = {
  id: string;
  tenant_id: string;
  patient_id: string;
  status: string;
  channel: string;
  contact_value: string;
  activated_at: string | null;
  patients: { first_name: string; last_name: string } | null;
};

export type MyCaredeskFamilyMember = {
  id: string;
  first_name: string;
  last_name: string;
  date_of_birth: string;
  sex: string;
  photo_path: string | null;
  patient_number: string | null;
  relationship: string;
  relationship_other_description: string | null;
  is_primary: boolean;
  co_manager_count: number;
  has_own_login: boolean;
  status: string;
  created_at: string;
  mobile_phone: string | null;
  email: string | null;
  address_line1: string | null;
  address_line2: string | null;
  city: string | null;
  province: string | null;
  postal_code: string | null;
  civil_status: string | null;
  occupation: string | null;
  employer_name: string | null;
  employer_position: string | null;
  employer_contact: string | null;
  employer_address: string | null;
};

// Shared shape for the personal-info self-edit feature (Angel: "allow us to
// edit personal information like full name, date of birth, address, also
// add work, company ... Health information is different as well") — the
// PATIENT-OWNED MyCareDesk account fields, deliberately separate from both
// the clinic's own `patients` record (still "contact your clinic to
// update") and mycaredesk_health_profiles (medical info). One shape used by
// PersonalInfoEditor everywhere it's rendered, so self and every dependent
// go through the exact same component/RPC.
export type PersonalInfoValues = {
  firstName: string;
  lastName: string;
  dateOfBirth: string;
  sex: string;
  mobilePhone: string | null;
  email: string | null;
  addressLine1: string | null;
  addressLine2: string | null;
  city: string | null;
  province: string | null;
  postalCode: string | null;
  civilStatus: string | null;
  occupation: string | null;
  employerName: string | null;
  employerPosition: string | null;
  employerContact: string | null;
  employerAddress: string | null;
};

// A profile the currently signed-in login can pick in the chooser — the
// login's own MyCareDesk identity, plus every active dependent they
// co-manage (Phase 1.1 mycaredesk_account_managers). NOT a clinic
// relationship — one profile may have zero, one, or many of those (see
// PatientPortalAccount / `allAccounts` below, resolved FROM the active
// profile once one is selected).
export type SelectableProfile = {
  accountId: string;
  firstName: string;
  lastName: string;
  photoPath: string | null;
  photoUrl: string | null; // resolved signed URL, see resolveMyCaredeskProfileSelection
  patientNumber: string | null; // own permanent MyCareDesk patient ID (e.g. "MCD-000002") — every profile has its own, self and every dependent alike
  isSelf: boolean;
  relationship: string | null; // null for isSelf
  relationshipOtherDescription: string | null;
  personalInfo: PersonalInfoValues;
};

export const ACTIVE_PROFILE_COOKIE = "mcd_active_profile";

// Step 1 (WHO): resolve the signed-in login's selectable MyCareDesk
// profiles and, if one is already chosen (cookie, or the only option),
// which one is active. Wrapped in React's cache() so it only hits the
// database once per request no matter how many places ask — every
// /portal/* page's own requirePatientPortal() call AND PortalShell's
// banner both need this, and without caching that would double every
// portal page's auth/profile queries. Deliberately does NOT redirect —
// requirePatientPortal() (below) is the only place that enforces the
// profile-choice gate, so this stays safe to call from the chooser page
// itself and from the shell without risking a redirect loop.
export const resolveMyCaredeskProfileSelection = cache(async function resolveMyCaredeskProfileSelection() {
  const supabase = await createClient();

  // Root cause found (Find a Doctor crash investigation, Digest 800866611,
  // third pass): supabase.auth.getUser() re-throws uncaught for anything
  // it doesn't classify as an AuthError — notably a corrupted or
  // partially-chunked session cookie, a real risk here since this app had
  // no middleware.ts refreshing sessions on every request (now added; see
  // lib/auth/safe-get-user.ts for the full mechanism). This function is
  // the single shared gate behind requirePatientPortal() (~16 portal
  // pages) and PortalShell's own profile resolution, so hardening it here
  // protects every one of those call sites at once, not just Find a
  // Doctor. Any failure to resolve "who is this" degrades to "treat as
  // signed out" — the safest possible failure mode, since it's exactly
  // what a genuinely-expired session already looks like, and a fresh
  // sign-in writes a clean cookie and self-heals it.
  const user = await getPortalUser(supabase);

  if (!user) {
    return { supabase, user: null as null, selectable: [] as SelectableProfile[], activeProfile: null as SelectableProfile | null, needsProfileChoice: false };
  }

  let [{ data: myAccount }, { data: family }] = await Promise.all([
    supabase.rpc("get_my_mycaredesk_account"),
    supabase.rpc("get_my_mycaredesk_family"),
  ]);

  // Self-healing account creation (bug report: Ir-habsi Islani signed up,
  // confirmed his email, and could sign in — but his name/details never
  // showed anywhere in the portal). Root cause: account creation
  // (self_register_mycaredesk_account) only ever ran on ONE path —
  // /portal/finish-signup, reached right after clicking the confirmation
  // email link. If that link is opened somewhere the app's own
  // /auth/callback route doesn't get exercised the way this app expects
  // (a different browser/device than the one that started signup, or a
  // mismatch between Supabase's configured confirmation redirect and this
  // route — a project-level setting, not something in this file), that
  // one-time registration step silently never runs, and the account is
  // stuck exactly like this forever: signed in, but with no
  // mycaredesk_accounts row, no name, no details, on every page — with no
  // error shown anywhere pointing at why. Manually re-running the RPC by
  // hand fixed that one account; this makes it self-healing for everyone
  // else. Every portal page and the shell already funnel through this one
  // function, so a signed-in patient login whose signup metadata is
  // complete (patient-signup-form.tsx always attaches it) but who still
  // has no mycaredesk_accounts row gets registered right here, on their
  // very next request — instead of staying invisibly broken until someone
  // notices and fixes it by hand.
  if (!myAccount) {
    const meta = (user.user_metadata ?? {}) as Record<string, unknown>;
    const isPatientSignup = meta.account_kind === "mycaredesk_patient";
    const hasRequiredFields = Boolean(meta.first_name && meta.last_name && meta.date_of_birth && meta.sex);
    if (isPatientSignup && hasRequiredFields) {
      const { error: registerError } = await supabase.rpc("self_register_mycaredesk_account", {
        p_first_name: meta.first_name as string,
        p_last_name: meta.last_name as string,
        p_date_of_birth: meta.date_of_birth as string,
        p_sex: meta.sex as string,
        p_mobile_phone: (meta.mobile_phone as string) ?? null,
        p_email: user.email ?? null,
      });
      // A registerError here is swallowed on purpose: "not authorized" (no
      // session — can't happen, we already have `user`) and "already
      // exists" (a genuine race between two concurrent requests both
      // trying this at once) both mean nothing further needs doing, and
      // any other failure just leaves this exactly as broken as it already
      // was — never worse than the silent failure this replaces.
      if (!registerError) {
        await supabase.rpc("link_my_existing_patients_to_mycaredesk_account");
        ({ data: myAccount } = await supabase.rpc("get_my_mycaredesk_account"));
      }
    }
  }

  const familyList = (family as any as MyCaredeskFamilyMember[]) ?? [];

  const rawSelectable: Omit<SelectableProfile, "photoUrl">[] = [];
  if (myAccount) {
    const a = myAccount as any;
    rawSelectable.push({
      accountId: a.id,
      firstName: a.first_name,
      lastName: a.last_name,
      photoPath: a.photo_path ?? null,
      patientNumber: a.patient_number ?? null,
      isSelf: true,
      relationship: null,
      relationshipOtherDescription: null,
      personalInfo: {
        firstName: a.first_name,
        lastName: a.last_name,
        dateOfBirth: a.date_of_birth,
        sex: a.sex,
        mobilePhone: a.mobile_phone ?? null,
        email: a.email ?? null,
        addressLine1: a.address_line1 ?? null,
        addressLine2: a.address_line2 ?? null,
        city: a.city ?? null,
        province: a.province ?? null,
        postalCode: a.postal_code ?? null,
        civilStatus: a.civil_status ?? null,
        occupation: a.occupation ?? null,
        employerName: a.employer_name ?? null,
        employerPosition: a.employer_position ?? null,
        employerContact: a.employer_contact ?? null,
        employerAddress: a.employer_address ?? null,
      },
    });
  }
  for (const m of familyList) {
    rawSelectable.push({
      accountId: m.id,
      firstName: m.first_name,
      lastName: m.last_name,
      photoPath: m.photo_path ?? null,
      patientNumber: m.patient_number ?? null,
      isSelf: false,
      relationship: m.relationship,
      relationshipOtherDescription: m.relationship_other_description ?? null,
      personalInfo: {
        firstName: m.first_name,
        lastName: m.last_name,
        dateOfBirth: m.date_of_birth,
        sex: m.sex,
        mobilePhone: m.mobile_phone ?? null,
        email: m.email ?? null,
        addressLine1: m.address_line1 ?? null,
        addressLine2: m.address_line2 ?? null,
        city: m.city ?? null,
        province: m.province ?? null,
        postalCode: m.postal_code ?? null,
        civilStatus: m.civil_status ?? null,
        occupation: m.occupation ?? null,
        employerName: m.employer_name ?? null,
        employerPosition: m.employer_position ?? null,
        employerContact: m.employer_contact ?? null,
        employerAddress: m.employer_address ?? null,
      },
    });
  }

  // Resolve a signed URL per profile with a photo — same private-bucket
  // pattern /portal/profile already uses for the caller's own photo, now
  // applied to every selectable profile (self + dependents) so the chooser
  // tiles and My Family screen can show real avatars instead of always
  // falling back to initials (spec 1.9). The storage policies were
  // extended alongside this (mycaredesk_family_avatars_and_managers) to
  // let a co-manager's session actually read a dependent's photo object —
  // without that fix this would silently resolve to null for every
  // dependent regardless of this code.
  const selectable: SelectableProfile[] = await Promise.all(
    rawSelectable.map(async (p) => {
      if (!p.photoPath) return { ...p, photoUrl: null };
      const { data } = await supabase.storage.from("patient-photos").createSignedUrl(p.photoPath, 3600);
      return { ...p, photoUrl: data?.signedUrl ?? null };
    })
  );

  const cookieStore = await cookies();
  const cookieAccountId = cookieStore.get(ACTIVE_PROFILE_COOKIE)?.value ?? null;

  let activeProfile: SelectableProfile | null = (cookieAccountId && selectable.find((p) => p.accountId === cookieAccountId)) || null;
  if (!activeProfile && selectable.length === 1) {
    activeProfile = selectable[0];
  }
  const needsProfileChoice = !activeProfile && selectable.length > 1;

  return { supabase, user, selectable, activeProfile, needsProfileChoice };
});

// Used only by the shell (banner) and the chooser page itself, where
// redirecting on `needsProfileChoice` would be wrong (the shell just wants
// to know what to display; the chooser page IS the destination of that
// redirect). Both intentionally skip the sign-in redirect too — the shell
// never renders for a signed-out visitor in the first place (every page
// that renders it already called requirePatientPortal() first), and the
// chooser page does its own sign-in check.
export async function getMyCaredeskProfileSelection() {
  return resolveMyCaredeskProfileSelection();
}

// Patient-side equivalent of requireClinicMember — confirms a signed-in
// session, nothing more. Every /portal/* page is reachable to any signed-in
// patient regardless of whether they've connected with a clinic yet (bug
// report: a brand-new self-registered patient — mycaredesk_accounts row
// only, no patient_portal_accounts row — used to get silently bounced back
// to the login form on every page except Welcome/Health Profile, because
// this used to hard-require an active clinic-side row and redirect to
// /portal/login when none existed). Callers now get `account: null` in
// that case and are expected to render a graceful "connect with a clinic
// to see this" empty state INSIDE the normal portal shell, per Angel's
// "do not hide the portal because records don't exist yet" principle —
// never redirect a signed-in patient away from a page just because one
// clinic relationship hasn't been established.
//
// Family Profiles Phase 1.5: `account`/`allAccounts` used to be resolved
// directly from auth.uid() — the single login's own clinic relationships,
// picking the most-recently-activated one when more than one existed.
// That's exactly backwards once a login can reach more than one PERSON (a
// parent managing several kids, spec Test A/C): "most recent activation"
// has nothing to do with "which person is the parent currently looking
// at." This now resolves in two steps —
//   1. WHO (resolveMyCaredeskProfileSelection, above): `selectable` is the
//      login's own MyCareDesk identity plus every active dependent they
//      co-manage. `activeProfile`/`activeAccountId` is whichever of those
//      the mcd_active_profile cookie names, falling back to the only
//      option when there's exactly one. When there's more than one and no
//      cookie yet (`needsProfileChoice`), this function redirects to
//      /portal/switch-profile — the chooser becomes the actual landing
//      state until a profile is picked, per spec, with zero silent
//      fallback to the account holder.
//   2. WHAT (clinic-scoped): `account`/`allAccounts` resolve FROM that
//      active profile's mycaredesk_account_id — the actual EHR-side
//      patients/patient_portal_accounts rows for whichever PERSON is
//      currently selected — instead of directly from auth.uid().
//
// A login with no MyCareDesk platform identity at all (pure clinic-invited
// patient who never self-registered — still the common case pre-rollout)
// has `selectable: []`, `activeProfile: null`, `needsProfileChoice: false`,
// and `account`/`allAccounts` fall back to the exact pre-Phase-1 direct
// auth_user_id lookup below — zero behavior change for that patient.
//
// Every existing caller (~16 files) that only destructures
// `{ supabase, account }` or similar keeps working unchanged; the new
// fields are additive. Threading `activeAccountId` into write actions as
// `p_for_account_id` is deliberately NOT done by this function itself —
// that's per-action wiring (Phase 1.8), kept out of this shared gate so it
// can land action-by-action without every call site changing at once.
export async function requirePatientPortal() {
  const { supabase, user, selectable, activeProfile, needsProfileChoice } = await resolveMyCaredeskProfileSelection();

  if (!user) {
    redirect("/portal/login");
  }
  if (needsProfileChoice) {
    redirect("/portal/switch-profile");
  }

  const activeAccountId = activeProfile?.accountId ?? null;

  let allAccounts: PatientPortalAccount[] = [];
  if (activeAccountId) {
    // Clinic-scoped relationship(s) resolve FROM the active profile's
    // mycaredesk_account_id — this is what lets a manager view a
    // dependent's appointments/results/etc. while that dependent's
    // profile is selected, scoped by the RLS this same join already
    // requires (patients_portal_self_read → is_portal_patient, extended
    // for co-managers in Phase 1.3).
    const { data: accounts } = await supabase
      .from("patient_portal_accounts")
      .select(
        "id, tenant_id, patient_id, status, channel, contact_value, activated_at, patients!inner(first_name, last_name, mycaredesk_account_id)"
      )
      .eq("status", "active")
      .eq("patients.mycaredesk_account_id", activeAccountId)
      .order("activated_at", { ascending: false });
    allAccounts = (accounts as any as PatientPortalAccount[]) ?? [];

    // Legacy fallback, self only: a patient record created before
    // mycaredesk_account_id linking existed has patients.mycaredesk_account_id
    // = null even though it's really the caller's own. A dependent's
    // patient_portal_accounts row is never keyed by a manager's
    // auth_user_id, so this fallback is meaningless (and unreachable) for
    // any profile other than the caller's own.
    if (allAccounts.length === 0 && activeProfile?.isSelf) {
      const { data: legacyAccounts } = await supabase
        .from("patient_portal_accounts")
        .select("id, tenant_id, patient_id, status, channel, contact_value, activated_at, patients(first_name, last_name)")
        .eq("auth_user_id", user.id)
        .eq("status", "active")
        .order("activated_at", { ascending: false });
      allAccounts = (legacyAccounts as any as PatientPortalAccount[]) ?? [];
    }
  } else {
    // No MyCareDesk platform identity at all — pre-Phase-1 behavior,
    // unchanged: resolve directly from auth.uid(), picking the
    // most-recently-activated relationship when more than one exists.
    // (needsProfileChoice is guaranteed false here — handled above.)
    const { data: accounts } = await supabase
      .from("patient_portal_accounts")
      .select("id, tenant_id, patient_id, status, channel, contact_value, activated_at, patients(first_name, last_name)")
      .eq("auth_user_id", user.id)
      .eq("status", "active")
      .order("activated_at", { ascending: false });
    allAccounts = (accounts as any as PatientPortalAccount[]) ?? [];
  }

  const account = allAccounts[0] ?? null;

  return {
    supabase,
    user,
    account,
    allAccounts,
    hasMultipleClinics: allAccounts.length > 1,
    selectable,
    activeProfile,
    activeAccountId,
    needsProfileChoice,
  };
}
