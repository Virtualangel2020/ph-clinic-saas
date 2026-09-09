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
const PORTAL_NAV = [
  { href: "/portal", label: "Home" },
  { href: "/portal/appointments", label: "Appointments" },
  { href: "/find-a-doctor", label: "Find a Doctor" },
  { href: "/portal/care", label: "My Care" },
  { href: "/portal/messages", label: "Messages" },
  { href: "/portal/profile", label: "Profile" },
];

export function PortalShell({ patientName, children }: { patientName?: string | null; children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <div style={{ minHeight: "100vh", background: "#f7f7f9" }}>
      <div style={{ maxWidth: 760, margin: "0 auto", padding: "24px 20px 60px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 18, flexWrap: "wrap", gap: 10 }}>
          <BrandHeader subtitle={patientName ? `Patient Portal — ${patientName}` : "Patient Portal"} />
          <SignOutButton />
        </div>

        <div style={{ display: "flex", gap: 4, overflowX: "auto", borderBottom: "1px solid #e2e2e2", marginBottom: 20, paddingBottom: 0 }}>
          {PORTAL_NAV.map((item) => {
            const active = item.href === "/portal" ? pathname === "/portal" : pathname.startsWith(item.href);
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
  );
}
