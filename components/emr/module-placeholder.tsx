import { BackLink } from "@/components/back-link";

// Shared shell for a nav item that's reachable but not built yet. Every
// EMR nav destination gets a real route from day one (Part 2's left nav is
// fixed/complete), even before its module ships — this is what renders
// until it does, so nothing 404s and it's always clear what's coming.
export function ModulePlaceholder({
  title,
  phase,
  blurb,
  backHref = "/dashboard",
  backLabel = "Dashboard",
}: {
  title: string;
  phase: string;
  blurb: string;
  backHref?: string;
  backLabel?: string;
}) {
  return (
    <div style={{ maxWidth: 640 }}>
      <BackLink href={backHref} label={backLabel} />
      <h1 style={{ fontSize: 22, marginBottom: 6 }}>{title}</h1>
      <div style={{ background: "var(--card-bg)", border: "1px solid var(--card-border)", borderRadius: 12, padding: 24 }}>
        <div style={{ display: "inline-block", fontSize: 11, fontWeight: 700, color: "#7a5c12", background: "#fff7e6", border: "1px solid #e6c66b", borderRadius: 999, padding: "3px 10px", marginBottom: 12 }}>
          {phase}
        </div>
        <p style={{ color: "#555", fontSize: 14, lineHeight: 1.6, margin: 0 }}>{blurb}</p>
      </div>
    </div>
  );
}
