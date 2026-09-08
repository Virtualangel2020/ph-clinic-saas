import Image from "next/image";
import Link from "next/link";

// Shared brand lockup (icon + wordmark + tagline) — used on every
// screen that isn't inside the signed-in dashboard shell (login, signup,
// Patient Portal, Superadmin, get-started, pay/success, etc.). The
// wordmark is colored to match the actual logo file's own typography
// ("My"/"Desk" in brand navy, "Care" in brand teal) rather than a plain
// single-color label. `subtitle` overrides the default "By Virtual Angel
// Systems" tagline for screens that need their own context line instead
// (e.g. "Super Admin", "Patient Portal — Maria Santos") — pass an empty
// string to show no subtitle at all.
//
// `variant="dark"` is for the rare case where this sits on a colored/dark
// surface (currently only the Super Admin header, which uses
// var(--brand-sidebar)) — the default navy/teal wordmark reads fine on
// white but nearly disappears against a medium-blue background, so the
// dark variant switches to off-white text with a mint accent instead.
// Every other usage (login, signup, portal, get-started, etc.) renders on
// a white/light card and should leave this prop unset.
export function BrandHeader({ subtitle, variant = "light" }: { subtitle?: string; variant?: "light" | "dark" }) {
  const tagline = subtitle === undefined ? "By Virtual Angel Systems" : subtitle;
  const wordmarkColor = variant === "dark" ? "#f4f5f7" : "var(--brand-primary)";
  const accentColor = variant === "dark" ? "var(--brand-accent)" : "var(--brand-secondary)";
  const taglineColor = variant === "dark" ? "rgba(244,245,247,0.75)" : "#8a8a8a";
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
      <Link href="/" style={{ display: "flex", alignItems: "center", gap: 12, textDecoration: "none", color: "inherit" }}>
        <Image
          src="/logo-64.png"
          alt="MyCareDesk logo"
          width={40}
          height={40}
          style={{ borderRadius: 8 }}
        />
        <div>
          <div style={{ fontWeight: 800, fontSize: 18, letterSpacing: 0.2, color: wordmarkColor }}>
            My<span style={{ color: accentColor }}>Care</span>Desk
          </div>
          {tagline && (
            <div style={{ fontSize: 11, color: taglineColor, marginTop: -2 }}>{tagline}</div>
          )}
        </div>
      </Link>
    </div>
  );
}
