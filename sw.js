const CACHE_NAME = "wikieditor-pwa-v1";
const CORE_ASSETS = [
  "/wiki/",
  "/wiki/index.html",
  "/wiki/viewer/index.html",
  "/wiki/editor/index.html",
  "/wiki/viewer.webmanifest",
  "/wiki/editor.webmanifest",
  "/wiki/css/common.css",
  "/wiki/shared/js/pwa.js",
  "/wiki/shared/js/csv.js",
  "/wiki/shared/js/i18n.js",
  "/wiki/shared/js/config.js",
  "/wiki/shared/js/api.js",
  "/wiki/shared/js/wiki-data.js",
  "/wiki/viewer/js/app.js",
  "/wiki/editor/js/app.js",
  "/wiki/icon/lightbringers-192.png",
  "/wiki/icon/lightbringers-512.png",
  "/wiki/icon/yelmalio-192.png",
  "/wiki/icon/yelmalio-512.png"
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(CORE_ASSETS)).then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            return caches.delete(key);
          }
          return Promise.resolve();
        })
      )
    ).then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") {
    return;
  }

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) {
    return;
  }

  if (!url.pathname.startsWith("/wiki/")) {
    return;
  }

  event.respondWith(
    caches.match(request).then((cachedResponse) => {
      if (cachedResponse) {
        return cachedResponse;
      }

      return fetch(request).then((networkResponse) => {
        if (!networkResponse || networkResponse.status !== 200) {
          return networkResponse;
        }

        const responseToCache = networkResponse.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(request, responseToCache));
        return networkResponse;
      }).catch(() => {
        if (request.mode === "navigate") {
          if (url.pathname.startsWith("/wiki/editor/")) {
            return caches.match("/wiki/editor/index.html");
          }
          return caches.match("/wiki/index.html");
        }

        return new Response("Offline", {
          status: 503,
          statusText: "Offline",
        });
      });
    })
  );
});
