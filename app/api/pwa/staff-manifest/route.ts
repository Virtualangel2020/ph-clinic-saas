import { NextResponse } from "next/server";

// Installable-app manifest for the clinic staff dashboard (/dashboard/*).
export async function GET() {
  return NextResponse.json(
    {
      name: "MyCareDesk — Staff",
      short_name: "MCD Staff",
      description: "Clinic staff dashboard for MyCareDesk by Virtual Angel Systems.",
      start_url: "/dashboard",
      scope: "/dashboard/",
      display: "standalone",
      orientation: "portrait-primary",
      background_color: "#14607f",
      theme_color: "#14607f",
      // ?v=2 cache-busts these icons for anyone reinstalling the app.
      icons: [
        { src: "/icons/icon-192.png?v=2", sizes: "192x192", type: "image/png", purpose: "any" },
        { src: "/icons/icon-512.png?v=2", sizes: "512x512", type: "image/png", purpose: "any" },
        { src: "/icons/icon-maskable-192.png?v=2", sizes: "192x192", type: "image/png", purpose: "maskable" },
        { src: "/icons/icon-maskable-512.png?v=2", sizes: "512x512", type: "image/png", purpose: "maskable" },
      ],
    },
    { headers: { "Content-Type": "application/manifest+json" } }
  );
}
