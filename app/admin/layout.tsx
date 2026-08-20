import type { Metadata } from "next";
import Link from "next/link";
import { BrandHeader } from "@/components/brand-header";
import { InstallPwaButton } from "@/components/install-pwa-button";
import { UnreadBadge } from "@/components/unread-badge";
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
  { href: "/admin/site-content", label: "Site Content" },
  { href: "/admin/demo-requests", label: "Demo Requests" },
  { href: "/admin/providers-directory", label: "Provider Directory" },
  { href: "/admin/customer-care", label: "Customer Care" },
  { href: "/admin/settings", label: "Settings" },
];

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const { supabase, profile } = await requireAdmin();

  const { count: unreadSupportCount } = await supabase
    .from("support_messages")
    .select("id", { count: "exact", head: true })
    .eq("sender_type", "clinic")
    .is("read_at", null);

  return (
    <div style={{ minHeight: "100vh" }}>
      <header
        style={{
          background: "#0c1730",
          color: "white",
          padding: "14px 20px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          flexWrap: "wrap",
          rowGap: 10,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 20, flexWrap: "wrap", rowGap: 10 }}>
          <div style={{ color: "white" }}>
            <BrandHeader subtitle="Super Admin" />
          </div>
          <nav style={{ display: "flex", gap: 14, flexWrap: "wrap", rowGap: 6 }}>
            {NAV.map((n) => (
              <Link key={n.href} href={n.href} style={{ position: "relative", color: "#e6c66b", fontSize: 13.5, textDecoration: "none", whiteSpace: "nowrap" }}>
                {n.label}
                {n.href === "/admin/customer-care" && (
                  <UnreadBadge count={unreadSupportCount ?? 0} style={{ top: -8, right: -14 }} />
                )}
              </Link>
            ))}
          </nav>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap" }}>
          <InstallPwaButton label="Install Admin app" />
          <div style={{ fontSize: 13, color: "#b9c2d6" }}>{profile.full_name || "Platform Admin"}</div>
        </div>
      </header>
      <main style={{ maxWidth: 1100, margin: "0 auto", padding: "24px 16px", overflowX: "hidden" }}>{children}</main>
    </div>
  );
}
