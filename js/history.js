// Histórico de precios: fuente ÚNICA de verdad, compartida por la página y el
// Service Worker (sw.js la carga con importScripts). Antes estas funciones
// estaban duplicadas en api.js y sw.js, con dos comparadores de fechas
// dd-mm-aaaa distintos (el del SW se olvidaba del unary + en el año).
//
// Depende solo de state.js/helpers.js/db.js, que es justo lo que el SW importa.

function formatDateDDMMYYYY(date) {
  const d = date.getDate().toString().padStart(2, '0');
  const m = (date.getMonth() + 1).toString().padStart(2, '0');
  const y = date.getFullYear();
  return d + '-' + m + '-' + y;
}

// Las fechas del Ministerio vienen como dd-mm-aaaa, asi que un sort() normal
// las ordenaria mal ("29-08" > "01-09"). Este es el comparador correcto.
function sortHistoryDates(keys) {
  return keys.slice().sort((a, b) => {
    const [da, ma, ya] = a.split('-');
    const [db, mb, yb] = b.split('-');
    return new Date(+ya, +ma - 1, +da) - new Date(+yb, +mb - 1, +db);
  });
}

// Los últimos `days` días, del más antiguo al más reciente, a medianoche.
function historyDateList(days) {
  const dates = [];
  for (let i = days; i >= 1; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    d.setHours(0, 0, 0, 0);
    dates.push(d);
  }
  return dates;
}

// Petición de una fecha del Ministerio. En el cliente delega en apiFetch()
// (que registra la llamada en el log de la API); en el Service Worker
// apiFetch no existe y cae en un fetch simple.
function historyRequest(url) {
  if (typeof apiFetch === 'function') return apiFetch(url);
  return fetch(url, { headers: { 'Accept': 'application/json' } });
}

// Descarga el histórico de una provincia por su id, reutilizando la caché de
// IndexedDB (clave hist_<idIdProvincia>_<dd-mm-aaaa>) y agrupando las peticiones
// de 3 en 3 para no saturar el Ministerio. Es la que usan el modal de detalle,
// el popup del mapa, el chat de IA y el chequeo de precios del SW.
async function fetchHistoryByProvinceId(provinceId, days) {
  if (!provinceId) return {};
  const dates = historyDateList(days || HISTORY_DAYS_DEFAULT);
  const results = {};
  const CHUNK = 3;
  for (let i = 0; i < dates.length; i += CHUNK) {
    const chunk = dates.slice(i, i + CHUNK);
    const promises = chunk.map(async (date) => {
      const dateStr = formatDateDDMMYYYY(date);
      const cacheKey = 'hist_' + provinceId + '_' + dateStr;
      const cached = await dbGet('cache', cacheKey);
      if (cached && cached.data) {
        results[dateStr] = cached.data;
        return;
      }
      try {
        const r = await historyRequest(API_BASE + 'EstacionesTerrestresHist/FiltroProvincia/' + dateStr + '/' + provinceId);
        if (r.ok) {
          const json = await r.json();
          const list = json.ListaEESSPrecio || [];
          results[dateStr] = list;
          await dbPut('cache', cacheKey, { data: list, timestamp: Date.now() });
        }
      } catch (e) { console.warn('Histórico: error en', dateStr, provinceId, e.message); }
    });
    await Promise.all(promises);
  }
  return results;
}

// Serie de precios de una estación: [{ date: 'dd-mm-aaaa', price, fuel? }].
// Si `fuelName` es un grupo (Gasolina, Gasóleo) usa el primer combustible del
// grupo con precio ese día; si no hay ninguno, el primero con precio.
function getStationHistory(historyByDate, stationId, fuelName) {
  const isGroup = FUEL_GROUPS[fuelName] ? true : false;
  const groupMembers = isGroup ? FUEL_GROUPS[fuelName] : [fuelName];
  const results = [];
  const dates = sortHistoryDates(Object.keys(historyByDate));
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