import { requirePatientPortal } from "@/lib/require-patient-portal";
import { PortalShell } from "@/components/portal-shell";
import { BackLink } from "@/components/back-link";
import { getLastCompletedEncounter } from "@/lib/patients/last-visit";

// "My Care" hub (spec Part 23) — groups the existing Results/Prescriptions/
// Records/Authorizations/Forms tabs plus the new Health Profile under one
// nav entry instead of listing all of them at the top level. Every link
// here points at a route that already existed before this pass (or, for
// Health Profile, was just added) — nothing was moved or renamed, so no
// existing bookmark or link breaks.
const ITEMS = [
  { href: "/portal/health-profile", label: "Health Information", desc: "Allergies, medications, conditions, and more — shared with your doctors once you're connected." },
  { href: "/portal/results", label: "My Results", desc: "Lab and imaging results your clinic has released to you." },
  { href: "/portal/prescriptions", label: "My Prescriptions", desc: "Prescriptions your providers have created for you." },
  { href: "/portal/records", label: "My Files", desc: "Documents from your clinic, plus anything you've uploaded." },
  { href: "/portal/authorizations", label: "Records & Authorizations", desc: "Manage who can access your records." },
  { href: "/portal/forms", label: "My Forms", desc: "Forms your clinic has assigned to you." },
];

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-PH", { dateStyle: "medium" });
}

export default async function PatientCarePage() {
  const { supabase, account } = await requirePatientPortal();

  // Last Visit summary (Task #139, spec Part 33/Design #6) — same
  // patient-safe fields and single source of truth as the dashboard's
  // Recent Care card (lib/patients/last-visit), so the two can never show
  // different answers to "when did I last see my doctor." Skipped
  // entirely for a patient with no clinic relationship yet — there's
  // nothing to look up. Every link below (Health Profile especially)
  // still works without one; the clinic-scoped ones show their own
  // graceful "not connected yet" state if visited.
  const lastVisit = account ? await getLastCompletedEncounter(supabase, account.patient_id) : null;

  return (
    <PortalShell>
      <BackLink href="/portal" label="Portal Home" />
      <h1 style={{ fontSize: 21, marginBottom: 4 }}>My Care</h1>
      <p style={{ color: "#666", fontSize: 13, marginBottom: 20 }}>Everything about your care, in one place.</p>

      {lastVisit && (
        <div style={{ background: "white", border: "1px solid #eee", borderRadius: 12, padding: 18, marginBottom: 16 }}>
          <h2 style={{ fontSize: 12, fontWeight: 700, color: "#888", textTransform: "uppercase", letterSpacing: 0.4, marginTop: 0, marginBottom: 10 }}>Last Visit</h2>
          <div style={{ fontSize: 13.5, lineHeight: 1.8 }}>
            <div>
              <strong>{fmtDate(lastVisit.encounter_date)}</strong> — {lastVisit.encounter_type ?? "Visit"}
            </div>
            {lastVisit.chief_complaint && <div style={{ color: "#666" }}>{lastVisit.chief_complaint}</div>}
            {lastVisit.provider_name && <div style={{ color: "#666" }}>{lastVisit.provider_name}</div>}
          </div>
        </div>
      )}

      <div style={{ display: "grid", gap: 10, gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))" }}>
        {ITEMS.map((item) => (
          <a
            key={item.href}
            href={item.href}
            style={{ display: "block", background: "white", border: "1px solid #eee", borderRadius: 12, padding: 16, textDecoration: "none" }}
          >
            <div style={{ fontWeight: 700, fontSize: 14, color: "var(--text-heading, #222)" }}>{item.label}</div>
            <div style={{ fontSize: 12, color: "#888", marginTop: 4 }}>{item.desc}</div>
          </a>
        ))}
      </div>
    </PortalShell>
  );
}
