"use client";

import { useEffect, useRef, useState } from "react";
import { checkSignupCheckoutStatusAction } from "./actions";

export function SignupQrCheckout({
  requestId,
  paymentIntentId,
  qrImage,
  amount,
  onPaid,
}: {
  requestId: string;
  paymentIntentId: string;
  qrImage: string;
  amount: number;
  onPaid: () => void;
}) {
  const [paid, setPaid] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    pollRef.current = setInterval(async () => {
      try {
        const status = await checkSignupCheckoutStatusAction(requestId, paymentIntentId);
        if (status.paid) {
          if (pollRef.current) clearInterval(pollRef.current);
          setPaid(true);
          onPaid();
        }
      } catch {
        // transient network/PayMongo hiccup — keep polling silently
      }
    }, 3000);

    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [requestId, paymentIntentId]);

  if (paid) {
    return (
      <div style={{ background: "#f0f9f0", border: "1px solid #bfe3bf", borderRadius: 10, padding: 20, textAlign: "center" }}>
        <div style={{ fontSize: 28, marginBottom: 4 }}>✓</div>
        <div style={{ color: "#1a7f37", fontWeight: 700, fontSize: 15 }}>Payment received — setting up your clinic...</div>
      </div>
    );
  }

  return (
    <div style={{ background: "white", border: "1px solid #e2e2e5", borderRadius: 10, padding: 20, textAlign: "center" }}>
      <img src={qrImage} alt="QR Ph payment code" style={{ width: 220, height: 220, margin: "0 auto 10px" }} />
      <div style={{ fontSize: 14, color: "#333", marginBottom: 4 }}>
        Scan with your GCash, Maya, or banking app — ₱{amount.toLocaleString()}
      </div>
      <div style={{ fontSize: 12, color: "#888" }}>
        Waiting for payment... your clinic unlocks automatically the moment it's received.
      </div>
      {error && <div style={{ color: "crimson", fontSize: 12, marginTop: 8 }}>{error}</div>}
    </div>
  );
}
