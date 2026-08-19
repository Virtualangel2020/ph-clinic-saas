// Shared shell for a nav item that's reachable but not built yet. Every
// EMR nav destination gets a real route from day one (Part 2's left nav is
// fixed/complete), even before its module ships — this is what renders
// until it does, so nothing 404s and it's always clear what's coming.
export function ModulePlaceholder({ title, phase, blurb }: { title: string; phase: string; blurb: string }) {
  return (
    <div style={{ maxWidth: 640 }}>
      <h1 style={{ fontSize: 22, marginBottom: 6 }}>{title}</h1>
      <div style={{ background: "white", border: "1px solid #e2e2e5", borderRadius: 12, padding: 24 }}>
        <div style={{ display: "inline-block", fontSize: 11, fontWeight: 700, color: "#7a5c12", background: "#fff7e6", border: "1px solid #e6c66b", borderRadius: 999, padding: "3px 10px", marginBottom: 12 }}>
          {phase}
        </div>
        <p style={{ color: "#555", fontSize: 14, lineHeight: 1.6, margin: 0 }}>{blurb}</p>
      </div>
    </div>
  );
}
