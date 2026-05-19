self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open("splex-shell-v1")
      .then((cache) => cache.addAll(["/", "/index.html", "/favicon.ico", "/login/magic", "/+not-found"]))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((key) => !["splex-shell-v1", "splex-assets-v1"].includes(key))
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

  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request)
        .then((response) => {
          const copy = response.clone();
          caches.open("splex-shell-v1").then((cache) => cache.put(request, copy));
          return response;
        })
        .catch(async () => {
          const cached = await caches.match(request);
          if (cached) return cached;
          return caches.match("/");
        })
    );
    return;
  }

  const isStaticAsset =
    url.pathname.startsWith("/_expo/") ||
    url.pathname.startsWith("/assets/") ||
    url.pathname === "/favicon.ico";

  if (!isStaticAsset) return;

  event.respondWith(
    caches.open("splex-assets-v1").then(async (cache) => {
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
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clients) => {
      if (clients.length > 0) {
        return clients[0].focus();
      }
      return self.clients.openWindow("/");
    })
  );
});
