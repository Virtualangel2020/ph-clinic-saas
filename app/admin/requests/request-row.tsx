"use client";

import { useState, useTransition } from "react";
import { approveRequestAction, rejectRequestAction } from "@/app/admin/actions";

const STATUS_COLOR: Record<string, string> = {
  pending: "#c99a2e",
  approved: "#1a7f37",
  rejected: "#a12a2a",
};

export function RequestRow({ request }: { request: any }) {
  const [pending, startTransition] = useTransition();
  const [localStatus, setLocalStatus] = useState(request.status);
  const [error, setError] = useState<string | null>(null);

  function approve() {
    startTransition(async () => {
      try {
        await approveRequestAction(request.id);
        setLocalStatus("approved");
      } catch (e: any) {
        setError(e.message);
      }
    });
  }

  function reject() {
    startTransition(async () => {
      try {
        await rejectRequestAction(request.id, "");
        setLocalStatus("rejected");
      } catch (e: any) {
        setError(e.message);
      }
    });
  }

  // A request that's approved with no resolved_by is one nobody clicked
  // "Approve" on — it self-provisioned the instant PayMongo confirmed
  // payment (see provision_tenant_from_paid_request / migration 025).
  // This is the "admin gets notified" surface for that flow: it's not a
  // push notification or an email (no email-sending infra is wired up
  // yet), just a badge that's impossible to miss here and on the
  // dashboard.
  const autoProvisioned = localStatus === "approved" && !request.resolved_by && !!request.user_id;

  return (
    <div
      style={{
        background: autoProvisioned ? "#fbfff8" : "white",
        border: `1px solid ${autoProvisioned ? "#bfe3bf" : "#e2e2e5"}`,
        borderRadius: 12,
        padding: 18,
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
        <div>
          <div style={{ fontWeight: 700, fontSize: 14 }}>
            {request.clinic_name || request.contact_name || request.contact_email}
            <span
              style={{
                marginLeft: 10,
                fontSize: 11,
                fontWeight: 600,
                color: STATUS_COLOR[localStatus] ?? "#666",
                border: `1px solid ${STATUS_COLOR[localStatus] ?? "#666"}`,
                borderRadius: 999,
                padding: "2px 8px",
              }}
            >
              {localStatus}
            </span>
            {autoProvisioned && (
              <span
                style={{
                  marginLeft: 6,
                  fontSize: 11,
                  fontWeight: 700,
                  color: "#1a7f37",
                  background: "#f0f9f0",
                  border: "1px solid #bfe3bf",
                  borderRadius: 999,
                  padding: "2px 8px",
                }}
              >
                ⚡ self-serve, paid — auto-provisioned
              </span>
            )}
          </div>
          <div style={{ fontSize: 12, color: "#888", marginTop: 4 }}>
            {request.type} · {request.contact_email}
            {request.contact_phone ? ` · ${request.contact_phone}` : ""}
          </div>
          <div style={{ fontSize: 12, color: "#888" }}>
            Requested plan: {request.plans?.name ?? "—"} ({request.requested_billing_cycle ?? "—"})
          </div>
          <div style={{ fontSize: 11, color: "#aaa", marginTop: 4 }}>
            Submitted {new Date(request.created_at).toLocaleString()}
          </div>
          {error && <div style={{ fontSize: 12, color: "crimson", marginTop: 6 }}>{error}</div>}
        </div>

        {localStatus === "pending" && (
          <div style={{ display: "flex", gap: 8 }}>
            <button onClick={approve} disabled={pending} style={{ ...btn, background: "#1a7f37" }}>
              Approve
            </button>
            <button onClick={reject} disabled={pending} style={{ ...btn, background: "#a12a2a" }}>
              Reject
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

const btn: React.CSSProperties = {
  padding: "6px 12px",
  borderRadius: 8,
  border: "none",
  color: "white",
  fontWeight: 600,
  fontSize: 12,
  cursor: "pointer",
};
