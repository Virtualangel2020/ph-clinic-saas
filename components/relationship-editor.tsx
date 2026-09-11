"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { RELATIONSHIP_OPTIONS } from "@/components/add-family-member-form";

function relationshipLabel(relationship: string | null, relationshipOtherDescription: string | null): string {
  if (!relationship) return "Family";
  if (relationship === "other") return relationshipOtherDescription || "Family";
  return RELATIONSHIP_OPTIONS.find((o) => o.value === relationship)?.label ?? relationship;
}

// Inline "change relationship" control — per Angel: "I want to easily be
// able to choose relationship at this part. Like, click on the word
// 'parent' then can change it to something else." Used on the profile
// chooser and My Family screen, wherever a dependent's relationship label
// is shown. Deliberately its own standalone control (not nested inside
// the profile-select button those labels sit next to) so clicking it never
// also submits the "switch to this profile" action beside it. Calls
// update_my_mycaredesk_relationship — scoped server-side to the caller's
// OWN manager row for that dependent, so this only ever changes how the
// signed-in user labels the relationship, never anyone else's.
export function RelationshipEditor({
  accountId,
  relationship,
  relationshipOtherDescription,
  onChanged,
  align = "center",
}: {
  accountId: string;
  relationship: string | null;
  relationshipOtherDescription: string | null;
  onChanged?: (relationship: string, relationshipOtherDescription: string | null) => void;
  align?: "center" | "left";
}) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(relationship ?? "child");
  const [otherText, setOtherText] = useState(relationshipOtherDescription ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!editing) {
    return (
      <button
        type="button"
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setValue(relationship ?? "child");
          setOtherText(relationshipOtherDescription ?? "");
          setError(null);
          setEditing(true);
        }}
        title="Click to change relationship"
        style={{
          fontSize: 12,
          color: "#888",
          background: "none",
          border: "none",
          padding: 0,
          cursor: "pointer",
          textDecoration: "underline",
          textDecorationStyle: "dotted",
          textDecorationColor: "#bbb",
          textUnderlineOffset: 3,
        }}
      >
        {relationshipLabel(relationship, relationshipOtherDescription)}
      </button>
    );
  }

  async function save() {
    setSaving(true);
    setError(null);
    const supabase = createClient();
    const { error } = await supabase.rpc("update_my_mycaredesk_relationship", {
      p_account_id: accountId,
      p_relationship: value,
      p_relationship_other_description: value === "other" ? otherText : null,
    });
    setSaving(false);
    if (error) {
      setError(error.message);
      return;
    }
    setEditing(false);
    onChanged?.(value, value === "other" ? otherText || null : null);
  }

  return (
    <div
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
      }}
      style={{ display: "flex", flexDirection: "column", gap: 6, alignItems: align === "center" ? "center" : "flex-start", marginTop: 2 }}
    >
      <div style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap", justifyContent: align === "center" ? "center" : "flex-start" }}>
        <select value={value} onChange={(e) => setValue(e.target.value)} style={{ fontSize: 12, padding: "4px 6px", borderRadius: 6, border: "1px solid #ccc" }}>
          {RELATIONSHIP_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
        {value === "other" && (
          <input
            value={otherText}
            onChange={(e) => setOtherText(e.target.value)}
            placeholder="Specify"
            style={{ fontSize: 12, padding: "4px 6px", borderRadius: 6, border: "1px solid #ccc", width: 90 }}
          />
        )}
      </div>
      <div style={{ display: "flex", gap: 8 }}>
        <button
          type="button"
          onClick={save}
          disabled={saving || (value === "other" && !otherText.trim())}
          style={{ fontSize: 11.5, fontWeight: 700, color: "white", background: "var(--brand-primary)", border: "none", borderRadius: 6, padding: "4px 10px", cursor: "pointer", opacity: saving ? 0.7 : 1 }}
        >
          {saving ? "Saving…" : "Save"}
        </button>
        <button
          type="button"
          onClick={() => setEditing(false)}
          style={{ fontSize: 11.5, fontWeight: 600, color: "#666", background: "none", border: "none", padding: "4px 4px", cursor: "pointer" }}
        >
          Cancel
        </button>
      </div>
      {error && <p style={{ color: "crimson", fontSize: 11, margin: 0 }}>{error}</p>}
    </div>
  );
}
