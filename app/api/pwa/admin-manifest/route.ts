import { NextResponse } from "next/server";

// Installable-app manifest for the Super Admin dashboard (/admin/*).
// Served separately from the root site manifest so this section can be
// "installed" on desktop/mobile as its own app, distinct from the clinic
// staff dashboard and the public marketing site.
export async function GET() {
  return NextResponse.json(
    {
      name: "MyCareDesk — Super Admin",
      short_name: "MCD Admin",
      description: "Super Admin dashboard for MyCareDesk by Virtual Angel Systems.",
      start_url: "/admin",
      scope: "/admin/",
      display: "standalone",
      orientation: "portrait-primary",
      background_color: "#14607f",
      theme_color: "#14607f",
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
