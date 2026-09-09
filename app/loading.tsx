import { MyCareDeskLoader } from "@/components/loading/mycaredesk-loader";

// Next.js shows this automatically the instant navigation starts to any
// route under app/ that doesn't have its own more specific loading.tsx,
// while that route's server data is still being fetched — this is what
// gives "click a link -> immediate response" (spec §4-5) for the public
// site, auth pages, and anything else not covered by a nested loading.tsx
// below. It never shows for a fully static page (there's nothing to
// suspend on), so it can't flicker on pages that are already instant.
export default function RootLoading() {
  return (
    <div style={{ minHeight: "60vh", display: "flex", alignItems: "center", justifyContent: "center", background: "var(--brand-background, #f6f9fb)" }}>
      <MyCareDeskLoader size="lg" />
    </div>
  );
}
