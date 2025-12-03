const CACHE_NAME = "vault-cache-v12";
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
  "/icons/favicon.ico"
];


// Install: cache everything
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(FILES_TO_CACHE);
    })
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
  event.respondWith(
    caches.match(event.request).then((response) => {
      return response || fetch(event.request);
    })
  );
});
