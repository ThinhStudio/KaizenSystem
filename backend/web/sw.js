// Service worker: cache-first for app shell, network-first for API GETs.
const SHELL = 'kaizen-shell-v3';
const ASSETS = ['/', '/index.html', '/app.css', '/js/app.js', '/js/api.js', '/js/offline.js', '/js/mock.js', '/js/lean.js', '/js/charts.js', '/manifest.webmanifest', '/icons/icon.svg'];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(SHELL).then((c) => c.addAll(ASSETS)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== SHELL).map((k) => caches.delete(k))))
    .then(() => self.clients.claim()));
});
self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET' || url.origin !== location.origin) return;
  if (url.pathname.startsWith('/api/')) {
    e.respondWith(fetch(e.request).then((res) => {
      if (res.ok) { const copy = res.clone(); caches.open('kaizen-api').then((c) => c.put(e.request, copy)); }
      return res;
    }).catch(() => caches.match(e.request).then((r) => r || new Response('{"error":"offline"}', { status: 503, headers: { 'Content-Type': 'application/json' } }))));
    return;
  }
  e.respondWith(caches.match(e.request).then((r) => r || fetch(e.request).catch(() => caches.match('/index.html'))));
});
