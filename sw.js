/* Mosaic Blanket Designer service worker */
const CACHE = 'mosaic-pwa-v36';
const ASSETS = [
  '/mosaic/',
  '/mosaic/index.html',
  '/mosaic/manifest.webmanifest',
  '/mosaic/icons/icon-192.png',
  '/mosaic/icons/icon-512.png',
  '/mosaic/icons/apple-touch-icon.png',
  '/mosaic/vendor/pdf-lib.min.js'
];

const pdfDownloads = new Map();

self.addEventListener('message', (event) => {
  const data = event.data || {};
  if (data.type === 'STORE_PDF' && data.key && data.buffer) {
    pdfDownloads.set(data.key, {
      buffer: data.buffer,
      name: data.name || 'mosaic-pattern.pdf',
      storedAt: Date.now()
    });
    event.ports && event.ports[0] && event.ports[0].postMessage({ ok: true });
  }
});

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE).then((cache) => cache.addAll(ASSETS)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);
  if (url.pathname.startsWith('/mosaic/download/')) {
    event.respondWith((async () => {
      const key = url.searchParams.get('key');
      const item = key ? pdfDownloads.get(key) : null;
      if (key) pdfDownloads.delete(key);
      if (!item) {
        return new Response('PDF expired. Tap Download PDF again.', {
          status: 404,
          headers: { 'Content-Type': 'text/plain; charset=utf-8' }
        });
      }
      const safe = String(item.name || 'mosaic-pattern.pdf').replace(/[^\w.\-]+/g, '_');
      return new Response(item.buffer, {
        status: 200,
        headers: {
          'Content-Type': 'application/pdf',
          'Content-Disposition': `attachment; filename="${safe}"`,
          'Cache-Control': 'no-store'
        }
      });
    })());
    return;
  }

  const isAppShell =
    req.mode === 'navigate' ||
    url.pathname === '/mosaic/' ||
    url.pathname === '/mosaic/index.html' ||
    url.pathname.endsWith('/sw.js');

  if (isAppShell) {
    event.respondWith(
      fetch(req)
        .then((res) => {
          if (res && res.ok) {
            const copy = res.clone();
            caches.open(CACHE).then((cache) => cache.put(req, copy));
          }
          return res;
        })
        .catch(() => caches.match(req).then((cached) => cached || caches.match('/mosaic/index.html')))
    );
    return;
  }

  event.respondWith(
    caches.match(req).then((cached) => {
      const fetchPromise = fetch(req)
        .then((res) => {
          if (res && res.ok && url.origin === self.location.origin) {
            const copy = res.clone();
            caches.open(CACHE).then((cache) => cache.put(req, copy));
          }
          return res;
        })
        .catch(() => cached);
      return cached || fetchPromise.then((res) => res || cached);
    })
  );
});
