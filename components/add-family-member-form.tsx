"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { LoadingButton } from "@/components/loading/loading-button";
import { DOB_MIN_DATE, dobMaxDate } from "@/lib/dob";

const input: React.CSSProperties = { padding: 9, borderRadius: 8, border: "1px solid #ccc", fontSize: 13.5, width: "100%", boxSizing: "border-box" };

// Shared relationship options — a dependent can be either "younger" (a
// manager's child/ward) or "older" (a manager caring for their own parent
// or another relative), so both directions are offered rather than
// assuming every dependent is a child. Exported so the inline "change
// relationship" editor (relationship-editor.tsx) stays in sync with
// exactly the same list the server accepts (see
// mycaredesk_dependent_relationship_fix.sql's check constraint).
export const RELATIONSHIP_OPTIONS: { value: string; label: string }[] = [
  { value: "child", label: "Child" },
  { value: "son", label: "Son" },
  { value: "daughter", label: "Daughter" },
  { value: "ward", label: "Ward" },
  { value: "spouse", label: "Spouse" },
  { value: "mother", label: "Mother" },
  { value: "father", label: "Father" },
  { value: "parent", label: "Parent" },
  { value: "sibling", label: "Sibling" },
  { value: "legal_guardian", label: "Legal Guardian" },
  { value: "caregiver", label: "Caregiver" },
  { value: "other", label: "Other" },
];

// Shared "+ Add Family Member" inline form — the same create_dependent_mycaredesk_account
// call, used from two places (the profile chooser's tile and the My Family
// screen) that each want their own surrounding card/tile chrome and their
// own follow-up behavior (switch straight to the new profile vs. just
// refresh the list), so only the form itself is factored out here rather
// than the whole card.
export function AddFamilyMemberForm({
  onCreated,
  onCancel,
}: {
  onCreated: (accountId: string) => void | Promise<void>;
  onCancel: () => void;
}) {
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [dateOfBirth, setDateOfBirth] = useState("");
  const [sex, setSex] = useState("female");
  const [relationship, setRelationship] = useState("child");
  const [relationshipOther, setRelationshipOther] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    const supabase = createClient();
    const { data, error } = await supabase.rpc("create_dependent_mycaredesk_account", {
      p_first_name: firstName,
      p_last_name: lastName,
      p_date_of_birth: dateOfBirth,
      p_sex: sex,
      p_relationship: relationship,
      p_relationship_other_description: relationship === "other" ? relationshipOther : null,
    });
    if (error) {
      setSaving(false);
      setError(error.message);
      return;
    }
    try {
      await onCreated((data as any).id);
    } catch (e: any) {
      // Near-impossible (the profile was just created for this exact
      // login), but leave the form visible with the error rather than
      // pretending nothing happened — the dependent account was created
      // either way.
      setSaving(false);
      setError(e?.message ?? "Something went wrong — please try selecting the new profile from the list.");
      return;
    }
    setSaving(false);
  }

  return (
    <form onSubmit={submit} style={{ marginTop: 20, maxWidth: 420, background: "white", border: "1px solid #eee", borderRadius: 10, padding: 16, display: "grid", gap: 10 }}>
      <p style={{ fontSize: 12, color: "#666", margin: 0 }}>
        For a spouse, child, or anyone else you're managing MyCareDesk for. They won't have their own login — you'll fill in their Health Profile and handle clinic
        requests on their behalf, and can invite another adult (like a co-parent) to help manage them too.
      </p>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
        <input required placeholder="First name" value={firstName} onChange={(e) => setFirstName(e.target.value)} style={input} />
        <input required placeholder="Last name" value={lastName} onChange={(e) => setLastName(e.target.value)} style={input} />
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
        <input required type="date" min={DOB_MIN_DATE} max={dobMaxDate()} value={dateOfBirth} onChange={(e) => setDateOfBirth(e.target.value)} style={input} />
        <select value={sex} onChange={(e) => setSex(e.target.value)} style={input}>
          <option value="female">Female</option>
          <option value="male">Male</option>
          <option value="other">Other</option>
        </select>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: relationship === "other" ? "1fr 1fr" : "1fr", gap: 10 }}>
        <label style={{ display: "block" }}>
          <span style={{ fontSize: 11.5, color: "#666", marginBottom: 4, display: "block", fontWeight: 600 }}>Relationship to you</span>
          <select value={relationship} onChange={(e) => setRelationship(e.target.value)} style={input}>
            {RELATIONSHIP_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </label>
        {relationship === "other" && (
          <label style={{ display: "block" }}>
            <span style={{ fontSize: 11.5, color: "#666", marginBottom: 4, display: "block", fontWeight: 600 }}>Please specify</span>
            <input required value={relationshipOther} onChange={(e) => setRelationshipOther(e.target.value)} placeholder="e.g. Niece" style={input} />
          </label>
        )}
      </div>
      {error && <p style={{ color: "crimson", fontSize: 13, margin: 0 }}>{error}</p>}
      <div style={{ display: "flex", gap: 8 }}>
        <LoadingButton
          type="submit"
          loading={saving}
          loadingText="Adding..."
          style={{ padding: "8px 16px", borderRadius: 8, border: "none", background: "var(--brand-primary)", color: "white", fontWeight: 700, fontSize: 13 }}
        >
          Add family member
        </LoadingButton>
        <button
          type="button"
          onClick={onCancel}
          style={{ padding: "8px 16px", borderRadius: 8, border: "1px solid #ccc", background: "white", fontWeight: 600, fontSize: 13, cursor: "pointer" }}
        >
          Cancel
        </button>
      </div>
    </form>
  );
}
