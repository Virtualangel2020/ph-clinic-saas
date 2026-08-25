import { NextRequest, NextResponse } from "next/server";
import { renderToBuffer } from "@react-pdf/renderer";
import { createClient } from "@/lib/supabase/server";
import { ReceiptDocument } from "@/lib/pdf/receipt-document";

export const runtime = "nodejs";

const METHOD_LABEL: Record<string, string> = {
  cash: "Cash",
  hmo: "HMO",
  philhealth: "PhilHealth",
  yakap: "YAKAP",
  paymongo: "PayMongo (Online)",
  other: "Other",
};

function formatDateTimePretty(iso: string) {
  return new Date(iso).toLocaleString("en-PH", { year: "numeric", month: "long", day: "numeric", hour: "numeric", minute: "2-digit" });
}

// GET ?paymentId=... -> application/pdf. One receipt per
// patient_charge_payments row. Works for staff (viewing/printing from the
// chart's Billing tab) and for the patient themselves (Patient Portal
// Billing) — access is scoped either by tenant membership or by the
// caller's own active patient_portal_accounts row, same dual-path check
// used elsewhere (see complete_patient_form / record_patient_charge_checkout_session).
export async function GET(req: NextRequest) {
  const paymentId = req.nextUrl.searchParams.get("paymentId");
  if (!paymentId) return NextResponse.json({ error: "Missing paymentId." }, { status: 400 });

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not authenticated." }, { status: 401 });

  const { data: payment, error: paymentError } = await supabase
    .from("patient_charge_payments")
    .select("id, patient_id, charge_id, amount_php, method, reference, paid_at, patients(tenant_id, first_name, middle_name, last_name, date_of_birth, sex), patient_charges(description)")
    .eq("id", paymentId)
    .maybeSingle();
  if (paymentError || !payment) return NextResponse.json({ error: "Receipt not found." }, { status: 404 });

  // RLS already scopes patient_charge_payments to either the caller's own
  // tenant (staff) or their own patient_id (portal) — reaching this line
  // with a row returned means the caller was already allowed to see it.

  const tenantId = (payment as any).patients?.tenant_id;
  const { data: clinicSettings } = await supabase
    .from("clinic_settings")
    .select("clinic_name, logo_path, address_line1, address_line2, city, province, postal_code, phone, mobile, email, website")
    .eq("tenant_id", tenantId)
    .maybeSingle();

  let logoUrl: string | null = null;
  if (clinicSettings?.logo_path) {
    const { data } = supabase.storage.from("clinic-logos").getPublicUrl(clinicSettings.logo_path);
    logoUrl = data.publicUrl;
  }

  const patientRow: any = (payment as any).patients;
  const patientFullName = `${patientRow.last_name}, ${patientRow.first_name}${patientRow.middle_name ? " " + patientRow.middle_name : ""}`;

  const pdfBuffer = await renderToBuffer(
    ReceiptDocument({
      data: {
        clinic: {
          name: clinicSettings?.clinic_name ?? "AngelClinic",
          logoUrl,
          addressLine1: clinicSettings?.address_line1 ?? null,
          addressLine2: clinicSettings?.address_line2 ?? null,
          city: clinicSettings?.city ?? null,
          province: clinicSettings?.province ?? null,
          postalCode: clinicSettings?.postal_code ?? null,
          phone: clinicSettings?.phone ?? null,
          mobile: clinicSettings?.mobile ?? null,
          email: clinicSettings?.email ?? null,
          website: clinicSettings?.website ?? null,
        },
        patient: { fullName: patientFullName, dateOfBirth: patientRow.date_of_birth, sex: patientRow.sex },
        receiptNumber: (payment as any).id.slice(0, 8).toUpperCase(),
        serviceDescription: (payment as any).patient_charges?.description ?? "Payment",
        amountPhp: Number((payment as any).amount_php),
        paidAt: formatDateTimePretty((payment as any).paid_at),
        method: METHOD_LABEL[(payment as any).method] ?? (payment as any).method,
        reference: (payment as any).reference,
        status: "PAID",
        generatedAt: formatDateTimePretty(new Date().toISOString()),
      },
    })
  );

  return new NextResponse(pdfBuffer as any, {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="receipt-${(payment as any).id.slice(0, 8)}.pdf"`,
      "Cache-Control": "no-store",
    },
  });
}
