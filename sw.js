const CACHE_VERSION = 'v2';
const STATIC_CACHE  = `aakaara-static-${CACHE_VERSION}`;
const IMAGE_CACHE   = `aakaara-images-${CACHE_VERSION}`;

// Only cache the bare minimum required for the shell
const PRECACHE_URLS = [
  '/',
  '/index.html',
  '/styles.css',
  '/Script.js',
  '/favicon.svg'
];

// ── Install: pre-cache shell assets ──────────────────────────────
self.addEventListener('install', event => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(STATIC_CACHE)
      .then(cache => cache.addAll(PRECACHE_URLS))
  );
});

// ── Activate: purge old caches ────────────────────────────────────
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys => {
      return Promise.all(
        keys.filter(k => k !== STATIC_CACHE && k !== IMAGE_CACHE)
            .map(k => caches.delete(k))
      );
    }).then(() => self.clients.claim())
  );
});

// ── Fetch ─────────────────────────────────────────────────────────
self.addEventListener('fetch', event => {
  const { request } = event;
  
  // 1. Video/HLS: Network-only (never cache huge media files)
  if (request.destination === 'video' || request.url.includes('.m3u8') || request.url.includes('.ts')) {
    return; 
  }

  if (request.method !== 'GET') return;

  // 2. HTML: Network-first (ensure user sees updated portfolio content)
  if (request.headers.get('Accept')?.includes('text/html')) {
    event.respondWith(
      fetch(request)
        .then(res => {
          const copy = res.clone();
          caches.open(STATIC_CACHE).then(cache => cache.put(request, copy));
          return res;
        })
        .catch(() => caches.match(request))
    );
    return;
  }

  // 3. CSS/JS/Fonts: Stale-while-revalidate (speed + background update)
  if (request.destination === 'style' || request.destination === 'script' || request.destination === 'font') {
    event.respondWith(
      caches.match(request).then(cached => {
        const networked = fetch(request).then(res => {
          const copy = res.clone();
          caches.open(STATIC_CACHE).then(cache => cache.put(request, copy));
          return res;
        });
        return cached || networked;
      })
    );
    return;
  }

  // 4. Images: Cache-first
  if (request.destination === 'image') {
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
});
