import { SkeletonBlock } from "@/components/loading/skeleton";

export default function CalendarLoading() {
  return (
    <div className="mcd-fade-in">
      <SkeletonBlock width={180} height={22} style={{ marginBottom: 16 }} />
      <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 8 }}>
        {Array.from({ length: 7 }).map((_, i) => (
          <SkeletonBlock key={i} height={260} radius={10} />
        ))}
      </div>
    </div>
  );
}
