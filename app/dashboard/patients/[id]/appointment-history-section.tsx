import Link from "next/link";
import { formatDayLabel, formatTime } from "../../calendar/date-utils";
import { STATUS_GLYPH, STATUS_LABEL, statusColor } from "../../calendar/status-constants";

export type AppointmentRow = {
  id: string;
  start_at: string;
  status: string;
  notes: string | null;
  provider_name: string | null;
  appointment_type_name: string | null;
  encounter_id: string | null; // set when this appointment already has an associated encounter
};

function ApptRow({ a }: { a: AppointmentRow }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12, background: "var(--card-bg)", border: "1px solid var(--card-border)", borderRadius: 10, padding: "10px 14px", fontSize: 13 }}>
      <div>
        <div>
          <span style={{ fontWeight: 700, color: "var(--text-heading)" }}>{formatDayLabel(a.start_at.slice(0, 10))}</span>
          <span style={{ color: "#666", marginLeft: 6 }}>{formatTime(a.start_at)}</span>
        </div>
        <div style={{ color: "#666", fontSize: 12, marginTop: 2 }}>
          {a.appointment_type_name ?? "Visit"}
          {a.provider_name ? ` · ${a.provider_name}` : ""}
          {a.notes ? ` · ${a.notes}` : ""}
        </div>
      </div>
      <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 4 }}>
        <span style={{ fontSize: 11, fontWeight: 700, color: statusColor(undefined, a.status) }}>
          {STATUS_GLYPH[a.status] ?? ""} {STATUS_LABEL[a.status] ?? a.status}
        </span>
        {a.encounter_id ? (
          <Link href={`/dashboard/encounters/${a.encounter_id}`} style={{ fontSize: 11, color: "#1a7f37", fontWeight: 700, textDecoration: "none" }}>
            Encounter Available ✓
          </Link>
        ) : (
          a.status === "completed" && <span style={{ fontSize: 10.5, color: "#bbb" }}>No encounter documented</span>
        )}
      </div>
    </div>
  );
}

// Patient chart > appointment history — this clinic's own appointments
// only (tenant-scoped by the page's own query), split the way the spec
// asks: what already happened vs. what's still coming up, so "when was
// this patient last seen" / "when do they come back" never require
// leaving the chart for the Calendar. A cancelled/no-show appointment
// still shows here with its real status — it is NOT hidden and no fake
// encounter is invented for it.
export function AppointmentHistorySection({ past, upcoming }: { past: AppointmentRow[]; upcoming: AppointmentRow[] }) {
  return (
    <div style={{ marginTop: 28, display: "grid", gap: 24 }}>
      <div>
        <h2 style={{ fontSize: 15, marginBottom: 8 }}>Upcoming appointments</h2>
        {upcoming.length === 0 ? (
          <p style={{ color: "#999", fontSize: 12.5 }}>No upcoming appointments scheduled with this clinic.</p>
        ) : (
          <div style={{ display: "grid", gap: 8 }}>
            {upcoming.map((a) => (
              <ApptRow key={a.id} a={a} />
            ))}
          </div>
        )}
      </div>

      <div>
        <h2 style={{ fontSize: 15, marginBottom: 8 }}>Past appointments</h2>
        {past.length === 0 ? (
          <p style={{ color: "#999", fontSize: 12.5 }}>No past appointments with this clinic yet.</p>
        ) : (
          <div style={{ display: "grid", gap: 8 }}>
            {past.map((a) => (
              <ApptRow key={a.id} a={a} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
