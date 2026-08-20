"use client";

import Link from "next/link";
import { useState } from "react";
import { usePathname } from "next/navigation";

const LINKS = [
  { href: "/", label: "Home" },
  { href: "/features", label: "Features" },
  { href: "/find-a-doctor", label: "Find a Doctor" },
  { href: "/pricing", label: "Pricing" },
  { href: "/security", label: "Security" },
  { href: "/about", label: "About Us" },
];

// Shared chrome for every PUBLIC page (Part 3). The secure clinic
// workspace (/dashboard/*) uses components/emr/emr-shell.tsx instead —
// these two never mix, by design (Part 72).
export function SiteNav() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  return (
    <header style={{ position: "sticky", top: 0, zIndex: 30, background: "rgba(12,23,48,0.96)", backdropFilter: "blur(6px)", borderBottom: "1px solid rgba(230,198,107,0.2)" }}>
      <div style={{ maxWidth: 1120, margin: "0 auto", padding: "14px 24px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16 }}>
        <Link href="/" style={{ display: "flex", alignItems: "baseline", gap: 6, textDecoration: "none" }}>
          <span style={{ fontWeight: 800, fontSize: 18, color: "#e6c66b", letterSpacing: 0.3 }}>AngelClinic</span>
        </Link>

        <nav style={{ display: "none", gap: 22 }} className="site-nav-links">
          {LINKS.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              style={{
                fontSize: 13.5,
                color: pathname === l.href ? "#e6c66b" : "rgba(244,245,247,0.8)",
                fontWeight: pathname === l.href ? 700 : 500,
                textDecoration: "none",
              }}
            >
              {l.label}
            </Link>
          ))}
        </nav>

        <div style={{ display: "none", alignItems: "center", gap: 10 }} className="site-nav-cta">
          <Link href="/login" style={{ fontSize: 13, color: "rgba(244,245,247,0.85)", textDecoration: "none" }}>Sign In</Link>
          <Link href="/request-demo" style={{ fontSize: 13, color: "#e6c66b", border: "1px solid rgba(230,198,107,0.5)", borderRadius: 8, padding: "8px 14px", textDecoration: "none", fontWeight: 600 }}>
            Request a Demo
          </Link>
          <Link href="/signup" style={{ fontSize: 13, background: "#e6c66b", color: "#0c1730", borderRadius: 8, padding: "8px 16px", textDecoration: "none", fontWeight: 700 }}>
            Start Your Trial
          </Link>
        </div>

        <button
          onClick={() => setOpen((o) => !o)}
          className="site-nav-toggle"
          style={{ background: "none", border: "1px solid rgba(230,198,107,0.4)", borderRadius: 8, color: "#e6c66b", padding: "6px 10px", fontSize: 13 }}
        >
          {open ? "✕" : "☰"}
        </button>
      </div>

      {open && (
        <div className="site-nav-mobile" style={{ padding: "8px 24px 18px", display: "grid", gap: 10 }}>
          {LINKS.map((l) => (
            <Link key={l.href} href={l.href} onClick={() => setOpen(false)} style={{ fontSize: 14, color: "#f4f5f7", textDecoration: "none" }}>
              {l.label}
            </Link>
          ))}
          <Link href="/login" onClick={() => setOpen(false)} style={{ fontSize: 14, color: "#f4f5f7", textDecoration: "none" }}>Sign In</Link>
          <Link href="/request-demo" onClick={() => setOpen(false)} style={{ fontSize: 14, color: "#e6c66b", textDecoration: "none", fontWeight: 700 }}>Request a Demo</Link>
          <Link href="/signup" onClick={() => setOpen(false)} style={{ fontSize: 14, color: "#e6c66b", textDecoration: "none", fontWeight: 700 }}>Start Your Trial →</Link>
        </div>
      )}

      <style>{`
        @media (min-width: 860px) {
          .site-nav-links { display: flex !important; }
          .site-nav-cta { display: flex !important; }
          .site-nav-toggle { display: none !important; }
        }
      `}</style>
    </header>
  );
}
