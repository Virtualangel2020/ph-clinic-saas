// "My Doctors" (bug-fix spec §14) — providers this patient has an
// established care relationship with, aggregated across every clinic
// they're connected to (a patient can accumulate more than one
// patient_portal_accounts row — one per clinic they've booked with or
// been invited by — see requirePatientPortal's allAccounts). Reuses
// user_profiles_portal_same_tenant_read RLS (already grants a patient
// read access to any active provider at a clinic they're connected to)
// and clinic_settings_portal_self_read for the clinic display name —
// `tenants` itself has no patient-read policy, so that table is never
// queried directly here. No new schema, no new RLS.
export type MyDoctor = {
  providerId: string;
  fullName: string;
  title: string | null;
  specialty: string | null;
  tenantId: string;
  clinicName: string | null;
};

export async function getMyDoctors(supabase: any, clinicAccounts: { tenant_id: string; patient_id: string }[]): Promise<MyDoctor[]> {
  if (clinicAccounts.length === 0) return [];

  const results = await Promise.all(
    clinicAccounts.map(async (acc) => {
      const [{ data: appts }, { data: clinicSettings }] = await Promise.all([
        supabase.from("appointments").select("provider_id").eq("patient_id", acc.patient_id).not("provider_id", "is", null),
        supabase.from("clinic_settings").select("clinic_name").eq("tenant_id", acc.tenant_id).maybeSingle(),
      ]);
      const providerIds = [...new Set(((appts as any[]) ?? []).map((a) => a.provider_id))];
      if (providerIds.length === 0) return [];

      const { data: providers } = await supabase.from("user_profiles").select("id, full_name, title, specialty").in("id", providerIds);
      const clinicName = (clinicSettings as any)?.clinic_name ?? null;
      return ((providers as any[]) ?? []).map((p) => ({
        providerId: p.id,
        fullName: p.full_name,
        title: p.title,
        specialty: p.specialty,
        tenantId: acc.tenant_id,
        clinicName,
      }));
    })
  );

  return results.flat();
}
