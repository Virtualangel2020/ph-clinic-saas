"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { LoadingButton } from "@/components/loading/loading-button";

const input: React.CSSProperties = { padding: 9, borderRadius: 8, border: "1px solid #ccc", fontSize: 13.5, width: "100%", boxSizing: "border-box" };

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
        <input required type="date" value={dateOfBirth} onChange={(e) => setDateOfBirth(e.target.value)} style={input} />
        <select value={sex} onChange={(e) => setSex(e.target.value)} style={input}>
          <option value="female">Female</option>
          <option value="male">Male</option>
          <option value="other">Other</option>
        </select>
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
