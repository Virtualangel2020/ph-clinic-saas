"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { LoadingOverlay } from "./loading-overlay";

// Spec §4-5: clicking a nav tab must show *something* branded immediately,
// not just on a hard refresh. Next's own per-route loading.tsx only fires
// reliably when the destination's data genuinely isn't ready yet — once a
// route has been visited this session, Next's client router cache can (and
// does, within its default ~30s window) serve the cached RSC payload
// instantly, so the tab appears to change with no loading state at all.
// That's correct/fast behavior, but it left navigation feeling like
// nothing happened, which is exactly what was reported.
//
// This indicator is independent of that cache: it flips on the instant a
// real in-app link is clicked (a plain DOM click listener, not tied to
// data-fetching) and flips off the instant the URL actually changes
// (usePathname/useSearchParams committing = the new route has taken over,
// whether that took 5ms from cache or 500ms from the network). So the
// branded loader is guaranteed to appear on every tab change, even a fast
// one — briefly for a cached tab, longer for a genuinely slow one — and a
// failsafe timeout means it can never spin forever if a navigation is
// cancelled or errors out (spec §8).
//
// Deliberately non-fullscreen: it covers only the content area it's
// mounted inside (the nearest `position: relative` ancestor — each shell
// wraps its main content region with one), so the sidebar/top bar/tab
// strip stay visible and clickable the whole time, per spec §4's "show
// page structure immediately."
function NavigationLoadingIndicatorInner() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [navigating, setNavigating] = useState(false);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // The URL actually changed — the destination has taken over (with
  // whatever it wants to show, cached content, its own skeleton, or fully
  // loaded content). Hide immediately; there's nothing left to bridge.
  useEffect(() => {
    setNavigating(false);
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname, searchParams?.toString()]);

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const anchor = (e.target as HTMLElement)?.closest?.("a");
      if (!anchor) return;
      if (anchor.target && anchor.target !== "_self") return;
      if (anchor.hasAttribute("download")) return;
      const href = anchor.getAttribute("href");
      if (!href || href.startsWith("#") || href.startsWith("mailto:") || href.startsWith("tel:")) return;

      let url: URL;
      try {
        url = new URL(href, window.location.href);
      } catch {
        return;
      }
      if (url.origin !== window.location.origin) return;

      const currentKey = `${window.location.pathname}${window.location.search}`;
      const nextKey = `${url.pathname}${url.search}`;
      if (nextKey === currentKey) return; // re-clicking the tab you're already on — nothing will change

      setNavigating(true);
      // Failsafe (spec §8: never spin forever) — if the pathname/
      // searchParams effect above never fires for some reason (a
      // cancelled navigation, a client-side error), this clears the
      // overlay on its own rather than leaving it stuck.
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      timeoutRef.current = setTimeout(() => setNavigating(false), 8000);
    }
    document.addEventListener("click", onClick);
    return () => {
      document.removeEventListener("click", onClick);
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, []);

  if (!navigating) return null;
  return <LoadingOverlay status="loading" label="Loading..." fullscreen={false} />;
}

export function NavigationLoadingIndicator() {
  return (
    <Suspense fallback={null}>
      <NavigationLoadingIndicatorInner />
    </Suspense>
  );
}
