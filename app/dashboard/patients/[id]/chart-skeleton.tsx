import { SkeletonBlock, SkeletonList } from "@/components/loading/skeleton";

// The patient-chart-shaped skeleton (title bar + tab strip + a few rows),
// shared by two different loading paths that both need it:
//  1. app/dashboard/patients/[id]/loading.tsx — Next's automatic fallback
//     for the standalone chart route.
//  2. app/dashboard/patients/page.tsx — an explicit <Suspense> fallback for
//     the master-detail right pane, which Next's file-based loading.tsx
//     does NOT cover (searchParams-only navigations, like clicking a
//     different "Recent Patient", don't retrigger the route's loading.tsx —
//     only an explicit, re-keyed Suspense boundary around the async pane
//     does). Keeping one component means both places show the exact same
//     branded placeholder instead of drifting apart.
export function PatientChartSkeleton({ withBackLink = true }: { withBackLink?: boolean }) {
  return (
    <div className="mcd-fade-in">
      {withBackLink && <SkeletonBlock width={100} height={12} style={{ marginBottom: 14 }} />}
      <SkeletonBlock width={220} height={26} style={{ marginBottom: 8 }} />
      <SkeletonBlock width={280} height={13} style={{ marginBottom: 20 }} />
      <div style={{ display: "flex", gap: 18, marginBottom: 18, flexWrap: "wrap" }}>
        {Array.from({ length: 6 }).map((_, i) => (
          <SkeletonBlock key={i} width={70} height={14} />
        ))}
      </div>
      <SkeletonList rows={5} withAvatar={false} />
    </div>
  );
}
