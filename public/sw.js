// Minimal service worker — makes the app installable and shows a branded
// offline page when there's no connection. Deliberately does NOT cache
// JS/CSS bundles or API responses: this app deploys often, and aggressively
// caching build output is the classic cause of a PWA getting "stuck" on an
// old version. Navigation requests always go to the network first.

const CACHE = "angel-clinic-shell-v1";
const SHELL_ASSETS = ["/offline.html", "/icons/icon-192.png"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE).then((cache) => cache.addAll(SHELL_ASSETS)).then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;

  // Only intercept page navigations; let every other request (JS, CSS,
  // API calls, Supabase requests) go straight to the network untouched.
  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request).catch(() => caches.match("/offline.html").then((res) => res || Response.error()))
    );
  }
});
