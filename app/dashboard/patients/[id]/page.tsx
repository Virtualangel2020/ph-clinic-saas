import { notFound } from "next/navigation";
import Link from "next/link";
import { requireClinicMember } from "@/lib/require-clinic-member";
import { BackLink } from "@/components/back-link";
import { ArchiveButton } from "./archive-button";
import { AllergiesSection } from "./allergies-section";
import { MedicationsSection } from "./medications-section";
import { DocumentsSection } from "./documents-section";
import { ProgressNotesSection } from "./progress-notes-section";
import { PortalSection } from "./portal-section";

function age(dob: string) {
  const b = new Date(dob);
  const now = new Date();
  let a = now.getFullYear() - b.getFullYear();
  const m = now.getMonth() - b.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < b.getDate())) a--;
  return a;
}

export default async function PatientDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { supabase, profile } = await requireClinicMember();

  const { data: patient } = await supabase
    .from("patients")
    .select("*")
    .eq("id", id)
    .eq("tenant_id", profile.tenant_id)
    .maybeSingle();

  if (!patient) notFound();

  const [{ data: allergies }, { data: medications }, { data: documents }, { data: notes }, { data: encounters }] = await Promise.all([
    supabase.from("patient_allergies").select("id, allergen, reaction, severity, noted_at").eq("patient_id", id).order("noted_at", { ascending: false }),
    supabase.from("patient_medications").select("id, medication_name, dosage, frequency, started_at, is_active, notes").eq("patient_id", id).order("created_at", { ascending: false }),
    supabase
      .from("patient_documents")
      .select("id, title, doc_type, description, created_at, storage_path, mime_type, file_size_bytes, status, status_reason")
      .eq("patient_id", id)
      .order("created_at", { ascending: false }),
    supabase
      .from("patient_progress_notes")
      .select("id, note_date, chief_complaint, subjective, objective, assessment, plan, bp_systolic, bp_diastolic, pulse_rate, respiratory_rate, oxygen_saturation, temperature_c, weight_kg, height_cm, created_at, user_profiles(full_name)")
      .eq("patient_id", id)
      .order("note_date", { ascending: false }),
    supabase
      .from("encounters")
      .select("id, encounter_date, encounter_type, chief_complaint, status, user_profiles(full_name)")
      .eq("patient_id", id)
      .order("encounter_date", { ascending: false })
      .order("created_at", { ascending: false }),
  ]);

  const [{ data: portalChannels }, { data: portalAccount }] = await Promise.all([
    supabase.rpc("tenant_patient_portal_channels", { p_tenant_id: profile.tenant_id }),
    supabase
      .from("patient_portal_accounts")
      .select("id, channel, contact_value, status, invited_at, activated_at, revoked_at")
      .eq("patient_id", id)
      .maybeSingle(),
  ]);

  const fullName = `${patient.last_name}, ${patient.first_name}${patient.middle_name ? " " + patient.middle_name : ""}${patient.suffix ? " " + patient.suffix : ""}`;

  return (
    <div style={{ maxWidth: 820 }}>
      <BackLink href="/dashboard/patients" label="Patients" />
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 12, marginBottom: 4 }}>
        <div>
          <h1 style={{ fontSize: 22, marginBottom: 2 }}>
            {fullName}
            {!patient.is_active && <span style={{ marginLeft: 10, fontSize: 12, color: "#a12a2a", fontWeight: 600 }}>ARCHIVED</span>}
          </h1>
          <p style={{ color: "#666", fontSize: 13 }}>
            {age(patient.date_of_birth)} y/o {patient.sex} · Born {new Date(patient.date_of_birth).toLocaleDateString()}
            {patient.blood_type ? ` · Blood type ${patient.blood_type}` : ""}
          </p>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <Link
            href={`/dashboard/patients/${patient.id}/edit`}
            style={{ border: "1px solid #ccc", borderRadius: 8, padding: "8px 14px", fontSize: 13, textDecoration: "none", color: "#333" }}
          >
            Edit
          </Link>
          <ArchiveButton patientId={patient.id} isActive={patient.is_active} />
        </div>
      </div>

      <div style={{ background: "white", border: "1px solid #e2e2e5", borderRadius: 12, padding: 18, marginTop: 16, display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 14, fontSize: 13 }}>
        <div>
          <div style={{ color: "#999", fontSize: 11, textTransform: "uppercase", marginBottom: 3 }}>Contact</div>
          <div>{patient.mobile_phone || "—"}</div>
          <div>{patient.email || "—"}</div>
        </div>
        <div>
          <div style={{ color: "#999", fontSize: 11, textTransform: "uppercase", marginBottom: 3 }}>Address</div>
          <div>{[patient.address_line1, patient.address_line2].filter(Boolean).join(", ") || "—"}</div>
          <div>{[patient.city, patient.province, patient.postal_code].filter(Boolean).join(", ")}</div>
        </div>
        <div>
          <div style={{ color: "#999", fontSize: 11, textTransform: "uppercase", marginBottom: 3 }}>Emergency contact</div>
          <div>{patient.emergency_contact_name || "—"} {patient.emergency_contact_relationship ? `(${patient.emergency_contact_relationship})` : ""}</div>
          <div>{patient.emergency_contact_phone || ""}</div>
        </div>
        <div>
          <div style={{ color: "#999", fontSize: 11, textTransform: "uppercase", marginBottom: 3 }}>Guardian</div>
          <div>{patient.guardian_name || "—"} {patient.guardian_relationship ? `(${patient.guardian_relationship})` : ""}</div>
          <div>{patient.guardian_phone || ""}</div>
        </div>
      </div>

      {patient.notes && (
        <div style={{ marginTop: 14, background: "#fff7e6", border: "1px solid #e6c66b", borderRadius: 10, padding: "10px 14px", fontSize: 12.5, color: "#7a5c12" }}>
          {patient.notes}
        </div>
      )}

      <AllergiesSection patientId={patient.id} allergies={(allergies as any) ?? []} />
      <MedicationsSection patientId={patient.id} medications={(medications as any) ?? []} />
      <ProgressNotesSection patientId={patient.id} notes={(notes as any) ?? []} />
      <DocumentsSection patientId={patient.id} documents={(documents as any) ?? []} />
      <PortalSection
        patientId={patient.id}
        patientEmail={patient.email}
        patientMobile={patient.mobile_phone}
        channels={(portalChannels as any) ?? { email: false, sms: false }}
        account={(portalAccount as any) ?? null}
      />

      <div style={{ marginTop: 28 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
          <h2 style={{ fontSize: 15 }}>Encounters</h2>
          <Link href={`/dashboard/encounters?patient=${patient.id}`} style={{ fontSize: 12.5, color: "#0c1730", fontWeight: 600, textDecoration: "none" }}>
            + New encounter
          </Link>
        </div>
        {!encounters || encounters.length === 0 ? (
          <p style={{ color: "#999", fontSize: 12.5 }}>No visits recorded yet.</p>
        ) : (
          <div style={{ display: "grid", gap: 8 }}>
            {(encounters as any[]).map((e) => (
              <Link
                key={e.id}
                href={`/dashboard/encounters/${e.id}`}
                style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, background: "white", border: "1px solid #e2e2e5", borderRadius: 10, padding: "11px 14px", textDecoration: "none", fontSize: 13 }}
              >
                <div>
                  <span style={{ fontWeight: 700, color: "#0c1730" }}>{new Date(e.encounter_date).toLocaleDateString()}</span>
                  {e.encounter_type && <span style={{ marginLeft: 8, fontSize: 11, color: "#888", border: "1px solid #ddd", borderRadius: 999, padding: "1px 7px" }}>{e.encounter_type}</span>}
                  {e.chief_complaint && <span style={{ color: "#666", marginLeft: 8 }}>— {e.chief_complaint}</span>}
                  {e.user_profiles && <span style={{ color: "#999", marginLeft: 8, fontSize: 12 }}>· {e.user_profiles.full_name}</span>}
                </div>
                <div style={{ fontSize: 11, fontWeight: 700, color: e.status === "closed" ? "#1a7f37" : "#8a6100" }}>{e.status === "closed" ? "Closed" : "Open"}</div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
