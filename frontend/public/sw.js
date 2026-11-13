/*
 * TailorPro Service Worker
 *
 * Scope of responsibility (deliberately narrow):
 *   - Same-origin GET navigations  -> network-first, offline fallback to the cached app shell
 *   - Same-origin hashed /assets/*  -> cache-first (file names change on every build)
 *   - Same-origin icons/manifest    -> network-first, cache fallback
 *
 * Everything else is NOT intercepted and goes straight to the network:
 *   - any non-GET request (POST/PUT/PATCH/DELETE...)
 *   - anything under /api/ (backend calls are never cached or proxied)
 *   - cross-origin requests (Google Fonts, Razorpay, analytics...)
 *   - any other path (e.g. /sw.js itself)
 *
 * Bump CACHE_VERSION whenever this file's caching behaviour changes: activation deletes every
 * older "tailorpro-*" cache, and skipWaiting/clients.claim make the new worker take over open
 * tabs immediately instead of waiting for them to close.
 */
const CACHE_VERSION = 'v3';
const CACHE_PREFIX = 'tailorpro-';
const CACHE_NAME = `${CACHE_PREFIX}static-${CACHE_VERSION}`;

const APP_SHELL = ['/index.html', '/manifest.json', '/favicon.ico', '/pwa-192x192.png', '/pwa-512x512.png'];

const HASHED_ASSET = /^\/assets\/[^/]+$/;
const OTHER_STATIC = /^\/(manifest\.json|favicon\.ico|pwa-\d+x\d+\.png)$/;

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      // cache: 'reload' bypasses the HTTP cache so the shell matches the current deployment
      .then((cache) => cache.addAll(APP_SHELL.map((url) => new Request(url, { cache: 'reload' }))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            // Remove previous versions (tailorpro-v1, tailorpro-v2, older static-*) of OUR caches only
            .filter((key) => key.startsWith(CACHE_PREFIX) && key !== CACHE_NAME)
            .map((key) => caches.delete(key))
        )
      )
      .then(() => self.clients.claim())
  );
});

function isCacheableResponse(response) {
  return Boolean(response) && response.ok && response.type === 'basic';
}

function putInCache(request, response) {
  const copy = response.clone();
  return caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
}

self.addEventListener('fetch', (event) => {
  const request = event.request;

  // 1. Never touch non-GET requests (registration, login, payments, any mutation)
  if (request.method !== 'GET') return;

  const url = new URL(request.url);

  // 2. Never touch cross-origin requests (fonts, payment SDKs, other services)
  if (url.origin !== self.location.origin) return;

  // 3. Never touch backend API calls
  if (url.pathname === '/api' || url.pathname.startsWith('/api/')) return;

  // 4. SPA navigations: network-first so users always get the latest deployment when online
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (isCacheableResponse(response)) {
            // Single shell entry: every client-side route renders the same index.html
            event.waitUntil(putInCache('/index.html', response));
          }
          return response;
        })
        .catch(() => caches.match('/index.html').then((cached) => cached || Response.error()))
    );
    return;
  }

  // 5. Hashed build assets: immutable, so cache-first is safe
  if (HASHED_ASSET.test(url.pathname)) {
    event.respondWith(
      caches.match(request).then(
        (cached) =>
          cached ||
          fetch(request).then((response) => {
            if (isCacheableResponse(response)) event.waitUntil(putInCache(request, response));
            return response;
          })
      )
    );
    return;
  }

  // 6. Non-hashed static files (manifest, icons): network-first, cached copy when offline
  if (OTHER_STATIC.test(url.pathname)) {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (isCacheableResponse(response)) event.waitUntil(putInCache(request, response));
          return response;
        })
        .catch(() => caches.match(request).then((cached) => cached || Response.error()))
    );
  }

  // 7. Anything else: not intercepted (browser default network behaviour)
});
