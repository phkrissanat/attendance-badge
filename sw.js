const CACHE_NAME = 'digital-badge-v1';
const ASSETS = [
  './',
  './index.html',
  './manifest.webmanifest',
  './icons/icon-192.png',
  './icons/icon-512.png',
  'https://cdnjs.cloudflare.com/ajax/libs/qrcodejs/1.0.0/qrcode.min.js'
];

// requests that should always try the network first, so a new deploy shows up
// immediately instead of waiting for the browser to notice this file changed
function isAlwaysFreshRequest(request) {
  if (request.mode === 'navigate') return true; // opening/reloading the app
  const url = new URL(request.url);
  return url.pathname.endsWith('/index.html') || url.pathname.endsWith('/manifest.webmanifest');
}

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS)).catch(() => {})
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;

  // network-first: always try to get the latest index.html/manifest when
  // online, only falling back to the cached copy if offline. This is what
  // fixes "edited the code but the phone still shows the old version" —
  // previously every page load used the cache in first without ever
  // checking whether the server had something newer.
  if (isAlwaysFreshRequest(event.request)) {
    event.respondWith(
      fetch(event.request)
        .then((res) => {
          const copy = res.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy)).catch(() => {});
          return res;
        })
        .catch(() => caches.match(event.request))
    );
    return;
  }

  // cache-first for everything else (icons, the qrcode.js library) — these
  // rarely change, so serving from cache keeps the app fast and usable offline
  event.respondWith(
    caches.match(event.request).then((cached) => {
      if (cached) return cached;
      return fetch(event.request)
        .then((res) => {
          const copy = res.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy)).catch(() => {});
          return res;
        })
        .catch(() => cached);
    })
  );
});
