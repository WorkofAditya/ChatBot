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
  "/images/1_add.png"
  "/images/2_search.png"
  "/images/3_manage.png"
  "/images/4_menu.png"
  "/images/5_json.png"
  "/images/6.png"
];


// Install: cache everything
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(FILES_TO_CACHE))
  );
  self.skipWaiting();
});

// Activate: clean up old caches
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keyList) =>
      Promise.all(
        keyList.map((key) => {
          if (key !== CACHE_NAME) {
            return caches.delete(key);
          }
        })
      )
    )
  );
  self.clients.claim();
});

// Fetch: serve from cache when offline
self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;

  event.respondWith(
    fetch(event.request)
      .then((response) => {
        const resClone = response.clone();
        caches.open(CACHE_NAME).then((cache) => {
          cache.put(event.request, resClone);
        });
        return response;
      })
      .catch(() => caches.match(event.request))
  );
});
