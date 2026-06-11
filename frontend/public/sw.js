// Bump the version suffix whenever the cache schema changes so stale entries
// (e.g. a cached "/" shell from before the app moved under /app) get evicted.
const SHELL_CACHE = "splex-shell-v3";
const ASSETS_CACHE = "splex-assets-v3";

// The app is served under /app (expo.experiments.baseUrl). This service worker
// is served from /app/sw.js, so its default scope is /app/ — it only controls
// the app, never the marketing landing page at "/". Keep these in sync with
// public/manifest.webmanifest and frontend/app.json.
const BASE_PATH = "/app";

// Paths the service worker must NEVER intercept. The admin UI is server-rendered
// by Django; Django collectstatic serves /static/ via whitenoise. If we cached
// these as the SPA shell, the SPA router would later "redirect to /" because the
// path isn't a known SPA route.
function isServerRendered(pathname) {
  return pathname.startsWith("/admin/") || pathname === "/admin" || pathname.startsWith("/static/");
}

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(SHELL_CACHE)
      .then((cache) =>
        cache.addAll([
          `${BASE_PATH}/`,
          `${BASE_PATH}/index.html`,
          `${BASE_PATH}/favicon.ico`,
          `${BASE_PATH}/login/magic`,
          `${BASE_PATH}/+not-found`
        ])
      )
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((key) => ![SHELL_CACHE, ASSETS_CACHE].includes(key))
          .map((key) => caches.delete(key))
      ).then(() => self.clients.claim())
    )
  );
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  if (isServerRendered(url.pathname)) return;

  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request)
        .then((response) => {
          const copy = response.clone();
          caches.open(SHELL_CACHE).then((cache) => cache.put(request, copy));
          return response;
        })
        .catch(async () => {
          const cached = await caches.match(request);
          if (cached) return cached;
          return caches.match(`${BASE_PATH}/`);
        })
    );
    return;
  }

  const isStaticAsset =
    url.pathname.startsWith(`${BASE_PATH}/_expo/`) ||
    url.pathname.startsWith(`${BASE_PATH}/assets/`) ||
    url.pathname === `${BASE_PATH}/favicon.ico`;

  if (!isStaticAsset) return;

  event.respondWith(
    caches.open(ASSETS_CACHE).then(async (cache) => {
      const cached = await cache.match(request);
      const networkFetch = fetch(request)
        .then((response) => {
          cache.put(request, response.clone());
          return response;
        })
        .catch(() => cached);
      return cached || networkFetch;
    })
  );
});

self.addEventListener("push", (event) => {
  const data = event.data ? event.data.json() : {};
  const title = data.title || "Splex";
  const options = {
    body: data.body || "",
    data: data.payload || {}
  };
  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  // Always land inside the app (/app), never the marketing landing at "/".
  // Honor an optional deep-link path from the push payload (e.g. "/groups/1").
  const target = event.notification.data?.url;
  const url =
    typeof target === "string" && target.startsWith("/")
      ? `${BASE_PATH}${target}`
      : `${BASE_PATH}/`;
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clients) => {
      if (clients.length > 0) {
        return clients[0].focus();
      }
      return self.clients.openWindow(url);
    })
  );
});
