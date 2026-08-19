// Shared low-level PayMongo API helper. Extracted out of
// app/dashboard/actions.ts so the in-app QR-checkout pattern (create
// Payment Intent -> create Payment Method -> attach -> poll) isn't
// duplicated between the logged-in-clinic billing flow and the new
// self-serve signup checkout flow (app/get-started/actions.ts). Both
// reuse this instead of hand-rolling their own fetch calls.
//
// Note: app/admin/actions.ts has its own separate, smaller PayMongo call
// (Checkout Sessions, for admin-generated payment links) that isn't
// routed through here — different endpoint/shape, and it's already
// confirmed working end-to-end in production, so it's left as-is rather
// than risked in this refactor.

export async function paymongoAuthHeader() {
  const secretKey = process.env.PAYMONGO_SECRET_KEY;
  if (!secretKey) {
    throw new Error("PAYMONGO_SECRET_KEY isn't set — ask the platform admin to add it in Vercel.");
  }
  return `Basic ${Buffer.from(`${secretKey}:`).toString("base64")}`;
}

export async function paymongo(path: string, body?: any) {
  const auth = await paymongoAuthHeader();
  const res = await fetch(`https://api.paymongo.com/v1${path}`, {
    method: body ? "POST" : "GET",
    headers: { Authorization: auth, "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });
  const json = await res.json();
  if (!res.ok) {
    const message = json?.errors?.[0]?.detail ?? `PayMongo error (HTTP ${res.status})`;
    throw new Error(message);
  }
  return json;
}

// Runs the 3-step QR Ph flow (create intent -> create payment method ->
// attach) and returns a ready-to-render base64 QR image. Shared by both
// the dashboard billing checkout and the signup checkout.
export async function createQrPhPaymentIntent(amountPhp: number, description: string) {
  const amountCentavos = Math.round(amountPhp * 100);

  const intent = await paymongo("/payment_intents", {
    data: {
      attributes: {
        amount: amountCentavos,
        currency: "PHP",
        capture_type: "automatic",
        payment_method_allowed: ["qrph"],
        description,
      },
    },
  });
  const paymentIntentId: string = intent.data.id;
  const clientKey: string = intent.data.attributes.client_key;

  const method = await paymongo("/payment_methods", {
    data: { attributes: { type: "qrph" } },
  });
  const paymentMethodId: string = method.data.id;

  const attached = await paymongo(`/payment_intents/${paymentIntentId}/attach`, {
    data: { attributes: { payment_method: paymentMethodId, client_key: clientKey } },
  });

  const rawImage: string | undefined = attached.data.attributes.next_action?.code?.image_url;
  if (!rawImage) {
    throw new Error(
      "PayMongo didn't return a QR code image for this payment — QR Ph may not be enabled on your account yet."
    );
  }
  const qrImage = rawImage.startsWith("data:") ? rawImage : `data:image/png;base64,${rawImage}`;

  return { paymentIntentId, qrImage };
}

export async function getPaymentIntentStatus(paymentIntentId: string): Promise<string> {
  const intent = await paymongo(`/payment_intents/${paymentIntentId}`);
  return intent.data.attributes.status;
}
