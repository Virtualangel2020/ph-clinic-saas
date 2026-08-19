"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createQrCheckoutAction, checkQrCheckoutStatusAction } from "./actions";

export function QrCheckout({ invoiceId }: { invoiceId: string }) {
  const [phase, setPhase] = useState<"idle" | "loading" | "waiting" | "paid" | "error">("idle");
  const [qrImage, setQrImage] = useState<string | null>(null);
  const [amount, setAmount] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const router = useRouter();

  useEffect(() => {
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, []);

  async function startCheckout() {
    setPhase("loading");
    setError(null);
    try {
      const result = await createQrCheckoutAction(invoiceId);
      setQrImage(result.qrImage);
      setAmount(result.amount);
      setPhase("waiting");

      pollRef.current = setInterval(async () => {
        try {
          const status = await checkQrCheckoutStatusAction(invoiceId, result.paymentIntentId);
          if (status.paid) {
            if (pollRef.current) clearInterval(pollRef.current);
            setPhase("paid");
            router.refresh();
          }
        } catch {
          // transient network/PayMongo hiccup — keep polling silently, the
          // next tick will usually succeed
        }
      }, 3000);
    } catch (e: any) {
      setError(e.message);
      setPhase("error");
    }
  }

  if (phase === "paid") {
    return (
      <div style={{ background: "#f0f9f0", border: "1px solid #bfe3bf", borderRadius: 10, padding: 16, textAlign: "center" }}>
        <div style={{ fontSize: 28, marginBottom: 4 }}>✓</div>
        <div style={{ color: "#1a7f37", fontWeight: 700, fontSize: 14 }}>Payment received</div>
      </div>
    );
  }

  if (phase === "waiting" && qrImage) {
    return (
      <div style={{ background: "white", border: "1px solid #e2e2e5", borderRadius: 10, padding: 16, textAlign: "center" }}>
        <img src={qrImage} alt="QR Ph payment code" style={{ width: 220, height: 220, margin: "0 auto 10px" }} />
        <div style={{ fontSize: 13, color: "#333", marginBottom: 4 }}>
          Scan with your GCash, Maya, or banking app — ₱{amount?.toLocaleString()}
        </div>
        <div style={{ fontSize: 12, color: "#888" }}>Waiting for payment... this updates automatically.</div>
      </div>
    );
  }

  return (
    <div>
      <button
        onClick={startCheckout}
        disabled={phase === "loading"}
        style={{
          padding: "10px 18px",
          borderRadius: 8,
          border: "none",
          background: "#0c1730",
          color: "#e6c66b",
          fontWeight: 700,
          fontSize: 13,
          cursor: "pointer",
        }}
      >
        {phase === "loading" ? "Preparing checkout..." : "Proceed to checkout"}
      </button>
      {error && <div style={{ color: "crimson", fontSize: 12, marginTop: 8 }}>{error}</div>}
    </div>
  );
}
