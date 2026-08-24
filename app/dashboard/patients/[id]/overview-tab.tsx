"use client";

import { useState } from "react";
import { ProfileTab } from "./profile-tab";
import { AppointmentHistorySection, type AppointmentRow } from "./appointment-history-section";
import { PortalSection } from "./portal-section";

type SubTabKey = "profile" | "appointments";
const SUBTABS: { key: SubTabKey; label: string }[] = [
  { key: "profile", label: "Profile" },
  { key: "appointments", label: "Appointments" },
];

// Overview tab — the chart's front door. Two subtabs: Profile (who this
// person is — demographics, alerts/notes, emergency contact, guardian,
// employment, referred-by, coverage-at-a-glance, plus the quick "last
// visit / next appt" summary) and Appointments (the full past/upcoming
// list). This subsumes what used to be a separate standalone
// "Appointments" chart tab — same AppointmentHistorySection component,
// same data, just reached from here instead of a second top-level tab.
export function OverviewTab({
  patient,
  totalEncounters,
  lastEncounter,
  nextAppt,
  pastAppts,
  upcomingAppts,
  portalProps,
  referredBy,
  alerts,
  billing,
}: {
  patient: any;
  totalEncounters: number;
  lastEncounter: any;
  nextAppt: any;
  pastAppts: AppointmentRow[];
  upcomingAppts: AppointmentRow[];
  portalProps: React.ComponentProps<typeof PortalSection>;
  referredBy: { source: "referral" | "manual"; label: string } | null;
  alerts: { id: string; kind?: string; category: string; message: string; created_at: string; user_profiles?: { full_name: string | null } | null }[];
  billing: { balance: number; status: "no_charges" | "unpaid" | "partial" | "paid" };
}) {
  const [sub, setSub] = useState<SubTabKey>("profile");

  return (
    <div>
      <div style={{ display: "flex", gap: 4, marginBottom: 16, flexWrap: "wrap" }}>
        {SUBTABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setSub(t.key)}
            style={{
              background: sub === t.key ? "#0c1730" : "transparent",
              color: sub === t.key ? "#e6c66b" : "#555",
              border: `1px solid ${sub === t.key ? "#0c1730" : "var(--input-border)"}`,
              borderRadius: 999,
              padding: "6px 14px",
              fontSize: 12.5,
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            {t.label}
            {t.key === "appointments" && upcomingAppts.length > 0 ? ` (${upcomingAppts.length})` : ""}
          </button>
        ))}
      </div>

      {sub === "profile" && (
        <ProfileTab
          patient={patient}
          totalEncounters={totalEncounters}
          lastEncounter={lastEncounter}
          nextAppt={nextAppt}
          pastAppts={pastAppts}
          upcomingAppts={upcomingAppts}
          portalProps={portalProps}
          referredBy={referredBy}
          alerts={alerts}
          billing={billing}
        />
      )}
      {sub === "appointments" && <AppointmentHistorySection past={pastAppts} upcoming={upcomingAppts} />}
    </div>
  );
}
