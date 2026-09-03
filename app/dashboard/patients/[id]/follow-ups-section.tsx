"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { completeFollowUpAction, cancelFollowUpAction } from "../actions";

export type FollowUpRow = {
  id: string;
  due_date: string;
  reason: string | null;
  status: "pending" | "completed" | "cancelled";
  completed_at: string | null;
  created_at: string;
  provider_name: string | null;
};

const STATUS_STYLE: Record<string, { color: string; bg: string; border: string; label: string }> = {
  pending: { color: "#8a6100", bg: "#fff6e6", border: "#f0d998", label: "Pending" },
  completed: { color: "#1a7f37", bg: "#eaf7ee", border: "#bfe6c9", label: "Completed" },
  cancelled: { color: "#888", bg: "#f2f2f2", border: "#ddd", label: "Cancelled" },
};

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

function dueBadge(dueDate: string, status: string) {
  if (status !== "pending") return null;
  const today = todayStr();
  if (dueDate < today) return { color: "#a12a2a", bg: "#fbeaea", border: "#f0c9c9", label: "Overdue" };
  if (dueDate === today) return { color: "#a12a2a", bg: "#fbeaea", border: "#f0c9c9", label: "Due today" };
  return null;
}

// Patient chart section for follow-up / recall tracking (set from the Plan
// field of a progress note — see progress-notes-section.tsx). Reads/writes
// the same `patient_follow_ups` rows the dashboard's "Follow-ups Due"
// widget reads, via complete_patient_follow_up / cancel_patient_follow_up.
export function FollowUpsSection({ patientId, followUps }: { patientId: string; followUps: FollowUpRow[] }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  function complete(id: string) {
    setError(null);
    setBusyId(id);
    startTransition(async () => {
      try {
        await completeFollowUpAction(id, patientId);
        router.refresh();
      } catch (e: any) {
        setError(e.message || "Couldn't mark that follow-up done.");
      } finally {
        setBusyId(null);
      }
    });
  }

  function cancel(id: string) {
    if (!confirm("Cancel this follow-up? It won't show up as due anymore.")) return;
    setError(null);
    setBusyId(id);
    startTransition(async () => {
      try {
        await cancelFollowUpAction(id, patientId);
        router.refresh();
      } catch (e: any) {
        setError(e.message || "Couldn't cancel that follow-up.");
      } finally {
        setBusyId(null);
      }
    });
  }

  const pendingRows = followUps.filter((f) => f.status === "pending").sort((a, b) => a.due_date.localeCompare(b.due_date));
  const resolvedRows = followUps.filter((f) => f.status !== "pending");

  return (
    <div>
      <div style={{ marginBottom: 8 }}>
        <h2 style={{ fontSize: 15, margin: 0 }}>Follow-ups</h2>
        <p style={{ fontSize: 12, color: "#999", margin: "2px 0 0" }}>
          Set from the Plan section of a progress note. Shows up on the clinic dashboard's Follow-ups Due list until
          it's marked done or cancelled.
        </p>
      </div>

      {error && <p style={{ fontSize: 12, color: "#a12a2a", marginBottom: 8 }}>{error}</p>}

      {followUps.length === 0 ? (
        <p style={{ color: "#999", fontSize: 12.5 }}>No follow-ups recorded for this patient yet.</p>
      ) : (
        <div style={{ display: "grid", gap: 10 }}>
          {[...pendingRows, ...resolvedRows].map((f) => {
            const s = STATUS_STYLE[f.status] ?? STATUS_STYLE.pending;
            const due = dueBadge(f.due_date, f.status);
            const busy = pending && busyId === f.id;
            return (
              <div key={f.id} style={{ background: "var(--card-bg)", border: "1px solid var(--card-border)", borderRadius: 10, padding: 14, fontSize: 13 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8, flexWrap: "wrap" }}>
                  <div>
                    <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center", marginBottom: 4 }}>
                      <span style={{ fontSize: 10.5, fontWeight: 700, color: s.color, background: s.bg, border: `1px solid ${s.border}`, borderRadius: 999, padding: "2px 8px" }}>
                        {s.label}
                      </span>
                      {due && (
                        <span style={{ fontSize: 10.5, fontWeight: 700, color: due.color, background: due.bg, border: `1px solid ${due.border}`, borderRadius: 999, padding: "2px 8px" }}>
                          {due.label}
                        </span>
                      )}
                    </div>
                    <div style={{ fontWeight: 700 }}>Due {new Date(f.due_date).toLocaleDateString()}</div>
                    {f.reason && <div style={{ fontSize: 12.5, color: "#333", marginTop: 3 }}>{f.reason}</div>}
                  </div>
                  <div style={{ fontSize: 11, color: "#999", textAlign: "right", whiteSpace: "nowrap" }}>
                    {f.provider_name ?? "Staff"}
                    <br />
                    set {new Date(f.created_at).toLocaleDateString()}
                  </div>
                </div>

                {f.status === "pending" && (
                  <div style={{ display: "flex", gap: 12, marginTop: 10 }}>
                    <button onClick={() => complete(f.id)} disabled={busy} style={{ background: "none", border: "none", color: "#1a7f37", cursor: "pointer", fontSize: 12, fontWeight: 600 }}>
                      Mark done
                    </button>
                    <button onClick={() => cancel(f.id)} disabled={busy} style={{ background: "none", border: "none", color: "#a12a2a", cursor: "pointer", fontSize: 12, fontWeight: 600 }}>
                      Cancel
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
