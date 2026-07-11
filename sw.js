const CACHE = 'gasolineras-v3';
const CDN_CACHE = 'gasolineras-cdn-v1';
const CDN_URLS = [
  'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css',
  'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js'
];
const API_HOST = 'sedeaplicaciones.minetur.gob.es';

const BASE = new URL('.', self.location).pathname;

const ASSETS = [
  `${BASE}index.html`,
  `${BASE}offline.html`,
  `${BASE}css/styles.css`,
  `${BASE}manifest.json`,
  `${BASE}icons/icon-192.png`,
  `${BASE}icons/icon-512.png`,
  `${BASE}icons/icon-192.svg`,
  `${BASE}icons/icon-512.svg`,
  `${BASE}js/state.js`,
  `${BASE}js/helpers.js`,
  `${BASE}js/storage.js`,
  `${BASE}js/map.js`,
  `${BASE}js/table.js`,
  `${BASE}js/controls.js`,
  `${BASE}js/api.js`,
  `${BASE}js/chart-engine.js`,
  `${BASE}js/push-notifications.js`,
  `${BASE}js/main.js`
];

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE).then(cache =>
      Promise.allSettled(ASSETS.map(url =>
        cache.add(url).catch(() => console.warn('[SW] Failed to cache: ' + url))
      ))
    )
    .then(() => caches.open(CDN_CACHE))
    .then(cache => Promise.allSettled(CDN_URLS.map(url => cache.add(url).catch(() => {}))))
    .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys => Promise.all(
      keys.filter(k => k !== CACHE && k !== CDN_CACHE).map(k => caches.delete(k))
    )).then(() => self.clients.claim())
  );
});

// Periodic Background Sync for checking favorite prices
self.addEventListener('periodicsync', event => {
  if (event.tag === 'check-favorite-prices') {
    event.waitUntil(
      (async () => {
        try {
          // Call checkFavoritePrices from helpers (requires importScripts)
          console.log('Periodic sync triggered for price check');
          // Price check logic will run when clients post message
          const clients = await self.clients.matchAll();
          clients.forEach(client => {
            client.postMessage({ type: 'trigger-price-check' });
          });
        } catch (error) {
          console.error('Error in periodic sync:', error);
        }
      })()
    );
  }
});

// Handle notification clicks
self.addEventListener('notificationclick', event => {
  event.notification.close();
  
  event.waitUntil(
    clients.matchAll({ type: 'window' }).then(clientList => {
      // Check if app is already open
      for (let client of clientList) {
        if (client.url === '/' && 'focus' in client) {
          return client.focus().then(() => {
            if (event.notification.data && event.notification.data.alerts) {
              const firstAlert = event.notification.data.alerts[0];
              client.postMessage({
                type: 'open-favorite',
                favoriteId: firstAlert.favoriteId
              });
            }
          });
        }
      }
      // If app not open, open it
      if (clients.openWindow) {
        return clients.openWindow('/').then(client => {
          if (client && event.notification.data && event.notification.data.alerts) {
            const firstAlert = event.notification.data.alerts[0];
            client.postMessage({
              type: 'open-favorite',
              favoriteId: firstAlert.favoriteId
            });
          }
        });
      }
    })
  );
});

self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);

  if (e.request.mode === 'navigate') {
    e.respondWith(
      caches.match(e.request).then(cached =>
        cached || fetch(e.request).catch(() => caches.match(`${BASE}offline.html`))
      )
    );
    return;
  }

  if (url.hostname === 'unpkg.com' || url.hostname === 'cdnjs.cloudflare.com') {
    e.respondWith(
      caches.match(e.request).then(cached => cached || fetch(e.request).then(res => {
        const clone = res.clone();
        caches.open(CDN_CACHE).then(cache => cache.put(e.request, clone));
        return res;
      }))
    );
    return;
  }

  if (url.hostname === API_HOST) {
    e.respondWith(
      fetch(e.request).then(res => {
        const clone = res.clone();
        caches.open(CACHE).then(cache => cache.put(e.request, clone));
        return res;
      }).catch(() => caches.match(e.request))
    );
    return;
  }

  if (ASSETS.includes(url.pathname) || url.pathname.startsWith(BASE)) {
    e.respondWith(
      caches.match(e.request).then(cached => cached || fetch(e.request))
    );
    return;
  }

  e.respondWith(
    fetch(e.request).catch(() => caches.match(e.request))
  );
});
