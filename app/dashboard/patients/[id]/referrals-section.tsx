"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ReferralForm } from "../../referrals/referral-form";
import { acceptReferralAction, declineReferralAction, completeReferralAction, cancelReferralAction, getReferralLetterUrlAction } from "../../referrals/actions";

export type ReferralRow = {
  id: string;
  destination_type: "internal" | "external";
  specialty_requested: string | null;
  reason: string;
  clinical_summary: string | null;
  urgency: "routine" | "urgent";
  status: "pending" | "accepted" | "completed" | "declined" | "cancelled";
  created_at: string;
  external_destination_name: string | null;
  sending_provider_name: string | null;
  receiving_provider_name: string | null;
  external_provider_name: string | null;
  external_provider_detail: string | null;
  isIncoming: boolean;
  isOutgoing: boolean;
};

const STATUS_STYLE: Record<string, { color: string; bg: string; border: string; label: string }> = {
  pending: { color: "#8a6100", bg: "#fff6e6", border: "#f0d998", label: "Pending" },
  accepted: { color: "var(--text-heading)", bg: "#f0f4ff", border: "#c7d4f5", label: "Accepted" },
  completed: { color: "#1a7f37", bg: "#eaf7ee", border: "#bfe6c9", label: "Completed" },
  declined: { color: "#a12a2a", bg: "#fbeaea", border: "#f0c9c9", label: "Declined" },
  cancelled: { color: "#888", bg: "#f2f2f2", border: "#ddd", label: "Cancelled" },
};

function Pill({ color, bg, border, children }: { color: string; bg: string; border: string; children: React.ReactNode }) {
  return (
    <span style={{ fontSize: 10.5, fontWeight: 700, color, background: bg, border: `1px solid ${border}`, borderRadius: 999, padding: "2px 8px" }}>
      {children}
    </span>
  );
}

function destinationLabel(r: ReferralRow) {
  if (r.destination_type === "internal") return r.receiving_provider_name ?? "AngelClinic provider";
  return r.external_provider_name ?? r.external_destination_name ?? "External provider";
}

// Patient chart section for Referrals (spec §22-25). The list here and the
// creation form both read/write the SAME `referrals` rows the global
// /dashboard/referrals workspace and referral-letter PDFs use — nothing is
// duplicated. Every write goes through the accept/decline/complete/cancel
// RPCs in ../../referrals/actions.ts, same gateway pattern as every other
// chart section.
export function ReferralsSection({ patientId, referrals }: { patientId: string; referrals: ReferralRow[] }) {
  const router = useRouter();
  const [creating, setCreating] = useState(false);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  function accept(id: string) {
    setError(null);
    setBusyId(id);
    startTransition(async () => {
      try {
        await acceptReferralAction(id, patientId);
        router.refresh();
      } catch (e: any) {
        setError(e.message || "Couldn't accept that referral.");
      } finally {
        setBusyId(null);
      }
    });
  }

  function decline(id: string) {
    const reason = prompt("Reason for declining (optional):") ?? "";
    setError(null);
    setBusyId(id);
    startTransition(async () => {
      try {
        await declineReferralAction(id, patientId, reason);
        router.refresh();
      } catch (e: any) {
        setError(e.message || "Couldn't decline that referral.");
      } finally {
        setBusyId(null);
      }
    });
  }

  function complete(id: string) {
    setError(null);
    setBusyId(id);
    startTransition(async () => {
      try {
        await completeReferralAction(id, patientId);
        router.refresh();
      } catch (e: any) {
        setError(e.message || "Couldn't complete that referral.");
      } finally {
        setBusyId(null);
      }
    });
  }

  function cancel(id: string) {
    if (!confirm("Cancel this referral?")) return;
    setError(null);
    setBusyId(id);
    startTransition(async () => {
      try {
        await cancelReferralAction(id, patientId);
        router.refresh();
      } catch (e: any) {
        setError(e.message || "Couldn't cancel that referral.");
      } finally {
        setBusyId(null);
      }
    });
  }

  async function printLetter(id: string) {
    setError(null);
    try {
      const url = await getReferralLetterUrlAction(id);
      window.open(url, "_blank");
    } catch (e: any) {
      setError(e.message || "No printable letter is available yet.");
    }
  }

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
        <h2 style={{ fontSize: 15 }}>Referrals</h2>
        <button onClick={() => setCreating((v) => !v)} style={{ fontSize: 12.5, color: "var(--text-heading)", background: "none", border: "none", cursor: "pointer", fontWeight: 600 }}>
          {creating ? "Cancel" : "+ New Referral"}
        </button>
      </div>

      {creating && (
        <div style={{ marginBottom: 14 }}>
          <ReferralForm
            patientId={patientId}
            onDone={() => {
              setCreating(false);
              router.refresh();
            }}
          />
        </div>
      )}

      {error && <p style={{ fontSize: 12, color: "#a12a2a", marginBottom: 8 }}>{error}</p>}

      {referrals.length === 0 ? (
        <p style={{ color: "#999", fontSize: 12.5 }}>No referrals yet for this patient.</p>
      ) : (
        <div style={{ display: "grid", gap: 10 }}>
          {referrals.map((r) => {
            const s = STATUS_STYLE[r.status] ?? STATUS_STYLE.pending;
            const busy = pending && busyId === r.id;
            return (
              <div key={r.id} style={{ background: "var(--card-bg)", border: "1px solid var(--card-border)", borderRadius: 10, padding: 14, fontSize: 13 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8, flexWrap: "wrap" }}>
                  <div>
                    <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center", marginBottom: 4 }}>
                      {r.isIncoming && <Pill color="#555" bg="#f2f2f2" border="#ddd">Incoming</Pill>}
                      {r.isOutgoing && <Pill color="#555" bg="#f2f2f2" border="#ddd">Outgoing</Pill>}
                      <Pill color={s.color} bg={s.bg} border={s.border}>{s.label}</Pill>
                      {r.urgency === "urgent" && <Pill color="#a12a2a" bg="#fbeaea" border="#f0c9c9">Urgent</Pill>}
                    </div>
                    <div style={{ fontWeight: 700 }}>
                      {r.destination_type === "internal" ? "To: " : "To (external): "}
                      {destinationLabel(r)}
                    </div>
                    {r.specialty_requested && <div style={{ fontSize: 12, color: "#666", marginTop: 1 }}>{r.specialty_requested}</div>}
                  </div>
                  <div style={{ fontSize: 11, color: "#999", whiteSpace: "nowrap" }}>{new Date(r.created_at).toLocaleDateString()}</div>
                </div>

                <div style={{ fontSize: 12.5, color: "#333", marginTop: 8 }}>{r.reason}</div>
                {r.clinical_summary && <div style={{ fontSize: 12, color: "#666", marginTop: 4 }}>{r.clinical_summary}</div>}

                <div style={{ display: "flex", gap: 12, marginTop: 10, flexWrap: "wrap" }}>
                  {r.isIncoming && r.status === "pending" && (
                    <>
                      <button onClick={() => accept(r.id)} disabled={busy} style={{ background: "none", border: "none", color: "#1a7f37", cursor: "pointer", fontSize: 12, fontWeight: 600 }}>
                        Accept
                      </button>
                      <button onClick={() => decline(r.id)} disabled={busy} style={{ background: "none", border: "none", color: "#a12a2a", cursor: "pointer", fontSize: 12, fontWeight: 600 }}>
                        Decline
                      </button>
                    </>
                  )}
                  {r.status === "accepted" && (
                    <button onClick={() => complete(r.id)} disabled={busy} style={{ background: "none", border: "none", color: "#1a7f37", cursor: "pointer", fontSize: 12, fontWeight: 600 }}>
                      Mark completed
                    </button>
                  )}
                  {r.isOutgoing && (r.status === "pending" || r.status === "accepted") && (
                    <button onClick={() => cancel(r.id)} disabled={busy} style={{ background: "none", border: "none", color: "#a12a2a", cursor: "pointer", fontSize: 12, fontWeight: 600 }}>
                      Cancel
                    </button>
                  )}
                  <button onClick={() => printLetter(r.id)} style={{ background: "none", border: "none", color: "var(--text-heading)", cursor: "pointer", fontSize: 12, fontWeight: 600 }}>
                    Print letter
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
