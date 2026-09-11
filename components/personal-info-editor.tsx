"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import type { PersonalInfoValues } from "@/lib/require-patient-portal";
import { DOB_MIN_DATE, dobMaxDate } from "@/lib/dob";

const FIELD: React.CSSProperties = { padding: "8px 10px", borderRadius: 8, border: "1px solid #ccc", fontSize: 13, width: "100%", boxSizing: "border-box" };
const LABEL: React.CSSProperties = { fontSize: 11, color: "#888", fontWeight: 600, marginBottom: 4, display: "block" };

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label style={LABEL}>{label}</label>
      {children}
    </div>
  );
}

function displayLine(values: (string | null | undefined)[]): string | null {
  const parts = values.map((v) => (v ?? "").trim()).filter(Boolean);
  return parts.length > 0 ? parts.join(", ") : null;
}

// Self-service "Personal Information" editor for a MyCareDesk platform
// account — Angel: "allow us to edit personal information like full name,
// date of birth, address, also add work, company ... Health information is
// different as well." One component used for both the signed-in owner's own
// info and any dependent they co-manage (accountId decides which via
// update_my_mycaredesk_personal_info's own is_my_mycaredesk_account_or_managed
// check) — same view/edit-toggle pattern as RelationshipEditor. Deliberately
// separate from the read-only "On File At Your Clinic" card elsewhere on
// these pages: that's the clinic's own EHR record and stays
// clinic-managed; this is the patient's own account.
export function PersonalInfoEditor({
  accountId,
  info,
  onChanged,
}: {
  accountId: string;
  info: PersonalInfoValues;
  onChanged?: () => void;
}) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState<PersonalInfoValues>(info);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function set<K extends keyof PersonalInfoValues>(key: K, value: PersonalInfoValues[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  function startEditing() {
    setForm(info);
    setError(null);
    setEditing(true);
  }

  async function save() {
    setSaving(true);
    setError(null);
    const supabase = createClient();
    const { error: rpcError } = await supabase.rpc("update_my_mycaredesk_personal_info", {
      p_account_id: accountId,
      p_first_name: form.firstName,
      p_last_name: form.lastName,
      p_date_of_birth: form.dateOfBirth,
      p_sex: form.sex,
      p_mobile_phone: form.mobilePhone,
      p_email: form.email,
      p_address_line1: form.addressLine1,
      p_address_line2: form.addressLine2,
      p_city: form.city,
      p_province: form.province,
      p_postal_code: form.postalCode,
      p_civil_status: form.civilStatus,
      p_occupation: form.occupation,
      p_employer_name: form.employerName,
      p_employer_position: form.employerPosition,
      p_employer_contact: form.employerContact,
      p_employer_address: form.employerAddress,
    });
    setSaving(false);
    if (rpcError) {
      setError(rpcError.message);
      return;
    }
    setEditing(false);
    // This component is often rendered straight from a Server Component
    // (e.g. /portal/profile) with no callback prop available to pass, so it
    // refreshes itself rather than relying on a parent to do it — the
    // updated values otherwise wouldn't show until the next navigation.
    router.refresh();
    onChanged?.();
  }

  if (!editing) {
    const address = displayLine([info.addressLine1, info.addressLine2, info.city, info.province, info.postalCode]);
    const employer = displayLine([info.employerName, info.employerPosition]);
    return (
      <div>
        <div style={{ display: "grid", gap: 6, fontSize: 12.5, color: "#444", lineHeight: 1.6 }}>
          <div>
            <strong>
              {info.firstName} {info.lastName}
            </strong>{" "}
            · {info.sex} · {info.dateOfBirth ? new Date(info.dateOfBirth).toLocaleDateString() : "—"}
          </div>
          {info.civilStatus && <div style={{ color: "#777" }}>{info.civilStatus}</div>}
          <div style={{ color: "#777" }}>{info.mobilePhone || "No mobile on file"}</div>
          <div style={{ color: "#777" }}>{info.email || "No email on file"}</div>
          <div style={{ color: "#777" }}>{address || "No address on file"}</div>
          {employer && <div style={{ color: "#777" }}>{employer}</div>}
        </div>
        <button
          type="button"
          onClick={startEditing}
          style={{ marginTop: 10, fontSize: 11.5, fontWeight: 600, color: "var(--brand-primary)", background: "none", border: "none", cursor: "pointer", padding: 0 }}
        >
          Edit Personal Information
        </button>
      </div>
    );
  }

  return (
    <div style={{ display: "grid", gap: 12 }}>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
        <Field label="First name">
          <input style={FIELD} value={form.firstName} onChange={(e) => set("firstName", e.target.value)} />
        </Field>
        <Field label="Last name">
          <input style={FIELD} value={form.lastName} onChange={(e) => set("lastName", e.target.value)} />
        </Field>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
        <Field label="Date of birth">
          <input type="date" min={DOB_MIN_DATE} max={dobMaxDate()} style={FIELD} value={form.dateOfBirth ?? ""} onChange={(e) => set("dateOfBirth", e.target.value)} />
        </Field>
        <Field label="Sex">
          <select style={FIELD} value={form.sex ?? ""} onChange={(e) => set("sex", e.target.value)}>
            <option value="female">Female</option>
            <option value="male">Male</option>
            <option value="other">Other</option>
          </select>
        </Field>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
        <Field label="Mobile number">
          <input style={FIELD} value={form.mobilePhone ?? ""} onChange={(e) => set("mobilePhone", e.target.value)} />
        </Field>
        <Field label="Email">
          <input type="email" style={FIELD} value={form.email ?? ""} onChange={(e) => set("email", e.target.value)} />
        </Field>
      </div>
      <Field label="Civil status">
        <select style={FIELD} value={form.civilStatus ?? ""} onChange={(e) => set("civilStatus", e.target.value)}>
          <option value="">Prefer not to say</option>
          <option value="single">Single</option>
          <option value="married">Married</option>
          <option value="widowed">Widowed</option>
          <option value="separated">Separated</option>
          <option value="divorced">Divorced</option>
        </select>
      </Field>

      <h4 style={{ fontSize: 11.5, fontWeight: 700, color: "#999", textTransform: "uppercase", letterSpacing: 0.3, margin: "4px 0 0" }}>Address</h4>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
        <Field label="Address line 1">
          <input style={FIELD} value={form.addressLine1 ?? ""} onChange={(e) => set("addressLine1", e.target.value)} />
        </Field>
        <Field label="Address line 2">
          <input style={FIELD} value={form.addressLine2 ?? ""} onChange={(e) => set("addressLine2", e.target.value)} />
        </Field>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10 }}>
        <Field label="City">
          <input style={FIELD} value={form.city ?? ""} onChange={(e) => set("city", e.target.value)} />
        </Field>
        <Field label="Province">
          <input style={FIELD} value={form.province ?? ""} onChange={(e) => set("province", e.target.value)} />
        </Field>
        <Field label="Postal code">
          <input style={FIELD} value={form.postalCode ?? ""} onChange={(e) => set("postalCode", e.target.value)} />
        </Field>
      </div>

      <h4 style={{ fontSize: 11.5, fontWeight: 700, color: "#999", textTransform: "uppercase", letterSpacing: 0.3, margin: "4px 0 0" }}>Work / Company (optional)</h4>
      <Field label="Occupation">
        <input style={FIELD} value={form.occupation ?? ""} onChange={(e) => set("occupation", e.target.value)} />
      </Field>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
        <Field label="Company / Employer">
          <input style={FIELD} value={form.employerName ?? ""} onChange={(e) => set("employerName", e.target.value)} />
        </Field>
        <Field label="Position">
          <input style={FIELD} value={form.employerPosition ?? ""} onChange={(e) => set("employerPosition", e.target.value)} />
        </Field>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
        <Field label="Company contact number">
          <input style={FIELD} value={form.employerContact ?? ""} onChange={(e) => set("employerContact", e.target.value)} />
        </Field>
        <Field label="Company address">
          <input style={FIELD} value={form.employerAddress ?? ""} onChange={(e) => set("employerAddress", e.target.value)} />
        </Field>
      </div>

      {error && <p style={{ color: "crimson", fontSize: 12, margin: 0 }}>{error}</p>}
      <div style={{ display: "flex", gap: 8 }}>
        <button
          type="button"
          onClick={save}
          disabled={saving || !form.firstName.trim() || !form.lastName.trim() || !form.dateOfBirth}
          style={{ fontSize: 12.5, fontWeight: 700, color: "white", background: "var(--brand-primary)", border: "none", borderRadius: 8, padding: "8px 16px", cursor: "pointer", opacity: saving ? 0.7 : 1 }}
        >
          {saving ? "Saving…" : "Save"}
        </button>
        <button
          type="button"
          onClick={() => setEditing(false)}
          style={{ fontSize: 12.5, fontWeight: 600, color: "#666", background: "none", border: "none", padding: "8px 4px", cursor: "pointer" }}
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
