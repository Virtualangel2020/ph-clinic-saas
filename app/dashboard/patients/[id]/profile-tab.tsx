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

// Profile tab — demographic and administrative information only (spec §5).
// Clinical content (allergies, meds, notes, orders…) lives in its own tabs;
// this tab answers "who is this person and how do we reach them," plus the
// quick-glance visit summary the front desk checks before every call.
export function ProfileTab({
  patient,
  totalEncounters,
  lastEncounter,
  nextAppt,
  pastAppts,
  upcomingAppts,
  portalProps,
  referredBy,
}: {
  patient: any;
  totalEncounters: number;
  lastEncounter: any;
  nextAppt: any;
  pastAppts: { id: string; status: string }[];
  upcomingAppts: { id: string; status: string }[];
  portalProps: React.ComponentProps<typeof PortalSection>;
  referredBy: { source: "referral" | "manual"; label: string } | null;
}) {
  const allAppts = [...pastAppts, ...upcomingAppts];
  const noShowCount = allAppts.filter((a) => NO_SHOW_STATUSES.has(a.status)).length;
  const cancellationCount = allAppts.filter((a) => CANCELLATION_STATUSES.has(a.status)).length;
  const pastCount = pastAppts.length;
  const futureCount = upcomingAppts.length;

  const employer = [patient.employer_name, patient.employer_position].filter(Boolean).join(" — ");

  return (
    <div style={{ display: "grid", gap: 14 }}>
      <div style={{ ...CARD, display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 16 }}>
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

      <div style={{ ...CARD, display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 16 }}>
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
        <div style={FIELD_BLOCK}>
          <div style={LABEL}>Referred by</div>
          <div style={{ fontSize: 14 }}>
            {referredBy ? referredBy.label : "—"}
            {referredBy?.source === "referral" && (
              <span style={{ marginLeft: 6, fontSize: 10.5, fontWeight: 700, color: "#1a4e8a", background: "#eaf1fd", border: "1px solid #bcd4f7", borderRadius: 999, padding: "2px 8px" }}>
                Auto — Referrals
              </span>
            )}
          </div>
        </div>
        <div style={FIELD_BLOCK}>
          <div style={LABEL}>Bill type</div>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 2 }}>
            {(patient.bill_types ?? []).length === 0 ? (
              <span style={{ fontSize: 14 }}>—</span>
            ) : (
              (patient.bill_types as string[]).map((b) => (
                <span key={b} style={{ fontSize: 10.5, fontWeight: 700, color: "#555", background: "#f2f2f2", border: "1px solid #ddd", borderRadius: 999, padding: "2px 8px" }}>
                  {BILL_TYPE_LABEL[b] ?? b}
                </span>
              ))
            )}
          </div>
          <Link href={`/dashboard/patients/${patient.id}?tab=coverage`} style={{ fontSize: 11, color: "var(--text-heading)", textDecoration: "none" }}>
            Manage in Billing →
          </Link>
        </div>
      </div>

      {(patient.employer_name || patient.employer_position || patient.employer_contact || patient.employer_address) && (
        <div style={{ ...CARD, display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 16 }}>
          <div style={{ gridColumn: "1 / -1", fontSize: 12, fontWeight: 700, color: "#666" }}>Company / Employer</div>
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
      )}

      {/* Quick summary (spec §9) — answers "when was this patient last
          seen / when do they come back / how reliable are they about
          keeping appointments" without leaving the Profile tab. */}
      <div style={{ ...CARD, display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 14 }}>
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

      <PortalSection {...portalProps} />
    </div>
  );
}
