import { MyCareDeskLoader } from "@/components/loading/mycaredesk-loader";

// The Patient Portal skews toward simple, single-purpose screens (book,
// pay, view results) rather than dense lists, so a small centered branded
// loader reads better here than a skeleton shaped for a specific layout.
export default function PortalLoading() {
  return (
    <div className="mcd-fade-in" style={{ minHeight: "40vh", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <MyCareDeskLoader size="md" />
    </div>
  );
}
