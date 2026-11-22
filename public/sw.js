const CACHE_NAME = 'tekfikir-iot-v4';
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/manifest.webmanifest',
  '/css/tokens.css',
  '/css/base.css',
  '/css/components.css',
  '/js/app.js',
  '/js/components.js',
  '/js/icons.js',
  '/js/state.js',
  '/img/favicon.svg',
  '/img/logo-mini.svg',
  '/img/icon-192.png',
  '/img/icon-512.png',
  '/fonts/plus-jakarta-sans-latin.woff2',
  '/fonts/plus-jakarta-sans-latin-ext.woff2',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => cache.addAll(STATIC_ASSETS))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key)))
      )
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);

  // API ve WebSocket isteklerini her zaman doğrudan ağdan geçir
  if (url.pathname.startsWith('/api/') || url.pathname.startsWith('/ws/')) {
    return;
  }

  // Stale-While-Revalidate: Statik dosyaları telefondaki önbellekten 0ms'de anında aç, arka planda sessizce güncelle
  event.respondWith(
    caches.open(CACHE_NAME).then((cache) =>
      cache.match(request).then((cachedResponse) => {
        const fetchPromise = fetch(request)
          .then((networkResponse) => {
            if (networkResponse && networkResponse.status === 200 && networkResponse.type === 'basic') {
              cache.put(request, networkResponse.clone());
            }
            return networkResponse;
          })
          .catch(() => cachedResponse);

        return cachedResponse || fetchPromise;
      })
    )
  );
});
