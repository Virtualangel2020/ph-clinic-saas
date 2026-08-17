import Link from "next/link";
import { BrandHeader } from "@/components/brand-header";
import { requireAdmin } from "@/lib/require-admin";

const NAV = [
  { href: "/admin", label: "Dashboard" },
  { href: "/admin/clients", label: "Clients" },
  { href: "/admin/requests", label: "Requests" },
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
        <div style={{ fontSize: 13, color: "#b9c2d6" }}>{profile.full_name || "Platform Admin"}</div>
      </header>
      <main style={{ maxWidth: 1100, margin: "0 auto", padding: "32px 24px" }}>{children}</main>
    </div>
  );
}
