import Link from "next/link";
import { SiteNav } from "@/components/public/site-nav";
import { SiteFooter } from "@/components/public/site-footer";
import { WhatsappButton } from "@/components/whatsapp-button";

const NAVY = "#0c1730";
const GOLD = "#e6c66b";

const CATEGORIES: { title: string; body: string; items: string[] }[] = [
  {
    title: "Patient Records",
    body: "One chart per patient — everything your team needs, without digging through scattered paper or spreadsheets.",
    items: ["Demographics & registration", "Emergency contacts & guardians", "Visit history", "Patient timeline", "Medications & allergies", "Documents"],
  },
  {
    title: "Scheduling",
    body: "See your whole clinic's day at a glance, across every provider.",
    items: ["Appointments & walk-ins", "Multi-provider calendar", "Provider availability", "Customizable appointment-type colors"],
  },
  {
    title: "Documentation",
    body: "Write notes the way your clinic already works — or set up a template once and reuse it.",
    items: ["Progress notes (SOAP & custom)", "Note templates", "Vital signs", "Provider e-signatures"],
  },
  {
    title: "Orders, Results & Prescriptions",
    body: "From order to result to prescription, with your clinic's branding and your credentials applied automatically.",
    items: ["Orders", "Results", "Prescriptions", "Documents"],
  },
  {
    title: "Referrals",
    body: "Refer with confidence — choose exactly what to share, and follow the referral through to completion.",
    items: ["Internal & external referrals", "Provider referral directory", "Patient authorization", "Referral tracking"],
  },
  {
    title: "Forms & Compliance",
    body: "Registration, acknowledgements, HMO and PhilHealth details, and medical certificates — built in, not bolted on.",
    items: ["Patient registration", "Forms & acknowledgements", "HMO / insurance", "PhilHealth", "Medical certificates"],
  },
  {
    title: "Communication",
    body: "Keep your team talking to each other — and give patients a direct line in too.",
    items: ["Provider messaging", "Telephone encounters", "Alerts", "Notifications", "Patient portal & secure messaging"],
  },
  {
    title: "Clinic Operations",
    body: "Run the business side of your clinic with the same clarity as the clinical side.",
    items: ["Clinic branding on every document", "Roles & granular permissions", "Audit logs", "Operational reports", "Staff accounts"],
  },
];

const ADDONS = [
  { name: "Financial Tracker", body: "Track clinic revenue and expenses alongside your clinical data." },
  { name: "Patient Payments (PayMongo)", body: "Accept online payments from patients directly." },
  { name: "Advanced Analytics", body: "Deeper operational and clinical reporting." },
  { name: "Email", body: "Send patient and referral communication by email." },
  { name: "SMS", body: "Reach patients by text — credits configurable by Virtual Angel Systems, not a flat guess." },
  { name: "WhatsApp", body: "Message patients and referral partners over WhatsApp." },
  { name: "Multi-Branch", body: "Run more than one clinic location under one account." },
  { name: "Custom Domain", body: "Connect your clinic's own domain instead of the default AngelClinic address." },
  { name: "Customer Care", body: "A persistent, direct message line to the Virtual Angel Systems support team, right in your dashboard." },
];

export default function FeaturesPage() {
  return (
    <div style={{ background: "#faf9f6" }}>
      <SiteNav />

      <section style={{ background: `linear-gradient(180deg, ${NAVY} 0%, #14213f 100%)`, color: "#f4f5f7", padding: "56px 24px 44px", textAlign: "center" }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: GOLD, letterSpacing: 0.5, textTransform: "uppercase", marginBottom: 10 }}>Features</div>
        <h1 style={{ fontSize: 32, margin: "0 0 12px" }}>Everything Your Clinic Needs, Organized.</h1>
        <p style={{ color: "rgba(244,245,247,0.8)", fontSize: 15, maxWidth: 560, margin: "0 auto" }}>
          Every feature below is included in AngelClinic Core — no tiers, no upsells for the basics of running a
          clinic.
        </p>
      </section>

      <main style={{ maxWidth: 1000, margin: "0 auto", padding: "48px 24px 24px" }}>
        <div style={{ display: "grid", gap: 20, gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", marginBottom: 56 }}>
          {CATEGORIES.map((c) => (
            <div key={c.title} style={{ background: "white", border: "1px solid #e2e2e5", borderRadius: 14, padding: 22 }}>
              <h2 style={{ fontSize: 17, color: NAVY, margin: "0 0 8px" }}>{c.title}</h2>
              <p style={{ color: "#666", fontSize: 13, lineHeight: 1.6, margin: "0 0 12px" }}>{c.body}</p>
              <ul style={{ margin: 0, paddingLeft: 18, fontSize: 12.5, color: "#444", lineHeight: 1.9 }}>
                {c.items.map((i) => (
                  <li key={i}>{i}</li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div style={{ textAlign: "center", marginBottom: 40 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: "#c99a2e", letterSpacing: 0.5, textTransform: "uppercase", marginBottom: 8 }}>Optional Add-ons</div>
          <h2 style={{ fontSize: 24, color: NAVY, margin: "0 0 8px" }}>Add More When You're Ready</h2>
          <p style={{ color: "#666", fontSize: 13.5, maxWidth: 520, margin: "0 auto" }}>None of these are required to get started — turn them on whenever your clinic needs them.</p>
        </div>
        <div style={{ display: "grid", gap: 12, gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", marginBottom: 56 }}>
          {ADDONS.map((a) => (
            <div key={a.name} style={{ background: "#f4f1ea", border: "1px solid #ece5d6", borderRadius: 10, padding: "14px 16px" }}>
              <div style={{ fontWeight: 700, fontSize: 13.5, color: NAVY, marginBottom: 4 }}>{a.name}</div>
              <div style={{ color: "#666", fontSize: 12.5, lineHeight: 1.5 }}>{a.body}</div>
            </div>
          ))}
        </div>

        <div style={{ background: NAVY, borderRadius: 14, padding: "32px 28px", textAlign: "center", marginBottom: 48 }}>
          <h2 style={{ color: "white", fontSize: 20, marginTop: 0, marginBottom: 8 }}>See It for Yourself</h2>
          <div style={{ display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap" }}>
            <Link href="/pricing" style={{ background: GOLD, color: NAVY, fontWeight: 700, fontSize: 14, padding: "11px 24px", borderRadius: 8, textDecoration: "none" }}>
              See Pricing →
            </Link>
            <Link href="/request-demo" style={{ border: "1px solid rgba(230,198,107,0.5)", color: GOLD, fontWeight: 700, fontSize: 14, padding: "11px 24px", borderRadius: 8, textDecoration: "none" }}>
              Request a Demo
            </Link>
          </div>
        </div>
      </main>

      <SiteFooter />
      <WhatsappButton />
    </div>
  );
}
