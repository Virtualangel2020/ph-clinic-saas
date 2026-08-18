import type { Metadata, Viewport } from "next";

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

export const viewport: Viewport = {
  themeColor: "#0c1730",
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
        }}
      >
        {children}
      </body>
    </html>
  );
}
