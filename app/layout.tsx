import type { Metadata, Viewport } from "next";
import { AuthErrorBanner } from "@/components/auth-error-banner";
import "./globals.css";

export const metadata: Metadata = {
  title: "MyCareDesk — Smart Clinic. Better Care.",
  description:
    "Multi-tenant Philippine clinic management platform by Virtual Angel Systems.",
  // app/manifest.ts auto-links /manifest.webmanifest here. The /admin and
  // /dashboard layouts each override this with their own manifest so those
  // sections install as separate apps.
  // ?v=2 cache-busts the icon files: browsers (and Windows' installed-PWA
  // icon cache) hold onto a favicon far more stubbornly than normal page
  // assets, sometimes keeping the very first icon they ever saw even after
  // the underlying file is corrected. Bump this suffix any time the icon
  // artwork itself changes again.
  icons: {
    icon: "/favicon.ico?v=2",
    apple: "/icons/apple-touch-icon.png?v=2",
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "MyCareDesk",
  },
};

// Explicit width/initialScale — without these, some mobile browsers fall
// back to rendering the page at a desktop-width virtual viewport (~980px)
// and zooming it out to fit the screen, which is what made the logo and
// other elements look tiny/cut-off on phones rather than laid out for
// their actual screen width.
export const viewport: Viewport = {
  themeColor: "#0f5a8c",
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
