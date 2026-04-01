const CACHE_VERSION = 'v1';
const STATIC_CACHE  = `aakaara-static-${CACHE_VERSION}`;
const IMAGE_CACHE   = `aakaara-images-${CACHE_VERSION}`;

const PRECACHE_URLS = [
  '/',
  '/index.html',
  '/styles.css',
  '/Script.js',
  '/favicon.svg',
  '/manifest.json'
];

// ── Install: pre-cache shell assets ──────────────────────────────
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(STATIC_CACHE)
      .then(cache => cache.addAll(PRECACHE_URLS))
      .then(() => self.skipWaiting())
  );
});

// ── Activate: purge old caches ────────────────────────────────────
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys
          .filter(k => k !== STATIC_CACHE && k !== IMAGE_CACHE)
          .map(k => caches.delete(k))
      )
    ).then(() => self.clients.claim())
  );
});

// ── Fetch ─────────────────────────────────────────────────────────
self.addEventListener('fetch', event => {
  const { request } = event;
  const url = new URL(request.url);

  // Only handle same-origin and CDN image requests
  if (request.method !== 'GET') return;

  // HTML pages → network-first (always fresh content)
  if (request.headers.get('Accept')?.includes('text/html')) {
    event.respondWith(
      fetch(request)
        .then(res => {
          const clone = res.clone();
          caches.open(STATIC_CACHE).then(c => c.put(request, clone));
          return res;
        })
        .catch(() => caches.match(request))
    );
    return;
  }

  // Images → cache-first
  if (request.destination === 'image' || /\.(jpe?g|png|gif|webp|svg|avif)$/i.test(url.pathname)) {
    event.respondWith(
      caches.open(IMAGE_CACHE).then(cache =>
        cache.match(request).then(cached => {
          if (cached) return cached;
          return fetch(request).then(res => {
            if (res.ok) cache.put(request, res.clone());
            return res;
          });
        })
      )
    );
    return;
  }

  // CSS / JS / fonts → cache-first with network fallback
  event.respondWith(
    caches.match(request).then(cached =>
      cached || fetch(request).then(res => {
        if (res.ok) {
          caches.open(STATIC_CACHE).then(c => c.put(request, res.clone()));
        }
        return res;
      })
    )
  );
});
