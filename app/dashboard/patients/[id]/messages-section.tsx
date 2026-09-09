"use client";

import { StaffThread } from "../../patient-portal/[patientId]/staff-thread";

// Messages tab on the patient chart. This is intentionally NOT a second
// messaging implementation — it renders the exact same StaffThread the
// standalone /dashboard/patient-portal/[patientId] page uses, fed by the
// exact same provider_patient_messages rows (see
// lib/patients/get-patient-chart-data.ts's providerMessages/
// messagingEnabled fields, scoped by provider_id + patient_id the same
// way that page's loader is). Sending/marking-read goes through the same
// server actions (sendPatientMessageAction / markPatientThreadReadAction
// inside StaffThread), so a message sent from here and one sent from the
// Patient Messages inbox are the same conversation, not two.
//
// The point of this tab: a provider mid-chart-review doesn't have to leave
// the patient to check "did I already tell them about this lab result?" —
// Patient Messages (the clinic-wide inbox) and this tab are just two doors
// into the same room.
export function MessagesSection({
  patientId,
  initialMessages,
  messagingEnabled,
}: {
  patientId: string;
  initialMessages: Parameters<typeof StaffThread>[0]["initialMessages"];
  messagingEnabled: boolean;
}) {
  return (
    <div style={{ marginTop: 8 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
        <h2 style={{ fontSize: 15 }}>Messages</h2>
        <a href={`/dashboard/patient-portal/${patientId}`} style={{ fontSize: 12, color: "var(--text-heading)", fontWeight: 600, textDecoration: "none" }}>
          Open in Patient Messages ↗
        </a>
      </div>
      <p style={{ fontSize: 12, color: "#888", marginBottom: 10 }}>
        Your Patient Portal conversation with this patient — the same thread as Patient Messages, just reachable
        directly from their chart.
      </p>
      <StaffThread patientId={patientId} initialMessages={initialMessages} messagingEnabled={messagingEnabled} />
    </div>
  );
}
