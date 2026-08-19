import type { MetadataRoute } from "next";

// Root manifest — covers the public marketing/pricing/request-access site
// and anything not under /admin or /dashboard (those have their own
// manifests at /api/pwa/admin-manifest and /api/pwa/staff-manifest so each
// section installs as its own distinct app).
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Angel Clinic",
    short_name: "Angel Clinic",
    description: "Angel Clinic by Virtual Angel Systems — Smart Clinic. Better Care.",
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "portrait-primary",
    background_color: "#0c1730",
    theme_color: "#0c1730",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/icon-maskable-192.png", sizes: "192x192", type: "image/png", purpose: "maskable" },
      { src: "/icons/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
