/* ==========================================
   Service Worker — University Housing PWA
   v3.0.0 — Network First for JS/HTML/CSS
   ========================================== */

const CACHE_VERSION = 'v7.0.1'; // 👈 غيّر الرقم ده كل مرة تعدل
const STATIC_CACHE = `static-${CACHE_VERSION}`;
const RUNTIME_CACHE = `runtime-${CACHE_VERSION}`;

const PRECACHE_URLS = [
  '/',
  '/login.html',
  '/dashboard.html',
  '/students.html',
  '/rooms.html',
  '/workers.html',
  '/permits.html',
  '/payments.html',
  '/reports.html',
  '/employees.html',
  '/audit.html',
  '/settings.html',
  '/offline.html',
  '/css/app.css',
  '/css/login.css',
  '/css/students.css',
  '/css/rooms.css',
  '/css/workers.css',
  '/css/permits.css',
  '/css/payments.css',
  '/css/reports.css',
  '/css/employees.css',
  '/css/audit.css',
  '/css/settings.css',
  '/js/firebase-client.js',
  '/js/api.js',
  '/js/core.js',
  '/js/login.js',
  '/js/students.js',
  '/js/rooms.js',
  '/js/workers.js',
  '/js/permits.js',
  '/js/payments.js',
  '/js/reports.js',
  '/js/employees.js',
  '/js/audit.js',
  '/js/settings.js',
  '/js/pwa.js',
  '/js/vendor/chart.umd.min.js',
  '/manifest.json',
];

/* ========== Install ========== */
self.addEventListener('install', (event) => {
  console.log('[SW] Installing...', CACHE_VERSION);
  event.waitUntil(
    caches.open(STATIC_CACHE)
      .then(cache => {
        return Promise.allSettled(
          PRECACHE_URLS.map(url =>
            cache.add(url).catch(err => {
              console.warn(`[SW] Failed to cache: ${url}`, err);
            })
          )
        );
      })
      .then(() => self.skipWaiting())
  );
});

/* ========== Activate ========== */
self.addEventListener('activate', (event) => {
  console.log('[SW] Activating...', CACHE_VERSION);
  event.waitUntil(
    caches.keys()
      .then(cacheNames => Promise.all(
        cacheNames
          .filter(name => name !== STATIC_CACHE && name !== RUNTIME_CACHE)
          .map(name => {
            console.log('[SW] Deleting old cache:', name);
            return caches.delete(name);
          })
      ))
      .then(() => self.clients.claim())
  );
});

/* ========== Fetch ========== */
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  if (request.method !== 'GET') return;

  // تجاهل طلبات API و Firebase
  if (
    url.pathname.startsWith('/api/') ||
    url.hostname.includes('firebaseio.com') ||
    url.hostname.includes('googleapis.com') ||
    url.hostname.includes('gstatic.com') ||
    url.hostname.includes('firebaseapp.com')
  ) {
    return;
  }

  // ✅ Network First للـ HTML والـ JS والـ CSS (عشان نضمن أحدث نسخة)
  if (
    request.mode === 'navigate' ||
    request.headers.get('accept')?.includes('text/html') ||
    url.pathname.endsWith('.js') ||
    url.pathname.endsWith('.css')
  ) {
    event.respondWith(
      fetch(request, { cache: 'no-store' })
        .then(response => {
          if (response.ok) {
            const clone = response.clone();
            caches.open(RUNTIME_CACHE).then(cache => cache.put(request, clone));
          }
          return response;
        })
        .catch(async () => {
          const cached = await caches.match(request);
          return cached || caches.match('/offline.html');
        })
    );
    return;
  }

  // Cache First للأصول الثابتة (صور، أيقونات، إلخ)
  event.respondWith(
    caches.match(request)
      .then(cached => {
        if (cached) {
          fetch(request).then(response => {
            if (response.ok) {
              caches.open(RUNTIME_CACHE).then(cache => cache.put(request, response));
            }
          }).catch(() => {});
          return cached;
        }
        return fetch(request).then(response => {
          if (response.ok) {
            const clone = response.clone();
            caches.open(RUNTIME_CACHE).then(cache => cache.put(request, clone));
          }
          return response;
        });
      })
  );
});

/* ========== Message ========== */
self.addEventListener('message', (event) => {
  if (event.data === 'SKIP_WAITING') {
    self.skipWaiting();
  }
  if (event.data === 'GET_VERSION') {
    event.source?.postMessage({ type: 'VERSION', version: CACHE_VERSION });
  }
});
