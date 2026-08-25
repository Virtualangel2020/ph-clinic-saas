"use client";

import { usePathname } from "next/navigation";
import Link from "next/link";
import { BrandHeader } from "@/components/brand-header";
import { SignOutButton } from "@/app/portal/sign-out-button";

// Shared shell for every /portal/* page (spec §15's base Patient Portal
// architecture): a small tab strip so a patient can move between My
// Profile, My Appointments, My Forms, My Records, Records &
// Authorizations, My Results, and My Prescriptions without re-navigating
// through a menu each time. Deliberately plain — this is patient-facing,
// not staff tooling, so it stays lightweight rather than reusing the
// EmrShell sidebar.
const PORTAL_NAV = [
  { href: "/portal", label: "My Profile" },
  { href: "/portal/appointments", label: "My Appointments" },
  { href: "/portal/forms", label: "My Forms" },
  { href: "/portal/billing", label: "My Billing" },
  { href: "/portal/records", label: "My Records" },
  { href: "/portal/authorizations", label: "Records & Authorizations" },
  { href: "/portal/results", label: "My Results" },
  { href: "/portal/prescriptions", label: "My Prescriptions" },
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
                  color: active ? "#0c1730" : "#888",
                  fontWeight: active ? 700 : 500,
                  borderBottom: active ? "2px solid #0c1730" : "2px solid transparent",
                  whiteSpace: "nowrap",
                }}
              >
                {item.label}
              </Link>
            );
          })}
        </div>

        {children}
      </div>
    </div>
  );
}
