import { BrandHeader } from "@/components/brand-header";

export default function PaymentSuccessPage() {
  return (
    <main style={{ maxWidth: 420, margin: "80px auto", padding: 24, textAlign: "center" }}>
      <div style={{ display: "inline-block", marginBottom: 24 }}>
        <BrandHeader />
      </div>
      <div style={{ fontSize: 40, marginBottom: 12 }}>✓</div>
      <h1 style={{ fontSize: 22, marginBottom: 8 }}>Payment received</h1>
      <p style={{ color: "#666", fontSize: 14 }}>
        Thank you — your payment is being confirmed. This can take a minute to reflect on our side. If you have any
        questions, reach out to the Angel Clinic team directly.
      </p>
    </main>
  );
}
