import Link from "next/link";
import { requirePatientPortal } from "@/lib/require-patient-portal";
import { PortalShell } from "@/components/portal-shell";
import { age } from "@/lib/patients/get-patient-chart-data";

function fmtDate(iso: string) {
  return new Date(iso).toLocaleString("en-PH", { dateStyle: "medium", timeStyle: "short" });
}

// My Profile (spec §15) — the Patient Portal home. A patient-friendly
// summary, not the staff Profile tab: demographics they already know
// about themselves, plus quick links into the other portal sections. All
// reads go through the patients_portal_self_read / appointments_portal_
// self_read RLS policies added alongside this page — same patients,
// appointments, and patient_forms rows the clinic's own chart uses.
export default async function PortalHomePage() {
  const { supabase, account } = await requirePatientPortal();
  const patientId = (account as any).patient_id;

  const [{ data: patient }, { data: nextAppt }, { data: assignedForms }, { data: chargesRaw }, { data: paymentsRaw }] = await Promise.all([
    supabase.from("patients").select("first_name, last_name, middle_name, date_of_birth, sex, mobile_phone, email, patient_code").eq("id", patientId).maybeSingle(),
    supabase
      .from("appointments")
      .select("id, start_at, status, user_profiles(full_name, title), appointment_types(name)")
      .eq("patient_id", patientId)
      .gte("start_at", new Date().toISOString())
      .neq("status", "cancelled")
      .order("start_at", { ascending: true })
      .limit(1)
      .maybeSingle(),
    supabase.from("patient_forms").select("id").eq("patient_id", patientId).eq("status", "assigned"),
    // Balance owed (spec: billing balance also shows on the portal) — the
    // SAME patient_charges/patient_charge_payments rows the clinic's own
    // Billing tab reads, via the portal-read RLS policy added alongside
    // those tables. This is a read-only balance display, not an online
    // payment flow — see the note below the card.
    supabase.from("patient_charges").select("amount_php, status").eq("patient_id", patientId),
    supabase.from("patient_charge_payments").select("amount_php").eq("patient_id", patientId),
  ]);

  const fullName = patient ? `${patient.first_name} ${patient.middle_name ? patient.middle_name + " " : ""}${patient.last_name}` : "";
  const pendingFormsCount = assignedForms?.length ?? 0;
  const totalCharged = ((chargesRaw as any[]) ?? []).filter((c) => c.status !== "void").reduce((sum, c) => sum + Number(c.amount_php), 0);
  const totalPaid = ((paymentsRaw as any[]) ?? []).reduce((sum, p) => sum + Number(p.amount_php), 0);
  const balance = Math.max(0, totalCharged - totalPaid);
  const peso = (n: number) => `₱${n.toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  return (
    <PortalShell patientName={patient?.first_name}>
      <h1 style={{ fontSize: 21, marginBottom: 4 }}>Welcome{patient ? `, ${patient.first_name}` : ""}</h1>
      <p style={{ color: "#666", fontSize: 13, marginBottom: 20 }}>Here's a quick look at your AngelClinic account.</p>

      {pendingFormsCount > 0 && (
        <Link
          href="/portal/forms"
          style={{ display: "block", background: "#fff7e6", border: "1px solid #e6c66b", borderRadius: 10, padding: "12px 16px", fontSize: 13, color: "#7a5c12", marginBottom: 16, textDecoration: "none" }}
        >
          You have {pendingFormsCount} form{pendingFormsCount === 1 ? "" : "s"} waiting to be completed. →
        </Link>
      )}

      <div style={{ display: "grid", gap: 12, gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))" }}>
        <div style={{ background: "white", border: "1px solid #eee", borderRadius: 12, padding: 18 }}>
          <h2 style={{ fontSize: 13.5, marginTop: 0, marginBottom: 10, color: "#888", textTransform: "uppercase", letterSpacing: 0.4 }}>My Info</h2>
          {patient ? (
            <div style={{ fontSize: 13.5, lineHeight: 1.9 }}>
              <div>
                <strong>{fullName}</strong>
              </div>
              <div style={{ color: "#666" }}>
                {patient.sex} · {age(patient.date_of_birth)}y · {new Date(patient.date_of_birth).toLocaleDateString()}
              </div>
              <div style={{ color: "#666" }}>{patient.mobile_phone ?? "No mobile on file"}</div>
              <div style={{ color: "#666" }}>{patient.email ?? "No email on file"}</div>
              <div style={{ color: "#999", fontSize: 11.5, marginTop: 4 }}>Patient ID {patient.patient_code ?? "—"}</div>
            </div>
          ) : (
            <p style={{ color: "#999", fontSize: 12.5 }}>We couldn't load your profile — please contact your clinic.</p>
          )}
          <p style={{ fontSize: 11.5, color: "#aaa", marginTop: 12 }}>To update your contact details, please contact your clinic directly.</p>
        </div>

        <div style={{ background: "white", border: "1px solid #eee", borderRadius: 12, padding: 18 }}>
          <h2 style={{ fontSize: 13.5, marginTop: 0, marginBottom: 10, color: "#888", textTransform: "uppercase", letterSpacing: 0.4 }}>Next Appointment</h2>
          {nextAppt ? (
            <div style={{ fontSize: 13.5, lineHeight: 1.8 }}>
              <div>
                <strong>{fmtDate((nextAppt as any).start_at)}</strong>
              </div>
              <div style={{ color: "#666" }}>{(nextAppt as any).appointment_types?.name ?? "Consultation"}</div>
              <div style={{ color: "#666" }}>
                {(nextAppt as any).user_profiles ? `${(nextAppt as any).user_profiles.title ? (nextAppt as any).user_profiles.title + " " : ""}${(nextAppt as any).user_profiles.full_name}` : ""}
              </div>
            </div>
          ) : (
            <p style={{ color: "#999", fontSize: 12.5, margin: 0 }}>No upcoming appointments.</p>
          )}
          <Link href="/portal/appointments" style={{ display: "inline-block", marginTop: 12, fontSize: 12, color: "var(--text-heading, #0c1730)", fontWeight: 600, textDecoration: "none" }}>
            View all appointments →
          </Link>
        </div>

        {totalCharged > 0 && (
          <div style={{ background: "white", border: "1px solid #eee", borderRadius: 12, padding: 18 }}>
            <h2 style={{ fontSize: 13.5, marginTop: 0, marginBottom: 10, color: "#888", textTransform: "uppercase", letterSpacing: 0.4 }}>My Balance</h2>
            <div style={{ fontSize: 22, fontWeight: 700, color: balance > 0 ? "#a12a2a" : "#1a7f37" }}>{peso(balance)}</div>
            <div style={{ fontSize: 12, color: "#666", marginTop: 2 }}>{balance > 0 ? "Balance due" : "Paid in full"}</div>
            <p style={{ fontSize: 11.5, color: "#aaa", marginTop: 12 }}>
              This reflects what your clinic has recorded. Online payment isn&apos;t available yet — please settle your
              balance at the clinic.
            </p>
          </div>
        )}
      </div>

      <div style={{ marginTop: 14, display: "grid", gap: 10, gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))" }}>
        {[
          { href: "/portal/forms", label: "My Forms" },
          { href: "/portal/records", label: "My Records" },
          { href: "/portal/authorizations", label: "Records & Authorizations" },
          { href: "/portal/results", label: "My Results" },
          { href: "/portal/prescriptions", label: "My Prescriptions" },
        ].map((l) => (
          <Link
            key={l.href}
            href={l.href}
            style={{ display: "block", background: "white", border: "1px solid #eee", borderRadius: 10, padding: "12px 14px", fontSize: 12.5, fontWeight: 600, color: "#333", textDecoration: "none" }}
          >
            {l.label} →
          </Link>
        ))}
      </div>
    </PortalShell>
  );
}
