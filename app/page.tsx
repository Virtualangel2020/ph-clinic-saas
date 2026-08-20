import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { SiteNav } from "@/components/public/site-nav";
import { SiteFooter } from "@/components/public/site-footer";
import { WhatsappButton } from "@/components/whatsapp-button";
import { DemoPopup } from "@/components/public/demo-popup";

const GOLD = "#e6c66b";
const NAVY = "#0c1730";

export default async function HomePage() {
  const supabase = await createClient();
  const { data: site } = await supabase.from("site_content").select("*").maybeSingle();

  let promoBanner: { text: string; ctaLabel: string } | null = null;
  if (site?.promo_banner_enabled && site.promo_banner_text) {
    if (site.promo_banner_promotion_id) {
      const { data: promo } = await supabase
        .from("promotions")
        .select("is_active")
        .eq("id", site.promo_banner_promotion_id)
        .maybeSingle();
      if (promo?.is_active) promoBanner = { text: site.promo_banner_text, ctaLabel: site.promo_banner_cta_label };
    } else {
      promoBanner = { text: site.promo_banner_text, ctaLabel: site.promo_banner_cta_label };
    }
  }

  return (
    <div style={{ background: "#faf9f6" }}>
      <SiteNav />

      {promoBanner && (
        <div style={{ background: GOLD, color: NAVY, textAlign: "center", padding: "9px 16px", fontSize: 13, fontWeight: 700 }}>
          {promoBanner.text}{" "}
          <Link href="/pricing" style={{ color: NAVY, textDecoration: "underline" }}>{promoBanner.ctaLabel}</Link>
        </div>
      )}

      {/* Hero */}
      <section style={{ background: `linear-gradient(180deg, ${NAVY} 0%, #14213f 100%)`, color: "#f4f5f7", padding: "72px 24px 96px" }}>
        <div style={{ maxWidth: 860, margin: "0 auto", textAlign: "center" }}>
          <div style={{ display: "inline-block", fontSize: 12, fontWeight: 700, color: GOLD, border: `1px solid rgba(230,198,107,0.4)`, borderRadius: 999, padding: "5px 14px", marginBottom: 22 }}>
            AngelClinic by Virtual Angel Systems
          </div>
          <h1 style={{ fontSize: 46, lineHeight: 1.12, margin: "0 0 18px", fontWeight: 800 }}>
            {site?.hero_heading || "Smart Clinic. Better Care."}
          </h1>
          <p style={{ fontSize: 17, color: "rgba(244,245,247,0.82)", maxWidth: 620, margin: "0 auto 34px", lineHeight: 1.6 }}>
            {site?.hero_subheading ||
              "One intelligent workspace for your patients, providers, schedules, documentation, referrals and everyday clinic operations."}
          </p>
          <div style={{ display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap" }}>
            <Link href="/features" style={{ background: GOLD, color: NAVY, fontWeight: 700, fontSize: 14, padding: "13px 26px", borderRadius: 10, textDecoration: "none" }}>
              Explore AngelClinic
            </Link>
            <Link href="/request-demo" style={{ border: "1px solid rgba(230,198,107,0.5)", color: GOLD, fontWeight: 700, fontSize: 14, padding: "13px 26px", borderRadius: 10, textDecoration: "none" }}>
              Request a Demo
            </Link>
            <Link href="/pricing" style={{ color: "rgba(244,245,247,0.75)", fontWeight: 600, fontSize: 14, padding: "13px 10px", textDecoration: "none" }}>
              See Pricing →
            </Link>
          </div>
        </div>
      </section>

      {/* Warm welcome */}
      <section style={{ maxWidth: 860, margin: "-46px auto 0", padding: "0 24px" }}>
        <div style={{ background: "white", borderRadius: 16, boxShadow: "0 12px 40px rgba(12,23,48,0.12)", padding: "34px 36px", textAlign: "center" }}>
          <h2 style={{ fontSize: 22, margin: "0 0 10px", color: NAVY }}>{site?.welcome_heading || "Hey, Doc! 👋 Welcome to AngelClinic."}</h2>
          <p style={{ color: "#555", fontSize: 14.5, lineHeight: 1.7, margin: "0 0 20px" }}>
            {site?.welcome_body ||
              "Your clinic already has enough going on. Your system shouldn't make things harder. Explore how AngelClinic can help bring your patients, schedules, documentation, referrals and clinic operations into one organized workspace."}
          </p>
          <Link href="/features" style={{ color: NAVY, fontWeight: 700, fontSize: 14, textDecoration: "none", borderBottom: `2px solid ${GOLD}`, paddingBottom: 2 }}>
            Take a Look Around →
          </Link>
        </div>
      </section>

      {/* Product experience sections */}
      <section style={{ maxWidth: 1000, margin: "0 auto", padding: "88px 24px 40px" }}>
        <ExperienceRow
          eyebrow="Patient Records"
          title="Your Patients. Organized."
          body="See the information you need without digging through scattered records — summary, visit history, timeline, medications, allergies, documents, and referrals, all in one chart."
          bullets={["Patient Summary", "Visit History", "Timeline", "Medications & Allergies", "Documents & Referrals"]}
        />
        <ExperienceRow
          reverse
          eyebrow="Scheduling"
          title="Your Schedule. One View."
          body="Appointments, walk-ins, and multiple doctors — color-coded, filterable, and clear at a glance."
          bullets={["Appointments & walk-ins", "Multiple doctors", "Provider availability", "Provider filtering", "Color-coded appointment types"]}
        />
        <ExperienceRow
          eyebrow="Documentation"
          title="Documentation That Fits Your Practice."
          body="SOAP, expanded, or your own custom template — vitals, assessment, plan, orders, and prescriptions without re-typing what the system already knows."
          bullets={["SOAP & expanded notes", "Custom templates", "Vitals & assessment", "Orders & prescriptions"]}
        />
        <ExperienceRow
          reverse
          eyebrow="Prescriptions"
          title="Prescriptions Made Simple."
          body="Your clinic branding, patient information, and provider PRC/signature — pulled in automatically, ready to print or download as a PDF."
          bullets={["Clinic branding", "Provider PRC & signature", "Print or download PDF"]}
        />
        <ExperienceRow
          eyebrow="Referrals"
          title="Refer Patients With Confidence."
          body="Search by specialty, provider, or location, choose exactly which records to share, and track the referral end to end."
          bullets={["Search specialty/provider/location", "Select records to share", "Patient authorization", "Referral tracking"]}
        />
        <ExperienceRow
          reverse
          eyebrow="Branding"
          title="Your Clinic. Your Identity."
          body="One clinic profile — logo, address, contact — automatically applied to every medical certificate, prescription, and referral your providers create."
          bullets={["Clinic logo & details", "Provider name & credentials", "Applied to every document"]}
        />
      </section>

      {/* Everything included */}
      <section style={{ background: NAVY, color: "#f4f5f7", padding: "72px 24px" }}>
        <div style={{ maxWidth: 1000, margin: "0 auto" }}>
          <div style={{ textAlign: "center", marginBottom: 40 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: GOLD, letterSpacing: 0.5, textTransform: "uppercase", marginBottom: 10 }}>
              Every AngelClinic Subscription Includes
            </div>
            <h2 style={{ fontSize: 28, margin: 0 }}>Everything Your Clinic Needs to Work Smarter</h2>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "10px 28px" }}>
            {CORE_INCLUDES.map((f) => (
              <div key={f} style={{ fontSize: 13.5, color: "rgba(244,245,247,0.85)", display: "flex", gap: 8, alignItems: "flex-start" }}>
                <span style={{ color: GOLD }}>✓</span> {f}
              </div>
            ))}
          </div>
          <p style={{ textAlign: "center", marginTop: 32, fontSize: 13, color: "rgba(244,245,247,0.6)" }}>
            Start with what you need today. Add more whenever your clinic grows.
          </p>
        </div>
      </section>

      {/* Demo CTA */}
      <section style={{ maxWidth: 780, margin: "0 auto", padding: "80px 24px", textAlign: "center" }}>
        <h2 style={{ fontSize: 26, color: NAVY, marginBottom: 12 }}>{site?.demo_cta_heading || "Want to See AngelClinic in Action?"}</h2>
        <p style={{ color: "#666", fontSize: 15, lineHeight: 1.7, marginBottom: 26, maxWidth: 560, marginLeft: "auto", marginRight: "auto" }}>
          {site?.demo_cta_body ||
            "We'll show you how AngelClinic brings your patients, schedules, documentation, prescriptions and referrals together in one organized workspace."}
        </p>
        <Link href="/request-demo" style={{ background: NAVY, color: GOLD, fontWeight: 700, fontSize: 14, padding: "13px 28px", borderRadius: 10, textDecoration: "none" }}>
          Request Your Demo →
        </Link>
      </section>

      <SiteFooter />
      <WhatsappButton />
      <DemoPopup />
    </div>
  );
}

const CORE_INCLUDES = [
  "Electronic Patient Records", "Patient Demographics", "Emergency Contacts", "Guardian Information",
  "Patient Visit History", "Patient Timeline", "Medication Management", "Allergy Management",
  "Calendar & Scheduling", "Walk-In Management", "Multi-Provider Calendar", "Provider Availability",
  "Progress Notes", "Custom Note Templates", "Vital Signs", "Prescriptions", "Provider E-Signatures",
  "Orders", "Results", "Documents", "Patient Registration", "Forms & Acknowledgements",
  "HMO / Insurance", "PhilHealth", "Internal & External Referrals", "Provider Referral Directory",
  "Referral Tracking", "Provider Messaging", "Telephone Encounters", "Medical Certificates",
  "Clinic Branding", "Roles & Permissions", "Audit Logs", "Operational Reports", "Staff Accounts",
];

function ExperienceRow({
  eyebrow, title, body, bullets, reverse,
}: { eyebrow: string; title: string; body: string; bullets: string[]; reverse?: boolean }) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 40, alignItems: "center", padding: "36px 0", borderBottom: "1px solid #eee" }}>
      <div style={{ order: reverse ? 2 : 1 }}>
        <div style={{ fontSize: 11.5, fontWeight: 700, color: "#c99a2e", textTransform: "uppercase", letterSpacing: 0.6, marginBottom: 8 }}>{eyebrow}</div>
        <h3 style={{ fontSize: 24, color: NAVY, margin: "0 0 12px" }}>{title}</h3>
        <p style={{ color: "#666", fontSize: 14, lineHeight: 1.7, margin: 0 }}>{body}</p>
      </div>
      <div style={{ order: reverse ? 1 : 2, background: "#f4f1ea", borderRadius: 14, padding: 22, border: "1px solid #ece5d6" }}>
        <div style={{ display: "grid", gap: 8 }}>
          {bullets.map((b) => (
            <div key={b} style={{ background: "white", borderRadius: 8, padding: "10px 14px", fontSize: 13, color: "#333", boxShadow: "0 1px 2px rgba(0,0,0,0.04)" }}>
              {b}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
