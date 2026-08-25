"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { resetDemoPatientInvoiceAction } from "../actions";

type Charge = { id: string; description: string; amount_php: number; status: string };

function peso(n: number) {
  return `₱${n.toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

// DEMO / TEST ONLY — only ever rendered when the current tenant is
// tenants.is_test, and the underlying RPC (admin_reset_demo_patient_invoice)
// independently refuses to run against anything else, so this can't
// touch a real clinic's data even if this component were somehow reused.
// Resets a demo invoice back to Unpaid so the same PayMongo demo can be
// run again for another prospective client, without deleting the
// PayMongo transaction history itself (see the RPC's own comment).
export function DemoResetSection({ patientId, charges }: { patientId: string; charges: Charge[] }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  function reset(chargeId: string) {
    if (!confirm("Reset this demo invoice back to Unpaid? This won't affect any real clinic data.")) return;
    setError(null);
    setBusyId(chargeId);
    startTransition(async () => {
      try {
        await resetDemoPatientInvoiceAction(chargeId);
        router.refresh();
      } catch (e: any) {
        setError(e.message || "Couldn't reset that invoice.");
      } finally {
        setBusyId(null);
      }
    });
  }

  if (charges.length === 0) return null;

  return (
    <div style={{ background: "#fff8e6", border: "1px solid #e6c66b", borderRadius: 12, padding: 20 }}>
      <h2 style={{ fontSize: 14, marginTop: 0, marginBottom: 4 }}>Demo Reset — Angel Testpatient</h2>
      <p style={{ fontSize: 12, color: "#7a5c12", marginTop: 0, marginBottom: 12 }}>
        For sales demos only. Resets Angel Testpatient&apos;s demo invoice back to Unpaid so you can walk through the
        PayMongo payment flow again.
      </p>
      {error && <p style={{ fontSize: 12, color: "#a12a2a" }}>{error}</p>}
      <div style={{ display: "grid", gap: 8 }}>
        {charges.map((c) => (
          <div key={c.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", background: "white", border: "1px solid #eee", borderRadius: 8, padding: "8px 12px", fontSize: 12.5 }}>
            <span>
              {c.description} — {peso(c.amount_php)}
            </span>
            <button
              onClick={() => reset(c.id)}
              disabled={pending && busyId === c.id}
              style={{ background: "none", border: "1px solid var(--input-border)", borderRadius: 8, padding: "6px 12px", fontSize: 12, cursor: "pointer", color: "#555" }}
            >
              {pending && busyId === c.id ? "Resetting…" : "Reset to Unpaid"}
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
