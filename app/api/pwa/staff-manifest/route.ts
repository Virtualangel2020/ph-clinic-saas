import { NextResponse } from "next/server";

// Installable-app manifest for the clinic staff dashboard (/dashboard/*).
export async function GET() {
  return NextResponse.json(
    {
      name: "Angel Clinic — Staff",
      short_name: "AC Staff",
      description: "Clinic staff dashboard for Angel Clinic by Virtual Angel Systems.",
      start_url: "/dashboard",
      scope: "/dashboard/",
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
