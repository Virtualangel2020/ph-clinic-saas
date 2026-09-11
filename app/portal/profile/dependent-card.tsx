"use client";

import { useState } from "react";
import { PhotoUpload } from "./photo-upload";
import { PersonalInfoEditor } from "@/components/personal-info-editor";
import type { PersonalInfoValues } from "@/lib/require-patient-portal";

// Compact dependent card for the Profile page's "Family / Dependents"
// section — per Angel's ask ("allow us to upload a profile picture on
// the right side of that or inside the profile same as the admin"), this
// gives each dependent the same avatar + "Change photo" upload the admin/
// staff side already has for patients, right here rather than only on the
// separate My Family screen. The name/date-of-birth line is still a link
// into that dependent's Health Profile; "Change photo" is a standalone
// button next to it (not nested inside that link) so the two never
// conflict, and toggles the same PhotoUpload widget used everywhere else
// a photo can be changed, scoped to this dependent via forAccountId.
export function DependentCard({
  accountId,
  firstName,
  lastName,
  dateOfBirth,
  photoUrl,
  personalInfo,
}: {
  accountId: string;
  firstName: string;
  lastName: string;
  dateOfBirth: string | null;
  photoUrl: string | null;
  personalInfo: PersonalInfoValues;
}) {
  const [editingPhoto, setEditingPhoto] = useState(false);
  const [editingInfo, setEditingInfo] = useState(false);
  const initials = `${firstName?.[0] ?? ""}${lastName?.[0] ?? ""}`.toUpperCase() || "?";

  return (
    <div style={{ background: "white", border: "1px solid #eee", borderRadius: 10, padding: "12px 14px" }}>
      <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
        <div
          style={{
            width: 40,
            height: 40,
            borderRadius: "50%",
            overflow: "hidden",
            background: "var(--brand-primary)",
            color: "white",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 14,
            fontWeight: 700,
            flexShrink: 0,
          }}
        >
          {photoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={photoUrl} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
          ) : (
            initials
          )}
        </div>
        <a href={`/portal/health-profile?for=${accountId}`} style={{ flex: 1, minWidth: 0, textDecoration: "none" }}>
          <div style={{ fontWeight: 700, fontSize: 13.5, color: "var(--text-heading, #222)" }}>
            {firstName} {lastName}
          </div>
          <div style={{ fontSize: 12, color: "#888", marginTop: 2 }}>
            {dateOfBirth ? `Born ${new Date(dateOfBirth).toLocaleDateString()}` : "Dependent"} · View / Manage Health Profile →
          </div>
        </a>
        <div style={{ display: "flex", flexDirection: "column", gap: 6, alignItems: "flex-end", flexShrink: 0 }}>
          <button
            type="button"
            onClick={() => setEditingPhoto((v) => !v)}
            style={{ fontSize: 11.5, fontWeight: 600, color: "var(--brand-primary)", background: "none", border: "none", cursor: "pointer", padding: 0, whiteSpace: "nowrap" }}
          >
            {editingPhoto ? "Close" : "Change photo"}
          </button>
          <button
            type="button"
            onClick={() => setEditingInfo((v) => !v)}
            style={{ fontSize: 11.5, fontWeight: 600, color: "var(--brand-primary)", background: "none", border: "none", cursor: "pointer", padding: 0, whiteSpace: "nowrap" }}
          >
            {editingInfo ? "Close" : "Edit Info"}
          </button>
        </div>
      </div>

      {editingPhoto && (
        <div style={{ marginTop: 12, paddingTop: 12, borderTop: "1px solid #f0f0f0" }}>
          <PhotoUpload photoUrl={photoUrl} initials={initials} forAccountId={accountId} caption={`PNG, JPG, or WEBP, up to 3MB. Only ${firstName}'s managers and connected clinics can see this.`} />
        </div>
      )}

      {editingInfo && (
        <div style={{ marginTop: 12, paddingTop: 12, borderTop: "1px solid #f0f0f0" }}>
          <PersonalInfoEditor accountId={accountId} info={personalInfo} />
        </div>
      )}
    </div>
  );
}
