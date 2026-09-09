import { requirePatientPortal } from "@/lib/require-patient-portal";
import { PortalShell } from "@/components/portal-shell";

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

export default async function PatientCarePage() {
  const { account } = await requirePatientPortal();

  return (
    <PortalShell patientName={(account as any)?.patients?.first_name}>
      <h1 style={{ fontSize: 21, marginBottom: 4 }}>My Care</h1>
      <p style={{ color: "#666", fontSize: 13, marginBottom: 20 }}>Everything about your care, in one place.</p>
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
