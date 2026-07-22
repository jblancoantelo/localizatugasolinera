const CACHE = 'gasolineras-v3';
const CDN_CACHE = 'gasolineras-cdn-v1';
const API_HOST = 'sedeaplicaciones.minetur.gob.es';
const API_BASE = 'https://' + API_HOST + '/ServiciosRESTCarburantes/PreciosCarburantes/';
const APP_VERSION = 5;

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

// ---- Push log helper (sends events to client) ----
function sendPushLog(event, detail) {
  self.clients.matchAll({ type: 'window' }).then(clients => {
    for (const c of clients) {
      c.postMessage({ type: 'push-log', event, detail });
    }
  });
}

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

async function checkPrices(reason) {
  try {
    const config = await getPushConfig();
    const days = Math.max(config.priceFallDays || 14, 2);
    const cacheTtl = config.cacheTtl || 12;
    const isModeRequest = reason === 'drop' || reason === 'rise';
    const checkDrop = isModeRequest ? reason === 'drop' : (config.pushNotificationsEnabled === true);
    const checkRise = isModeRequest ? reason === 'rise' : (config.pushOnPriceRise === true);

    const motivo = reason === 'periodicsync' ? 'alarma periódica'
      : reason === 'drop' ? 'test bajada'
      : reason === 'rise' ? 'test subida'
      : reason === 'setinterval' ? 'intervalo setInterval'
      : 'desconocido';
    sendPushLog('checkPrices', 'inicio — motivo: ' + motivo + ' | checkDrop=' + checkDrop + ' checkRise=' + checkRise + ' días=' + days);

    const favorites = await dbGetAllFavorites();
    if (!favorites || favorites.length === 0) {
      sendPushLog('checkPrices', 'no hay favoritos — fin');
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

    const provCount = Object.keys(byProvince).length;
    sendPushLog('checkPrices', 'procesando ' + favorites.length + ' favoritos en ' + provCount + ' provincias');

    const alerts = [];
    let checkedCount = 0;

    for (const [provKey, favs] of Object.entries(byProvince)) {
      const provId = favs[0].provinceId;
      const provName = favs[0].provinceName;
      if (!provId || !provName) {
        sendPushLog('checkPrices', 'provincia inválida — skip');
        continue;
      }

      try {
        sendPushLog('checkPrices', provName + ': fetch datos frescos');
        const r = await fetch(API_BASE + 'EstacionesTerrestres/FiltroProvincia/' + provId, {
          headers: { 'Accept': 'application/json' }
        });
        if (!r.ok) {
          sendPushLog('checkPrices', provName + ': HTTP ' + r.status + ' — skip');
          continue;
        }
        const json = await r.json();
        const freshData = json.ListaEESSPrecio || [];
        if (!freshData.length) {
          sendPushLog('checkPrices', provName + ': 0 estaciones — skip');
          continue;
        }
        sendPushLog('checkPrices', provName + ': ' + freshData.length + ' estaciones recibidas, guardando caché');
        await cacheProvinceData(provName, freshData, cacheTtl);

        const fetchDays = Math.max(days, 14);
        sendPushLog('checkPrices', provName + ': fetch histórico ' + fetchDays + ' días (ventana=' + days + ')');
        const historyData = await fetchProvinceHistorySW(provId, fetchDays);
        const histDates = Object.keys(historyData).length;
        sendPushLog('checkPrices', provName + ': histórico ' + histDates + ' fechas');

        for (const fav of favs) {
          const station = freshData.find(s => s.IDEESS === fav.id);
          if (!station) {
            sendPushLog('checkPrices', '  ' + (fav.brand || fav.id) + ': no encontrada en datos frescos — skip');
            continue;
          }

          const fuelName = getFirstFuelName(station);
          if (!fuelName) {
            sendPushLog('checkPrices', '  ' + station.Rótulo + ': sin combustible — skip');
            continue;
          }

          const currentPrice = getFirstFuelPrice(station);
          if (currentPrice === null) {
            sendPushLog('checkPrices', '  ' + station.Rótulo + ': sin precio — skip');
            continue;
          }

          const stationHistory = getStationHistorySW(historyData, fav.id, fuelName);
          if (stationHistory.length < 2) {
            sendPushLog('checkPrices', '  ' + station.Rótulo + ': histórico insuficiente (' + stationHistory.length + ' puntos) — skip');
            continue;
          }

          let refPrice, result, modeLabel;
          if (config.priceCheckMode === 'consecutive') {
            const window = stationHistory.slice(-days);
            if (window.length < 2) {
              sendPushLog('checkPrices', '  ' + station.Rótulo + ': ventana consecutiva insuficiente (' + window.length + ' puntos) — skip');
              continue;
            }
            let allDrop = true, allRise = true;
            for (let i = 0; i < window.length - 1; i++) {
              const p1 = parsePrice(window[i].price);
              const p2 = parsePrice(window[i + 1].price);
              if (p1 === null || p2 === null) { allDrop = false; allRise = false; break; }
              const d = p1 - p2;
              if (d > 0) allRise = false;
              else if (d < 0) allDrop = false;
              else { allDrop = false; allRise = false; break; }
            }
            if (!allDrop && !allRise) {
              sendPushLog('checkPrices', '  ' + station.Rótulo + ': sin tendencia consecutiva (' + fuelName + ') — skip');
              continue;
            }
            refPrice = parsePrice(window[0].price);
            if (refPrice === null) {
              sendPushLog('checkPrices', '  ' + station.Rótulo + ': precio referencia inválido — skip');
              continue;
            }
            result = comparePrices(currentPrice, refPrice);
            modeLabel = 'tendencia ' + (allDrop ? '↓ bajada' : '↑ subida') + ' ' + window.length + 'd';
          } else {
            const window = stationHistory.slice(-days);
            if (window.length < 2) {
              sendPushLog('checkPrices', '  ' + station.Rótulo + ': ventana promedio insuficiente (' + window.length + ' puntos) — skip');
              continue;
            }
            let sum = 0;
            let count = 0;
            for (const rec of window) {
              const p = parsePrice(rec.price);
              if (p !== null) { sum += p; count++; }
            }
            if (count < 1) {
              sendPushLog('checkPrices', '  ' + station.Rótulo + ': sin precios válidos en histórico — skip');
              continue;
            }
            refPrice = sum / count;
            result = comparePrices(currentPrice, refPrice);
            modeLabel = 'promedio ' + refPrice.toFixed(3) + ' (' + count + 'd)';
          }

          if (!result) {
            sendPushLog('checkPrices', '  ' + station.Rótulo + ': sin cambio (' + fuelName + ' ' + currentPrice + ' vs ' + modeLabel + ') — skip');
            continue;
          }

          const dir = result.isRise ? '↑ subida' : '↓ bajada';
          if (result.isRise && !checkRise) {
            sendPushLog('checkPrices', '  ' + station.Rótulo + ': ' + dir + ' ' + result.difference.toFixed(3) + '€ — ignorado (subida desactivada)');
            continue;
          }
          if (!result.isRise && !checkDrop) {
            sendPushLog('checkPrices', '  ' + station.Rótulo + ': ' + dir + ' ' + result.difference.toFixed(3) + '€ — ignorado (bajada desactivada)');
            continue;
          }

          checkedCount++;
          alerts.push({
            favoriteId: fav.id,
            brand: station.Rótulo,
            fuel: fuelName,
            currentPrice: currentPrice,
            avgPrice: refPrice,
            difference: result.difference.toFixed(3),
            isRise: result.isRise,
            address: station.Dirección,
            locality: station.Localidad
          });
          sendPushLog('checkPrices', '  ✅ ' + station.Rótulo + ': ' + dir + ' ' + result.difference.toFixed(3) + '€ (' + modeLabel + ' → ' + currentPrice + ') — ALERTA #' + alerts.length);
        }
      } catch (e) {
        sendPushLog('checkPrices', provName + ': error — ' + e.message);
        console.warn('[SW] Error checking province', provName, e.message);
      }
    }

    if (alerts.length > 0) {
      const riseCount = alerts.filter(a => a.isRise).length;
      const dropCount = alerts.filter(a => !a.isRise).length;
      const lines = alerts.slice(0, 4).map(a =>
        (a.isRise ? '↑' : '↓') + ' ' + a.brand + ' · ' + a.fuel + ' ' + (a.isRise ? '+' : '') + a.difference + '€'
      );
      const more = alerts.length > 4 ? ' (+' + (alerts.length - 4) + ' más)' : '';
      const body = lines.join('\n') + more;
      sendPushLog('checkPrices', 'completado: ' + checkedCount + ' alertas (' + dropCount + '↓ ' + riseCount + '↑)');
      sendPushLog('📨 notificación', 'mostrada: título="Alerta de Precios" body="' + body.replace(/\n/g, ' | ') + '" tag=price-alert');
      await self.registration.showNotification('Alerta de Precios', {
        body: body,
        icon: 'icons/icon-192.png',
        badge: 'icons/icon-192.png',
        tag: 'price-alert',
        requireInteraction: true,
        data: { alerts }
      });
      console.log('[SW] Price alert sent:', alerts.length, 'alerts');
    } else {
      sendPushLog('checkPrices', 'completado: 0 alertas — no se envía notificación (sin cambios relevantes)');
    }
  } catch (e) {
    sendPushLog('checkPrices', 'error general: ' + e.message);
    console.error('[SW] checkPrices error:', e.message);
  }
}

// ---- Periodic Background Sync ----

self.addEventListener('periodicsync', event => {
  if (event.tag === 'check-favorite-prices') {
    sendPushLog('⏰ periodicsync', 'iniciado — motivo: alarma periódica del SO');
    event.waitUntil(checkPrices('periodicsync'));
  }
});

// ---- Messages from client ----

self.addEventListener('message', event => {
  if (event.data && event.data.type === 'trigger-price-check') {
    const mode = event.data.mode;
    const motivo = mode === 'drop' ? 'test bajada' : mode === 'rise' ? 'test subida' : 'intervalo setInterval';
    sendPushLog('📩 trigger-price-check', 'recibido — motivo: ' + motivo);
    event.waitUntil(checkPrices(mode || 'setinterval'));
  }
  if (event.data && event.data.type === 'get-version') {
    if (event.ports && event.ports.length) {
      event.ports[0].postMessage({ version: APP_VERSION });
    }
  }
});

// ---- Push event (for server-sent push messages, if any) ----

self.addEventListener('push', event => {
  let data = {};
  try { data = event.data ? event.data.json() : {}; } catch(e) {}
  const title = data.title || 'Alerta de Precios';
  const body = data.body || 'Tus favoritos tienen cambios de precio';
  const tag = data.tag || 'push-alert';
  sendPushLog('📨 push recibido', 'título="' + title + '" body="' + body + '" tag=' + tag);
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
  sendPushLog('notificationclick', 'recibido — título="' + event.notification.title + '" body="' + event.notification.body + '" tag=' + event.notification.tag);

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
