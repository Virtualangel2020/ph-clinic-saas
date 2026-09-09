import { SkeletonBlock, SkeletonList } from "@/components/loading/skeleton";

export default function PrescriptionsLoading() {
  return (
    <div className="mcd-fade-in">
      <SkeletonBlock width={180} height={22} style={{ marginBottom: 16 }} />
      <SkeletonList rows={7} />
    </div>
  );
}
