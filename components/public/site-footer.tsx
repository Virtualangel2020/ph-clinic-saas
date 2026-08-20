import Link from "next/link";

export function SiteFooter() {
  return (
    <footer style={{ background: "#0c1730", color: "rgba(244,245,247,0.7)", marginTop: 64 }}>
      <div style={{ maxWidth: 1120, margin: "0 auto", padding: "40px 24px", display: "grid", gridTemplateColumns: "1.4fr 1fr 1fr 1fr", gap: 24 }}>
        <div>
          <div style={{ fontWeight: 800, fontSize: 16, color: "#e6c66b", marginBottom: 8 }}>AngelClinic</div>
          <p style={{ fontSize: 12.5, lineHeight: 1.6, maxWidth: 260 }}>Smart Clinic. Better Care. AngelClinic by Virtual Angel Systems.</p>
        </div>
        <div>
          <div style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: 0.5, color: "rgba(244,245,247,0.4)", marginBottom: 10 }}>Product</div>
          <FooterLink href="/features">Features</FooterLink>
          <FooterLink href="/pricing">Pricing</FooterLink>
          <FooterLink href="/security">Security</FooterLink>
          <FooterLink href="/find-a-doctor">Find a Doctor</FooterLink>
        </div>
        <div>
          <div style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: 0.5, color: "rgba(244,245,247,0.4)", marginBottom: 10 }}>Company</div>
          <FooterLink href="/about">About Us</FooterLink>
          <FooterLink href="/request-demo">Request a Demo</FooterLink>
          <FooterLink href="/login">Sign In</FooterLink>
        </div>
        <div>
          <div style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: 0.5, color: "rgba(244,245,247,0.4)", marginBottom: 10 }}>Get Started</div>
          <FooterLink href="/signup">Start Your Trial</FooterLink>
        </div>
      </div>
      <div style={{ borderTop: "1px solid rgba(255,255,255,0.08)", padding: "16px 24px", fontSize: 11.5, textAlign: "center", color: "rgba(244,245,247,0.4)" }}>
        © {new Date().getFullYear()} Virtual Angel Systems. AngelClinic is a clinic operations platform for Philippine healthcare providers.
      </div>
    </footer>
  );
}

function FooterLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 8 }}>
      <Link href={href} style={{ fontSize: 13, color: "rgba(244,245,247,0.75)", textDecoration: "none" }}>{children}</Link>
    </div>
  );
}
