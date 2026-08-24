"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { savePatientAction, type PatientInput } from "./actions";

type Patient = {
  id: string;
  first_name: string;
  middle_name: string | null;
  last_name: string;
  suffix: string | null;
  date_of_birth: string;
  sex: string;
  civil_status: string | null;
  blood_type: string | null;
  mobile_phone: string | null;
  email: string | null;
  address_line1: string | null;
  address_line2: string | null;
  city: string | null;
  province: string | null;
  postal_code: string | null;
  emergency_contact_name: string | null;
  emergency_contact_relationship: string | null;
  emergency_contact_phone: string | null;
  guardian_name: string | null;
  guardian_relationship: string | null;
  guardian_phone: string | null;
  notes: string | null;
  occupation: string | null;
  employer_name: string | null;
  employer_position: string | null;
  employer_contact: string | null;
  employer_address: string | null;
  employment_status: string | null;
  referred_by_note: string | null;
};

const FIELD_STYLE: React.CSSProperties = { border: "1px solid var(--input-border)", borderRadius: 8, padding: "9px 11px", fontSize: 13.5, width: "100%" };
const LABEL_STYLE: React.CSSProperties = { fontSize: 12, color: "#666", marginBottom: 4, display: "block" };

function toInput(p: Patient | null): PatientInput {
  return {
    id: p?.id ?? null,
    firstName: p?.first_name ?? "",
    middleName: p?.middle_name ?? "",
    lastName: p?.last_name ?? "",
    suffix: p?.suffix ?? "",
    dateOfBirth: p?.date_of_birth ?? "",
    sex: p?.sex ?? "female",
    civilStatus: p?.civil_status ?? "",
    bloodType: p?.blood_type ?? "",
    mobilePhone: p?.mobile_phone ?? "",
    email: p?.email ?? "",
    addressLine1: p?.address_line1 ?? "",
    addressLine2: p?.address_line2 ?? "",
    city: p?.city ?? "",
    province: p?.province ?? "",
    postalCode: p?.postal_code ?? "",
    emergencyContactName: p?.emergency_contact_name ?? "",
    emergencyContactRelationship: p?.emergency_contact_relationship ?? "",
    emergencyContactPhone: p?.emergency_contact_phone ?? "",
    guardianName: p?.guardian_name ?? "",
    guardianRelationship: p?.guardian_relationship ?? "",
    guardianPhone: p?.guardian_phone ?? "",
    notes: p?.notes ?? "",
    occupation: p?.occupation ?? "",
    employerName: p?.employer_name ?? "",
    employerPosition: p?.employer_position ?? "",
    employerContact: p?.employer_contact ?? "",
    employerAddress: p?.employer_address ?? "",
    employmentStatus: p?.employment_status ?? "",
    referredByNote: p?.referred_by_note ?? "",
  };
}

export function PatientForm({ patient }: { patient: Patient | null }) {
  const router = useRouter();
  const [form, setForm] = useState<PatientInput>(toInput(patient));
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function set<K extends keyof PatientInput>(key: K, value: PatientInput[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function save() {
    if (!form.firstName.trim() || !form.lastName.trim() || !form.dateOfBirth) {
      setError("First name, last name, and date of birth are required.");
      return;
    }
    setError(null);
    startTransition(async () => {
      try {
        const id = await savePatientAction(form);
        router.push(`/dashboard/patients/${id}`);
      } catch (e: any) {
        setError(e.message || "Couldn't save this patient — please try again.");
      }
    });
  }

  return (
    <div style={{ background: "var(--card-bg)", border: "1px solid var(--card-border)", borderRadius: 12, padding: 22, display: "grid", gap: 18, maxWidth: 720 }}>
      <div>
        <h3 style={{ fontSize: 14, fontWeight: 700, marginBottom: 10 }}>Demographics</h3>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 10 }}>
          <div>
            <label style={LABEL_STYLE}>First name *</label>
            <input style={FIELD_STYLE} value={form.firstName} onChange={(e) => set("firstName", e.target.value)} />
          </div>
          <div>
            <label style={LABEL_STYLE}>Middle name</label>
            <input style={FIELD_STYLE} value={form.middleName} onChange={(e) => set("middleName", e.target.value)} />
          </div>
          <div>
            <label style={LABEL_STYLE}>Last name *</label>
            <input style={FIELD_STYLE} value={form.lastName} onChange={(e) => set("lastName", e.target.value)} />
          </div>
          <div>
            <label style={LABEL_STYLE}>Suffix</label>
            <input style={FIELD_STYLE} value={form.suffix} onChange={(e) => set("suffix", e.target.value)} placeholder="Jr., Sr., III" />
          </div>
          <div>
            <label style={LABEL_STYLE}>Date of birth *</label>
            <input type="date" style={FIELD_STYLE} value={form.dateOfBirth} onChange={(e) => set("dateOfBirth", e.target.value)} />
          </div>
          <div>
            <label style={LABEL_STYLE}>Sex *</label>
            <select style={FIELD_STYLE} value={form.sex} onChange={(e) => set("sex", e.target.value)}>
              <option value="female">Female</option>
              <option value="male">Male</option>
              <option value="other">Other</option>
            </select>
          </div>
          <div>
            <label style={LABEL_STYLE}>Civil status</label>
            <select style={FIELD_STYLE} value={form.civilStatus} onChange={(e) => set("civilStatus", e.target.value)}>
              <option value="">—</option>
              <option value="single">Single</option>
              <option value="married">Married</option>
              <option value="widowed">Widowed</option>
              <option value="separated">Separated</option>
              <option value="other">Other</option>
            </select>
          </div>
          <div>
            <label style={LABEL_STYLE}>Blood type</label>
            <input style={FIELD_STYLE} value={form.bloodType} onChange={(e) => set("bloodType", e.target.value)} placeholder="O+" />
          </div>
          <div>
            <label style={LABEL_STYLE}>Occupation</label>
            <input style={FIELD_STYLE} value={form.occupation} onChange={(e) => set("occupation", e.target.value)} />
          </div>
        </div>
      </div>

      <div>
        <h3 style={{ fontSize: 14, fontWeight: 700, marginBottom: 10 }}>Contact</h3>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 10 }}>
          <div>
            <label style={LABEL_STYLE}>Mobile phone</label>
            <input style={FIELD_STYLE} value={form.mobilePhone} onChange={(e) => set("mobilePhone", e.target.value)} />
          </div>
          <div>
            <label style={LABEL_STYLE}>Email</label>
            <input style={FIELD_STYLE} value={form.email} onChange={(e) => set("email", e.target.value)} />
          </div>
          <div style={{ gridColumn: "1 / -1" }}>
            <label style={LABEL_STYLE}>Address line 1</label>
            <input style={FIELD_STYLE} value={form.addressLine1} onChange={(e) => set("addressLine1", e.target.value)} />
          </div>
          <div style={{ gridColumn: "1 / -1" }}>
            <label style={LABEL_STYLE}>Address line 2</label>
            <input style={FIELD_STYLE} value={form.addressLine2} onChange={(e) => set("addressLine2", e.target.value)} />
          </div>
          <div>
            <label style={LABEL_STYLE}>City</label>
            <input style={FIELD_STYLE} value={form.city} onChange={(e) => set("city", e.target.value)} />
          </div>
          <div>
            <label style={LABEL_STYLE}>Province</label>
            <input style={FIELD_STYLE} value={form.province} onChange={(e) => set("province", e.target.value)} />
          </div>
          <div>
            <label style={LABEL_STYLE}>Postal code</label>
            <input style={FIELD_STYLE} value={form.postalCode} onChange={(e) => set("postalCode", e.target.value)} />
          </div>
        </div>
      </div>

      <div>
        <h3 style={{ fontSize: 14, fontWeight: 700, marginBottom: 10 }}>Emergency contact</h3>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 10 }}>
          <div>
            <label style={LABEL_STYLE}>Name</label>
            <input style={FIELD_STYLE} value={form.emergencyContactName} onChange={(e) => set("emergencyContactName", e.target.value)} />
          </div>
          <div>
            <label style={LABEL_STYLE}>Relationship</label>
            <input style={FIELD_STYLE} value={form.emergencyContactRelationship} onChange={(e) => set("emergencyContactRelationship", e.target.value)} />
          </div>
          <div>
            <label style={LABEL_STYLE}>Phone</label>
            <input style={FIELD_STYLE} value={form.emergencyContactPhone} onChange={(e) => set("emergencyContactPhone", e.target.value)} />
          </div>
        </div>
      </div>

      <div>
        <h3 style={{ fontSize: 14, fontWeight: 700, marginBottom: 10 }}>Guardian (if minor)</h3>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 10 }}>
          <div>
            <label style={LABEL_STYLE}>Name</label>
            <input style={FIELD_STYLE} value={form.guardianName} onChange={(e) => set("guardianName", e.target.value)} />
          </div>
          <div>
            <label style={LABEL_STYLE}>Relationship</label>
            <input style={FIELD_STYLE} value={form.guardianRelationship} onChange={(e) => set("guardianRelationship", e.target.value)} />
          </div>
          <div>
            <label style={LABEL_STYLE}>Phone</label>
            <input style={FIELD_STYLE} value={form.guardianPhone} onChange={(e) => set("guardianPhone", e.target.value)} />
          </div>
        </div>
      </div>

      <div>
        <h3 style={{ fontSize: 14, fontWeight: 700, marginBottom: 10 }}>Company / Employer (optional)</h3>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 10 }}>
          <div>
            <label style={LABEL_STYLE}>Company name</label>
            <input style={FIELD_STYLE} value={form.employerName} onChange={(e) => set("employerName", e.target.value)} />
          </div>
          <div>
            <label style={LABEL_STYLE}>Position</label>
            <input style={FIELD_STYLE} value={form.employerPosition} onChange={(e) => set("employerPosition", e.target.value)} />
          </div>
          <div>
            <label style={LABEL_STYLE}>Company contact</label>
            <input style={FIELD_STYLE} value={form.employerContact} onChange={(e) => set("employerContact", e.target.value)} />
          </div>
          <div style={{ gridColumn: "1 / -1" }}>
            <label style={LABEL_STYLE}>Company address</label>
            <input style={FIELD_STYLE} value={form.employerAddress} onChange={(e) => set("employerAddress", e.target.value)} />
          </div>
          <div>
            <label style={LABEL_STYLE}>Employment status</label>
            <select style={FIELD_STYLE} value={form.employmentStatus} onChange={(e) => set("employmentStatus", e.target.value)}>
              <option value="">—</option>
              <option value="employed">Employed</option>
              <option value="self_employed">Self-employed</option>
              <option value="unemployed">Unemployed</option>
              <option value="student">Student</option>
              <option value="retired">Retired</option>
              <option value="other">Other</option>
            </select>
          </div>
        </div>
      </div>

      <div>
        <h3 style={{ fontSize: 14, fontWeight: 700, marginBottom: 10 }}>Referred by</h3>
        <p style={{ fontSize: 11.5, color: "#888", marginTop: -4, marginBottom: 8 }}>
          If this patient came in through an accepted referral already recorded in Referrals, that shows
          automatically on the chart — only fill this in if the source isn&apos;t captured there (e.g. word of
          mouth, a doctor outside AngelClinic, walk-in).
        </p>
        <input
          style={FIELD_STYLE}
          value={form.referredByNote}
          onChange={(e) => set("referredByNote", e.target.value)}
          placeholder="e.g. Referred by Dr. Cruz, St. Luke's — or 'Walk-in'"
        />
      </div>

      <div>
        <label style={LABEL_STYLE}>Notes</label>
        <textarea style={{ ...FIELD_STYLE, minHeight: 70, fontFamily: "inherit" }} value={form.notes} onChange={(e) => set("notes", e.target.value)} />
      </div>

      {error && <div style={{ color: "#a12a2a", fontSize: 12.5 }}>{error}</div>}

      <div>
        <button
          onClick={save}
          disabled={pending}
          style={{ background: "#0c1730", color: "white", border: "none", borderRadius: 8, padding: "10px 20px", fontSize: 13.5, fontWeight: 600, cursor: "pointer", opacity: pending ? 0.6 : 1 }}
        >
          {pending ? "Saving…" : patient ? "Save changes" : "Add patient"}
        </button>
      </div>
    </div>
  );
}
