const CACHE_NAME = 'porezator-v3';
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/offline-core.js',
  '/favicon.ico',
  '/favicon.svg',
  '/favicon-96x96.png',
  '/robots.txt',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(STATIC_ASSETS))
  );
});

self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
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
  const { request } = event;

  if (request.method !== 'GET') {
    return;
  }

  // API calls: let the browser handle them normally
  if (request.url.includes('/api/')) {
    return;
  }

  // Same-origin static assets: stale-while-revalidate with cache fallback.
  event.respondWith((async () => {
    const cache = await caches.open(CACHE_NAME);
    const cached = await cache.match(request);

    const networkFetch = fetch(request).then((response) => {
      if (response.ok && request.url.startsWith(self.location.origin)) {
        cache.put(request, response.clone());
      }
      return response;
    }).catch(() => null);

    if (cached) {
      event.waitUntil(networkFetch);
      return cached;
    }

    const response = await networkFetch;
    return response || Response.error();
  })());
});
