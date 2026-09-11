"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { setActiveProfileAction, setActiveProfileNoRedirectAction } from "@/app/portal/actions";
import { AddFamilyMemberForm } from "@/components/add-family-member-form";
import { RelationshipEditor } from "@/components/relationship-editor";
import type { SelectableProfile } from "@/lib/require-patient-portal";

function initials(firstName: string, lastName: string) {
  return `${firstName?.[0] ?? ""}${lastName?.[0] ?? ""}`.toUpperCase() || "?";
}

function Avatar({ p, size }: { p: Pick<SelectableProfile, "firstName" | "lastName" | "photoUrl">; size: number }) {
  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: "50%",
        overflow: "hidden",
        background: "var(--brand-primary)",
        color: "white",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontSize: size * 0.34,
        fontWeight: 700,
        flexShrink: 0,
      }}
    >
      {p.photoUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={p.photoUrl} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
      ) : (
        initials(p.firstName, p.lastName)
      )}
    </div>
  );
}

// "Netflix-style" profile chooser (spec: "log in once, see everyone you're
// authorized to manage, pick a profile"). Rendered as the actual post-login
// landing state whenever a login can reach more than one MyCareDesk profile
// and no mcd_active_profile cookie is set yet (see requirePatientPortal's
// redirect to /portal/switch-profile), and reachable any time after via
// "Switch Profile" in the portal shell's Viewing banner.
//
// Picking a tile submits a real form to setActiveProfileAction — a plain
// Server Action call, not a client fetch — so this works with JS-disabled
// clients too and needs no local loading state of its own beyond the tile
// form's native pending state.
export function ProfileChooser({ selectable }: { selectable: SelectableProfile[] }) {
  const router = useRouter();
  const [adding, setAdding] = useState(false);

  return (
    <div>
      <h1 style={{ fontSize: 22, marginBottom: 4 }}>Who's this for?</h1>
      <p style={{ color: "#666", fontSize: 13, marginBottom: 24 }}>Pick a profile to continue. You can switch anytime from the menu.</p>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(130px, 1fr))", gap: 16, maxWidth: 560 }}>
        {selectable.map((p) => (
          <div key={p.accountId} style={{ padding: "18px 10px 12px", borderRadius: 12, border: "1px solid #eee", background: "white" }}>
            <form action={setActiveProfileAction.bind(null, p.accountId)}>
              <button
                type="submit"
                style={{
                  width: "100%",
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  gap: 10,
                  padding: 0,
                  border: "none",
                  background: "transparent",
                  cursor: "pointer",
                }}
              >
                <Avatar p={p} size={64} />
                <div style={{ fontSize: 14, fontWeight: 700, color: "#222", textAlign: "center" }}>
                  {p.firstName} {p.lastName}
                </div>
              </button>
            </form>
            <div style={{ textAlign: "center", marginTop: 2 }}>
              {p.isSelf ? <div style={{ fontSize: 12, color: "#888" }}>You</div> : <RelationshipEditor accountId={p.accountId} relationship={p.relationship} relationshipOtherDescription={p.relationshipOtherDescription} onChanged={() => router.refresh()} />}
              {p.patientNumber && <div style={{ fontSize: 11, color: "#aaa", marginTop: 2 }}>{p.patientNumber}</div>}
            </div>
          </div>
        ))}

        <button
          onClick={() => setAdding((v) => !v)}
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            gap: 10,
            padding: "18px 10px",
            borderRadius: 12,
            border: "1px dashed var(--brand-primary)",
            background: "white",
            cursor: "pointer",
            color: "var(--brand-primary)",
          }}
        >
          <div style={{ width: 64, height: 64, borderRadius: "50%", border: "2px dashed var(--brand-primary)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 28 }}>+</div>
          <div style={{ fontSize: 13, fontWeight: 700 }}>Add Family Member</div>
        </button>
      </div>

      {adding && (
        <AddFamilyMemberForm
          onCancel={() => setAdding(false)}
          onCreated={async (accountId) => {
            // Immediately select the newly-created dependent's profile and
            // land in the portal as them — matches "add a family member,
            // start using it right away" rather than dropping back into a
            // chooser that now shows one more tile to click.
            await setActiveProfileNoRedirectAction(accountId);
            router.push("/portal");
          }}
        />
      )}
    </div>
  );
}
