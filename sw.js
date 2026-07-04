const cacheName = 'officer-v1';
const staticAssets = [
  './',
  './index.html',
  './manifest.json'
];

self.addEventListener('install', async e => {
  const cache = await caches.open(cacheName);
  await cache.addAll(staticAssets);
  return self.skipWaiting();
});

self.addEventListener('activate', e => {
  self.clients.claim();
});

self.addEventListener('fetch', async e => {
  const req = e.request;
  const url = new URL(req.url);

  // Auth-sensitive HTML must NOT be served from cache-first.
  // Otherwise Supabase session hydration may not have completed yet,
  // and protected pages can incorrectly redirect to index.html.
  const authSensitivePaths = new Set([
    '/index.html',
    '/home.html'
  ]);

  if (url.origin === location.origin) {
    if (authSensitivePaths.has(url.pathname)) {
      e.respondWith(networkAndCache(req));
    } else {
      e.respondWith(cacheFirst(req));
    }
  } else {
    e.respondWith(networkAndCache(req));
  }
});

async function cacheFirst(req) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(req);
  return cached || fetch(req);
}

async function networkAndCache(req) {
  const cache = await caches.open(cacheName);
  try {
    const refresh = await fetch(req);
    await cache.put(req, refresh.clone());
    return refresh;
  } catch (e) {
    return cache.match(req);
  }
}

if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('sw.js').catch(err => console.log("SW registration failed", err));
}