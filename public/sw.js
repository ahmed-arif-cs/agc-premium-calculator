/* AGC Premium Calculator service worker — offline-first app shell with network-first HTML. */
const CACHE = "agc-calc-v3";
const APP_SHELL = [
  "/",
  "/manifest.json",
  "/favicon.ico",
  "/icon-192.png",
  "/icon-512.png",
  "/icon-maskable-192.png",
  "/icon-maskable-512.png",
  "/apple-touch-icon.png",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE).then((cache) => cache.addAll(APP_SHELL)).then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))),
      )
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  // Navigations: network-first, fall back to cached shell when offline.
  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request)
        .then((response) => {
          const copy = response.clone();
          caches.open(CACHE).then((cache) => cache.put(request, copy));
          return response;
        })
        .catch(() => caches.match(request).then((r) => r || caches.match("/"))),
    );
    return;
  }

  // Only intercept real static sub-resources (scripts, styles, images,
  // fonts, the web manifest — anything with a non-empty `destination`).
  // A plain `fetch()`/XHR request — same-origin API routes such as
  // `/api/currency` (which already runs its own 1-hour TTL + live/
  // fallback/offline rate chain server-side) and `/api/auth/session`
  // (which `SessionProvider` relies on to reconcile Google/GitHub
  // sign-in state) — and Next.js App Router's own RSC data fetches for
  // client-side navigation (which reuse a page's URL but expect a
  // different, non-HTML payload than a full navigation to that same
  // URL) all have an empty `destination`. Letting the cache-first
  // branch below intercept those was a real bug: this cache never
  // expires entries, so the very first response ever fetched for a
  // path like `/api/currency` or `/api/auth/session` would be served
  // forever afterwards — permanently freezing exchange rates and
  // sign-in state — and an RSC payload cached under a page's URL could
  // later be served back for what should have been a full HTML
  // navigation to that same URL (or vice versa), since both share the
  // same cache key. Static sub-resources are unaffected by this guard.
  if (!request.destination) return;

  // Static assets: cache-first, then network (and cache runtime).
  event.respondWith(
    caches.match(request).then((cached) => {
      if (cached) return cached;
      return fetch(request)
        .then((response) => {
          if (response && response.status === 200 && response.type === "basic") {
            const copy = response.clone();
            caches.open(CACHE).then((cache) => cache.put(request, copy));
          }
          return response;
        })
        .catch(() => cached);
    }),
  );
});
