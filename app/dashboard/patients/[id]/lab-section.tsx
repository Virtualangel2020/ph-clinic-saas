"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  addLabOrderAction,
  addLabResultAction,
  markLabResultReviewedAction,
  setLabOrderStatusAction,
  type LabTestInput,
} from "../../orders/actions";

// Patient-chart Lab Orders & Results section. Combines both concerns
// (ordering a panel of tests, and recording/reviewing the results that
// come back against it) because they're the same clinical workflow from
// this chart's point of view — see the clinic-wide /dashboard/orders and
// /dashboard/results pages for the cross-patient views of the same data.
// All writes go through the RPC-gateway server actions in
// ../../orders/actions.ts — never a raw insert/update against these tables.

export type LabResultRow = {
  id: string;
  result_summary: string | null;
  resulted_at: string;
  reviewed_at: string | null;
  reviewed_by_name: string | null;
};

export type LabOrderRow = {
  id: string;
  status: string; // ordered | collected | completed | cancelled
  priority: string; // routine | stat
  notes: string | null;
  ordered_at: string;
  ordering_provider_name: string | null;
  items: { id: string; test_name: string }[];
  results: LabResultRow[];
};

const FIELD_STYLE: React.CSSProperties = { border: "1px solid var(--input-border)", borderRadius: 8, padding: "8px 10px", fontSize: 13, fontFamily: "inherit", width: "100%", boxSizing: "border-box" };

const STATUS_STYLE: Record<string, { color: string; bg: string; border: string; label: string }> = {
  ordered: { color: "#8a6100", bg: "#fff6e6", border: "#f0d998", label: "Ordered" },
  collected: { color: "var(--text-heading)", bg: "#f0f4ff", border: "#c7d4f5", label: "Collected" },
  completed: { color: "#1a7f37", bg: "#eaf7ee", border: "#bfe6c9", label: "Completed" },
  cancelled: { color: "#a12a2a", bg: "#fbeaea", border: "#f0c9c9", label: "Cancelled" },
};

function StatusPill({ status }: { status: string }) {
  const s = STATUS_STYLE[status] ?? STATUS_STYLE.ordered;
  return (
    <span style={{ fontSize: 10.5, fontWeight: 700, color: s.color, background: s.bg, border: `1px solid ${s.border}`, borderRadius: 999, padding: "2px 8px" }}>
      {s.label}
    </span>
  );
}

function PriorityPill({ priority }: { priority: string }) {
  const stat = priority === "stat";
  return (
    <span
      style={{
        fontSize: 10.5,
        fontWeight: 700,
        color: stat ? "#a12a2a" : "#666",
        background: stat ? "#fbeaea" : "#f2f2f2",
        border: `1px solid ${stat ? "#f0c9c9" : "#ddd"}`,
        borderRadius: 999,
        padding: "2px 8px",
      }}
    >
      {stat ? "STAT" : "Routine"}
    </span>
  );
}

export function LabSection({ patientId, labOrders }: { patientId: string; labOrders: LabOrderRow[] }) {
  const router = useRouter();
  const [adding, setAdding] = useState(false);
  const [tests, setTests] = useState<string[]>([""]);
  const [priority, setPriority] = useState("routine");
  const [notes, setNotes] = useState("");
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function updateTest(i: number, value: string) {
    setTests((prev) => prev.map((t, idx) => (idx === i ? value : t)));
  }

  function addTestRow() {
    setTests((prev) => [...prev, ""]);
  }

  function removeTestRow(i: number) {
    setTests((prev) => prev.filter((_, idx) => idx !== i));
  }

  function saveOrder() {
    const cleaned = tests.map((t) => t.trim()).filter(Boolean);
    if (cleaned.length === 0) {
      setError("Add at least one test.");
      return;
    }
    setError(null);
    startTransition(async () => {
      try {
        const payload: LabTestInput[] = cleaned.map((testName) => ({ testName }));
        await addLabOrderAction(patientId, null, priority, notes, payload);
        setTests([""]);
        setPriority("routine");
        setNotes("");
        setAdding(false);
        router.refresh();
      } catch (e: any) {
        setError(e.message || "Couldn't place that order.");
      }
    });
  }

  return (
    <div style={{ marginTop: 24 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
        <h2 style={{ fontSize: 15 }}>Lab orders &amp; results</h2>
        <button onClick={() => setAdding((v) => !v)} style={{ fontSize: 12.5, color: "var(--text-heading)", background: "none", border: "none", cursor: "pointer", fontWeight: 600 }}>
          {adding ? "Cancel" : "+ Order labs"}
        </button>
      </div>

      {error && !adding && <p style={{ fontSize: 12, color: "#a12a2a", marginBottom: 8 }}>{error}</p>}

      {adding && (
        <div style={{ background: "var(--card-bg)", border: "1px solid var(--card-border)", borderRadius: 10, marginBottom: 10, padding: 14, display: "grid", gap: 10 }}>
          <div>
            <div style={labelStyle}>Tests</div>
            <div style={{ display: "grid", gap: 6 }}>
              {tests.map((t, i) => (
                <div key={i} style={{ display: "flex", gap: 6 }}>
                  <input placeholder="e.g. CBC, Lipid panel" value={t} onChange={(e) => updateTest(i, e.target.value)} style={FIELD_STYLE} />
                  {tests.length > 1 && (
                    <button onClick={() => removeTestRow(i)} style={{ background: "none", border: "none", color: "#999", cursor: "pointer", fontSize: 16, padding: "0 6px" }}>
                      ×
                    </button>
                  )}
                </div>
              ))}
            </div>
            <button onClick={addTestRow} style={{ marginTop: 6, fontSize: 12, color: "var(--text-heading)", background: "none", border: "none", cursor: "pointer", fontWeight: 600 }}>
              + Add another test
            </button>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 2fr", gap: 10 }}>
            <div>
              <div style={labelStyle}>Priority</div>
              <select value={priority} onChange={(e) => setPriority(e.target.value)} style={FIELD_STYLE}>
                <option value="routine">Routine</option>
                <option value="stat">STAT</option>
              </select>
            </div>
            <div>
              <div style={labelStyle}>Notes</div>
              <input placeholder="Optional" value={notes} onChange={(e) => setNotes(e.target.value)} style={FIELD_STYLE} />
            </div>
          </div>

          {error && <p style={{ fontSize: 12, color: "#a12a2a", margin: 0 }}>{error}</p>}
          <button onClick={saveOrder} disabled={pending} style={{ background: "#0c1730", color: "white", border: "none", borderRadius: 8, padding: "8px 14px", fontSize: 13, cursor: "pointer", justifySelf: "start" }}>
            {pending ? "Placing…" : "Place order"}
          </button>
        </div>
      )}

      {labOrders.length === 0 ? (
        <p style={{ color: "#999", fontSize: 12.5 }}>No lab orders yet.</p>
      ) : (
        <div style={{ display: "grid", gap: 10 }}>
          {labOrders.map((o) => (
            <LabOrderCard key={o.id} order={o} patientId={patientId} />
          ))}
        </div>
      )}
    </div>
  );
}

function LabOrderCard({ order, patientId }: { order: LabOrderRow; patientId: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [addingResult, setAddingResult] = useState(false);
  const [resultSummary, setResultSummary] = useState("");

  const hasResult = order.results.length > 0;
  const canAddResult = !hasResult && (order.status === "ordered" || order.status === "collected");

  function setStatus(status: string) {
    setError(null);
    startTransition(async () => {
      try {
        await setLabOrderStatusAction(order.id, patientId, status);
        router.refresh();
      } catch (e: any) {
        setError(e.message || "Couldn't update this order.");
      }
    });
  }

  function saveResult() {
    if (!resultSummary.trim()) {
      setError("Enter a result summary.");
      return;
    }
    setError(null);
    startTransition(async () => {
      try {
        await addLabResultAction(order.id, patientId, resultSummary);
        setResultSummary("");
        setAddingResult(false);
        router.refresh();
      } catch (e: any) {
        setError(e.message || "Couldn't save that result.");
      }
    });
  }

  function markReviewed(resultId: string) {
    setError(null);
    startTransition(async () => {
      try {
        await markLabResultReviewedAction(resultId, patientId);
        router.refresh();
      } catch (e: any) {
        setError(e.message || "Couldn't mark this result reviewed.");
      }
    });
  }

  return (
    <div style={{ background: "var(--card-bg)", border: "1px solid var(--card-border)", borderRadius: 10, padding: 14, fontSize: 13 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8, marginBottom: 6 }}>
        <div>
          <div style={{ fontWeight: 700 }}>
            {order.items.map((i) => i.test_name).join(", ") || "No tests listed"}
          </div>
          <div style={{ fontSize: 11.5, color: "#888", marginTop: 2 }}>
            Ordered {new Date(order.ordered_at).toLocaleDateString()} by {order.ordering_provider_name ?? "staff"}
          </div>
        </div>
        <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
          <PriorityPill priority={order.priority} />
          <StatusPill status={order.status} />
        </div>
      </div>

      {order.notes && <div style={{ fontSize: 12.5, color: "#555", marginBottom: 8 }}>{order.notes}</div>}

      {error && <p style={{ fontSize: 12, color: "#a12a2a", margin: "0 0 8px" }}>{error}</p>}

      <div style={{ display: "flex", gap: 12, marginBottom: hasResult || canAddResult ? 8 : 0, flexWrap: "wrap" }}>
        {order.status === "ordered" && (
          <button onClick={() => setStatus("collected")} disabled={pending} style={linkButtonStyle}>
            Mark collected
          </button>
        )}
        {(order.status === "ordered" || order.status === "collected") && (
          <button onClick={() => confirm("Cancel this order?") && setStatus("cancelled")} disabled={pending} style={{ ...linkButtonStyle, color: "#a12a2a" }}>
            Cancel order
          </button>
        )}
      </div>

      {hasResult && (
        <div style={{ display: "grid", gap: 8, marginTop: 4 }}>
          {order.results.map((r) => (
            <div key={r.id} style={{ background: "#f7f7f9", border: "1px solid #eee", borderRadius: 8, padding: 10 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
                <span
                  style={{
                    fontSize: 10.5,
                    fontWeight: 700,
                    color: r.reviewed_at ? "#1a7f37" : "#8a6100",
                    background: r.reviewed_at ? "#eaf7ee" : "#fff6e6",
                    border: `1px solid ${r.reviewed_at ? "#bfe6c9" : "#f0d998"}`,
                    borderRadius: 999,
                    padding: "2px 8px",
                  }}
                >
                  {r.reviewed_at ? "Reviewed" : "Unreviewed"}
                </span>
                {!r.reviewed_at && (
                  <button onClick={() => markReviewed(r.id)} disabled={pending} style={linkButtonStyle}>
                    Mark reviewed
                  </button>
                )}
              </div>
              {r.result_summary && <div style={{ fontSize: 12.5, marginTop: 6, whiteSpace: "pre-wrap" }}>{r.result_summary}</div>}
              <div style={{ fontSize: 11, color: "#888", marginTop: 6 }}>
                Resulted {new Date(r.resulted_at).toLocaleDateString()}
                {r.reviewed_at ? ` · Reviewed by ${r.reviewed_by_name ?? "staff"} on ${new Date(r.reviewed_at).toLocaleDateString()}` : ""}
              </div>
            </div>
          ))}
        </div>
      )}

      {canAddResult && (
        <div style={{ marginTop: 8 }}>
          {addingResult ? (
            <div style={{ display: "grid", gap: 6 }}>
              <textarea
                placeholder="Result summary"
                value={resultSummary}
                onChange={(e) => setResultSummary(e.target.value)}
                style={{ ...FIELD_STYLE, minHeight: 60 }}
              />
              <div style={{ display: "flex", gap: 8 }}>
                <button onClick={saveResult} disabled={pending} style={{ background: "#0c1730", color: "white", border: "none", borderRadius: 8, padding: "7px 14px", fontSize: 12.5, cursor: "pointer" }}>
                  {pending ? "Saving…" : "Save result"}
                </button>
                <button onClick={() => { setAddingResult(false); setResultSummary(""); setError(null); }} style={{ background: "none", border: "none", color: "#999", cursor: "pointer", fontSize: 12.5 }}>
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <button onClick={() => setAddingResult(true)} style={linkButtonStyle}>
              + Add result
            </button>
          )}
        </div>
      )}
    </div>
  );
}

const labelStyle: React.CSSProperties = { fontSize: 11, fontWeight: 600, color: "#666", marginBottom: 4 };
const linkButtonStyle: React.CSSProperties = { fontSize: 12, color: "var(--text-heading)", background: "none", border: "none", cursor: "pointer", fontWeight: 600, padding: 0 };
