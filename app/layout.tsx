import type { Metadata, Viewport } from "next";
import { AuthErrorBanner } from "@/components/auth-error-banner";
import "./globals.css";

export const metadata: Metadata = {
  title: "Angel Clinic — Smart Clinic. Better Care.",
  description:
    "Multi-tenant Philippine clinic management platform by Virtual Angel Systems.",
  // app/manifest.ts auto-links /manifest.webmanifest here. The /admin and
  // /dashboard layouts each override this with their own manifest so those
  // sections install as separate apps.
  icons: {
    icon: "/favicon.ico",
    apple: "/icons/apple-touch-icon.png",
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Angel Clinic",
  },
};

// Explicit width/initialScale — without these, some mobile browsers fall
// back to rendering the page at a desktop-width virtual viewport (~980px)
// and zooming it out to fit the screen, which is what made the logo and
// other elements look tiny/cut-off on phones rather than laid out for
// their actual screen width.
export const viewport: Viewport = {
  themeColor: "#0c1730",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body
        style={{
          fontFamily: "system-ui, sans-serif",
          margin: 0,
          background: "#f7f7f8",
          color: "#1a1a1a",
          overflowX: "hidden",
          maxWidth: "100vw",
        }}
      >
        <AuthErrorBanner />
        {children}
      </body>
    </html>
  );
}
