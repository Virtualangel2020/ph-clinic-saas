"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";

type NavItem = { href: string; label: string; short: string };

const CORE_NAV: NavItem[] = [
  { href: "/dashboard", label: "Dashboard", short: "Dash" },
  { href: "/dashboard/patients", label: "Patients", short: "Pts" },
  { href: "/dashboard/calendar", label: "Calendar", short: "Cal" },
  { href: "/dashboard/encounters", label: "Encounters", short: "Enc" },
  { href: "/dashboard/referrals", label: "Referrals", short: "Ref" },
  { href: "/dashboard/prescriptions", label: "Prescriptions", short: "Rx" },
  { href: "/dashboard/orders", label: "Orders", short: "Ord" },
  { href: "/dashboard/results", label: "Results", short: "Res" },
  { href: "/dashboard/documents", label: "Documents", short: "Doc" },
  { href: "/dashboard/insurance", label: "Insurance / HMO", short: "Ins" },
  { href: "/dashboard/philhealth", label: "PhilHealth", short: "PH" },
  { href: "/dashboard/reports", label: "Reports", short: "Rpt" },
];

type AddonNav = { key: string; href: string; label: string; short: string };
const ADDON_NAV: AddonNav[] = [
  { key: "patient_portal", href: "/dashboard/patient-portal", label: "Patient Portal", short: "Portal" },
  { key: "financial_tracker", href: "/dashboard/financials", label: "Financials", short: "Fin" },
  { key: "patient_payments", href: "/dashboard/payments", label: "Payments", short: "Pay" },
  { key: "communications", href: "/dashboard/communications", label: "Communications", short: "Comm" },
];

const JELLYBEANS = [
  { key: "R", label: "Referrals", href: "/dashboard/referrals?tab=inbox" },
  { key: "M", label: "Provider messages", href: "/dashboard/communications?tab=messages" },
  { key: "P", label: "Patient messages", href: "/dashboard/patient-portal?tab=messages" },
  { key: "T", label: "Telephone encounters", href: "/dashboard/communications?tab=calls" },
  { key: "A", label: "Alerts", href: "/dashboard/alerts" },
  { key: "D", label: "Documents/results to review", href: "/dashboard/results?tab=unreviewed" },
] as const;

const MOBILE_QUERY = "(max-width: 859px)";

export function EmrShell({
  clinicName,
  userLabel,
  enabledAddonKeys,
  jellybeanCounts,
  children,
}: {
  clinicName: string;
  userLabel: string;
  enabledAddonKeys: string[];
  jellybeanCounts: Partial<Record<(typeof JELLYBEANS)[number]["key"], number>>;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    const stored = window.localStorage.getItem("ac_nav_collapsed");
    if (stored === "1") setCollapsed(true);
  }, []);

  // A fixed 220px sidebar plus a fixed top bar left almost no room for
  // content on a phone-width screen, and the AngelClinic mark inside the
  // sidebar was getting squeezed unreadable. Below 860px the sidebar
  // becomes an off-canvas drawer (hidden by default, opened by the
  // hamburger button in the top bar) instead of a permanently-visible
  // column, and content runs full-width.
  useEffect(() => {
    const mq = window.matchMedia(MOBILE_QUERY);
    setIsMobile(mq.matches);
    const onChange = (e: MediaQueryListEvent) => setIsMobile(e.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  // Tapping a nav link on mobile should navigate AND close the drawer,
  // rather than leaving it open over the new page.
  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  function toggleCollapsed() {
    setCollapsed((prev) => {
      window.localStorage.setItem("ac_nav_collapsed", !prev ? "1" : "0");
      return !prev;
    });
  }

  const visibleAddons = ADDON_NAV.filter((a) => enabledAddonKeys.includes(a.key) || a.key === "communications" && enabledAddonKeys.some((k) => ["email_communications", "sms_messaging", "whatsapp_communications"].includes(k)));

  // On mobile the drawer is always full-width and fully labeled (icon-only
  // "collapsed" mode only makes sense for a permanently-visible desktop
  // rail) and it's positioned off-screen until opened.
  const effectiveCollapsed = isMobile ? false : collapsed;
  const navWidth = isMobile ? 240 : collapsed ? 64 : 220;
  const contentOffset = isMobile ? 0 : navWidth;

  return (
    <div style={{ minHeight: "100vh", background: "#f4f5f7" }}>
      {isMobile && mobileOpen && (
        <div
          onClick={() => setMobileOpen(false)}
          style={{ position: "fixed", inset: 0, background: "rgba(12,23,48,0.5)", zIndex: 19 }}
        />
      )}

      {/* Fixed left nav (Part 2) — an off-canvas drawer on mobile */}
      <nav
        style={{
          position: "fixed",
          top: 0,
          left: 0,
          bottom: 0,
          width: navWidth,
          background: "#0c1730",
          color: "#f4f5f7",
          display: "flex",
          flexDirection: "column",
          transform: isMobile && !mobileOpen ? "translateX(-100%)" : "translateX(0)",
          transition: "width 0.15s ease, transform 0.2s ease",
          zIndex: 20,
        }}
      >
        <div style={{ padding: effectiveCollapsed ? "16px 8px" : "16px 18px", borderBottom: "1px solid rgba(255,255,255,0.1)", display: "flex", alignItems: "center", justifyContent: effectiveCollapsed ? "center" : "flex-start", gap: 9 }}>
          <Image src="/logo-64.png" alt="AngelClinic logo" width={28} height={28} style={{ borderRadius: 6, flexShrink: 0 }} />
          {!effectiveCollapsed && <div style={{ fontWeight: 800, fontSize: 15, color: "#e6c66b" }}>AngelClinic</div>}
          {isMobile && (
            <button
              onClick={() => setMobileOpen(false)}
              aria-label="Close menu"
              style={{ marginLeft: "auto", background: "none", border: "none", color: "rgba(244,245,247,0.7)", fontSize: 18, cursor: "pointer", padding: 4 }}
            >
              ✕
            </button>
          )}
        </div>

        <div style={{ flex: 1, overflowY: "auto", padding: "8px 0" }}>
          {CORE_NAV.map((item) => (
            <NavLink key={item.href} item={item} collapsed={effectiveCollapsed} active={isActive(pathname, item.href)} />
          ))}

          {visibleAddons.length > 0 && (
            <>
              <div style={{ margin: "10px 14px 4px", fontSize: 10, letterSpacing: 0.5, textTransform: "uppercase", color: "rgba(255,255,255,0.35)" }}>
                {!effectiveCollapsed ? "Add-ons" : "···"}
              </div>
              {visibleAddons.map((item) => (
                <NavLink key={item.href} item={item} collapsed={effectiveCollapsed} active={isActive(pathname, item.href)} />
              ))}
            </>
          )}
        </div>

        <div style={{ borderTop: "1px solid rgba(255,255,255,0.1)", padding: "8px 0" }}>
          <NavLink item={{ href: "/dashboard/settings", label: "Settings", short: "Set" }} collapsed={effectiveCollapsed} active={isActive(pathname, "/dashboard/settings")} />
          <NavLink item={{ href: "/dashboard/help", label: "Help", short: "Help" }} collapsed={effectiveCollapsed} active={isActive(pathname, "/dashboard/help")} />
          {!isMobile && (
            <button
              onClick={toggleCollapsed}
              style={{
                width: "100%",
                background: "none",
                border: "none",
                color: "rgba(255,255,255,0.5)",
                fontSize: 12,
                padding: "10px 18px",
                textAlign: "left",
                cursor: "pointer",
              }}
            >
              {collapsed ? "»" : "« Collapse"}
            </button>
          )}
        </div>
      </nav>

      {/* Fixed top bar (Part 3): hamburger (mobile only) + global search + jellybeans */}
      <header
        style={{
          position: "fixed",
          top: 0,
          left: contentOffset,
          right: 0,
          minHeight: 56,
          background: "white",
          borderBottom: "1px solid #e2e2e5",
          display: "flex",
          alignItems: "center",
          gap: isMobile ? 10 : 16,
          padding: isMobile ? "8px 12px" : "0 20px",
          zIndex: 10,
          transition: "left 0.15s ease",
          flexWrap: "wrap",
        }}
      >
        {isMobile && (
          <>
            <button
              onClick={() => setMobileOpen(true)}
              aria-label="Open menu"
              style={{ background: "none", border: "1px solid #ddd", borderRadius: 8, padding: "6px 9px", fontSize: 15, cursor: "pointer", flexShrink: 0 }}
            >
              ☰
            </button>
            <Image src="/logo-64.png" alt="AngelClinic logo" width={26} height={26} style={{ borderRadius: 6, flexShrink: 0 }} />
          </>
        )}
        {!isMobile && (
          <input
            placeholder="Search patients by name, MRN, DOB, or phone…"
            disabled
            title="Turns on once Patient Management ships"
            style={{
              flex: 1,
              maxWidth: 420,
              padding: "8px 12px",
              borderRadius: 8,
              border: "1px solid #ddd",
              fontSize: 13,
              background: "#f7f7f8",
              color: "#999",
            }}
          />
        )}
        <div style={{ display: "flex", gap: 6, marginLeft: isMobile ? 0 : "auto", overflowX: "auto", flex: isMobile ? "1 1 auto" : "0 0 auto" }}>
          {JELLYBEANS.map((jb) => (
            <Link
              key={jb.key}
              href={jb.href}
              title={jb.label}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 4,
                padding: "5px 9px",
                borderRadius: 999,
                background: (jellybeanCounts[jb.key] ?? 0) > 0 ? "#0c1730" : "#f0f1f3",
                color: (jellybeanCounts[jb.key] ?? 0) > 0 ? "#e6c66b" : "#888",
                fontSize: 12,
                fontWeight: 700,
                textDecoration: "none",
                flexShrink: 0,
              }}
            >
              {jb.key} {jellybeanCounts[jb.key] ?? 0}
            </Link>
          ))}
        </div>
        {!isMobile && (
          <div style={{ fontSize: 12, color: "#888", borderLeft: "1px solid #eee", paddingLeft: 14, whiteSpace: "nowrap" }}>
            {clinicName} · {userLabel}
          </div>
        )}
      </header>

      <main
        style={{
          marginLeft: contentOffset,
          marginTop: isMobile ? 68 : 56,
          padding: isMobile ? 16 : 28,
          maxWidth: "100%",
          overflowX: "hidden",
          transition: "margin-left 0.15s ease",
        }}
      >
        {isMobile && (
          <div style={{ fontSize: 11.5, color: "#999", marginBottom: 12 }}>{clinicName} · {userLabel}</div>
        )}
        {children}
      </main>
    </div>
  );
}

function isActive(pathname: string | null, href: string) {
  if (!pathname) return false;
  if (href === "/dashboard") return pathname === "/dashboard";
  return pathname.startsWith(href);
}

function NavLink({ item, collapsed, active }: { item: NavItem; collapsed: boolean; active: boolean }) {
  return (
    <Link
      href={item.href}
      title={item.label}
      style={{
        display: "block",
        padding: collapsed ? "9px 0" : "9px 18px",
        textAlign: collapsed ? "center" : "left",
        fontSize: 13,
        fontWeight: active ? 700 : 500,
        color: active ? "#e6c66b" : "rgba(244,245,247,0.8)",
        background: active ? "rgba(230,198,107,0.1)" : "transparent",
        borderLeft: active ? "3px solid #e6c66b" : "3px solid transparent",
        textDecoration: "none",
      }}
    >
      {collapsed ? item.short : item.label}
    </Link>
  );
}
