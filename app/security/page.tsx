import { createClient } from "@/lib/supabase/server";
import { SiteNav } from "@/components/public/site-nav";
import { SiteFooter } from "@/components/public/site-footer";

const NAVY = "#0c1730";
const GOLD = "#e6c66b";

// Every claim on this page describes something actually built in this
// codebase as of this writing. Do NOT add claims here (AES-256, ISO
// certifications, HIPAA/PhilHealth certification, etc.) without the
// underlying control actually existing — this page is meant to stay
// exactly as honest as the audit_logs/RLS/RPC architecture it describes.
const CONTROLS = [
  {
    title: "Data isolation between clinics",
    body: "Every clinic's data lives in the same database but is enforced separate by Postgres Row Level Security — every table checks the signed-in user's clinic before returning a single row. There's no shared query path where one clinic could see another's data.",
  },
  {
    title: "Role-based access",
    body: "Clinic Admin, Provider, Reception, and Other Staff each have distinct default access, and a Clinic Admin can further adjust individual permissions per person — down to specific actions like signing notes or managing billing.",
  },
  {
    title: "Server-side authorization on every action",
    body: "Every action that changes data — creating a patient, approving a signature, inviting staff — runs through a database function that independently re-checks who's calling and what they're allowed to do, rather than trusting the app's UI to enforce it.",
  },
  {
    title: "Audit history",
    body: "Sensitive actions — credential and signature approvals, permission changes, and more — are written to an audit log with who made the change and when.",
  },
  {
    title: "Encrypted in transit",
    body: "All traffic to AngelClinic is served over HTTPS/TLS, provided by our hosting infrastructure (Vercel) and database provider (Supabase).",
  },
  {
    title: "Private document storage",
    body: "Provider signatures and other sensitive files are stored in a private storage bucket — they're only ever accessible through short-lived signed links generated for an authorized request, never a public URL.",
  },
  {
    title: "Account authentication",
    body: "Sign-in is handled by Supabase Auth with hashed, salted password storage — AngelClinic never stores or has access to a plain-text password.",
  },
];

export default async function SecurityPage() {
  const supabase = await createClient();
  const { data: site } = await supabase.from("site_content").select("security_intro").maybeSingle();

  return (
    <div style={{ background: "#faf9f6" }}>
      <SiteNav />

      <section style={{ background: `linear-gradient(180deg, ${NAVY} 0%, #14213f 100%)`, color: "#f4f5f7", padding: "56px 24px 44px", textAlign: "center" }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: GOLD, letterSpacing: 0.5, textTransform: "uppercase", marginBottom: 10 }}>Security & Privacy</div>
        <h1 style={{ fontSize: 32, margin: "0 0 12px" }}>How We Protect Your Clinic's Data</h1>
        <p style={{ color: "rgba(244,245,247,0.8)", fontSize: 15, maxWidth: 620, margin: "0 auto" }}>
          {site?.security_intro ||
            "We built AngelClinic around the same isolation, authorization, and audit principles a hospital IT team would expect — described here plainly, with no vague marketing claims."}
        </p>
      </section>

      <main style={{ maxWidth: 760, margin: "0 auto", padding: "48px 24px 72px" }}>
        <div style={{ display: "grid", gap: 14, marginBottom: 40 }}>
          {CONTROLS.map((c) => (
            <div key={c.title} style={{ background: "white", border: "1px solid #e2e2e5", borderRadius: 12, padding: "18px 20px" }}>
              <h2 style={{ fontSize: 15.5, color: NAVY, margin: "0 0 6px" }}>{c.title}</h2>
              <p style={{ color: "#666", fontSize: 13.5, lineHeight: 1.6, margin: 0 }}>{c.body}</p>
            </div>
          ))}
        </div>

        <div style={{ background: "#f4f1ea", border: "1px solid #ece5d6", borderRadius: 12, padding: "18px 20px", fontSize: 13, color: "#555", lineHeight: 1.6 }}>
          We haven't pursued formal certifications (such as HIPAA or ISO 27001) yet, and we don't claim them. If a
          specific compliance requirement matters for your clinic, reach out on the{" "}
          <a href="/request-demo" style={{ color: "#0c1730", fontWeight: 600 }}>Request a Demo</a> page and we'll talk it through honestly.
        </div>
      </main>

      <SiteFooter />
    </div>
  );
}
