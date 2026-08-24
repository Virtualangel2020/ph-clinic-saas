"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";
import type { PatientChartData } from "@/lib/patients/get-patient-chart-data";
import { OverviewTab } from "./overview-tab";
import { ClinicalTab } from "./clinical-tab";
import { PatientHistoryTab } from "./patient-history-tab";
import { BillingSection } from "./billing-section";
import { EncounterHistorySection } from "./encounter-history-section";
import { ProgressNotesSection } from "./progress-notes-section";
import { PrescriptionsSection } from "./prescriptions-section";
import { LabSection } from "./lab-section";
import { DocumentsSection } from "./documents-section";
import { FormsSection } from "./forms-section";
import { ReferralsSection } from "./referrals-section";
import { AppointmentHistorySection } from "./appointment-history-section";

// "appointments" and "coverage" keys are kept exactly as before for
// deep-link compatibility (../orders/page.tsx, ../results/page.tsx, and
// ../prescriptions/page.tsx all link in with ?tab=orders_results /
// ?tab=prescriptions; nothing currently deep-links ?tab=appointments, but
// the key stays wired below regardless — cheap insurance). Overview now
// folds the old standalone Appointments tab in as a subtab (see
// overview-tab.tsx), so "appointments" is no longer in the visible TABS
// list, just still handled if ever reached directly.
type TabKey =
  | "profile"
  | "clinical"
  | "coverage"
  | "encounters"
  | "progress_notes"
  | "orders_results"
  | "prescriptions"
  | "referrals"
  | "documents"
  | "forms"
  | "appointments"
  | "history";

const TABS: { key: TabKey; label: string }[] = [
  { key: "profile", label: "Overview" },
  { key: "clinical", label: "Clinical" },
  { key: "coverage", label: "Billing" },
  { key: "encounters", label: "Encounters" },
  { key: "progress_notes", label: "Progress Notes" },
  { key: "orders_results", label: "Orders & Results" },
  { key: "prescriptions", label: "Prescriptions" },
  { key: "referrals", label: "Referrals" },
  { key: "documents", label: "Documents" },
  { key: "forms", label: "Forms" },
  { key: "history", label: "Patient History" },
];

// The unified patient chart (spec §4): one page, one patient, every
// clinical/administrative category behind a tab instead of one long
// scroll. Every tab below reuses an EXISTING section component verbatim —
// no data is re-fetched or duplicated here, this component only decides
// which already-fetched slice of `data` each tab shows.
export function PatientChartTabs({
  data,
  canViewClinical,
}: {
  data: PatientChartData;
  canViewClinical: boolean;
}) {
  // Deep-linkable tabs: /dashboard/patients/[id]?tab=orders_results (or
  // the master-detail pane's /dashboard/patients?patient=...&tab=...) lets
  // the global Orders/Results/Documents/Referrals/Forms tabs and any other
  // "open this patient's chart to the right tab" link land directly where
  // it should, instead of always resetting to Profile.
  const searchParams = useSearchParams();
  const requestedTab = searchParams.get("tab") as TabKey | null;
  const initialTab = requestedTab && TABS.some((t) => t.key === requestedTab) ? requestedTab : "profile";
  const [tab, setTab] = useState<TabKey>(initialTab);
  const { patient } = data;

  return (
    <div>
      <div
        style={{
          display: "flex",
          gap: 4,
          overflowX: "auto",
          borderBottom: "1px solid var(--card-border)",
          marginBottom: 18,
          paddingBottom: 0,
        }}
      >
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            style={{
              flexShrink: 0,
              background: "none",
              border: "none",
              borderBottom: tab === t.key ? "2px solid #0c1730" : "2px solid transparent",
              color: tab === t.key ? "var(--text-heading)" : "#888",
              fontWeight: tab === t.key ? 700 : 500,
              fontSize: 13,
              padding: "9px 12px",
              cursor: "pointer",
              whiteSpace: "nowrap",
            }}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === "profile" && (
        <OverviewTab
          patient={patient}
          totalEncounters={data.totalEncounters}
          lastEncounter={data.lastEncounter}
          nextAppt={data.nextAppt}
          pastAppts={data.pastAppts}
          upcomingAppts={data.upcomingAppts}
          portalProps={{
            patientId: patient.id,
            patientEmail: patient.email,
            patientMobile: patient.mobile_phone,
            channels: data.portalChannels,
            account: data.portalAccount,
          }}
          referredBy={data.referredBy}
          alerts={data.alerts}
          billing={data.billing}
        />
      )}

      {tab === "clinical" && (
        <ClinicalTab
          patientId={patient.id}
          problems={data.activeProblems}
          prescriptions={data.prescriptions}
          labOrders={data.labOrders}
          encounters={data.encounters.map((e: any) => ({
            id: e.id,
            encounter_date: e.encounter_date,
            encounter_type: e.encounter_type,
            chief_complaint: e.chief_complaint,
            status: e.status,
            signed_at: e.signed_at ?? null,
            provider_name: e.user_profiles?.full_name ?? null,
          }))}
        />
      )}

      {tab === "coverage" && (
        <BillingSection
          patientId={patient.id}
          billTypes={patient.bill_types ?? []}
          billing={data.billing}
          providers={data.providers}
          paymentType={patient.payment_type ?? "cash"}
          philhealthNumber={patient.philhealth_number}
          philhealthMemberType={patient.philhealth_member_type}
          philhealthStatus={patient.philhealth_status}
          philhealthPrincipalOrDependent={patient.philhealth_principal_or_dependent}
          philhealthRelationshipToPrincipal={patient.philhealth_relationship_to_principal}
          insurancePlans={data.insurancePlans}
        />
      )}

      {tab === "encounters" && (
        <EncounterHistorySection
          patientId={patient.id}
          initialRows={data.encounters.map((e: any) => ({
            id: e.id,
            encounter_date: e.encounter_date,
            encounter_type: e.encounter_type,
            chief_complaint: e.chief_complaint,
            status: e.status,
            signed_at: e.signed_at ?? null,
            provider_name: e.user_profiles?.full_name ?? null,
          }))}
          initialHasMore={data.initialEncounterHasMore}
          providers={data.providers}
          appointmentTypes={data.appointmentTypes}
        />
      )}

      {tab === "progress_notes" && (
        <ProgressNotesSection patientId={patient.id} notes={data.notes as any} canViewClinical={canViewClinical} noteTemplate={data.noteTemplate as any} />
      )}

      {tab === "orders_results" && (
        <div>
          <p style={{ fontSize: 12, color: "#999", margin: "0 0 8px" }}>
            Orders and their results are shown together for now — a dedicated Results view with its own status
            workflow (New / Reviewed / Released / Follow-up) is coming as Orders expands beyond lab tests.
          </p>
          <LabSection patientId={patient.id} labOrders={data.labOrders} />
        </div>
      )}

      {tab === "prescriptions" && <PrescriptionsSection patientId={patient.id} prescriptions={data.prescriptions} />}

      {tab === "referrals" && <ReferralsSection patientId={patient.id} referrals={data.referrals} />}

      {tab === "documents" && (
        <DocumentsSection patientId={patient.id} documents={data.documents as any} providers={data.providers} customFolders={data.documentFolders} />
      )}

      {tab === "forms" && (
        <FormsSection patientId={patient.id} forms={data.patientForms as any} activeTemplates={data.activeFormTemplates as any} entitled={data.formsEntitled} />
      )}

      {tab === "appointments" && <AppointmentHistorySection past={data.pastAppts} upcoming={data.upcomingAppts} />}

      {tab === "history" && (
        <PatientHistoryTab
          patientId={patient.id}
          allergies={data.allergies as any}
          medications={data.medications as any}
          primaryProvider={data.primaryProvider}
          sharingPreference={data.sharingPreference}
        />
      )}
    </div>
  );
}
