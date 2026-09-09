// Skeleton placeholders (spec §3D, §4): used inside route-level
// loading.tsx files and inside list/table sections so navigating to a page
// shows its structure immediately instead of a blank white screen while
// data fetches. Server-renderable (no "use client" needed — these are
// static markup + a CSS animation class), so they work directly inside
// Next's automatic loading.tsx boundaries.

export function SkeletonBlock({ width = "100%", height = 14, radius = 6, style }: { width?: number | string; height?: number; radius?: number; style?: React.CSSProperties }) {
  return <div className="mcd-shimmer" style={{ width, height, borderRadius: radius, ...style }} />;
}

export function SkeletonCircle({ size = 36 }: { size?: number }) {
  return <div className="mcd-shimmer" style={{ width: size, height: size, borderRadius: "50%", flexShrink: 0 }} />;
}

// One row of a list — an avatar-ish circle plus two lines of text, the
// shape most patient/appointment/message list rows share.
export function SkeletonRow({ withAvatar = true }: { withAvatar?: boolean }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 0", borderBottom: "1px solid var(--card-border, #e2e2e5)" }}>
      {withAvatar && <SkeletonCircle />}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 8 }}>
        <SkeletonBlock width="40%" height={13} />
        <SkeletonBlock width="65%" height={11} />
      </div>
    </div>
  );
}

export function SkeletonList({ rows = 6, withAvatar = true }: { rows?: number; withAvatar?: boolean }) {
  return (
    <div>
      {Array.from({ length: rows }).map((_, i) => (
        <SkeletonRow key={i} withAvatar={withAvatar} />
      ))}
    </div>
  );
}

// A grid of stat/summary cards, e.g. the dashboard's top row of widgets.
export function SkeletonStatCards({ count = 4 }: { count?: number }) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: `repeat(auto-fit, minmax(200px, 1fr))`, gap: 14 }}>
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} style={{ background: "var(--card-bg, #fff)", border: "1px solid var(--card-border, #e2e2e5)", borderRadius: 10, padding: 16 }}>
          <SkeletonBlock width="50%" height={11} style={{ marginBottom: 10 }} />
          <SkeletonBlock width="35%" height={22} />
        </div>
      ))}
    </div>
  );
}

// A simple table skeleton for billing/reports/analytics-style grids.
export function SkeletonTable({ rows = 6, columns = 4 }: { rows?: number; columns?: number }) {
  return (
    <div style={{ border: "1px solid var(--card-border, #e2e2e5)", borderRadius: 10, overflow: "hidden" }}>
      {Array.from({ length: rows }).map((_, r) => (
        <div
          key={r}
          style={{
            display: "grid",
            gridTemplateColumns: `repeat(${columns}, 1fr)`,
            gap: 12,
            padding: "12px 16px",
            borderBottom: r === rows - 1 ? "none" : "1px solid var(--card-border, #e2e2e5)",
          }}
        >
          {Array.from({ length: columns }).map((_, c) => (
            <SkeletonBlock key={c} height={12} width={c === 0 ? "80%" : "55%"} />
          ))}
        </div>
      ))}
    </div>
  );
}

// A generic page shell: a title-sized bar plus a card — the safe default
// for any route-level loading.tsx that doesn't have a more specific shape
// built for it yet.
export function SkeletonPage({ children }: { children?: React.ReactNode }) {
  return (
    <div style={{ padding: "24px 16px", maxWidth: 1100, margin: "0 auto" }} className="mcd-fade-in">
      <SkeletonBlock width={180} height={22} style={{ marginBottom: 18 }} />
      {children ?? <SkeletonList rows={5} />}
    </div>
  );
}
