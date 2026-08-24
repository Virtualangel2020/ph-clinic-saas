import Link from "next/link";
import { requireClinicMember } from "@/lib/require-clinic-member";

const TYPE_LABEL: Record<string, string> = {
  labs: "Labs",
  imaging: "Imaging",
  progress_notes: "Progress Notes",
  referrals: "Referrals",
  forms: "Forms",
  hospital_er: "Hospital / ER",
  procedures: "Procedures",
  medications: "Medications / Prescriptions",
  insurance: "Insurance",
  patient_documents: "Patient Documents",
  other: "Other",
};

// Clinic-wide view across every patient's document folder (see
// /dashboard/patients/[id] where documents actually live and get filed).
// Files are stored in the private "patient-documents" Storage bucket,
// tenant-isolated by folder path — this list only shows metadata; opening
// a file goes through a signed URL requested from the patient's own page.
//
// IMPORTANT: this tab is for standalone FILES only (referrals, forms,
// scanned hospital records, insurance cards, external records received via
// Records Exchange) — never a place clinical results pile up unsorted.
// Prescriptions, lab orders, and lab results are structured data with
// their own dedicated modules (Prescriptions / Orders / Results, plus each
// patient's own chart) — they are never filed here, precisely so this tab
// never turns into a mess of loose result printouts.
export default async function DocumentsPage() {
  const { supabase, profile } = await requireClinicMember();

  const { data: documents } = await supabase
    .from("patient_documents")
    .select("id, title, doc_type, description, created_at, status, storage_path, patients(id, first_name, last_name)")
    .eq("tenant_id", profile.tenant_id)
    .eq("status", "active")
    .order("created_at", { ascending: false });

  return (
    <div>
      <h1 style={{ fontSize: 24, marginBottom: 4 }}>Documents</h1>
      <p style={{ color: "#666", marginBottom: 20, fontSize: 13 }}>
        Standalone files only — referrals, forms, scanned records, insurance cards — each already organized inside a
        patient's own chart. Lab results and prescriptions live in their own Results and Prescriptions tabs, not here.
        Add a file from a patient's own chart.
      </p>

      {!documents || documents.length === 0 ? (
        <div style={{ background: "var(--card-bg)", border: "1px solid var(--card-border)", borderRadius: 12, padding: 24, color: "#888", fontSize: 13 }}>
          No documents yet — open a patient's chart to add one.
        </div>
      ) : (
        <div style={{ display: "grid", gap: 8 }}>
          {(documents as any[]).map((d) => (
            <Link
              key={d.id}
              href={`/dashboard/patients/${d.patients?.id}`}
              style={{ display: "flex", justifyContent: "space-between", alignItems: "center", background: "var(--card-bg)", border: "1px solid var(--card-border)", borderRadius: 10, padding: "12px 16px", textDecoration: "none", gap: 12 }}
            >
              <div>
                <div style={{ fontWeight: 700, fontSize: 13.5, color: "var(--text-heading)" }}>
                  {d.title}
                  <span style={{ marginLeft: 8, fontSize: 11, color: "#888", border: "1px solid var(--input-border)", borderRadius: 999, padding: "1px 7px", fontWeight: 400 }}>
                    {TYPE_LABEL[d.doc_type] ?? d.doc_type}
                  </span>
                  {!d.storage_path && (
                    <span style={{ marginLeft: 6, fontSize: 10.5, color: "#c99a2e", fontWeight: 400 }}>metadata only</span>
                  )}
                </div>
                <div style={{ fontSize: 12, color: "#888" }}>
                  {d.patients ? `${d.patients.last_name}, ${d.patients.first_name}` : "Unknown patient"} · {new Date(d.created_at).toLocaleDateString()}
                </div>
              </div>
              <div style={{ color: "#bbb", fontSize: 18 }}>›</div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
