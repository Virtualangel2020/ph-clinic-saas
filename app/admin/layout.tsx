import type { Metadata } from "next";
import Link from "next/link";
import { BrandHeader } from "@/components/brand-header";
import { InstallPwaButton } from "@/components/install-pwa-button";
import { requireAdmin } from "@/lib/require-admin";

// Overrides the root manifest so /admin installs as its own app ("Angel
// Clinic — Super Admin"), separate from the clinic staff dashboard.
export const metadata: Metadata = {
  manifest: "/api/pwa/admin-manifest",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "AC Admin",
  },
};

const NAV = [
  { href: "/admin", label: "Dashboard" },
  { href: "/admin/clients", label: "Clients" },
  { href: "/admin/requests", label: "Requests" },
  { href: "/admin/promotions", label: "Promotions" },
  { href: "/admin/pricing", label: "Pricing" },
  { href: "/admin/faqs", label: "FAQ" },
  { href: "/admin/settings", label: "Settings" },
];

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const { profile } = await requireAdmin();

  return (
    <div style={{ minHeight: "100vh" }}>
      <header
        style={{
          background: "#0c1730",
          color: "white",
          padding: "14px 24px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 28 }}>
          <div style={{ color: "white" }}>
            <BrandHeader subtitle="Super Admin" />
          </div>
          <nav style={{ display: "flex", gap: 18 }}>
            {NAV.map((n) => (
              <Link key={n.href} href={n.href} style={{ color: "#e6c66b", fontSize: 14, textDecoration: "none" }}>
                {n.label}
              </Link>
            ))}
          </nav>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <InstallPwaButton label="Install Admin app" />
          <div style={{ fontSize: 13, color: "#b9c2d6" }}>{profile.full_name || "Platform Admin"}</div>
        </div>
      </header>
      <main style={{ maxWidth: 1100, margin: "0 auto", padding: "32px 24px" }}>{children}</main>
    </div>
  );
}
