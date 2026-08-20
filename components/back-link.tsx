import Link from "next/link";

// One consistent "go back" affordance used across every drill-down page —
// Superadmin client detail, EMR settings sub-pages, module placeholders —
// so navigating "into" something always has an obvious way back out,
// instead of relying on the browser's back button or hunting for the nav.
export function BackLink({ href, label }: { href: string; label: string }) {
  return (
    <Link
      href={href}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 4,
        fontSize: 13,
        color: "#666",
        textDecoration: "none",
        marginBottom: 14,
      }}
    >
      ← {label}
    </Link>
  );
}
