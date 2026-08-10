/* Mosaic Blanket Designer service worker */
const CACHE = 'mosaic-pwa-v62';
const PDF_CACHE = 'mosaic-pdf-downloads';
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
  if (data.type === 'CLAIM_CLIENTS') {
    event.waitUntil(self.clients.claim());
    return;
  }
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
      Promise.all(
        keys
          .filter((k) => k !== CACHE && k !== PDF_CACHE)
          .map((k) => caches.delete(k))
      )
    ).then(() => self.clients.claim())
  );
});

async function pdfCacheResponse(url) {
  const cache = await caches.open(PDF_CACHE);
  // Match without query string.
  const exact = await cache.match(url.pathname);
  if (exact) return exact;
  const all = await cache.keys();
  for (const req of all) {
    try {
      if (new URL(req.url).pathname === url.pathname) {
        const hit = await cache.match(req);
        if (hit) return hit;
      }
    } catch (_) {}
  }
  return null;
}

function memoryPdfResponse(url) {
  const key = url.searchParams.get('key');
  const item = key ? pdfDownloads.get(key) : null;
  if (key) pdfDownloads.delete(key);
  if (!item) return null;
  const rawName = String(item.name || 'mosaic-pattern.pdf');
  const ascii = rawName.replace(/[^\x20-\x7E]/g, '_').replace(/["\\]/g, '').replace(/[^\w.\-]+/g, '_') || 'mosaic-pattern.pdf';
  const safe = ascii.toLowerCase().endsWith('.pdf') ? ascii : (ascii + '.pdf');
  const asBinary = url.searchParams.get('binary') === '1';
  const encoded = encodeURIComponent(rawName);
  return new Response(item.buffer, {
    status: 200,
    headers: {
      'Content-Type': asBinary ? 'application/octet-stream' : 'application/pdf',
      'Content-Disposition': `attachment; filename="${safe}"; filename*=UTF-8''${encoded}`,
      'Cache-Control': 'no-store'
    }
  });
}

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);

  // Never let PDF download URLs fall through to GitHub Pages (that returns 404.html,
  // which Safari then saves as name.pdf.html).
  if (url.pathname.startsWith('/mosaic/pdf-cache/') || url.pathname.startsWith('/mosaic/download/')) {
    event.respondWith((async () => {
      if (url.pathname.startsWith('/mosaic/pdf-cache/')) {
        const cached = await pdfCacheResponse(url);
        if (cached) return cached;
      } else {
        const mem = memoryPdfResponse(url);
        if (mem) return mem;
      }
      return new Response('PDF expired. Tap Download PDF again.', {
        status: 404,
        headers: { 'Content-Type': 'text/plain; charset=utf-8' }
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
