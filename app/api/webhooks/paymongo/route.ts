import { NextResponse } from "next/server";
import crypto from "crypto";
import { createAdminClient } from "@/lib/supabase/admin";

// PayMongo calls this after a checkout session gets paid. No user is
// signed in when this runs — PayMongo authenticates itself via the
// Paymongo-Signature header instead, which is why this uses the
// service-role client (see lib/supabase/admin.ts) rather than the normal
// session-scoped one.
//
// NOTE ON SIGNATURE VERIFICATION: PayMongo's header format is
// `t=<timestamp>,te=<test-mode signature>,li=<live-mode signature>`,
// where the signature is HMAC-SHA256 of `${timestamp}.${rawBody}` using
// your webhook's signing secret (from PayMongo dashboard → Developers →
// Webhooks → your endpoint). If PAYMONGO_WEBHOOK_SECRET isn't set yet,
// verification is skipped (with a logged warning) so the endpoint still
// works while you're wiring things up — set the secret to lock it down
// before relying on this for real payments.
function verifySignature(rawBody: string, signatureHeader: string | null, secret: string): boolean {
  if (!signatureHeader) return false;
  const parts = Object.fromEntries(
    signatureHeader.split(",").map((kv) => {
      const [k, v] = kv.split("=");
      return [k, v];
    })
  );
  const timestamp = parts.t;
  const candidate = secret.startsWith("whsk_live") ? parts.li : parts.te;
  if (!timestamp || !candidate) return false;

  const expected = crypto.createHmac("sha256", secret).update(`${timestamp}.${rawBody}`).digest("hex");

  try {
    return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(candidate));
  } catch {
    return false;
  }
}

// Best-effort extraction — PayMongo nests the checkout session's own
// payload inside the event, but the exact shape isn't confirmed against a
// live event yet. Falls back through a few plausible paths and logs the
// full event if none match, so it can be adjusted from real traffic
// instead of guesswork.
function extractCheckoutSession(event: any) {
  const inner = event?.data?.attributes?.data;
  const id: string | undefined = inner?.id;
  const paymentAttrs = inner?.attributes?.payments?.[0]?.attributes;
  return {
    id,
    amount: paymentAttrs?.amount ? Number(paymentAttrs.amount) / 100 : null,
    method: paymentAttrs?.source?.type ?? paymentAttrs?.payment_method_used ?? null,
  };
}

export async function POST(request: Request) {
  const rawBody = await request.text();
  const secret = process.env.PAYMONGO_WEBHOOK_SECRET;
  const signatureHeader = request.headers.get("paymongo-signature");

  if (secret) {
    if (!verifySignature(rawBody, signatureHeader, secret)) {
      console.warn("PayMongo webhook: signature verification failed");
      return NextResponse.json({ error: "invalid signature" }, { status: 401 });
    }
  } else {
    console.warn("PayMongo webhook: PAYMONGO_WEBHOOK_SECRET not set — skipping signature verification");
  }

  let event: any;
  try {
    event = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }

  const eventType = event?.data?.attributes?.type;
  if (eventType !== "checkout_session.payment.paid") {
    // Acknowledge anything we don't act on — PayMongo retries non-2xx
    // responses, and we only care about this one event type.
    return NextResponse.json({ received: true, ignored: eventType ?? "unknown" });
  }

  const session = extractCheckoutSession(event);
  if (!session.id) {
    console.error("PayMongo webhook: could not find checkout session id in payload", JSON.stringify(event));
    return NextResponse.json({ received: true, error: "unrecognized payload shape" });
  }

  const admin = createAdminClient();

  const { data: invoice, error: invoiceError } = await admin
    .from("invoices")
    .select("id, tenant_id, amount_php, discount_php")
    .eq("paymongo_checkout_session_id", session.id)
    .maybeSingle();

  if (invoiceError || !invoice) {
    console.error("PayMongo webhook: no invoice matches checkout session", session.id, invoiceError?.message);
    return NextResponse.json({ received: true, error: "no matching invoice" });
  }

  const methodMap: Record<string, string> = { gcash: "gcash", paymaya: "paymaya", card: "card" };
  const method = (session.method && methodMap[session.method]) || "other";

  const amountPaid = session.amount ?? Number(invoice.amount_php) - Number(invoice.discount_php);

  const { data: paymentRow, error: paymentError } = await admin
    .from("payments")
    .insert({
      tenant_id: invoice.tenant_id,
      invoice_id: invoice.id,
      amount_php: amountPaid,
      method,
      reference: session.id,
      note: `Paid via PayMongo checkout (${session.method ?? "unknown method"})`,
    })
    .select()
    .single();

  if (paymentError) {
    console.error("PayMongo webhook: failed to record payment", paymentError.message);
    return NextResponse.json({ received: true, error: "failed to record payment" });
  }

  const { data: allPayments } = await admin.from("payments").select("amount_php").eq("invoice_id", invoice.id);
  const totalPaid = (allPayments ?? []).reduce((sum: number, p: any) => sum + Number(p.amount_php), 0);
  const owed = Number(invoice.amount_php) - Number(invoice.discount_php);
  const newStatus = totalPaid <= 0 ? "pending" : totalPaid < owed ? "partially_paid" : "paid";

  await admin.from("invoices").update({ status: newStatus }).eq("id", invoice.id);

  await admin.from("audit_logs").insert({
    tenant_id: invoice.tenant_id,
    actor_user_id: null,
    action: "paymongo_webhook_payment",
    entity_type: "payments",
    entity_id: paymentRow.id,
    new_value: { amount_php: amountPaid, method, checkout_session_id: session.id },
  });

  return NextResponse.json({ received: true, recorded: true });
}
