"use client";

import { useState, useTransition } from "react";
import { startMyChargeOnlinePaymentAction } from "../actions";

// Opens PayMongo Checkout for the patient to pay THIS specific charge.
// Never marks anything Paid on click — only the verified webhook does
// that once PayMongo confirms (app/api/webhooks/paymongo/route.ts).
export function PayNowButton({ chargeId }: { chargeId: string }) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function payNow() {
    setError(null);
    startTransition(async () => {
      try {
        const url = await startMyChargeOnlinePaymentAction(chargeId);
        window.location.href = url;
      } catch (e: any) {
        setError(e.message || "Couldn't start payment. Please try again.");
      }
    });
  }

  return (
    <div>
      <button
        onClick={payNow}
        disabled={pending}
        style={{ background: "#0c1730", color: "#e6c66b", border: "none", borderRadius: 8, padding: "9px 18px", fontSize: 13, fontWeight: 700, cursor: "pointer" }}
      >
        {pending ? "Opening secure checkout…" : "Pay Now"}
      </button>
      {error && <p style={{ fontSize: 11.5, color: "#a12a2a", marginTop: 6 }}>{error}</p>}
    </div>
  );
}
