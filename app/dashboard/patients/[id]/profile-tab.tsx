import Link from "next/link";
import { age } from "@/lib/patients/get-patient-chart-data";
import { formatDayLabel, formatTime } from "../../calendar/date-utils";
import { PortalSection } from "./portal-section";

const BILL_TYPE_LABEL: Record<string, string> = { cash: "Cash", hmo: "HMO", philhealth: "PhilHealth", yakap: "YAKAP", other: "Other" };

const NO_SHOW_STATUSES = new Set(["no_show"]);
const CANCELLATION_STATUSES = new Set(["cancelled", "late_cancellation"]);

const FIELD_BLOCK: React.CSSProperties = {};
const LABEL: React.CSSProperties = { color: "#999", fontSize: 11, textTransform: "uppercase", marginBottom: 3, letterSpacing: 0.3 };
const CARD: React.CSSProperties = { background: "var(--card-bg)", border: "1px solid var(--card-border)", borderRadius: 12, padding: 18 };
const CARD_TITLE: React.CSSProperties = { fontSize: 12, fontWeight: 700, color: "#666", textTransform: "uppercase", letterSpacing: 0.4, marginBottom: 12 };

const BILLING_STATUS_STYLE: Record<string, { bg: string; border: string; color: string; label: string }> = {
  paid: { bg: "#eaf7ee", border: "#bfe6c9", color: "#1a7f37", label: "Paid in full" },
  partial: { bg: "#fff6e6", border: "#f0d998", color: "#8a6100", label: "Partial balance" },
  unpaid: { bg: "#fbeaea", border: "#f0c9c9", color: "#a12a2a", label: "Unpaid" },
  no_charges: { bg: "#f2f2f2", border: "#ddd", color: "#666", label: "No charges" },
};

function peso(n: number) {
  return `₱${n.toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

type AlertRow = { id: string; kind?: string; category: string; message: string; created_at: string; user_profiles?: { full_name: string | null } | null };

// Profile tab — demographic and administrative information only (spec §5).
// Clinical content (allergies, meds, notes, orders…) lives in its own tabs;
// this tab answers "who is this person and how do we reach them," plus the
// quick-glance visit/alerts/billing summary the front desk checks before
// every call. Laid out as two columns (demographics + visit summary on the
// left, at-a-glance cards on the right) per the user's reference EHR
// screenshot. The Alerts & Notes and Billing cards here are READ-ONLY
// summaries of data owned elsewhere (the sticky PatientAlertsBanner above
// the chart, and the Billing tab's ledger) — not a second place to manage
// either, to avoid duplicating that logic.
export function ProfileTab({
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
  pastAppts: { id: string; status: string }[];
  upcomingAppts: { id: string; status: string }[];
  portalProps: React.ComponentProps<typeof PortalSection>;
  referredBy: { source: "referral" | "manual"; label: string } | null;
  alerts: AlertRow[];
  billing: { balance: number; status: "no_charges" | "unpaid" | "partial" | "paid" };
}) {
  const allAppts = [...pastAppts, ...upcomingAppts];
  const noShowCount = allAppts.filter((a) => NO_SHOW_STATUSES.has(a.status)).length;
  const cancellationCount = allAppts.filter((a) => CANCELLATION_STATUSES.has(a.status)).length;
  const pastCount = pastAppts.length;
  const futureCount = upcomingAppts.length;

  const employer = [patient.employer_name, patient.employer_position].filter(Boolean).join(" — ");
  const bs = BILLING_STATUS_STYLE[billing.status];

  return (
    <div style={{ display: "flex", gap: 14, flexWrap: "wrap", alignItems: "flex-start" }}>
      {/* Left column — demographics, employer, visit summary, portal. */}
      <div style={{ flex: "1 1 420px", display: "grid", gap: 14, minWidth: 0 }}>
        <div style={CARD}>
          <div style={CARD_TITLE}>Demographics</div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 16 }}>
            <div style={FIELD_BLOCK}>
              <div style={LABEL}>Full name</div>
              <div style={{ fontSize: 14 }}>
                {patient.last_name}, {patient.first_name} {patient.middle_name ?? ""} {patient.suffix ?? ""}
              </div>
            </div>
            <div style={FIELD_BLOCK}>
              <div style={LABEL}>Date of birth / age</div>
              <div style={{ fontSize: 14 }}>
                {new Date(patient.date_of_birth).toLocaleDateString()} · {age(patient.date_of_birth)} years old
              </div>
            </div>
            <div style={FIELD_BLOCK}>
              <div style={LABEL}>Sex</div>
              <div style={{ fontSize: 14, textTransform: "capitalize" }}>{patient.sex}</div>
            </div>
            <div style={FIELD_BLOCK}>
              <div style={LABEL}>Patient ID</div>
              <div style={{ fontSize: 14, fontFamily: "monospace" }}>{patient.patient_code ?? "—"}</div>
            </div>
            <div style={FIELD_BLOCK}>
              <div style={LABEL}>Mobile number</div>
              <div style={{ fontSize: 14 }}>{patient.mobile_phone || "—"}</div>
            </div>
            <div style={FIELD_BLOCK}>
              <div style={LABEL}>Email</div>
              <div style={{ fontSize: 14 }}>{patient.email || "—"}</div>
            </div>
            <div style={FIELD_BLOCK}>
              <div style={LABEL}>Occupation</div>
              <div style={{ fontSize: 14 }}>{patient.occupation || "—"}</div>
            </div>
            <div style={FIELD_BLOCK}>
              <div style={LABEL}>Employment status</div>
              <div style={{ fontSize: 14, textTransform: "capitalize" }}>{(patient.employment_status || "—").replace("_", " ")}</div>
            </div>
            <div style={FIELD_BLOCK}>
              <div style={LABEL}>Civil status / blood type</div>
              <div style={{ fontSize: 14 }}>{[patient.civil_status, patient.blood_type].filter(Boolean).join(" · ") || "—"}</div>
            </div>
            <div style={{ ...FIELD_BLOCK, gridColumn: "1 / -1" }}>
              <div style={LABEL}>Address</div>
              <div style={{ fontSize: 14 }}>
                {[patient.address_line1, patient.address_line2].filter(Boolean).join(", ") || "—"}
                {patient.city || patient.province || patient.postal_code
                  ? ` · ${[patient.city, patient.province, patient.postal_code].filter(Boolean).join(", ")}`
                  : ""}
              </div>
            </div>
          </div>
        </div>

        {(patient.employer_name || patient.employer_position || patient.employer_contact || patient.employer_address) && (
          <div style={CARD}>
            <div style={CARD_TITLE}>Company / Employer</div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 16 }}>
              <div style={FIELD_BLOCK}>
                <div style={LABEL}>Company / position</div>
                <div style={{ fontSize: 14 }}>{employer || "—"}</div>
              </div>
              <div style={FIELD_BLOCK}>
                <div style={LABEL}>Company contact</div>
                <div style={{ fontSize: 14 }}>{patient.employer_contact || "—"}</div>
              </div>
              <div style={{ ...FIELD_BLOCK, gridColumn: "1 / -1" }}>
                <div style={LABEL}>Company address</div>
                <div style={{ fontSize: 14 }}>{patient.employer_address || "—"}</div>
              </div>
            </div>
          </div>
        )}

        {/* Quick summary (spec §9) — answers "when was this patient last
            seen / when do they come back / how reliable are they about
            keeping appointments" without leaving the Profile tab. */}
        <div style={CARD}>
          <div style={CARD_TITLE}>Visit Summary</div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 14 }}>
            <div>
              <div style={LABEL}>Last visit</div>
              <div style={{ fontWeight: 700, color: "var(--text-heading)", fontSize: 14 }}>
                {lastEncounter ? formatDayLabel(lastEncounter.encounter_date) : "—"}
              </div>
            </div>
            <div>
              <div style={LABEL}>Next appointment</div>
              {nextAppt ? (
                <Link href={`/dashboard/calendar?appt=${nextAppt.id}`} style={{ fontWeight: 700, color: "var(--text-heading)", fontSize: 14, textDecoration: "none" }}>
                  {formatDayLabel(nextAppt.start_at.slice(0, 10))} — {formatTime(nextAppt.start_at)}
                </Link>
              ) : (
                <div style={{ fontWeight: 700, color: "var(--text-heading)", fontSize: 14 }}>—</div>
              )}
            </div>
            <div>
              <div style={LABEL}>Past appointments</div>
              <div style={{ fontWeight: 700, color: "var(--text-heading)", fontSize: 14 }}>{pastCount}</div>
            </div>
            <div>
              <div style={LABEL}>Future appointments</div>
              <div style={{ fontWeight: 700, color: "var(--text-heading)", fontSize: 14 }}>{futureCount}</div>
            </div>
            <div>
              <div style={LABEL}>No shows</div>
              <div style={{ fontWeight: 700, color: noShowCount > 0 ? "#a12a2a" : "var(--text-heading)", fontSize: 14 }}>{noShowCount}</div>
            </div>
            <div>
              <div style={LABEL}>Cancellations</div>
              <div style={{ fontWeight: 700, color: cancellationCount > 0 ? "#8a6100" : "var(--text-heading)", fontSize: 14 }}>{cancellationCount}</div>
            </div>
            <div>
              <div style={LABEL}>Total encounters</div>
              <div style={{ fontWeight: 700, color: "var(--text-heading)", fontSize: 14 }}>{totalEncounters}</div>
            </div>
          </div>
        </div>

        <PortalSection {...portalProps} />
      </div>

      {/* Right column — at-a-glance cards: alerts, billing, coverage,
          emergency contact/guardian, referred-by. */}
      <div style={{ flex: "1 1 300px", display: "grid", gap: 14, minWidth: 0 }}>
        <div style={CARD}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
            <div style={{ ...CARD_TITLE, marginBottom: 0 }}>Alerts &amp; Notes {alerts.length > 0 ? `(${alerts.length})` : ""}</div>
          </div>
          {alerts.length === 0 ? (
            <p style={{ color: "#999", fontSize: 12.5, margin: 0 }}>No alerts or notes on file.</p>
          ) : (
            <div style={{ display: "grid", gap: 8 }}>
              {alerts.slice(0, 6).map((a) => (
                <div key={a.id} style={{ borderLeft: `3px solid ${a.kind === "note" ? "#8a99b3" : "#e6c66b"}`, paddingLeft: 10 }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: a.kind === "note" ? "#556" : "#8a6100", textTransform: "uppercase" }}>
                    {a.kind === "note" ? "Note" : a.category}
                  </div>
                  <div style={{ fontSize: 13 }}>{a.message}</div>
                  <div style={{ fontSize: 11, color: "#999", marginTop: 1 }}>
                    {new Date(a.created_at).toLocaleDateString()}
                    {a.user_profiles?.full_name ? ` · ${a.user_profiles.full_name}` : ""}
                  </div>
                </div>
              ))}
            </div>
          )}
          <p style={{ fontSize: 11, color: "#aaa", marginTop: 10 }}>Add or resolve alerts from the banner at the top of this chart.</p>
        </div>

        <div style={CARD}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
            <div style={{ ...CARD_TITLE, marginBottom: 0 }}>Billing</div>
            <span style={{ fontSize: 10.5, fontWeight: 700, color: bs.color, background: bs.bg, border: `1px solid ${bs.border}`, borderRadius: 999, padding: "2px 8px" }}>{bs.label}</span>
          </div>
          <div style={{ fontSize: 22, fontWeight: 700, color: billing.balance > 0 ? "#a12a2a" : "var(--text-heading)" }}>{peso(billing.balance)}</div>
          <div style={{ fontSize: 11.5, color: "#666", marginTop: 2 }}>{billing.balance > 0 ? "Balance due" : "No balance due"}</div>
          <div style={{ marginTop: 10 }}>
            <div style={LABEL}>Bill type</div>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 2 }}>
              {(patient.bill_types ?? []).length === 0 ? (
                <span style={{ fontSize: 13 }}>—</span>
              ) : (
                (patient.bill_types as string[]).map((b) => (
                  <span key={b} style={{ fontSize: 10.5, fontWeight: 700, color: "#555", background: "#f2f2f2", border: "1px solid #ddd", borderRadius: 999, padding: "2px 8px" }}>
                    {BILL_TYPE_LABEL[b] ?? b}
                  </span>
                ))
              )}
            </div>
          </div>
          <Link href={`/dashboard/patients/${patient.id}?tab=coverage`} style={{ display: "inline-block", marginTop: 10, fontSize: 11.5, color: "var(--text-heading)", fontWeight: 600, textDecoration: "none" }}>
            Manage in Billing →
          </Link>
        </div>

        <div style={CARD}>
          <div style={CARD_TITLE}>Emergency Contact &amp; Guardian</div>
          <div style={{ display: "grid", gap: 12 }}>
            <div style={FIELD_BLOCK}>
              <div style={LABEL}>Emergency contact</div>
              <div style={{ fontSize: 14 }}>{patient.emergency_contact_name || "—"}</div>
              <div style={{ fontSize: 12.5, color: "#666" }}>
                {[patient.emergency_contact_relationship, patient.emergency_contact_phone].filter(Boolean).join(" · ")}
              </div>
            </div>
            <div style={FIELD_BLOCK}>
              <div style={LABEL}>Guardian</div>
              <div style={{ fontSize: 14 }}>{patient.guardian_name || "—"}</div>
              <div style={{ fontSize: 12.5, color: "#666" }}>{[patient.guardian_relationship, patient.guardian_phone].filter(Boolean).join(" · ")}</div>
            </div>
          </div>
        </div>

        <div style={CARD}>
          <div style={CARD_TITLE}>Referred By</div>
          <div style={{ fontSize: 14 }}>
            {referredBy ? referredBy.label : "—"}
            {referredBy?.source === "referral" && (
              <span style={{ marginLeft: 6, fontSize: 10.5, fontWeight: 700, color: "#1a4e8a", background: "#eaf1fd", border: "1px solid #bcd4f7", borderRadius: 999, padding: "2px 8px" }}>
                Auto — Referrals
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
