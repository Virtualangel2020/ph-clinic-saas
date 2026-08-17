export const metadata = {
  title: "Angel Clinic — Smart Clinic. Better Care.",
  description:
    "Multi-tenant Philippine clinic management platform by Virtual Angel Systems.",
  icons: { icon: "/favicon.ico" },
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
