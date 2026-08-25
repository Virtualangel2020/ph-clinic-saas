import { requireClinicAdmin } from "@/lib/require-clinic-admin";
import { BackLink } from "@/components/back-link";
import { SetupWizard } from "./setup-wizard";
import { CLINIC_PATIENT_ACCESS_COLUMNS, CLINIC_PATIENT_ACCESS_DEFAULTS, ClinicPatientAccessRow } from "../shared";

// The 9-step first-time setup wizard (spec §1-2). Every step saves
// immediately through the same RPCs the full settings pages use — this
// is a guided, plain-language front door to those pages, not a separate
// data path. A clinic can stop after any step and everything already
// works with its safe defaults; "Review & Activate" only flips a
// display flag (patient_access_setup_completed), it never gates
// functionality.
export default async function PatientAccessSetupPage() {
  const { supabase, profile } = await requireClinicAdmin();
  const tenantId = profile.tenant_id;

  const [{ data: clinicSettings }, { data: cancellation }, { data: payments }, { count: serviceCount }] = await Promise.all([
    supabase.from("clinic_settings").select(CLINIC_PATIENT_ACCESS_COLUMNS).eq("tenant_id", tenantId).maybeSingle(),
    supabase.from("clinic_settings").select("cancellation_policy").eq("tenant_id", tenantId).maybeSingle(),
    supabase.from("clinic_settings").select("accept_online_payments").eq("tenant_id", tenantId).maybeSingle(),
    supabase.from("appointment_types").select("id", { count: "exact", head: true }).eq("tenant_id", tenantId).eq("is_active", true),
  ]);

  return (
    <div style={{ maxWidth: 640 }}>
      <BackLink href="/dashboard/settings/patient-access" label="Patient Access & Payments" />
      <h1 style={{ fontSize: 22, marginBottom: 4 }}>Set Up Patient Access & Payments</h1>
      <p style={{ color: "#666", fontSize: 13, marginBottom: 20 }}>
        A few quick questions about how your clinic actually works. Nothing here is required to keep using
        AngelClinic — every setting already has a safe default — this just walks through them in plain language.
      </p>

      <SetupWizard
        clinicDefaults={((clinicSettings as ClinicPatientAccessRow) ?? CLINIC_PATIENT_ACCESS_DEFAULTS) as ClinicPatientAccessRow}
        cancellationPolicy={(cancellation as any)?.cancellation_policy ?? null}
        acceptOnlinePayments={!!(payments as any)?.accept_online_payments}
        serviceCount={serviceCount ?? 0}
      />
    </div>
  );
}
