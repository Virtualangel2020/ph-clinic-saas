"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { setActiveProfileAction } from "@/app/portal/actions";
import { AddFamilyMemberForm } from "@/components/add-family-member-form";
import { RelationshipEditor } from "@/components/relationship-editor";
import { PersonalInfoEditor } from "@/components/personal-info-editor";
import { PhotoUpload } from "@/app/portal/profile/photo-upload";
import type { SelectableProfile } from "@/lib/require-patient-portal";

export type ManagerRow = {
  manager_account_id: string;
  first_name: string;
  last_name: string;
  relationship: string;
  relationship_other_description: string | null;
  is_primary: boolean;
  is_me: boolean;
};

function managersLabel(managers: ManagerRow[]) {
  if (managers.length === 0) return "You";
  return managers.map((m) => (m.is_me ? "You" : `${m.first_name} ${m.last_name}`)).join(", ");
}

function initials(p: SelectableProfile) {
  return `${p.firstName?.[0] ?? ""}${p.lastName?.[0] ?? ""}`.toUpperCase() || "?";
}

// Family Profiles Phase 1.10 — "My Family" management screen (promoted out
// of being a Profile subsection, per spec, since it's now first-class).
// This is where "+ Add Family Member" and per-dependent photo management
// live going forward; the Family/Dependents section still on /portal/profile
// links in here rather than duplicating this. [Manage Access] and
// [Link Existing Patient] (Phase 2 — adult co-management/linking) aren't
// built yet, so they're deliberately not rendered here rather than shown
// as dead buttons.
export function FamilyList({
  selectable,
  activeAccountId,
  managersByAccount,
}: {
  selectable: SelectableProfile[];
  activeAccountId: string | null;
  managersByAccount: Record<string, ManagerRow[]>;
}) {
  const router = useRouter();
  const [editingPhotoFor, setEditingPhotoFor] = useState<string | null>(null);
  const [editingInfoFor, setEditingInfoFor] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);

  return (
    <div>
      <div style={{ display: "grid", gap: 12 }}>
        {selectable.map((p) => {
          const managers = managersByAccount[p.accountId] ?? [];
          const isActive = p.accountId === activeAccountId;
          const editingPhoto = editingPhotoFor === p.accountId;
          const editingInfo = editingInfoFor === p.accountId;
          return (
            <div key={p.accountId} style={{ background: "white", border: isActive ? "1px solid var(--brand-primary)" : "1px solid #eee", borderRadius: 12, padding: 16 }}>
              <div style={{ display: "flex", gap: 14, alignItems: "flex-start", flexWrap: "wrap" }}>
                <div
                  style={{
                    width: 56,
                    height: 56,
                    borderRadius: "50%",
                    overflow: "hidden",
                    background: "var(--brand-primary)",
                    color: "white",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: 20,
                    fontWeight: 700,
                    flexShrink: 0,
                  }}
                >
                  {p.photoUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={p.photoUrl} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                  ) : (
                    initials(p)
                  )}
                </div>
                <div style={{ flex: 1, minWidth: 160 }}>
                  <div style={{ fontWeight: 700, fontSize: 15, color: "#222" }}>
                    {p.firstName} {p.lastName}
                    {isActive && <span style={{ fontSize: 11, fontWeight: 700, color: "var(--brand-primary)", marginLeft: 8 }}>Currently viewing</span>}
                  </div>
                  <div style={{ fontSize: 12.5, color: "#888", marginTop: 2 }}>
                    {p.isSelf ? "You" : <RelationshipEditor accountId={p.accountId} relationship={p.relationship} relationshipOtherDescription={p.relationshipOtherDescription} align="left" onChanged={() => router.refresh()} />}
                  </div>
                  {!p.isSelf && <div style={{ fontSize: 11.5, color: "#999", marginTop: 4 }}>Managed by: {managersLabel(managers)}</div>}
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 8, alignItems: "flex-end" }}>
                  {!isActive && (
                    <form action={setActiveProfileAction.bind(null, p.accountId)}>
                      <button type="submit" style={{ fontSize: 12, fontWeight: 700, color: "white", background: "var(--brand-primary)", border: "none", borderRadius: 8, padding: "7px 14px", cursor: "pointer" }}>
                        Open
                      </button>
                    </form>
                  )}
                  <button
                    type="button"
                    onClick={() => setEditingPhotoFor(editingPhoto ? null : p.accountId)}
                    style={{ fontSize: 11.5, fontWeight: 600, color: "var(--brand-primary)", background: "none", border: "none", cursor: "pointer", padding: 0 }}
                  >
                    {editingPhoto ? "Close" : "Change photo"}
                  </button>
                  <button
                    type="button"
                    onClick={() => setEditingInfoFor(editingInfo ? null : p.accountId)}
                    style={{ fontSize: 11.5, fontWeight: 600, color: "var(--brand-primary)", background: "none", border: "none", cursor: "pointer", padding: 0 }}
                  >
                    {editingInfo ? "Close" : "Edit Info"}
                  </button>
                </div>
              </div>

              {editingPhoto && (
                <div style={{ marginTop: 12, paddingTop: 12, borderTop: "1px solid #f0f0f0" }}>
                  <PhotoUpload
                    photoUrl={p.photoUrl}
                    initials={initials(p)}
                    forAccountId={p.isSelf ? undefined : p.accountId}
                    caption={p.isSelf ? undefined : `PNG, JPG, or WEBP, up to 3MB. Only ${p.firstName}'s managers and connected clinics can see this.`}
                  />
                </div>
              )}

              {editingInfo && (
                <div style={{ marginTop: 12, paddingTop: 12, borderTop: "1px solid #f0f0f0" }}>
                  <PersonalInfoEditor accountId={p.accountId} info={p.personalInfo} onChanged={() => router.refresh()} />
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div style={{ marginTop: 16 }}>
        {adding ? (
          <AddFamilyMemberForm
            onCancel={() => setAdding(false)}
            onCreated={async () => {
              setAdding(false);
              router.refresh();
            }}
          />
        ) : (
          <button
            onClick={() => setAdding(true)}
            style={{ fontSize: 12.5, fontWeight: 700, color: "var(--brand-primary)", background: "white", border: "1px dashed var(--brand-primary)", borderRadius: 10, padding: "10px 16px", cursor: "pointer" }}
          >
            + Add Family Member
          </button>
        )}
      </div>
    </div>
  );
}
