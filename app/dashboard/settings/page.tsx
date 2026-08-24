import Link from "next/link";
import { requireClinicMember } from "@/lib/require-clinic-member";
import { UnreadBadge } from "@/components/unread-badge";

// Organized settings categories (Part 76) rather than one giant page.
// Each links to its own dedicated page — built ones are real, the rest are
// clearly-labeled placeholders (see /dashboard/settings/<x>) until their
// phase ships.
const SECTIONS: { title: string; items: { href: string; label: string; desc: string }[] }[] = [
  // Customer Care is inserted into "Account" below at render time (it needs
  // a live unread-message count, unlike the static entries here).
  {
    title: "Clinic",
    items: [
      { href: "/dashboard/settings/clinic-profile", label: "Clinic Profile & Branding", desc: "Name, logo, address, contact — auto-applied to every document." },
      { href: "/dashboard/settings/schedules", label: "Schedules", desc: "Provider working hours and availability." },
      { href: "/dashboard/settings/calendar", label: "Calendar", desc: "Appointment types, colors, and availability colors." },
    ],
  },
  {
    title: "People",
    items: [
      { href: "/dashboard/settings/providers", label: "Providers & Credentials", desc: "PRC/PTR, specialty, and signature approval." },
      { href: "/dashboard/settings/users", label: "Users & Permissions", desc: "Invite staff and control what each person can do." },
    ],
  },
  {
    title: "Clinical setup",
    items: [
      { href: "/dashboard/settings/note-templates", label: "Progress Note Templates", desc: "SOAP, Expanded, or your own custom note format." },
      { href: "/dashboard/settings/medical-certificates", label: "Medical Certificates", desc: "Template builder for your clinic's medical certificate." },
      { href: "/dashboard/settings/forms", label: "Forms & Registration", desc: "Patient intake forms and consent/acknowledgement templates." },
      { href: "/dashboard/settings/referral-directory", label: "Referral Directory Profile", desc: "How your clinic appears to other AngelClinic providers." },
    ],
  },
  {
    title: "Account",
    items: [
      { href: "/dashboard/billing", label: "Subscription & Billing", desc: "Your plan, add-ons, and invoices." },
      { href: "/dashboard/settings/customer-care", label: "Customer Care", desc: "Message the Virtual Angel Systems support team." },
      { href: "/dashboard/settings/notifications", label: "Notifications", desc: "Which events raise an alert." },
      { href: "/dashboard/settings/appearance", label: "Appearance", desc: "Light, dark, or system theme." },
      { href: "/dashboard/settings/language", label: "Language", desc: "Interface language." },
      { href: "/dashboard/settings/security", label: "Security", desc: "Password policy and session settings." },
    ],
  },
];

export default async function SettingsHubPage() {
  const { supabase, profile } = await requireClinicMember();

  // Only shows a count when Customer Care is actually entitled — an
  // unentitled tenant has no support_messages rows to begin with, so this
  // naturally comes back 0/empty for them.
  const { count: unreadCount } = await supabase
    .from("support_messages")
    .select("id", { count: "exact", head: true })
    .eq("tenant_id", profile.tenant_id)
    .eq("sender_type", "platform")
    .is("read_at", null);

  return (
    <div style={{ maxWidth: 880 }}>
      <h1 style={{ fontSize: 22, marginBottom: 4 }}>Settings</h1>
      <p style={{ color: "#666", fontSize: 13, marginBottom: 24 }}>Everything that configures how your clinic runs.</p>

      {SECTIONS.map((section) => (
        <div key={section.title} style={{ marginBottom: 28 }}>
          <h2 style={{ fontSize: 13, color: "#888", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 10 }}>{section.title}</h2>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 12 }}>
            {section.items.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                style={{ display: "block", position: "relative", background: "var(--card-bg)", border: "1px solid var(--card-border)", borderRadius: 10, padding: 16, textDecoration: "none" }}
              >
                {item.href === "/dashboard/settings/customer-care" && <UnreadBadge count={unreadCount ?? 0} />}
                <div style={{ fontWeight: 700, fontSize: 14, color: "var(--text-heading)", marginBottom: 4 }}>{item.label}</div>
                <div style={{ fontSize: 12, color: "#888" }}>{item.desc}</div>
              </Link>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
