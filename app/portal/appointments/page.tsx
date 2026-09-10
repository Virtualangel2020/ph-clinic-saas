import { requirePatientPortal } from "@/lib/require-patient-portal";
import { PortalShell } from "@/components/portal-shell";

function fmtDate(iso: string) {
  return new Date(iso).toLocaleString("en-PH", { dateStyle: "medium", timeStyle: "short" });
}
function fmtDateOnly(iso: string) {
  return new Date(iso).toLocaleDateString("en-PH", { dateStyle: "medium" });
}
function fmtTimeOnly(iso: string) {
  return new Date(iso).toLocaleTimeString("en-PH", { timeStyle: "short" });
}

const STATUS_LABEL: Record<string, string> = {
  booked: "Confirmed",
  confirmed: "Confirmed",
  checked_in: "Checked in",
  completed: "Completed",
  cancelled: "Cancelled",
  no_show: "No show",
};

const SELECT_COLS =
  "id, start_at, end_at, status, notes, provider_id, booking_mode, expected_arrival_at, telehealth_link_override, user_profiles(full_name, title), appointment_types(name, delivery_mode)";

// My Appointments (spec §15) — the same `appointments` rows the clinic's
// own Calendar and the chart's Appointments tab use, filtered to this one
// patient via appointments_portal_self_read RLS.
//
// "Join Online Visit" (spec Part 20, simplified per Angel's direction — no
// picker, no validation, just whatever URL the doctor pasted): resolves to
// the appointment's own override if the doctor set one for that specific
// visit, else the recurring provider+patient link from
// provider_patient_telehealth_links — see telehealth_links_portal_self_read
// RLS, which reuses the existing is_portal_patient() helper.
export default async function PortalAppointmentsPage() {
  const { supabase, account } = await requirePatientPortal();
  const patientId = (account as any).patient_id;
  const nowIso = new Date().toISOString();

  const [{ data: upcoming }, { data: past }, { data: links }] = await Promise.all([
    supabase.from("appointments").select(SELECT_COLS).eq("patient_id", patientId).gte("start_at", nowIso).order("start_at", { ascending: true }),
    supabase.from("appointments").select(SELECT_COLS).eq("patient_id", patientId).lt("start_at", nowIso).order("start_at", { ascending: false }).limit(20),
    supabase.from("provider_patient_telehealth_links").select("provider_id, meeting_url").eq("patient_id", patientId),
  ]);

  const linkByProvider = new Map<string, string>((links as any[] | null)?.map((l) => [l.provider_id, l.meeting_url]) ?? []);

  function resolvedLink(a: any): string | null {
    if (a.telehealth_link_override) return a.telehealth_link_override;
    return linkByProvider.get(a.provider_id) ?? null;
  }

  function Row({ a }: { a: any }) {
    const isTelehealth = a.appointment_types?.delivery_mode === "telehealth" || a.appointment_types?.delivery_mode === "both";
    const link = isTelehealth ? resolvedLink(a) : null;
    const joinable = link && !["cancelled", "no_show"].includes(a.status);

    // Wording varies by booking_mode (spec Parts 15/17) — a flexible-
    // arrival or walk-in-intent row's start_at/end_at is that day's whole
    // clinic-hours window, never a personal slot, so it's shown as a
    // window/date rather than an exact time.
    const bookingMode = a.booking_mode ?? "scheduled";
    let headline: string;
    let subline: string | null = null;
    if (bookingMode === "flexible_arrival") {
      headline = fmtDateOnly(a.start_at);
      subline = `Flexible arrival: ${fmtTimeOnly(a.start_at)}–${fmtTimeOnly(a.end_at)}${a.expected_arrival_at ? ` · Planned arrival ~${fmtTimeOnly(a.expected_arrival_at)}` : ""} — not a guaranteed time`;
    } else if (bookingMode === "walk_in_intent") {
      headline = fmtDateOnly(a.start_at);
      subline = `Walk-in — available ${fmtTimeOnly(a.start_at)}–${fmtTimeOnly(a.end_at)} — not a guaranteed time`;
    } else {
      headline = fmtDate(a.start_at);
    }

    return (
      <div style={{ background: "white", border: "1px solid #eee", borderRadius: 10, padding: "12px 14px", display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 10, flexWrap: "wrap" }}>
        <div>
          <strong style={{ fontSize: 13.5 }}>{headline}</strong>
          {subline && <div style={{ color: "#888", fontSize: 11.5, fontStyle: "italic", marginTop: 2 }}>{subline}</div>}
          <div style={{ color: "#666", fontSize: 12.5, marginTop: 3 }}>
            {a.appointment_types?.name ?? "Consultation"}
            {a.user_profiles ? ` · ${a.user_profiles.title ? a.user_profiles.title + " " : ""}${a.user_profiles.full_name}` : ""}
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
          {joinable && (
            <a
              href={link!}
              target="_blank"
              rel="noopener noreferrer"
              style={{ fontSize: 11.5, fontWeight: 700, background: "var(--brand-primary)", color: "white", borderRadius: 999, padding: "5px 12px", textDecoration: "none" }}
            >
              Join Online Visit
            </a>
          )}
          <span style={{ fontSize: 11, fontWeight: 700, background: "#f0f0f0", color: "#555", borderRadius: 999, padding: "3px 10px" }}>{STATUS_LABEL[a.status] ?? a.status}</span>
        </div>
      </div>
    );
  }

  return (
    <PortalShell>
      <h1 style={{ fontSize: 20, marginBottom: 16 }}>My Appointments</h1>

      <h2 style={{ fontSize: 13.5, color: "#888", textTransform: "uppercase", letterSpacing: 0.4, marginBottom: 8 }}>Upcoming</h2>
      <div style={{ display: "grid", gap: 8, marginBottom: 24 }}>
        {(!upcoming || upcoming.length === 0) && <p style={{ color: "#999", fontSize: 12.5 }}>No upcoming appointments.</p>}
        {(upcoming as any[])?.map((a) => (
          <Row key={a.id} a={a} />
        ))}
      </div>

      <h2 style={{ fontSize: 13.5, color: "#888", textTransform: "uppercase", letterSpacing: 0.4, marginBottom: 8 }}>Past</h2>
      <div style={{ display: "grid", gap: 8 }}>
        {(!past || past.length === 0) && <p style={{ color: "#999", fontSize: 12.5 }}>No past appointments on record.</p>}
        {(past as any[])?.map((a) => (
          <Row key={a.id} a={a} />
        ))}
      </div>
    </PortalShell>
  );
}
