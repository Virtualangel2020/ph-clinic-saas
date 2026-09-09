import { SkeletonBlock, SkeletonTable } from "@/components/loading/skeleton";

export default function ResultsLoading() {
  return (
    <div className="mcd-fade-in">
      <SkeletonBlock width={120} height={22} style={{ marginBottom: 16 }} />
      <SkeletonTable rows={7} columns={5} />
    </div>
  );
}
