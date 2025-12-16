// Service Worker for Ok Snap PWA
const CACHE_NAME = 'ok-snap-v1.0.19';
const urlsToCache = [
  '/',
  '/index.html',
  '/manifest.json'
];

// Install event - cache resources
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('Opened cache');
        return cache.addAll(urlsToCache);
      })
  );
});

// Fetch event - serve from cache, fallback to network
self.addEventListener('fetch', (event) => {
  event.respondWith(
    caches.match(event.request)
      .then((response) => {
        // Return cached version or fetch from network
        if (response) {
          return response;
        }
        // Wrap fetch in try/catch to handle network errors gracefully
        return fetch(event.request).catch((error) => {
          console.warn('Service worker fetch failed:', error.message);
          // Return a basic error response instead of throwing
          return new Response('Network error', {
            status: 408,
            statusText: 'Request Timeout',
            headers: { 'Content-Type': 'text/plain' }
          });
        });
      })
      .catch((error) => {
        console.warn('Service worker cache match failed:', error.message);
        // Try to fetch from network as fallback
        return fetch(event.request).catch((fetchError) => {
          console.warn('Service worker fetch fallback failed:', fetchError.message);
          return new Response('Network error', {
            status: 408,
            statusText: 'Request Timeout',
            headers: { 'Content-Type': 'text/plain' }
          });
        });
      })
  );
});

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          // Delete all old caches (including v1, v1.0.17, etc.)
          if (cacheName !== CACHE_NAME) {
            console.log('Deleting old cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => {
      // Force clients to reload to get new version
      return self.clients.claim();
    })
  );
});

