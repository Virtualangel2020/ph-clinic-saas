import { requirePatientPortal } from "@/lib/require-patient-portal";
import { PortalShell } from "@/components/portal-shell";
import { PortalDocumentsList } from "./records-list";

// My Records (spec §15) — read-only view of this patient's own
// patient_documents, the exact same rows the chart's Documents tab and the
// global Documents tab show, via patient_documents_portal_self_read RLS.
// A patient can view/download; they can never delete or change status
// here — that stays a staff-only action (spec §10-12).
export default async function PortalRecordsPage() {
  const { supabase, account } = await requirePatientPortal();
  const patientId = (account as any).patient_id;

  const { data: documents } = await supabase
    .from("patient_documents")
    .select("id, title, doc_type, description, created_at, storage_path, mime_type, document_date, status")
    .eq("patient_id", patientId)
    .eq("status", "active")
    .order("created_at", { ascending: false });

  return (
    <PortalShell>
      <h1 style={{ fontSize: 20, marginBottom: 4 }}>My Records</h1>
      <p style={{ color: "#666", fontSize: 13, marginBottom: 16 }}>Documents your clinic has filed to your record.</p>
      <PortalDocumentsList documents={(documents as any) ?? []} />
    </PortalShell>
  );
}
