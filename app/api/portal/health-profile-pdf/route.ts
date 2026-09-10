import { NextRequest, NextResponse } from "next/server";
import { renderToBuffer } from "@react-pdf/renderer";
import { headers } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { HealthProfileDocument, type HealthProfileData, type SectionStatus } from "@/lib/pdf/health-profile-document";

export const runtime = "nodejs";

async function siteOrigin() {
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host");
  const proto = h.get("x-forwarded-proto") ?? "https";
  return `${proto}://${host}`;
}

function asStatus(v: unknown): SectionStatus {
  return v === "none" || v === "has_entries" ? v : "unknown";
}

// GET ?forAccountId=... -> application/pdf download of the MyCareDesk
// Health Profile (spec: "download to PDF patient profile"). Defaults to
// the caller's own profile; forAccountId lets a manager download a
// dependent's (or any account they're a linked, granted co-manager of) —
// re-validated server-side via is_selectable_mycaredesk_profile, the same
// real security boundary the profile-switch cookie uses, rather than
// trusted from the query string. Both mycaredesk_accounts and
// mycaredesk_health_profiles already have owner-or-manager SELECT RLS
// policies, so this reads them with the caller's own session — no
// service-role client needed.
export async function GET(req: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not authenticated." }, { status: 401 });

  const { data: myAccount } = await supabase.rpc("get_my_mycaredesk_account");
  if (!myAccount) return NextResponse.json({ error: "Set up your MyCareDesk account first." }, { status: 400 });

  const forAccountId = req.nextUrl.searchParams.get("forAccountId");
  let targetAccountId = (myAccount as any).id as string;
  let generatedByName: string | null = null;

  if (forAccountId && forAccountId !== targetAccountId) {
    const { data: ok, error: checkError } = await supabase.rpc("is_selectable_mycaredesk_profile", { p_account_id: forAccountId });
    if (checkError) return NextResponse.json({ error: checkError.message }, { status: 400 });
    if (!ok) return NextResponse.json({ error: "You don't have access to that profile." }, { status: 403 });
    targetAccountId = forAccountId;
    generatedByName = `${(myAccount as any).first_name ?? ""} ${(myAccount as any).last_name ?? ""}`.trim() || null;
  }

  const { data: account, error: accountError } = await supabase
    .from("mycaredesk_accounts")
    .select("first_name, last_name, date_of_birth, sex, patient_number")
    .eq("id", targetAccountId)
    .maybeSingle();
  if (accountError || !account) return NextResponse.json({ error: "Profile not found." }, { status: 404 });

  const { data: profile } = await supabase
    .from("mycaredesk_health_profiles")
    .select(
      "allergies, allergies_status, medications, medications_status, conditions, conditions_status, surgical_history, surgical_history_status, family_history, family_history_status, social_history, hmo_name, hmo_number, philhealth_number, emergency_contact_name, emergency_contact_relationship, emergency_contact_phone"
    )
    .eq("mycaredesk_account_id", targetAccountId)
    .maybeSingle();

  const origin = await siteOrigin();
  const fullName = `${account.first_name} ${account.last_name}`.trim();

  const data: HealthProfileData = {
    patient: { fullName, patientNumber: account.patient_number ?? null, dateOfBirth: account.date_of_birth, sex: account.sex },
    logoUrl: `${origin}/logo-64.png`,
    allergiesStatus: asStatus(profile?.allergies_status),
    allergies: (profile?.allergies as string[] | null) ?? [],
    medicationsStatus: asStatus(profile?.medications_status),
    medications: (profile?.medications as string[] | null) ?? [],
    conditionsStatus: asStatus(profile?.conditions_status),
    conditions: (profile?.conditions as string[] | null) ?? [],
    surgicalHistoryStatus: asStatus(profile?.surgical_history_status),
    surgicalHistory: profile?.surgical_history ?? null,
    familyHistoryStatus: asStatus(profile?.family_history_status),
    familyHistory: profile?.family_history ?? null,
    socialHistory: profile?.social_history ?? null,
    hmoName: profile?.hmo_name ?? null,
    hmoNumber: profile?.hmo_number ?? null,
    philhealthNumber: profile?.philhealth_number ?? null,
    emergencyContactName: profile?.emergency_contact_name ?? null,
    emergencyContactRelationship: profile?.emergency_contact_relationship ?? null,
    emergencyContactPhone: profile?.emergency_contact_phone ?? null,
    generatedAt: new Date().toLocaleString("en-PH", { year: "numeric", month: "long", day: "numeric", hour: "numeric", minute: "2-digit" }),
    generatedByName,
  };

  const pdfBuffer = await renderToBuffer(HealthProfileDocument({ data }));

  return new NextResponse(pdfBuffer as any, {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="patient-profile-${fullName.replace(/\s+/g, "-").toLowerCase()}.pdf"`,
      "Cache-Control": "no-store",
    },
  });
}
