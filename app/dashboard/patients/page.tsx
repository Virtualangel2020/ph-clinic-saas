import Link from "next/link";
import { requireClinicMember } from "@/lib/require-clinic-member";
import { PatientList } from "./patient-list";

// Part 2 (Phase 2): patient chart foundation — demographics, contact,
// emergency contact, guardian, allergies, current medications, documents,
// and a lightweight progress note per patient. Visit history/timeline
// proper depends on Encounters (not built yet — see /dashboard/encounters).
export default async function PatientsPage() {
  const { supabase, profile } = await requireClinicMember();

  const { data: patients } = await supabase
    .from("patients")
    .select("id, first_name, middle_name, last_name, date_of_birth, sex, mobile_phone, is_active")
    .eq("tenant_id", profile.tenant_id)
    .order("last_name")
    .order("first_name");

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12, marginBottom: 4 }}>
        <h1 style={{ fontSize: 24 }}>Patients</h1>
        <Link
          href="/dashboard/patients/new"
          style={{ background: "#0c1730", color: "white", borderRadius: 8, padding: "9px 16px", fontSize: 13.5, fontWeight: 600, textDecoration: "none" }}
        >
          + Add Patient
        </Link>
      </div>
      <p style={{ color: "#666", marginBottom: 20, fontSize: 13 }}>
        Demographics, contact, emergency contact, guardian, allergies, and current medications. Full visit
        history/timeline ships with Encounters in a later phase.
      </p>

      <PatientList patients={(patients as any) ?? []} />
    </div>
  );
}
