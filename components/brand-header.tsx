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
export function BrandHeader({ subtitle }: { subtitle?: string }) {
  const tagline = subtitle === undefined ? "By Virtual Angel Systems" : subtitle;
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
          <div style={{ fontWeight: 800, fontSize: 18, letterSpacing: 0.2, color: "var(--brand-primary)" }}>
            My<span style={{ color: "var(--brand-secondary)" }}>Care</span>Desk
          </div>
          {tagline && (
            <div style={{ fontSize: 11, color: "#8a8a8a", marginTop: -2 }}>{tagline}</div>
          )}
        </div>
      </Link>
    </div>
  );
}
