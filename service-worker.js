const APP_VERSION = "1";
const CACHE_NAME = `vault-cache-v${APP_VERSION}`;
const FILES_TO_CACHE = [
  "/",
  "/index.html",
  "/styles.css",
  "/js/app.js",
  "/js/pdf.min.js",
  "/js/pdf.worker.min.js",
  "/manifest.json",
  "/icons/192.png",
  "/icons/512.png",
  "/icons/maskable.png",
  "/icons/favicon.ico",
  "/images/1_add.png",
  "/images/2_search.png",
  "/images/3_manage.png",
  "/images/4_menu.png",
  "/images/5_json.png",
  "/images/6.png"
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(FILES_TO_CACHE))
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keyList) =>
      Promise.all(
        keyList.map((key) => {
          if (key !== CACHE_NAME) return caches.delete(key);
        })
      )
    )
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;

  event.respondWith(
    caches.match(event.request, { ignoreSearch: true }).then((cached) => {
      if (cached) return cached;

      return fetch(event.request)
        .then((response) => {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
          return response;
        })
        .catch(() => {
          if (event.request.destination === "document") {
            return caches.match("/index.html");
          }
          if (event.request.destination === "image") {
            return new Response(
              '<svg width="400" height="300" xmlns="http://www.w3.org/2000/svg"><rect width="400" height="300" fill="#ccc"/><text x="50%" y="50%" dominant-baseline="middle" text-anchor="middle" fill="#555" font-size="20">Offline</text></svg>',
              { headers: { "Content-Type": "image/svg+xml" } }
            );
          }
        });
    })
  );
});

self.addEventListener("message", (event) => {
  if (event.data === "SKIP_WAITING") self.skipWaiting();
});
