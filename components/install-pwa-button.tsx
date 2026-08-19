"use client";

import { useEffect, useState } from "react";

// Registers the shared service worker once, then shows an "Install app"
// button wherever it's placed — using the manifest linked by the nearest
// layout (root, /admin, or /dashboard each link a different one, so the
// browser's install prompt offers the right app for that section).
export function InstallPwaButton({
  label = "Install app",
  style,
}: {
  label?: string;
  style?: React.CSSProperties;
}) {
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [installed, setInstalled] = useState(false);
  const [isIos, setIsIos] = useState(false);
  const [showIosHint, setShowIosHint] = useState(false);

  useEffect(() => {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch(() => {
        /* non-fatal: app still works, just without offline fallback */
      });
    }

    const standalone =
      window.matchMedia?.("(display-mode: standalone)").matches || (navigator as any).standalone === true;
    setInstalled(standalone);

    const ua = window.navigator.userAgent;
    setIsIos(/iphone|ipad|ipod/i.test(ua) && !(window as any).MSStream);

    function onBeforeInstallPrompt(e: any) {
      e.preventDefault();
      setDeferredPrompt(e);
    }
    function onInstalled() {
      setInstalled(true);
      setDeferredPrompt(null);
    }

    window.addEventListener("beforeinstallprompt", onBeforeInstallPrompt);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onBeforeInstallPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  if (installed) return null;
  if (!deferredPrompt && !isIos) return null;

  async function handleClick() {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      await deferredPrompt.userChoice;
      setDeferredPrompt(null);
      return;
    }
    if (isIos) setShowIosHint((v) => !v);
  }

  return (
    <div style={{ position: "relative", display: "inline-block" }}>
      <button
        onClick={handleClick}
        style={{
          padding: "6px 14px",
          borderRadius: 8,
          border: "1px solid #e6c66b",
          background: "transparent",
          color: "#e6c66b",
          fontWeight: 600,
          fontSize: 12,
          cursor: "pointer",
          ...style,
        }}
      >
        ⤓ {label}
      </button>
      {showIosHint && (
        <div
          style={{
            position: "absolute",
            top: "calc(100% + 8px)",
            right: 0,
            width: 220,
            background: "white",
            color: "#1a1a1a",
            borderRadius: 10,
            padding: 12,
            fontSize: 12,
            lineHeight: 1.5,
            boxShadow: "0 8px 24px rgba(0,0,0,0.25)",
            zIndex: 50,
          }}
        >
          On iPhone/iPad: tap the <strong>Share</strong> button, then{" "}
          <strong>Add to Home Screen</strong>.
        </div>
      )}
    </div>
  );
}
