import { SkeletonBlock } from "@/components/loading/skeleton";

export default function SettingsLoading() {
  return (
    <div className="mcd-fade-in" style={{ display: "flex", flexDirection: "column", gap: 12, maxWidth: 560 }}>
      <SkeletonBlock width={140} height={22} style={{ marginBottom: 8 }} />
      {Array.from({ length: 5 }).map((_, i) => (
        <SkeletonBlock key={i} height={40} radius={8} />
      ))}
    </div>
  );
}
