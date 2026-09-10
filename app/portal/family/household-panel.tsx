"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  lookupAccountByPatientNumberAction,
  requestAdultLinkAction,
  respondToAdultLinkRequestAction,
  cancelAdultLinkRequestAction,
  unlinkAdultAction,
  grantFamilyAccessAction,
  grantFamilyAccessAllAction,
  revokeFamilyAccessAction,
  type FoundAccount,
} from "./actions";
import type { ManagerRow } from "./family-list";

export type LinkRequestRow = {
  id: string;
  direction: "incoming" | "outgoing";
  other_account_id: string;
  other_first_name: string;
  other_last_name: string;
  requested_at: string;
};

export type LinkedAdultRow = {
  link_id: string;
  account_id: string;
  first_name: string;
  last_name: string;
  linked_since: string;
};

export type DependentOption = { accountId: string; firstName: string; lastName: string };

const RELATIONSHIPS = [
  { value: "mother", label: "Mother" },
  { value: "father", label: "Father" },
  { value: "parent", label: "Parent" },
  { value: "legal_guardian", label: "Legal guardian" },
  { value: "sibling", label: "Sibling" },
  { value: "caregiver", label: "Caregiver" },
  { value: "other", label: "Other" },
];

const btnPrimary: React.CSSProperties = { fontSize: 12, fontWeight: 700, color: "white", background: "var(--brand-primary)", border: "none", borderRadius: 8, padding: "7px 14px", cursor: "pointer" };
const btnGhost: React.CSSProperties = { fontSize: 12, fontWeight: 600, color: "#666", background: "white", border: "1px solid #ccc", borderRadius: 8, padding: "7px 14px", cursor: "pointer" };
const input: React.CSSProperties = { padding: 9, borderRadius: 8, border: "1px solid #ccc", fontSize: 13.5, boxSizing: "border-box" };

function initials(firstName: string, lastName: string) {
  return `${firstName?.[0] ?? ""}${lastName?.[0] ?? ""}`.toUpperCase() || "?";
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString();
}

// Family Profiles Phase 2 (first slice) — household linking by Patient ID
// with an accept/decline handshake, then explicit per-dependent access
// grants. Linking two adults' accounts grants NEITHER of them anything by
// itself (per Angel: "he still needs his own email and password... no
// access to my records, same with me") — every dependent has to be shared
// on purpose afterward, one at a time or all at once.
export function HouseholdPanel({
  myPatientNumber,
  requests,
  linkedAdults,
  dependents,
  managersByAccount,
}: {
  myPatientNumber: string | null;
  requests: LinkRequestRow[];
  linkedAdults: LinkedAdultRow[];
  dependents: DependentOption[];
  managersByAccount: Record<string, ManagerRow[]>;
}) {
  return (
    <div style={{ display: "grid", gap: 16, marginBottom: 24 }}>
      {requests.length > 0 && <FamilyRequests requests={requests} />}
      <LinkedAdults linkedAdults={linkedAdults} dependents={dependents} managersByAccount={managersByAccount} />
      <LinkAccountForm myPatientNumber={myPatientNumber} />
    </div>
  );
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ background: "white", border: "1px solid #eee", borderRadius: 12, padding: 16 }}>
      <h2 style={{ fontSize: 13.5, color: "#888", textTransform: "uppercase", letterSpacing: 0.4, margin: "0 0 10px" }}>{title}</h2>
      {children}
    </div>
  );
}

function FamilyRequests({ requests }: { requests: LinkRequestRow[] }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  function respond(id: string, approve: boolean) {
    setError(null);
    setBusyId(id);
    startTransition(async () => {
      try {
        await respondToAdultLinkRequestAction(id, approve);
        router.refresh();
      } catch (e: any) {
        setError(e?.message ?? "Something went wrong.");
      } finally {
        setBusyId(null);
      }
    });
  }

  function cancel(id: string) {
    setError(null);
    setBusyId(id);
    startTransition(async () => {
      try {
        await cancelAdultLinkRequestAction(id);
        router.refresh();
      } catch (e: any) {
        setError(e?.message ?? "Something went wrong.");
      } finally {
        setBusyId(null);
      }
    });
  }

  return (
    <Card title="Family Requests">
      <div style={{ display: "grid", gap: 8 }}>
        {requests.map((r) => (
          <div key={r.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, flexWrap: "wrap", padding: "8px 10px", background: "#f7f7f9", borderRadius: 8 }}>
            <span style={{ fontSize: 13 }}>
              {r.direction === "incoming" ? (
                <>
                  <strong>
                    {r.other_first_name} {r.other_last_name}
                  </strong>{" "}
                  wants to link accounts with you
                </>
              ) : (
                <>
                  Waiting for{" "}
                  <strong>
                    {r.other_first_name} {r.other_last_name}
                  </strong>{" "}
                  to accept
                </>
              )}
            </span>
            <div style={{ display: "flex", gap: 6 }}>
              {r.direction === "incoming" ? (
                <>
                  <button style={btnPrimary} disabled={pending && busyId === r.id} onClick={() => respond(r.id, true)}>
                    Accept
                  </button>
                  <button style={btnGhost} disabled={pending && busyId === r.id} onClick={() => respond(r.id, false)}>
                    Decline
                  </button>
                </>
              ) : (
                <button style={btnGhost} disabled={pending && busyId === r.id} onClick={() => cancel(r.id)}>
                  Cancel
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
      {error && <p style={{ color: "crimson", fontSize: 12.5, marginTop: 8 }}>{error}</p>}
    </Card>
  );
}

function LinkedAdults({
  linkedAdults,
  dependents,
  managersByAccount,
}: {
  linkedAdults: LinkedAdultRow[];
  dependents: DependentOption[];
  managersByAccount: Record<string, ManagerRow[]>;
}) {
  const router = useRouter();
  const [expanded, setExpanded] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function unlink(linkId: string) {
    if (!confirm("Unlink this account? They'll also lose access to any family members you've shared with them.")) return;
    setError(null);
    startTransition(async () => {
      try {
        await unlinkAdultAction(linkId);
        router.refresh();
      } catch (e: any) {
        setError(e?.message ?? "Something went wrong.");
      }
    });
  }

  if (linkedAdults.length === 0) {
    return (
      <Card title="Linked Household Members">
        <p style={{ color: "#999", fontSize: 12.5, margin: 0 }}>No one linked yet — link your spouse or another adult's account below.</p>
      </Card>
    );
  }

  return (
    <Card title="Linked Household Members">
      <div style={{ display: "grid", gap: 10 }}>
        {linkedAdults.map((a) => (
          <div key={a.link_id} style={{ border: "1px solid #eee", borderRadius: 10, padding: 12 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <div style={{ width: 36, height: 36, borderRadius: "50%", background: "var(--brand-primary)", color: "white", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, fontWeight: 700 }}>
                  {initials(a.first_name, a.last_name)}
                </div>
                <div>
                  <div style={{ fontWeight: 700, fontSize: 14 }}>
                    {a.first_name} {a.last_name}
                  </div>
                  <div style={{ fontSize: 11.5, color: "#999" }}>Linked since {fmtDate(a.linked_since)}</div>
                </div>
              </div>
              <div style={{ display: "flex", gap: 6 }}>
                <button style={btnGhost} onClick={() => setExpanded(expanded === a.link_id ? null : a.link_id)}>
                  {expanded === a.link_id ? "Close" : "Manage Access"}
                </button>
                <button style={{ ...btnGhost, color: "#c0392b", borderColor: "#e6b3ac" }} disabled={pending} onClick={() => unlink(a.link_id)}>
                  Unlink
                </button>
              </div>
            </div>

            {expanded === a.link_id && (
              <AccessManager adult={a} dependents={dependents} managersByAccount={managersByAccount} onChanged={() => router.refresh()} />
            )}
          </div>
        ))}
      </div>
      {error && <p style={{ color: "crimson", fontSize: 12.5, marginTop: 8 }}>{error}</p>}
    </Card>
  );
}

function AccessManager({
  adult,
  dependents,
  managersByAccount,
  onChanged,
}: {
  adult: LinkedAdultRow;
  dependents: DependentOption[];
  managersByAccount: Record<string, ManagerRow[]>;
  onChanged: () => void;
}) {
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [bulkRelationship, setBulkRelationship] = useState("parent");

  function hasAccess(depAccountId: string) {
    return (managersByAccount[depAccountId] ?? []).some((m) => m.manager_account_id === adult.account_id);
  }

  async function grant(depAccountId: string, relationship: string) {
    setError(null);
    setBusy(depAccountId);
    try {
      await grantFamilyAccessAction(depAccountId, adult.account_id, relationship, null);
      onChanged();
    } catch (e: any) {
      setError(e?.message ?? "Something went wrong.");
    } finally {
      setBusy(null);
    }
  }

  async function revoke(depAccountId: string) {
    setError(null);
    setBusy(depAccountId);
    try {
      await revokeFamilyAccessAction(depAccountId, adult.account_id);
      onChanged();
    } catch (e: any) {
      setError(e?.message ?? "Something went wrong.");
    } finally {
      setBusy(null);
    }
  }

  async function grantAll() {
    setError(null);
    setBusy("__all__");
    try {
      await grantFamilyAccessAllAction(adult.account_id, bulkRelationship, null);
      onChanged();
    } catch (e: any) {
      setError(e?.message ?? "Something went wrong.");
    } finally {
      setBusy(null);
    }
  }

  const ungranted = dependents.filter((d) => !hasAccess(d.accountId));

  return (
    <div style={{ marginTop: 12, paddingTop: 12, borderTop: "1px solid #f0f0f0" }}>
      {dependents.length === 0 ? (
        <p style={{ color: "#999", fontSize: 12.5, margin: 0 }}>You don't have any family members to share yet.</p>
      ) : (
        <div style={{ display: "grid", gap: 8 }}>
          {dependents.map((d) => {
            const granted = hasAccess(d.accountId);
            return <DependentRow key={d.accountId} dep={d} granted={granted} busy={busy === d.accountId} onGrant={(rel) => grant(d.accountId, rel)} onRevoke={() => revoke(d.accountId)} />;
          })}
        </div>
      )}

      {ungranted.length > 1 && (
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 10, flexWrap: "wrap" }}>
          <select value={bulkRelationship} onChange={(e) => setBulkRelationship(e.target.value)} style={input}>
            {RELATIONSHIPS.map((r) => (
              <option key={r.value} value={r.value}>
                {r.label}
              </option>
            ))}
          </select>
          <button style={btnPrimary} disabled={busy === "__all__"} onClick={grantAll}>
            Give access to all
          </button>
        </div>
      )}

      {error && <p style={{ color: "crimson", fontSize: 12.5, marginTop: 8 }}>{error}</p>}
    </div>
  );
}

function DependentRow({
  dep,
  granted,
  busy,
  onGrant,
  onRevoke,
}: {
  dep: DependentOption;
  granted: boolean;
  busy: boolean;
  onGrant: (relationship: string) => void;
  onRevoke: () => void;
}) {
  const [relationship, setRelationship] = useState("parent");

  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, flexWrap: "wrap", background: "#f7f7f9", borderRadius: 8, padding: "8px 10px" }}>
      <span style={{ fontSize: 13, fontWeight: 600 }}>
        {dep.firstName} {dep.lastName}
      </span>
      {granted ? (
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontSize: 11.5, color: "#2a8f5a", fontWeight: 700 }}>Has access</span>
          <button style={btnGhost} disabled={busy} onClick={onRevoke}>
            Remove
          </button>
        </div>
      ) : (
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <select value={relationship} onChange={(e) => setRelationship(e.target.value)} style={{ ...input, padding: "6px 8px", fontSize: 12.5 }}>
            {RELATIONSHIPS.map((r) => (
              <option key={r.value} value={r.value}>
                {r.label}
              </option>
            ))}
          </select>
          <button style={btnPrimary} disabled={busy} onClick={() => onGrant(relationship)}>
            Grant access
          </button>
        </div>
      )}
    </div>
  );
}

function LinkAccountForm({ myPatientNumber }: { myPatientNumber: string | null }) {
  const router = useRouter();
  const [patientNumber, setPatientNumber] = useState("");
  const [found, setFound] = useState<FoundAccount | null | undefined>(undefined);
  const [searching, setSearching] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  async function search(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSent(false);
    setSearching(true);
    try {
      const result = await lookupAccountByPatientNumberAction(patientNumber);
      setFound(result);
    } catch (e: any) {
      setError(e?.message ?? "Something went wrong.");
      setFound(undefined);
    } finally {
      setSearching(false);
    }
  }

  async function sendRequest() {
    if (!found) return;
    setSending(true);
    setError(null);
    try {
      await requestAdultLinkAction(found.id);
      setSent(true);
      router.refresh();
    } catch (e: any) {
      setError(e?.message ?? "Something went wrong.");
    } finally {
      setSending(false);
    }
  }

  return (
    <Card title="Link a Family Member's Account">
      <p style={{ fontSize: 12, color: "#666", margin: "0 0 10px" }}>
        For an adult with their own MyCareDesk login — like a spouse — who you want to co-manage family members with. They'll get a request to accept before anything is
        linked, and linking alone shares nothing until you choose to give them access to a specific family member.
        {myPatientNumber && (
          <>
            {" "}
            Your own Patient ID is <strong>{myPatientNumber}</strong> — share it with them if they'd rather send the request.
          </>
        )}
      </p>
      <form onSubmit={search} style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <input
          required
          placeholder="Their Patient ID (e.g. MCD-000123)"
          value={patientNumber}
          onChange={(e) => {
            setPatientNumber(e.target.value);
            setFound(undefined);
            setSent(false);
          }}
          style={{ ...input, flex: 1, minWidth: 200 }}
        />
        <button type="submit" style={btnGhost} disabled={searching || !patientNumber.trim()}>
          {searching ? "Searching..." : "Find"}
        </button>
      </form>

      {error && <p style={{ color: "crimson", fontSize: 12.5, marginTop: 8 }}>{error}</p>}

      {found === null && !error && <p style={{ fontSize: 12.5, color: "#999", marginTop: 8 }}>No account found with that Patient ID.</p>}

      {found && (
        <div style={{ marginTop: 10, display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, flexWrap: "wrap", background: "#f7f7f9", borderRadius: 8, padding: "10px 12px" }}>
          <span style={{ fontSize: 13 }}>
            <strong>
              {found.first_name} {found.last_name}
            </strong>
          </span>
          {sent || found.request_pending ? (
            <span style={{ fontSize: 12, color: "#888" }}>Request sent — waiting for them to accept.</span>
          ) : found.already_linked ? (
            <span style={{ fontSize: 12, color: "#888" }}>Already linked.</span>
          ) : (
            <button style={btnPrimary} disabled={sending} onClick={sendRequest}>
              {sending ? "Sending..." : "Send Link Request"}
            </button>
          )}
        </div>
      )}
    </Card>
  );
}
