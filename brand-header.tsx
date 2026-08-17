import Image from "next/image";
import Link from "next/link";

export function BrandHeader({ subtitle }: { subtitle?: string }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
      <Link href="/" style={{ display: "flex", alignItems: "center", gap: 12, textDecoration: "none", color: "inherit" }}>
        <Image
          src="/logo-64.png"
          alt="Angel Clinic logo"
          width={40}
          height={40}
          style={{ borderRadius: 8 }}
        />
        <div>
          <div style={{ fontWeight: 800, fontSize: 18, letterSpacing: 0.2 }}>
            Angel<span style={{ color: "#c99a2e" }}>Clinic</span>
          </div>
          {subtitle && (
            <div style={{ fontSize: 11, color: "#8a8a8a", marginTop: -2 }}>{subtitle}</div>
          )}
        </div>
      </Link>
    </div>
  );
}
