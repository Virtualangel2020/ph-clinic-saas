import { requireClinicAdmin } from "@/lib/require-clinic-admin";
import { BackLink } from "@/components/back-link";
import { CancellationManager } from "./cancellation-manager";

// Cancellation & No-Show Policy (spec §40-48, §63). clinic_settings.
// cancellation_policy is a single structured jsonb blob + a version
// counter that's bumped on every save — patient_policy_acknowledgements
// snapshots the exact policy + version a patient agreed to, so a later
// edit here never rewrites what someone already acknowledged. A provider
// can wholesale-override the clinic policy (provider_patient_access_
// settings.cancellation_policy, its own version counter) — NULL there
// means "inherit the clinic policy," non-null REPLACES it entirely.
export default async function CancellationPage() {
  const { supabase, profile } = await requireClinicAdmin();
  const tenantId = profile.tenant_id;

  const [{ data: clinicSettings }, { data: providers }, { data: overrides }] = await Promise.all([
    supabase.from("clinic_settings").select("cancellation_policy, cancellation_policy_version").eq("tenant_id", tenantId).maybeSingle(),
    supabase.from("user_profiles").select("id, full_name, title").eq("tenant_id", tenantId).eq("role", "doctor").eq("is_active", true).order("full_name"),
    supabase.from("provider_patient_access_settings").select("provider_id, cancellation_policy, cancellation_policy_version").eq("tenant_id", tenantId),
  ]);

  return (
    <div style={{ maxWidth: 780 }}>
      <BackLink href="/dashboard/settings/patient-access" label="Patient Access & Payments" />
      <h1 style={{ fontSize: 22, marginBottom: 4 }}>Cancellation & No-Show Policy</h1>
      <p style={{ color: "#666", fontSize: 13, marginBottom: 20 }}>
        No-shows and cancellations are always tracked automatically, but nothing is ever auto-charged unless you
        configure it here. If a patient hasn&apos;t already agreed to a fee or advance-payment policy, keep this
        simple — patients only ever see the parts of this that actually apply to their appointment.
      </p>

      <CancellationManager
        clinicPolicy={(clinicSettings as any)?.cancellation_policy ?? null}
        clinicPolicyVersion={(clinicSettings as any)?.cancellation_policy_version ?? 1}
        providers={(providers as any) ?? []}
        overrides={(overrides as any) ?? []}
      />
    </div>
  );
}
