import { SkeletonBlock, SkeletonStatCards, SkeletonTable } from "@/components/loading/skeleton";

export default function FinancialsLoading() {
  return (
    <div className="mcd-fade-in" style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <SkeletonBlock width={160} height={22} />
      <SkeletonStatCards count={3} />
      <SkeletonTable rows={7} columns={5} />
    </div>
  );
}
