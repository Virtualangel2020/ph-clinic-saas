import { requirePatientPortal } from "@/lib/require-patient-portal";
import type { PersonalInfoValues } from "@/lib/require-patient-portal";
import { PortalShell } from "@/components/portal-shell";
import { BackLink } from "@/components/back-link";
import { PersonalInfoEditor } from "@/components/personal-info-editor";
import { PhotoUpload } from "./photo-upload";
import { DependentCard } from "./dependent-card";
import { age } from "@/lib/patients/get-patient-chart-data";
import { getMyDoctors } from "@/lib/patients/my-doctors";

// Profile (spec Part 23's simplified nav, extended by the bug-fix spec
// §14/§16: "My Doctors" and "Family / Dependents" belong under the
// patient's profile/account menu, not as new top-level tabs). The clinic
// demographics section below is this clinic's own patients row (unchanged
// from before); My Doctors and Family/Dependents work off the platform
// mycaredesk_accounts identity instead and are shown regardless of
// whether the patient has connected with any clinic yet.
export default async function PatientProfilePage() {
  const { supabase, account, allAccounts } = await requirePatientPortal();

  const [{ data: patient }, { data: mycaredeskAccount }, { data: family }, myDoctors] = await Promise.all([
    account
      ? supabase
          .from("patients")
          .select("first_name, last_name, middle_name, date_of_birth, sex, mobile_phone, email, patient_code, address_line1, city, province")
          .eq("id", account.patient_id)
          .maybeSingle()
      : Promise.resolve({ data: null }),
    supabase.rpc("get_my_mycaredesk_account"),
    supabase.rpc("get_my_mycaredesk_family"),
    getMyDoctors(
      supabase,
      allAccounts.map((a) => ({ tenant_id: a.tenant_id, patient_id: a.patient_id }))
    ),
  ]);

  const fullName = patient ? `${patient.first_name} ${patient.middle_name ? patient.middle_name + " " : ""}${patient.last_name}` : "";
  const familyList = (family as any[]) ?? [];

  const displayName = fullName || `${(mycaredeskAccount as any)?.first_name ?? ""} ${(mycaredeskAccount as any)?.last_name ?? ""}`.trim();
  const initials =
    displayName
      .split(" ")
      .map((s) => s.charAt(0))
      .join("")
      .slice(0, 2)
      .toUpperCase() || "?";

  let photoUrl: string | null = null;
  if ((mycaredeskAccount as any)?.photo_path) {
    const { data } = await supabase.storage.from("patient-photos").createSignedUrl((mycaredeskAccount as any).photo_path, 3600);
    photoUrl = data?.signedUrl ?? null;
  }

  // Personal Information (Angel: "allow us to edit personal information
  // like full name, date of birth, address, also add work, company ...
  // Health information is different as well") — sourced from the
  // MyCareDesk platform account (mycaredeskAccount, already fetched above
  // via get_my_mycaredesk_account's `select *`, so the new columns are
  // already present), NOT the clinic's own patient record below. Only
  // rendered once the platform account exists — before that there's
  // nothing yet to edit here (the "Set up your MyCareDesk account" flow on
  // Health Profile creates it).
  const ma = mycaredeskAccount as any;
  const myPersonalInfo: PersonalInfoValues | null = ma
    ? {
        firstName: ma.first_name,
        lastName: ma.last_name,
        dateOfBirth: ma.date_of_birth,
        sex: ma.sex,
        mobilePhone: ma.mobile_phone ?? null,
        email: ma.email ?? null,
        addressLine1: ma.address_line1 ?? null,
        addressLine2: ma.address_line2 ?? null,
        city: ma.city ?? null,
        province: ma.province ?? null,
        postalCode: ma.postal_code ?? null,
        civilStatus: ma.civil_status ?? null,
        occupation: ma.occupation ?? null,
        employerName: ma.employer_name ?? null,
        employerPosition: ma.employer_position ?? null,
        employerContact: ma.employer_contact ?? null,
        employerAddress: ma.employer_address ?? null,
      }
    : null;

  // Signed photo URL per dependent, same bucket/pattern as the account
  // holder's own photo above — lets each dependent's card show its real
  // photo (or an upload prompt) right here, not just on the separate My
  // Family screen.
  const familyPhotoUrls = await Promise.all(
    familyList.map(async (f) => {
      if (!f.photo_path) return null;
      const { data } = await supabase.storage.from("patient-photos").createSignedUrl(f.photo_path, 3600);
      return data?.signedUrl ?? null;
    })
  );

  return (
    <PortalShell>
      <BackLink href="/portal" label="Portal Home" />
      <h1 style={{ fontSize: 21, marginBottom: 4 }}>Profile</h1>
      <p style={{ color: "#666", fontSize: 13, marginBottom: 20 }}>Your account, doctors, and family.</p>

      <PhotoUpload photoUrl={photoUrl} initials={initials} />

      {myPersonalInfo && (
        <div style={{ background: "white", border: "1px solid #eee", borderRadius: 12, padding: 18, marginBottom: 12 }}>
          <h2 style={{ fontSize: 12, fontWeight: 700, color: "#888", textTransform: "uppercase", letterSpacing: 0.4, marginTop: 0, marginBottom: 10 }}>
            Personal Information
          </h2>
          <PersonalInfoEditor accountId={ma.id} info={myPersonalInfo} />
        </div>
      )}

      {(mycaredeskAccount as any)?.patient_number && (
        <div style={{ background: "white", border: "1px solid #eee", borderRadius: 12, padding: "14px 18px", marginBottom: 12, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <div style={{ fontSize: 11, color: "#999", textTransform: "uppercase", letterSpacing: 0.3 }}>MyCareDesk Patient Number</div>
            <div style={{ fontSize: 16, fontWeight: 700, fontFamily: "monospace", color: "var(--brand-primary)" }}>{(mycaredeskAccount as any).patient_number}</div>
          </div>
          <div style={{ fontSize: 11, color: "#aaa", maxWidth: 160, textAlign: "right" }}>Your permanent MyCareDesk ID — not a password.</div>
        </div>
      )}

      {account ? (
        <div style={{ background: "white", border: "1px solid #eee", borderRadius: 12, padding: 18, marginBottom: 12 }}>
          <h2 style={{ fontSize: 12, fontWeight: 700, color: "#888", textTransform: "uppercase", letterSpacing: 0.4, marginTop: 0, marginBottom: 10 }}>On File At Your Clinic</h2>
          {patient ? (
            <div style={{ fontSize: 13.5, lineHeight: 1.9 }}>
              <div>
                <strong>{fullName}</strong>
              </div>
              <div style={{ color: "#666" }}>
                {patient.sex} · {age(patient.date_of_birth)}y · {new Date(patient.date_of_birth).toLocaleDateString()}
              </div>
              <div style={{ color: "#666" }}>{patient.mobile_phone ?? "No mobile on file"}</div>
              <div style={{ color: "#666" }}>{patient.email ?? "No email on file"}</div>
              {(patient.address_line1 || patient.city) && (
                <div style={{ color: "#666" }}>{[patient.address_line1, patient.city, patient.province].filter(Boolean).join(", ")}</div>
              )}
              <div style={{ color: "#999", fontSize: 11.5, marginTop: 6 }}>Patient ID {patient.patient_code ?? "—"}</div>
            </div>
          ) : (
            <p style={{ color: "#999", fontSize: 12.5 }}>We couldn't load your profile — please contact your clinic.</p>
          )}
          <p style={{ fontSize: 11.5, color: "#aaa", marginTop: 12 }}>To update your contact details, please contact your clinic directly.</p>
        </div>
      ) : (
        <div style={{ background: "white", border: "1px solid #eee", borderRadius: 12, padding: 18, marginBottom: 12 }}>
          <p style={{ color: "#666", fontSize: 12.5, margin: 0 }}>
            You're not connected with a clinic yet. Once you book your first appointment, that clinic's information about you will
            show up here too.
          </p>
        </div>
      )}

      <a
        href="/portal/billing"
        style={{ display: "block", background: "white", border: "1px solid #eee", borderRadius: 10, padding: "12px 14px", fontSize: 12.5, fontWeight: 600, color: "#333", textDecoration: "none", marginBottom: 8 }}
      >
        My Billing →
      </a>
      <a
        href="/portal/health-profile"
        style={{ display: "block", background: "white", border: "1px solid #eee", borderRadius: 10, padding: "12px 14px", fontSize: 12.5, fontWeight: 600, color: "#333", textDecoration: "none", marginBottom: 20 }}
      >
        My MyCareDesk Account & Health Info →
      </a>

      <h2 style={{ fontSize: 13.5, color: "#888", textTransform: "uppercase", letterSpacing: 0.4, marginBottom: 8 }}>My Doctors</h2>
      {myDoctors.length === 0 ? (
        <p style={{ color: "#999", fontSize: 12.5, marginBottom: 20 }}>
          No established relationships yet — book your first appointment from{" "}
          <a href="/portal/find-a-doctor" style={{ color: "var(--brand-primary)", fontWeight: 600 }}>
            Find a Doctor
          </a>
          .
        </p>
      ) : (
        <div style={{ display: "grid", gap: 8, marginBottom: 20 }}>
          {myDoctors.map((d) => (
            <div key={`${d.tenantId}-${d.providerId}`} style={{ background: "white", border: "1px solid #eee", borderRadius: 10, padding: "12px 14px" }}>
              <div style={{ fontWeight: 700, fontSize: 13.5, color: "var(--brand-primary)" }}>
                {d.title ? `${d.title} ` : ""}
                {d.fullName}
              </div>
              <div style={{ fontSize: 12, color: "#888", marginTop: 2 }}>
                {[d.specialty, d.clinicName].filter(Boolean).join(" · ")}
              </div>
              <div style={{ display: "flex", gap: 10, marginTop: 8, flexWrap: "wrap" }}>
                <a href={`/portal/find-a-doctor/${d.providerId}`} style={{ fontSize: 11.5, fontWeight: 600, color: "var(--brand-primary)", textDecoration: "none" }}>
                  View Profile
                </a>
                <a href={`/portal/book/${d.providerId}`} style={{ fontSize: 11.5, fontWeight: 600, color: "var(--brand-primary)", textDecoration: "none" }}>
                  Book Appointment
                </a>
                <a href={`/portal/messages/${d.providerId}`} style={{ fontSize: 11.5, fontWeight: 600, color: "var(--brand-primary)", textDecoration: "none" }}>
                  Message
                </a>
              </div>
            </div>
          ))}
        </div>
      )}

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 8 }}>
        <h2 style={{ fontSize: 13.5, color: "#888", textTransform: "uppercase", letterSpacing: 0.4, margin: 0 }}>Family / Dependents</h2>
        <a href="/portal/family" style={{ fontSize: 11.5, fontWeight: 700, color: "var(--brand-primary)", textDecoration: "none" }}>
          Manage Family →
        </a>
      </div>
      {familyList.length === 0 ? (
        <p style={{ color: "#999", fontSize: 12.5, margin: 0 }}>
          No dependents added yet — you can add one from{" "}
          <a href="/portal/family" style={{ color: "var(--brand-primary)", fontWeight: 600 }}>
            My Family
          </a>
          .
        </p>
      ) : (
        <div style={{ display: "grid", gap: 8 }}>
          {familyList.map((f, i) => (
            <DependentCard
              key={f.id}
              accountId={f.id}
              firstName={f.first_name}
              lastName={f.last_name}
              dateOfBirth={f.date_of_birth}
              photoUrl={familyPhotoUrls[i]}
              patientNumber={f.patient_number ?? null}
              personalInfo={{
                firstName: f.first_name,
                lastName: f.last_name,
                dateOfBirth: f.date_of_birth,
                sex: f.sex,
                mobilePhone: f.mobile_phone ?? null,
                email: f.email ?? null,
                addressLine1: f.address_line1 ?? null,
                addressLine2: f.address_line2 ?? null,
                city: f.city ?? null,
                province: f.province ?? null,
                postalCode: f.postal_code ?? null,
                civilStatus: f.civil_status ?? null,
                occupation: f.occupation ?? null,
                employerName: f.employer_name ?? null,
                employerPosition: f.employer_position ?? null,
                employerContact: f.employer_contact ?? null,
                employerAddress: f.employer_address ?? null,
              }}
            />
          ))}
        </div>
      )}
    </PortalShell>
  );
}
