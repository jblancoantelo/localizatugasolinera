const CACHE = 'gasolineras-v3';
const CDN_CACHE = 'gasolineras-cdn-v1';
const API_HOST = 'sedeaplicaciones.minetur.gob.es';
const API_BASE = 'https://' + API_HOST + '/ServiciosRESTCarburantes/PreciosCarburantes/';

importScripts('js/state.js', 'js/helpers.js', 'js/db.js');

const BASE = new URL('.', self.location).pathname;

const ASSETS = [
  BASE + 'index.html',
  BASE + 'offline.html',
  BASE + 'css/styles.css',
  BASE + 'manifest.json',
  BASE + 'icons/icon-192.png',
  BASE + 'icons/icon-512.png',
  BASE + 'icons/icon-192.svg',
  BASE + 'icons/icon-512.svg',
  BASE + 'js/state.js',
  BASE + 'js/helpers.js',
  BASE + 'js/db.js',
  BASE + 'js/storage.js',
  BASE + 'js/map.js',
  BASE + 'js/table.js',
  BASE + 'js/controls.js',
  BASE + 'js/api.js',
  BASE + 'js/chart-engine.js',
  BASE + 'js/push-notifications.js',
  BASE + 'js/main.js'
];

const CDN_URLS = [
  'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css',
  'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js'
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

// ---- Price check logic ----

function formatDateDDMMYYYY(date) {
  const d = date.getDate().toString().padStart(2, '0');
  const m = (date.getMonth() + 1).toString().padStart(2, '0');
  const y = date.getFullYear();
  return d + '-' + m + '-' + y;
}

async function fetchProvinceHistorySW(provinceId, days) {
  const dates = [];
  if (!days) days = 14;
  for (let i = days; i >= 1; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    d.setHours(0, 0, 0, 0);
    dates.push(d);
  }
  const results = {};
  const CHUNK = 3;
  for (let i = 0; i < dates.length; i += CHUNK) {
    const chunk = dates.slice(i, i + CHUNK);
    const promises = chunk.map(async (date) => {
      const dateStr = formatDateDDMMYYYY(date);
      const cacheKey = 'hist_' + provinceId + '_' + dateStr;
      let cached = await dbGet('cache', cacheKey);
      if (cached && cached.data) {
        results[dateStr] = cached.data;
        return;
      }
      try {
        const r = await fetch(API_BASE + 'EstacionesTerrestresHist/FiltroProvincia/' + dateStr + '/' + provinceId, {
          headers: { 'Accept': 'application/json' }
        });
        if (r.ok) {
          const json = await r.json();
          const list = json.ListaEESSPrecio || [];
          results[dateStr] = list;
          await dbPut('cache', cacheKey, { data: list, timestamp: Date.now() });
        }
      } catch (e) { console.warn('[SW] Hist error:', dateStr, provinceId, e.message); }
    });
    await Promise.all(promises);
  }
  return results;
}

function getStationHistorySW(historyByDate, stationId, fuelName) {
  const isGroup = FUEL_GROUPS[fuelName] ? true : false;
  const groupMembers = isGroup ? FUEL_GROUPS[fuelName] : [fuelName];
  const results = [];
  const dates = Object.keys(historyByDate).sort((a, b) => {
    const [da, ma, ya] = a.split('-');
    const [db, mb, yb] = b.split('-');
    return new Date(ya, ma - 1, da) - new Date(yb, mb - 1, db);
  });
  for (const dateStr of dates) {
    const list = historyByDate[dateStr];
    if (!list || !list.length) continue;
    const st = list.find(x => x.IDEESS === stationId);
    if (!st) continue;
    const key = FUEL_KEYS[fuelName];
    if (key) {
      const price = getFuelPrice(st, key);
      if (price !== null) results.push({ date: dateStr, price });
    } else {
      let found = false;
      for (const name of groupMembers) {
        const k = FUEL_KEYS[name];
        if (k) {
          const p = getFuelPrice(st, k);
          if (p !== null) {
            results.push({ date: dateStr, price: p, fuel: name });
            found = true;
            break;
          }
        }
      }
      if (!found) {
        for (const [, k] of FUEL_NAMES) {
          const p = getFuelPrice(st, k);
          if (p !== null) { results.push({ date: dateStr, price: p }); break; }
        }
      }
    }
  }
  return results;
}

async function checkPrices(mode) {
  try {
    const config = await getPushConfig();
    const days = config.priceFallDays || 3;
    const cacheTtl = config.cacheTtl || 12;
    const checkDrop = mode ? mode === 'drop' : true;
    const checkRise = mode ? mode === 'rise' : config.pushOnPriceRise === true;

    const favorites = await dbGetAllFavorites();
    if (!favorites || favorites.length === 0) {
      console.log('[SW] No favorites to check');
      return;
    }

    const byProvince = {};
    for (const fav of favorites) {
      const key = fav.provinceId || fav.provinceName;
      if (!key) continue;
      if (!byProvince[key]) byProvince[key] = [];
      byProvince[key].push(fav);
    }

    const alerts = [];

    for (const [provKey, favs] of Object.entries(byProvince)) {
      const provId = favs[0].provinceId;
      const provName = favs[0].provinceName;
      if (!provId || !provName) continue;

      try {
        const r = await fetch(API_BASE + 'EstacionesTerrestres/FiltroProvincia/' + provId, {
          headers: { 'Accept': 'application/json' }
        });
        if (!r.ok) continue;
        const json = await r.json();
        const freshData = json.ListaEESSPrecio || [];
        if (!freshData.length) continue;

        await cacheProvinceData(provName, freshData, cacheTtl);

        const historyData = await fetchProvinceHistorySW(provId, days);

        for (const fav of favs) {
          const station = freshData.find(s => s.IDEESS === fav.id);
          if (!station) continue;

          const fuelName = getFirstFuelName(station);
          if (!fuelName) continue;

          const currentPrice = getFirstFuelPrice(station);
          if (currentPrice === null) continue;

          const stationHistory = getStationHistorySW(historyData, fav.id, fuelName);
          if (stationHistory.length < 2) continue;

          const oldestRecord = stationHistory[0];
          const oldestPrice = parsePrice(oldestRecord.price);
          if (oldestPrice === null) continue;

          const result = comparePrices(currentPrice, oldestPrice);
          if (result && (result.isRise ? checkRise : true)) {
            alerts.push({
              favoriteId: fav.id,
              brand: station.Rótulo,
              fuel: fuelName,
              currentPrice: currentPrice,
              oldestPrice: oldestPrice,
              difference: result.difference.toFixed(3),
              isRise: result.isRise,
              address: station.Dirección,
              locality: station.Localidad
            });
          }
        }
      } catch (e) {
        console.warn('[SW] Error checking province', provName, e.message);
      }
    }

    if (alerts.length > 0) {
      const riseCount = alerts.filter(a => a.isRise).length;
      const dropCount = alerts.filter(a => !a.isRise).length;
      let body = '';
      if (dropCount > 0) body += dropCount + ' favorito(s) con precios más bajos';
      if (dropCount > 0 && riseCount > 0) body += ' · ';
      if (riseCount > 0) body += riseCount + ' favorito(s) con precios más altos';
      await self.registration.showNotification('Alerta de Precios', {
        body: body,
        icon: 'icons/icon-192.png',
        badge: 'icons/icon-192.png',
        tag: 'price-alert',
        requireInteraction: true,
        data: { alerts }
      });
      console.log('[SW] Price alert sent:', alerts.length, 'alerts');
    }
  } catch (e) {
    console.error('[SW] checkPrices error:', e.message);
  }
}

// ---- Periodic Background Sync ----

self.addEventListener('periodicsync', event => {
  if (event.tag === 'check-favorite-prices') {
    event.waitUntil(checkPrices());
  }
});

// ---- Messages from client ----

self.addEventListener('message', event => {
  if (event.data && event.data.type === 'trigger-price-check') {
    event.waitUntil(checkPrices(event.data.mode));
  }
});

// ---- Push event (for server-sent push messages, if any) ----

self.addEventListener('push', event => {
  let data = {};
  try { data = event.data ? event.data.json() : {}; } catch(e) {}
  const title = data.title || 'Alerta de Precios';
  const body = data.body || 'Tus favoritos tienen cambios de precio';
  const tag = data.tag || 'push-alert';
  event.waitUntil(
    self.registration.showNotification(title, {
      body,
      icon: 'icons/icon-192.png',
      badge: 'icons/icon-192.png',
      tag,
      requireInteraction: true,
      data: data.alerts ? { alerts: data.alerts } : {}
    })
  );
});

// ---- Notification click ----

self.addEventListener('notificationclick', event => {
  event.notification.close();

  const scopeUrl = new URL(self.registration.scope || '/');
  const scopePath = scopeUrl.pathname.replace(/\/?$/, '/');

  event.waitUntil(
    clients.matchAll({ type: 'window' }).then(clientList => {
      for (const client of clientList) {
        const clientPath = new URL(client.url).pathname;
        if ((clientPath === scopePath || clientPath === scopePath.replace(/\/$/, '') || clientPath === scopePath + 'index.html') && 'focus' in client) {
          const alerts = event.notification.data && event.notification.data.alerts;
          if (alerts && alerts.length) {
            client.postMessage({ type: 'open-favorite', favoriteId: alerts[0].favoriteId });
          }
          return client.focus();
        }
      }
      const targetUrl = scopeUrl.origin + scopePath.replace(/\/$/, '');
      return clients.openWindow(targetUrl).then(client => {
        if (client) {
          const alerts = event.notification.data && event.notification.data.alerts;
          if (alerts && alerts.length) {
            client.postMessage({ type: 'open-favorite', favoriteId: alerts[0].favoriteId });
          }
        }
      });
    })
  );
});

// ---- Fetch strategy ----

self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);

  if (e.request.mode === 'navigate') {
    e.respondWith(
      caches.match(e.request).then(cached =>
        cached || fetch(e.request).catch(() => caches.match(BASE + 'offline.html'))
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
