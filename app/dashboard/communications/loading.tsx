import { SkeletonBlock, SkeletonList } from "@/components/loading/skeleton";

export default function CommunicationsLoading() {
  return (
    <div className="mcd-fade-in">
      <SkeletonBlock width={140} height={22} style={{ marginBottom: 16 }} />
      <SkeletonList rows={6} />
    </div>
  );
}
