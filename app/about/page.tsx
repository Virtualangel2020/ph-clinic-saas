import { createClient } from "@/lib/supabase/server";
import { SiteNav } from "@/components/public/site-nav";
import { SiteFooter } from "@/components/public/site-footer";

const NAVY = "#0c1730";
const GOLD = "#e6c66b";

const DEFAULT_ABOUT = `AngelClinic started with a simple frustration: clinics deserve software that works the way they do, not the other way around.

I'm a Registered Nurse who spent years working in U.S. healthcare systems — watching firsthand how the right software can make a clinic's day run smoother, and how the wrong software just adds more clicks between a provider and their patient. When I started looking at what was available for clinics here in the Philippines, I saw a gap: systems that were either too rigid, too expensive, or built for a completely different healthcare system.

AngelClinic is my answer to that gap — built specifically around how Filipino clinics actually operate, from HMO and PhilHealth handling to the everyday realities of a busy front desk and a provider trying to get through their day. It's built by someone who has stood on both sides of that counter — as a clinician, and now as the person building the tools clinicians use.`;

export default async function AboutPage() {
  const supabase = await createClient();
  const { data: site } = await supabase.from("site_content").select("about_body").maybeSingle();

  const paragraphs: string[] = (site?.about_body?.trim() || DEFAULT_ABOUT).split("\n\n").filter(Boolean);

  return (
    <div style={{ background: "#faf9f6" }}>
      <SiteNav />

      <section style={{ background: `linear-gradient(180deg, ${NAVY} 0%, #14213f 100%)`, color: "#f4f5f7", padding: "56px 24px 44px", textAlign: "center" }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: GOLD, letterSpacing: 0.5, textTransform: "uppercase", marginBottom: 10 }}>About Us</div>
        <h1 style={{ fontSize: 32, margin: "0 0 12px" }}>Why AngelClinic</h1>
      </section>

      <main style={{ maxWidth: 680, margin: "0 auto", padding: "48px 24px 40px" }}>
        <div style={{ background: "white", border: "1px solid #e2e2e5", borderRadius: 14, padding: "32px 34px" }}>
          {paragraphs.map((p, i) => (
            <p key={i} style={{ color: "#444", fontSize: 15, lineHeight: 1.8, margin: i === paragraphs.length - 1 ? 0 : "0 0 18px" }}>
              {p}
            </p>
          ))}
        </div>

        <div style={{ marginTop: 40 }}>
          <h2 style={{ fontSize: 15, color: "#888", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 16 }}>Why Clinics Choose AngelClinic</h2>
          <div style={{ display: "grid", gap: 12, gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))" }}>
            {[
              ["Built for Philippine clinics", "HMO, PhilHealth, and everyday workflow — not adapted from a system built for somewhere else."],
              ["One plan, no upsells", "AngelClinic Core includes what a clinic actually needs to run — add-ons are optional, not required."],
              ["A real person behind it", "Built by someone with clinical experience, not just a software vendor guessing at what clinics need."],
            ].map(([title, body]) => (
              <div key={title} style={{ background: "#f4f1ea", border: "1px solid #ece5d6", borderRadius: 10, padding: "16px 18px" }}>
                <div style={{ fontWeight: 700, fontSize: 13.5, color: NAVY, marginBottom: 4 }}>{title}</div>
                <div style={{ color: "#666", fontSize: 12.5, lineHeight: 1.5 }}>{body}</div>
              </div>
            ))}
          </div>
        </div>
      </main>

      <SiteFooter />
    </div>
  );
}
