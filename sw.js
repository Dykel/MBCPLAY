/*!
 * MBCPLAY service worker
 * (c) Jonathan COLLET — MIT License
 *
 * Caches the app shell so the player opens instantly and installs as an app.
 * Live streams are never cached: they always go straight to the network.
 */
const VERSION = "v1";
const SHELL_CACHE = `mbcplay-shell-${VERSION}`;
const RUNTIME_CACHE = `mbcplay-runtime-${VERSION}`;

const SHELL = [
  "./",
  "index.html",
  "manifest.webmanifest",
  "assets/css/style.css",
  "assets/js/app.js",
  "assets/js/install.js",
  "assets/img/favicon.svg",
  "assets/img/icon-192.png",
  "assets/img/icon-512.png",
  "https://cdn.jsdelivr.net/npm/hls.js@1.5.13/dist/hls.min.js",
];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(SHELL_CACHE).then((cache) => cache.addAll(SHELL)));
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys
        .filter((key) => key.startsWith("mbcplay-") && ![SHELL_CACHE, RUNTIME_CACHE].includes(key))
        .map((key) => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

function isStream(url) {
  return /\.(m3u8|ts|aac|mp4|m4s)(\?|$)/i.test(url.pathname);
}

// Network first, falling back to the cache when offline.
async function networkFirst(request) {
  const cache = await caches.open(RUNTIME_CACHE);
  try {
    const response = await fetch(request);
    if (response.ok) cache.put(request, response.clone());
    return response;
  } catch (err) {
    return (await caches.match(request, { ignoreSearch: true }))
      || (request.mode === "navigate" && (await caches.match("./")))
      || Promise.reject(err);
  }
}

// Serve from cache immediately, refresh in the background.
async function staleWhileRevalidate(request) {
  const cache = await caches.open(RUNTIME_CACHE);
  const cached = (await caches.match(request));
  const refresh = fetch(request).then((response) => {
    if (response.ok || response.type === "opaque") cache.put(request, response.clone());
    return response;
  }).catch(() => cached);
  return cached || refresh;
}

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;
  const url = new URL(request.url);

  if (isStream(url)) return; // live video/audio: let the browser handle it

  // App files and the playlist: always fresh when online, so pushes to GitHub show up right away.
  if (url.origin === location.origin) {
    event.respondWith(networkFirst(request));
    return;
  }

  // Channel logos and the pinned hls.js build rarely change.
  if (request.destination === "image" || url.hostname === "cdn.jsdelivr.net") {
    event.respondWith(staleWhileRevalidate(request));
  }
});
