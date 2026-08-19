"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createQrPhPaymentIntent, getPaymentIntentStatus } from "@/lib/paymongo";

// Actions a clinic's own logged-in staff can trigger for THEIR OWN
// invoices — never platform-admin-only. RLS on invoices/payments already
// restricts reads to `current_tenant_id()`; the RPCs called here re-check
// the same thing server-side as defense in depth.
//
// Trust boundary, stated plainly: the money-received signal used below
// comes from calling PayMongo's own "retrieve a payment intent" endpoint
// server-side, in this file — never from anything the browser asserts.
// A payment only gets recorded once PayMongo itself reports
// status = "succeeded". The one residual gap: `tenant_record_verified_payment`
// is a Postgres RPC reachable directly over Supabase's REST API by any
// authenticated user with a session — a technically sophisticated clinic
// user could in theory call it directly with a fabricated amount for
// their OWN invoice, bypassing this file's PayMongo check entirely. The
// blast radius is narrow (only their own tenant's own invoice can be
// marked paid, never another tenant's, and it's clearly logged in
// audit_logs and shows up in the admin Billing panel like any other
// payment for review) — but it's not airtight, and worth knowing.

export async function createQrCheckoutAction(invoiceId: string): Promise<{
  paymentIntentId: string;
  qrImage: string;
  amount: number;
}> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not signed in.");

  const { data: invoice, error: invoiceError } = await supabase
    .from("invoices")
    .select("id, tenant_id, description, amount_php, discount_php")
    .eq("id", invoiceId)
    .single();
  if (invoiceError || !invoice) throw new Error("Invoice not found, or it doesn't belong to your clinic.");

  const { data: payments } = await supabase.from("payments").select("amount_php").eq("invoice_id", invoiceId);
  const alreadyPaid = (payments ?? []).reduce((sum, p: any) => sum + Number(p.amount_php), 0);
  const remaining = Number(invoice.amount_php) - Number(invoice.discount_php) - alreadyPaid;
  if (remaining <= 0) throw new Error("This invoice is already fully paid.");

  const { paymentIntentId, qrImage } = await createQrPhPaymentIntent(
    remaining,
    `Angel Clinic — ${invoice.description}`
  );

  const { error: saveError } = await supabase.rpc("tenant_set_invoice_payment_intent", {
    p_invoice_id: invoiceId,
    p_payment_intent_id: paymentIntentId,
  });
  if (saveError) throw new Error(saveError.message);

  return { paymentIntentId, qrImage, amount: remaining };
}

export async function checkQrCheckoutStatusAction(
  invoiceId: string,
  paymentIntentId: string
): Promise<{ paid: boolean; status: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not signed in.");

  const { data: invoice, error: invoiceError } = await supabase
    .from("invoices")
    .select("id, tenant_id, amount_php, discount_php, paymongo_payment_intent_id, status")
    .eq("id", invoiceId)
    .single();
  if (invoiceError || !invoice) throw new Error("Invoice not found, or it doesn't belong to your clinic.");
  if (invoice.paymongo_payment_intent_id !== paymentIntentId) {
    throw new Error("This QR code doesn't match this invoice anymore — refresh and try again.");
  }

  if (invoice.status === "paid") {
    return { paid: true, status: "succeeded" };
  }

  const status = await getPaymentIntentStatus(paymentIntentId);

  if (status !== "succeeded") {
    return { paid: false, status };
  }

  const { data: payments } = await supabase.from("payments").select("amount_php").eq("invoice_id", invoiceId);
  const alreadyPaid = (payments ?? []).reduce((sum, p: any) => sum + Number(p.amount_php), 0);
  const remaining = Number(invoice.amount_php) - Number(invoice.discount_php) - alreadyPaid;

  if (remaining > 0) {
    const { error: recordError } = await supabase.rpc("tenant_record_verified_payment", {
      p_invoice_id: invoiceId,
      p_amount_php: remaining,
      p_payment_intent_id: paymentIntentId,
    });
    if (recordError) throw new Error(recordError.message);
  }

  revalidatePath("/dashboard/billing");
  revalidatePath(`/admin/clients/${invoice.tenant_id}`);

  return { paid: true, status: "succeeded" };
}
