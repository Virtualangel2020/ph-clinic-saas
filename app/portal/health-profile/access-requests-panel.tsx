"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

type Request = {
  id: string;
  tenant_id: string;
  clinic_name: string;
  message: string | null;
  status: string;
  created_at: string;
  for_account_id?: string | null;
  for_account_name?: string | null;
};

// Lets the account owner approve or deny a clinic's request to link this
// MyCareDesk account to a patient record at their clinic (see
// staff_request_mycaredesk_access / patient_respond_to_mycaredesk_access_request).
// Approving creates that clinic's own patients row automatically — see the
// migration for exactly what gets copied.
export function AccessRequestsPanel({ requests }: { requests: Request[] }) {
  const router = useRouter();
  const [busyId, setBusyId] = useState<string | null>(null);
  const pending = requests.filter((r) => r.status === "pending");

  if (pending.length === 0) return null;

  async function respond(id: string, approve: boolean) {
    setBusyId(id);
    const supabase = createClient();
    await supabase.rpc("patient_respond_to_mycaredesk_access_request", { p_request_id: id, p_approve: approve });
    setBusyId(null);
    router.refresh();
  }

  return (
    <div style={{ background: "#fff7e6", border: "1px solid #e6c66b", borderRadius: 10, padding: 16, marginBottom: 20 }}>
      <div style={{ fontWeight: 700, fontSize: 13.5, color: "#7a5c12", marginBottom: 8 }}>Clinic requests waiting for your approval</div>
      <div style={{ display: "grid", gap: 8 }}>
        {pending.map((r) => (
          <div key={r.id} style={{ background: "white", border: "1px solid #e6c66b", borderRadius: 8, padding: "10px 12px" }}>
            <div style={{ fontWeight: 700, fontSize: 13 }}>{r.clinic_name}</div>
            {r.for_account_name && <div style={{ fontSize: 12, color: "#7a5c12", marginTop: 2 }}>For: {r.for_account_name}</div>}
            {r.message && <div style={{ fontSize: 12, color: "#666", marginTop: 2 }}>{r.message}</div>}
            <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
              <button
                onClick={() => respond(r.id, true)}
                disabled={busyId === r.id}
                style={{ fontSize: 12, fontWeight: 700, color: "white", background: "#1a7f37", border: "none", borderRadius: 6, padding: "6px 14px", cursor: "pointer" }}
              >
                Approve
              </button>
              <button
                onClick={() => respond(r.id, false)}
                disabled={busyId === r.id}
                style={{ fontSize: 12, fontWeight: 600, color: "#a12a2a", background: "white", border: "1px solid #a12a2a", borderRadius: 6, padding: "6px 14px", cursor: "pointer" }}
              >
                Deny
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
