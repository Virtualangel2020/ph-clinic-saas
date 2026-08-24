import Link from "next/link";
import { NewOrderClient } from "./new-order-client";

// Global "+ New Order" entry point (spec §16-19): search-patient-first,
// then place the order. Once a patient is picked, this calls the exact
// same addLabOrderAction (../actions.ts) the patient chart's own
// Orders & Results tab uses — no separate order-creation path, just a
// different starting point for staff who don't already have a chart open.
export default function NewOrderPage() {
  return (
    <div>
      <Link href="/dashboard/orders" style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 13, color: "#666", textDecoration: "none", marginBottom: 14 }}>
        ← Back to Orders
      </Link>
      <h1 style={{ fontSize: 22, marginBottom: 4 }}>New Order</h1>
      <p style={{ color: "#666", marginBottom: 20, fontSize: 13 }}>
        Search for the patient this order is for. To place an order while already viewing a chart, use "+ New Order"
        on that patient's Orders &amp; Results tab instead — it's the same action, just with the patient pre-selected.
      </p>
      <NewOrderClient />
    </div>
  );
}
