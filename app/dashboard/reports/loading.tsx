import { SkeletonBlock, SkeletonStatCards, SkeletonTable } from "@/components/loading/skeleton";

export default function ReportsLoading() {
  return (
    <div className="mcd-fade-in" style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <SkeletonBlock width={160} height={22} />
      <SkeletonStatCards count={4} />
      <SkeletonTable rows={6} columns={4} />
    </div>
  );
}
