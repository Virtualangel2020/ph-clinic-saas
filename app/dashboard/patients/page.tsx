import { requireClinicMember } from "@/lib/require-clinic-member";
import { PatientSearchPanel } from "./patient-search-panel";
import { PatientChartPane } from "./patient-chart-pane";

// Master-detail Patients hub: left pane is search (name, mobile, Patient
// ID, or date of birth) + Add Patient + Recent Patients; right pane is the
// selected patient's full tabbed chart, selected via ?patient=<id> so the
// URL stays shareable/bookmarkable and the back button works correctly.
// Both this page and the standalone /dashboard/patients/[id] route render
// the identical chart via the same data loader (see
// lib/patients/get-patient-chart-data.ts) — there is exactly one chart
// implementation, reachable two ways.
export default async function PatientsPage({ searchParams }: { searchParams: { patient?: string } }) {
  await requireClinicMember();

  const selectedId = searchParams.patient;

  return (
    <div>
      <h1 style={{ fontSize: 24, marginBottom: 4 }}>Patients</h1>
      <p style={{ color: "#666", marginBottom: 20, fontSize: 13 }}>
        Search by name, mobile number, Patient ID, or date of birth. Select a patient to open their full chart.
      </p>

      <div className="patients-grid" style={{ display: "grid", gridTemplateColumns: "minmax(300px, 340px) 1fr", gap: 20, alignItems: "start" }}>
        <div style={{ background: "var(--card-bg)", border: "1px solid var(--card-border)", borderRadius: 12, padding: 16 }}>
          <PatientSearchPanel />
        </div>

        <div>
          {selectedId ? (
            <PatientChartPane patientId={selectedId} />
          ) : (
            <div
              style={{
                background: "var(--card-bg)",
                border: "1px solid var(--card-border)",
                borderRadius: 12,
                padding: 48,
                textAlign: "center",
                color: "#888",
                fontSize: 13.5,
                minHeight: 240,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              Select a patient to view their chart
            </div>
          )}
        </div>
      </div>

      <style>{`
        @media (max-width: 900px) {
          .patients-grid { grid-template-columns: 1fr !important; }
        }
      `}</style>
    </div>
  );
}
