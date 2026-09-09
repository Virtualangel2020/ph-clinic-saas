import { SkeletonBlock, SkeletonList } from "@/components/loading/skeleton";

export default function PatientChartLoading() {
  return (
    <div className="mcd-fade-in">
      <SkeletonBlock width={100} height={12} style={{ marginBottom: 14 }} />
      <SkeletonBlock width={220} height={26} style={{ marginBottom: 8 }} />
      <SkeletonBlock width={280} height={13} style={{ marginBottom: 20 }} />
      <div style={{ display: "flex", gap: 18, marginBottom: 18 }}>
        {Array.from({ length: 6 }).map((_, i) => (
          <SkeletonBlock key={i} width={70} height={14} />
        ))}
      </div>
      <SkeletonList rows={5} withAvatar={false} />
    </div>
  );
}
