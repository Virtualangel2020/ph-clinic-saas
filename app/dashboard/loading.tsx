import { SkeletonStatCards, SkeletonBlock } from "@/components/loading/skeleton";

// Shown inside the EmrShell (the sidebar/header stay mounted and
// interactive — only this content area swaps in) the instant a staff
// member navigates to the dashboard while its widgets load, instead of a
// frozen previous page or a blank one (spec §4).
export default function DashboardLoading() {
  return (
    <div className="mcd-fade-in" style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <SkeletonBlock width={200} height={22} />
      <SkeletonStatCards count={4} />
      <SkeletonStatCards count={3} />
    </div>
  );
}
