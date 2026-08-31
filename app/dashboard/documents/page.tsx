import Link from "next/link";
import { notFound } from "next/navigation";
import { requireClinicMember } from "@/lib/require-clinic-member";
import { DocumentsSection } from "../patients/[id]/documents-section";
import { DocumentsPatientSearch } from "./documents-patient-search";
import { age } from "@/lib/patients/get-patient-chart-data";

// Patient Documents (spec §10-12): search-and-select a patient FIRST, then
// see only that patient's folder tree — never every patient's files by
// default, which both reduces clutter and lowers the chance of a staff
// member accidentally opening someone else's records. The folder tree
// itself (DocumentsSection) is the exact same component and the exact
// same patient_documents rows the patient's own chart Documents tab
// renders — nothing is duplicated, this page just reaches it via a
// dedicated document-first search instead of the chart's Profile tab.
export default async function DocumentsPage({ searchParams }: { searchParams: Promise<{ patient?: string }> }) {
  const { supabase, profile } = await requireClinicMember();
  const { patient: patientId } = await searchParams;

  if (!patientId) {
    return (
      <div>
        <h1 style={{ fontSize: 24, marginBottom: 4 }}>Patient Documents</h1>
        <p style={{ color: "#666", marginBottom: 20, fontSize: 13 }}>
          Select a patient to view their document folders. Lab results and prescriptions live in their own Results
          and Prescriptions tabs, not here.
        </p>
        <DocumentsPatientSearch />
      </div>
    );
  }

  const [{ data: patient }, { data: documents }, { data: providers }, { data: documentFolders }, { data: documentSharesRaw }] = await Promise.all([
    supabase.from("patients").select("id, first_name, last_name, middle_name, date_of_birth, sex, patient_code, is_active, records_sharing_mode").eq("id", patientId).eq("tenant_id", profile.tenant_id).maybeSingle(),
    supabase
      .from("patient_documents")
      // See lib/patients/get-patient-chart-data.ts — patient_documents has
      // 3 separate FKs to user_profiles, so this embed must name the
      // constraint or PostgREST rejects the whole query (silently, since
      // only `data` is read below).
      .select("id, title, doc_type, description, created_at, storage_path, mime_type, file_size_bytes, status, status_reason, document_date, source, user_profiles!patient_documents_created_by_fkey(full_name)")
      .eq("patient_id", patientId)
      .eq("tenant_id", profile.tenant_id)
      .order("created_at", { ascending: false }),
    supabase.from("user_profiles").select("id, full_name, title").eq("tenant_id", profile.tenant_id).eq("role", "doctor").eq("is_active", true).order("full_name"),
    supabase.from("document_folders").select("key, label").eq("tenant_id", profile.tenant_id).order("label"),
    supabase
      .from("patient_document_shares")
      .select(
        "document_id, consent_confirmed, created_at, shared_with:user_profiles!patient_document_shares_shared_with_provider_id_fkey(full_name, title), shared_by_user:user_profiles!patient_document_shares_shared_by_fkey(full_name)"
      )
      .eq("patient_id", patientId)
      .order("created_at", { ascending: false }),
  ]);

  if (!patient) notFound();

  const documentShares = ((documentSharesRaw as any[]) ?? []).map((s) => ({
    document_id: s.document_id,
    consent_confirmed: s.consent_confirmed,
    created_at: s.created_at,
    provider_name: s.shared_with ? `${s.shared_with.title ? s.shared_with.title + " " : ""}${s.shared_with.full_name}` : "—",
    shared_by_name: s.shared_by_user?.full_name ?? null,
  }));

  return (
    <div>
      <Link href="/dashboard/documents" style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 13, color: "#666", textDecoration: "none", marginBottom: 14 }}>
        ← Search a different patient
      </Link>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 12, marginBottom: 4 }}>
        <div>
          <h1 style={{ fontSize: 22, marginBottom: 2 }}>
            {patient.last_name}, {patient.first_name} {patient.middle_name ?? ""}
          </h1>
          <p style={{ color: "#666", fontSize: 13 }}>
            {patient.sex} · {age(patient.date_of_birth)}y · {patient.patient_code ?? "—"}
          </p>
        </div>
        <Link href={`/dashboard/patients/${patient.id}`} style={{ fontSize: 12.5, color: "var(--text-heading)", textDecoration: "none", fontWeight: 600 }}>
          Open full chart ↗
        </Link>
      </div>

      <div style={{ marginTop: 16 }}>
        <DocumentsSection
          patientId={patient.id}
          documents={(documents as any) ?? []}
          providers={(providers as any) ?? []}
          customFolders={(documentFolders as any) ?? []}
          documentShares={documentShares}
          recordsSharingMode={(patient as any).records_sharing_mode ?? "needs_consent"}
        />
      </div>
    </div>
  );
}
