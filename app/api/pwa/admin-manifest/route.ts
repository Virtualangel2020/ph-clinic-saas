import { NextResponse } from "next/server";

// Installable-app manifest for the Super Admin dashboard (/admin/*).
// Served separately from the root site manifest so this section can be
// "installed" on desktop/mobile as its own app, distinct from the clinic
// staff dashboard and the public marketing site.
export async function GET() {
  return NextResponse.json(
    {
      name: "Angel Clinic — Super Admin",
      short_name: "AC Admin",
      description: "Super Admin dashboard for Angel Clinic by Virtual Angel Systems.",
      start_url: "/admin",
      scope: "/admin/",
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
    },
    { headers: { "Content-Type": "application/manifest+json" } }
  );
}
