/* ==========================================
   Service Worker — University Housing PWA
   ========================================== */

const CACHE_VERSION = 'v1.0.0';
const STATIC_CACHE = `static-${CACHE_VERSION}`;
const RUNTIME_CACHE = `runtime-${CACHE_VERSION}`;

// الملفات التي تُخزَّن عند التثبيت
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
  '/js/vendor/chart.umd.min.js',
  '/manifest.json',
];

/* ========== Install ========== */
self.addEventListener('install', (event) => {
  console.log('[SW] Installing...');
  event.waitUntil(
    caches.open(STATIC_CACHE)
      .then(cache => {
        console.log('[SW] Caching static assets');
        // استخدم addAll مع تجاهل الفشل للملفات الفردية
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
  console.log('[SW] Activating...');
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

  // تجاهل طلبات API و Firebase (لا تُخزَّن)
  if (
    url.pathname.startsWith('/api/') ||
    url.hostname.includes('firebaseio.com') ||
    url.hostname.includes('googleapis.com') ||
    url.hostname.includes('gstatic.com') ||
    url.hostname.includes('firebaseapp.com') ||
    request.method !== 'GET'
  ) {
    return; // مرر للشبكة مباشرة
  }

  // استراتيجية: Network First للـ HTML (للتحديثات)
  // Fallback إلى cache إن فشلت الشبكة
  if (request.headers.get('accept')?.includes('text/html')) {
    event.respondWith(
      fetch(request)
        .then(response => {
          const clone = response.clone();
          caches.open(RUNTIME_CACHE).then(cache => cache.put(request, clone));
          return response;
        })
        .catch(async () => {
          const cached = await caches.match(request);
          return cached || caches.match('/offline.html');
        })
    );
    return;
  }

  // استراتيجية: Cache First للأصول الثابتة (CSS, JS, images)
  event.respondWith(
    caches.match(request)
      .then(cached => {
        if (cached) {
          // أعد التخزين في الخلفية للتحديث
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

/* ========== Message — للتحكم بالتحديث ========== */
self.addEventListener('message', (event) => {
  if (event.data === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});
