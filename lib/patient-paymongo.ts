// Patient-facing PayMongo helper — a clinic billing ITS OWN patient.
//
// Per explicit instruction, this reuses the SAME PayMongo account/keys
// already wired for AngelClinic's own platform billing
// (process.env.PAYMONGO_SECRET_KEY / PAYMONGO_WEBHOOK_SECRET — see
// lib/paymongo.ts and app/admin/actions.ts's createPaymentLinkAction).
// There is only one PayMongo merchant account in play right now
// (Virtual Angel Systems'), used for both AngelClinic's subscription
// invoices AND every clinic's patient billing.
//
// This is a real simplification, not a shortcut with a hidden cost: it's
// exactly the same "each clinic pastes its own key" architecture minus
// the paste step, and the seam is still clean. If/when a given clinic
// gets its own PayMongo merchant account (§18's longer-term goal — each
// clinic owns its own patient collections), the only change needed is:
// resolve `secretKey` per-tenant here instead of from the shared env var,
// and everything downstream (Checkout Session creation, the webhook,
// patient_charge_payments, Financial) stays exactly as-is — none of it
// assumes a single global key.
//
// A clinic still opts in per-tenant via clinic_settings.accept_online_payments
// (Settings → Payments), so PayMongo checkout is never offered on a
// charge unless that clinic has switched it on.

export async function paymongoSecretKey(): Promise<string> {
  const key = process.env.PAYMONGO_SECRET_KEY;
  if (!key) {
    throw new Error("PAYMONGO_SECRET_KEY isn't set — add it as a server Environment Variable in Vercel and redeploy.");
  }
  return key;
}

export function paymongoMode(): "test" | "live" | "not_configured" {
  const key = process.env.PAYMONGO_SECRET_KEY;
  if (!key) return "not_configured";
  if (key.startsWith("sk_live_")) return "live";
  return "test";
}

// Same request shape as the already-working admin Checkout Session flow
// (app/admin/actions.ts) — deliberately not re-architected, just given a
// different description/success destination for a patient charge.
export async function createPatientChargeCheckoutSession(params: {
  description: string;
  amountPhp: number;
  successUrl: string;
}): Promise<{ sessionId: string; checkoutUrl: string }> {
  const secretKey = await paymongoSecretKey();
  const amountCentavos = Math.round(params.amountPhp * 100);

  const res = await fetch("https://api.paymongo.com/v1/checkout_sessions", {
    method: "POST",
    headers: {
      Authorization: `Basic ${Buffer.from(`${secretKey}:`).toString("base64")}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      data: {
        attributes: {
          send_email_receipt: false,
          show_line_items: true,
          description: params.description,
          line_items: [{ name: params.description, amount: amountCentavos, currency: "PHP", quantity: 1 }],
          payment_method_types: ["gcash", "paymaya", "card", "grab_pay"],
          success_url: params.successUrl,
        },
      },
    }),
  });

  const json = await res.json();
  if (!res.ok) {
    const message = json?.errors?.[0]?.detail ?? `PayMongo error (HTTP ${res.status})`;
    throw new Error(message);
  }

  return { sessionId: json.data.id, checkoutUrl: json.data.attributes.checkout_url };
}
