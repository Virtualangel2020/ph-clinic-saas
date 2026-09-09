import { SkeletonBlock, SkeletonList } from "@/components/loading/skeleton";

export default function EncountersLoading() {
  return (
    <div className="mcd-fade-in">
      <SkeletonBlock width={160} height={22} style={{ marginBottom: 16 }} />
      <SkeletonList rows={7} />
    </div>
  );
}
