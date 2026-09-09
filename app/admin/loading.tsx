import { SkeletonBlock, SkeletonStatCards, SkeletonList } from "@/components/loading/skeleton";

// Renders inside the Super Admin header/nav (app/admin/layout.tsx stays
// mounted) the instant a Superadmin navigates between sections.
export default function AdminLoading() {
  return (
    <div className="mcd-fade-in" style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <SkeletonBlock width={160} height={22} />
      <SkeletonStatCards count={3} />
      <SkeletonList rows={6} />
    </div>
  );
}
