import { requirePatientPortal } from "@/lib/require-patient-portal";
import { PortalShell } from "@/components/portal-shell";

function fmtDate(iso: string) {
  return new Date(iso).toLocaleString("en-PH", { dateStyle: "medium", timeStyle: "short" });
}

const STATUS_LABEL: Record<string, string> = {
  booked: "Confirmed",
  confirmed: "Confirmed",
  checked_in: "Checked in",
  completed: "Completed",
  cancelled: "Cancelled",
  no_show: "No show",
};

// My Appointments (spec §15) — the same `appointments` rows the clinic's
// own Calendar and the chart's Appointments tab use, filtered to this one
// patient via appointments_portal_self_read RLS.
export default async function PortalAppointmentsPage() {
  const { supabase, account } = await requirePatientPortal();
  const patientId = (account as any).patient_id;
  const nowIso = new Date().toISOString();

  const [{ data: upcoming }, { data: past }] = await Promise.all([
    supabase
      .from("appointments")
      .select("id, start_at, status, notes, user_profiles(full_name, title), appointment_types(name)")
      .eq("patient_id", patientId)
      .gte("start_at", nowIso)
      .order("start_at", { ascending: true }),
    supabase
      .from("appointments")
      .select("id, start_at, status, notes, user_profiles(full_name, title), appointment_types(name)")
      .eq("patient_id", patientId)
      .lt("start_at", nowIso)
      .order("start_at", { ascending: false })
      .limit(20),
  ]);

  function Row({ a }: { a: any }) {
    return (
      <div style={{ background: "white", border: "1px solid #eee", borderRadius: 10, padding: "12px 14px", display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 10, flexWrap: "wrap" }}>
        <div>
          <strong style={{ fontSize: 13.5 }}>{fmtDate(a.start_at)}</strong>
          <div style={{ color: "#666", fontSize: 12.5, marginTop: 3 }}>
            {a.appointment_types?.name ?? "Consultation"}
            {a.user_profiles ? ` · ${a.user_profiles.title ? a.user_profiles.title + " " : ""}${a.user_profiles.full_name}` : ""}
          </div>
        </div>
        <span style={{ fontSize: 11, fontWeight: 700, background: "#f0f0f0", color: "#555", borderRadius: 999, padding: "3px 10px", flexShrink: 0 }}>
          {STATUS_LABEL[a.status] ?? a.status}
        </span>
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
