/* ================= APP-SHELL SERVICE WORKER =================
   Offline-first, first increment (2026-08-19): caches only the static
   app shell (HTML/CSS/JS) so the POS screen can actually LOAD with no
   network at all — a prerequisite for capturing a sale offline in the
   first place. Deliberately does NOT cache anything under /api/ — this
   is a money/inventory system; serving stale product prices or stock
   counts from a cache would be actively dangerous. API calls always go
   to the network, and offline.js's outbox queue is what handles the
   case where that network call fails. See SESSION_LOG.md 2026-08-19
   "Offline-first sync" for the full design notes and what's NOT covered
   yet (GRN and other screens' offline capture, deep conflict merge). */

const SHELL_CACHE = 'pilk-shell-v1';
const SHELL_ASSETS = [
  '/', '/index.html', '/style.css',
  '/lib/qrcode.js', '/lib/ambient-bg.js',
  '/dashboard.js', '/products.js', '/grn.js', '/sell.js', '/bills.js',
  '/customers.js', '/vendors.js', '/loans.js', '/expenses.js',
  '/messages.js', '/reports.js', '/help.js', '/onboarding.js',
  '/settings.js', '/siteEditor.js', '/app.js', '/offline.js'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(SHELL_CACHE)
      .then((cache) => cache.addAll(SHELL_ASSETS))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((names) => Promise.all(names.filter((n) => n !== SHELL_CACHE).map((n) => caches.delete(n))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  // Never intercept API calls, the storefront, or the handbook docs —
  // only this app's own static shell. Also skip non-GET entirely (a
  // cached response to a POST makes no sense and browsers reject it).
  if (event.request.method !== 'GET') return;
  if (url.origin !== self.location.origin) return;
  if (url.pathname.startsWith('/api/') || url.pathname.startsWith('/shop') || url.pathname.startsWith('/docs/')) return;

  event.respondWith(
    caches.match(event.request).then((cached) => {
      const networkFetch = fetch(event.request)
        .then((res) => {
          if (res && res.ok) {
            const copy = res.clone();
            caches.open(SHELL_CACHE).then((cache) => cache.put(event.request, copy));
          }
          return res;
        })
        .catch(() => cached); // offline and not cached — nothing more to do
      // Cache-first for instant offline load; refresh the cache in the
      // background so the shell doesn't go stale for next time.
      return cached || networkFetch;
    })
  );
});
