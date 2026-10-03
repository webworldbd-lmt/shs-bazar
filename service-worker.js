const CACHE_NAME = 'market-koro-v1';

// Static assets to precache
const PRECACHE_ASSETS = [
  './',
  './index.html',
  './shop.html',
  './cart.html',
  './checkout.html',
  './offers.html',
  './orders.html',
  './wishlist.html',
  './profile.html',
  './settings.html',
  './product-detail.html',
  './login.html',
  './about.html',
  './contact.html',
  './faq.html',
  './privacy-policy.html',
  './return-policy.html',
  './shipping-policy.html',
  './terms.html',
  './manifest.json',
  './assets/css/style.css',
  './assets/js/app.js',
  './assets/js/auth.js',
  './assets/js/firebase-config.js',
  './assets/js/products.js',
  './assets/js/cart-checkout.js',
  './assets/js/category-icons.js',
  './assets/js/locations.js',
  './assets/js/translations.js',
  './assets/images/logo.png',
  './assets/images/pwa-192.png',
  './assets/images/pwa-512.png',
  './assets/images/apple-touch-icon.png'
];

// Domains & URL patterns that MUST NOT be cached
const EXCLUDED_PATTERNS = [
  'identitytoolkit.googleapis.com',
  'securetoken.googleapis.com',
  'firestore.googleapis.com',
  'firebase.googleapis.com',
  'firebaseinstallations.googleapis.com',
  'res.cloudinary.com',
  'api.cloudinary.com',
  'api.telegram.org'
];

// Install Event
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        return cache.addAll(PRECACHE_ASSETS);
      })
      .then(() => self.skipWaiting())
      .catch((err) => {
        console.warn('[SW] Precache issue (non-fatal):', err);
        return self.skipWaiting();
      })
  );
});

// Activate Event
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cache) => {
          if (cache !== CACHE_NAME) {
            console.log('[SW] Deleting old cache:', cache);
            return caches.delete(cache);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// Fetch Event
self.addEventListener('fetch', (event) => {
  const request = event.request;

  // 1. Skip non-GET requests (POST, PUT, DELETE, etc.)
  if (request.method !== 'GET') {
    return;
  }

  const url = new URL(request.url);

  // 2. Skip Firebase, Cloudinary, and external API calls
  const isExcluded = EXCLUDED_PATTERNS.some((pattern) => url.origin.includes(pattern) || url.hostname.includes(pattern));
  if (isExcluded) {
    return;
  }

  // 3. Handle Navigation / HTML requests (Network First, fallback to cache or index.html)
  if (request.mode === 'navigate' || (request.headers.get('accept') && request.headers.get('accept').includes('text/html'))) {
    event.respondWith(
      fetch(request)
        .then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            const responseClone = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(request, responseClone);
            });
          }
          return networkResponse;
        })
        .catch(() => {
          return caches.match(request).then((cachedResponse) => {
            if (cachedResponse) {
              return cachedResponse;
            }
            return caches.match('./index.html');
          });
        })
    );
    return;
  }

  // 4. For Static Assets (CSS, JS, Fonts, Images) -> Stale-While-Revalidate
  event.respondWith(
    caches.match(request).then((cachedResponse) => {
      const fetchPromise = fetch(request)
        .then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200 && networkResponse.type === 'basic') {
            const responseClone = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(request, responseClone);
            });
          }
          return networkResponse;
        })
        .catch(() => {
          // Network fail silently for background revalidation
        });

      return cachedResponse || fetchPromise;
    })
  );
});
