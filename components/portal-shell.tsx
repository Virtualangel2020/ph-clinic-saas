"use client";

import { usePathname } from "next/navigation";
import Link from "next/link";
import { BrandHeader } from "@/components/brand-header";
import { SignOutButton } from "@/app/portal/sign-out-button";
import { NavigationLoadingIndicator } from "@/components/loading/navigation-loading-indicator";

// Shared shell for every /portal/* page. Simplified per spec Part 23 down
// to six top-level entries — Home / Appointments / Find a Doctor / My Care
// / Messages / Profile — instead of the previous nine-tab flat list. Every
// page the old flat list linked to still exists at the same URL (Billing,
// Records, Authorizations, Results, Prescriptions, Forms); they're now
// reachable via the My Care and Profile hub pages instead of the top nav,
// so nothing was moved or renamed and no existing bookmark or deep link
// breaks. Find a Doctor deliberately points at the public directory page
// (outside this shell) rather than a portal-shelled duplicate — same
// directory, same data, no second copy.
//
// Layout: on wide screens this renders as a left sidebar of tabs (the
// style Angel asked for, modeled after other patient-portal apps) with the
// brand + sign-out pinned above it; on narrow screens it falls back to the
// original horizontal scrollable top nav, which is already the better
// pattern for a phone. Both navs point at the exact same six routes, so
// nothing about routing or page content changes with screen width.
const PORTAL_NAV = [
  { href: "/portal", label: "Home", icon: "home" },
  { href: "/portal/appointments", label: "Appointments", icon: "calendar" },
  { href: "/find-a-doctor", label: "Find a Doctor", icon: "doctor" },
  { href: "/portal/care", label: "My Care", icon: "care" },
  { href: "/portal/messages", label: "Messages", icon: "messages" },
  { href: "/portal/profile", label: "Profile", icon: "profile" },
] as const;

function NavIcon({ name }: { name: (typeof PORTAL_NAV)[number]["icon"] }) {
  const common = { width: 17, height: 17, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 1.8, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };
  switch (name) {
    case "home":
      return (
        <svg {...common}>
          <path d="M4 11.5 12 4l8 7.5" />
          <path d="M6 10v9h5v-5h2v5h5v-9" />
        </svg>
      );
    case "calendar":
      return (
        <svg {...common}>
          <rect x="4" y="5" width="16" height="15" rx="2" />
          <path d="M4 9h16M8 3v4M16 3v4" />
        </svg>
      );
    case "doctor":
      return (
        <svg {...common}>
          <circle cx="12" cy="12" r="9" />
          <path d="M12 8v8M8 12h8" />
        </svg>
      );
    case "care":
      return (
        <svg {...common}>
          <path d="M12 20s-7-4.35-9.5-8.5C1 8 2.5 4.5 6 4.5c2 0 3.3 1.2 4 2.3.7-1.1 2-2.3 4-2.3 3.5 0 5 3.5 3.5 7C19 15.65 12 20 12 20z" />
        </svg>
      );
    case "messages":
      return (
        <svg {...common}>
          <path d="M4 5h16v11H8l-4 4V5z" />
        </svg>
      );
    case "profile":
      return (
        <svg {...common}>
          <circle cx="12" cy="8" r="3.5" />
          <path d="M5 20c1.2-3.5 4-5.5 7-5.5s5.8 2 7 5.5" />
        </svg>
      );
  }
}

export function PortalShell({ patientName, children }: { patientName?: string | null; children: React.ReactNode }) {
  const pathname = usePathname();
  const isActive = (href: string) => (href === "/portal" ? pathname === "/portal" : pathname.startsWith(href));

  return (
    <div style={{ minHeight: "100vh", background: "#f7f7f9" }}>
      <div className="portal-layout">
        <aside className="portal-sidebar">
          <div style={{ padding: "22px 16px 16px" }}>
            <BrandHeader subtitle={patientName ? `Hi, ${patientName}` : "Patient Portal"} />
          </div>
          <nav style={{ display: "flex", flexDirection: "column", gap: 2, padding: "4px 10px", flex: 1 }}>
            {PORTAL_NAV.map((item) => {
              const active = isActive(item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 11,
                    padding: "10px 12px",
                    borderRadius: 8,
                    textDecoration: "none",
                    fontSize: 13.5,
                    fontWeight: active ? 700 : 500,
                    color: active ? "var(--brand-primary)" : "#555",
                    background: active ? "rgba(4,156,160,0.09)" : "transparent",
                  }}
                >
                  <NavIcon name={item.icon} />
                  {item.label}
                </Link>
              );
            })}
          </nav>
          <div style={{ padding: 14, borderTop: "1px solid #f0f0f0" }}>
            <SignOutButton />
          </div>
        </aside>

        <div className="portal-main">
          <div className="portal-topbar" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 18, flexWrap: "wrap", gap: 10 }}>
            <BrandHeader subtitle={patientName ? `Patient Portal — ${patientName}` : "Patient Portal"} />
            <SignOutButton />
          </div>

          <div className="portal-topnav" style={{ display: "flex", gap: 4, overflowX: "auto", borderBottom: "1px solid #e2e2e2", marginBottom: 20, paddingBottom: 0 }}>
            {PORTAL_NAV.map((item) => {
              const active = isActive(item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  style={{
                    flexShrink: 0,
                    padding: "9px 12px",
                    fontSize: 12.5,
                    textDecoration: "none",
                    color: active ? "var(--brand-primary)" : "#888",
                    fontWeight: active ? 700 : 500,
                    borderBottom: active ? "2px solid var(--brand-primary)" : "2px solid transparent",
                    whiteSpace: "nowrap",
                  }}
                >
                  {item.label}
                </Link>
              );
            })}
          </div>

          <div style={{ position: "relative", minHeight: 200 }}>
            <NavigationLoadingIndicator />
            {children}
          </div>
        </div>
      </div>

      <style>{`
        .portal-sidebar { display: none; }
        @media (min-width: 860px) {
          .portal-layout { display: flex; align-items: flex-start; max-width: 1080px; margin: 0 auto; }
          .portal-sidebar {
            display: flex; flex-direction: column; width: 220px; flex-shrink: 0;
            min-height: 100vh; background: white; border-right: 1px solid #eee;
            position: sticky; top: 0;
          }
          .portal-topbar { display: none !important; }
          .portal-topnav { display: none !important; }
          .portal-main { flex: 1; min-width: 0; padding: 28px 32px 60px; }
          .portal-main > div:last-child { max-width: 760px; }
        }
        .portal-main { padding: 24px 20px 60px; max-width: 760px; margin: 0 auto; }
      `}</style>
    </div>
  );
}
