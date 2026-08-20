import { SiteNav } from "@/components/public/site-nav";
import { SiteFooter } from "@/components/public/site-footer";
import { RequestDemoForm } from "./request-demo-form";

const NAVY = "#0c1730";
const GOLD = "#e6c66b";

export default function RequestDemoPage() {
  return (
    <div style={{ background: "#faf9f6" }}>
      <SiteNav />

      <section style={{ background: `linear-gradient(180deg, ${NAVY} 0%, #14213f 100%)`, color: "#f4f5f7", padding: "56px 24px 44px", textAlign: "center" }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: GOLD, letterSpacing: 0.5, textTransform: "uppercase", marginBottom: 10 }}>
          Request a Demo
        </div>
        <h1 style={{ fontSize: 32, margin: "0 0 12px" }}>See AngelClinic in Action</h1>
        <p style={{ color: "rgba(244,245,247,0.8)", fontSize: 15, maxWidth: 520, margin: "0 auto" }}>
          Tell us a bit about your clinic and we'll walk you through how AngelClinic fits your workflow — no
          pressure, no obligation.
        </p>
      </section>

      <main style={{ maxWidth: 620, margin: "-24px auto 0", padding: "0 24px 72px" }}>
        <RequestDemoForm />
      </main>

      <SiteFooter />
    </div>
  );
}
