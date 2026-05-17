/* VoidHop service worker.
 *
 * Strategy:
 *   - /api/*               → network-only. The API is the single source of
 *                            truth for crypto blobs; stale reads are unsafe.
 *   - /assets/*  (hashed)  → cache-first with runtime write. Filenames are
 *                            content-hashed, so a content change means a new
 *                            URL — cached entries can never go stale.
 *   - navigate  (HTML)     → network-first, fall back to cached `/` so the
 *                            SPA still opens offline.
 *   - else                 → passthrough.
 *
 * Bump CACHE_VERSION whenever a precached resource (manifest, icons,
 * favicon, or the app shell at `/`) changes.
 */

const CACHE_VERSION = "voidhop-v1";
const PRECACHE = `${CACHE_VERSION}-precache`;
const RUNTIME = `${CACHE_VERSION}-runtime`;

const PRECACHE_URLS = [
  "/",
  "/manifest.webmanifest",
  "/favicon.svg",
  "/favicon.ico",
  "/favicon-32x32.png",
  "/apple-touch-icon.png",
  "/icon-192.png",
  "/icon-512.png",
  "/maskable-512.png",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(PRECACHE);
      // Use individual adds so one missing icon doesn't fail the whole install.
      await Promise.all(
        PRECACHE_URLS.map((url) =>
          cache.add(url).catch(() => {
            /* tolerate missing precache entries */
          }),
        ),
      );
      await self.skipWaiting();
    })(),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(
        keys
          .filter((k) => k !== PRECACHE && k !== RUNTIME)
          .map((k) => caches.delete(k)),
      );
      await self.clients.claim();
    })(),
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  if (url.pathname.startsWith("/api/")) {
    // Network-only, no SW interference.
    return;
  }

  if (url.pathname.startsWith("/assets/")) {
    event.respondWith(cacheFirst(request));
    return;
  }

  if (request.mode === "navigate") {
    event.respondWith(navigationStrategy(request));
    return;
  }
});

async function cacheFirst(request) {
  const cache = await caches.open(RUNTIME);
  const cached = await cache.match(request);
  if (cached) return cached;
  const response = await fetch(request);
  if (response.ok) cache.put(request, response.clone());
  return response;
}

async function navigationStrategy(request) {
  try {
    const network = await fetch(request);
    return network;
  } catch {
    const cache = await caches.open(PRECACHE);
    const fallback = await cache.match("/");
    if (fallback) return fallback;
    return new Response("Offline", {
      status: 503,
      headers: { "Content-Type": "text/plain" },
    });
  }
}
