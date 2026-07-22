const API_BASE = 'https://sedeaplicaciones.minetur.gob.es/ServiciosRESTCarburantes/PreciosCarburantes/';
const API_LOG = [];

async function apiFetch(url) {
  const start = performance.now();
  try {
    const res = await fetch(url, { headers: { 'Accept': 'application/json' } });
    const ms = (performance.now() - start).toFixed(0);
    API_LOG.unshift({ url, ms: ms + 'ms', time: (() => { const d = new Date(); return d.getDate().toString().padStart(2,'0') + '/' + (d.getMonth()+1).toString().padStart(2,'0') + '/' + d.getFullYear().toString().slice(-2) + ' ' + d.getHours().toString().padStart(2,'0') + ':' + d.getMinutes().toString().padStart(2,'0') + ':' + d.getSeconds().toString().padStart(2,'0'); })(), ok: res.ok });
    if (API_LOG.length > 30) API_LOG.length = 30;
    try { localStorage.setItem('gasolineras_api_log', JSON.stringify(API_LOG)); } catch(e) {}
    renderApiLog();
    return res;
  } catch (e) {
    const ms = (performance.now() - start).toFixed(0);
    API_LOG.unshift({ url, ms: ms + 'ms', time: (() => { const d = new Date(); return d.getDate().toString().padStart(2,'0') + '/' + (d.getMonth()+1).toString().padStart(2,'0') + '/' + d.getFullYear().toString().slice(-2) + ' ' + d.getHours().toString().padStart(2,'0') + ':' + d.getMinutes().toString().padStart(2,'0') + ':' + d.getSeconds().toString().padStart(2,'0'); })(), ok: false });
    if (API_LOG.length > 30) API_LOG.length = 30;
    try { localStorage.setItem('gasolineras_api_log', JSON.stringify(API_LOG)); } catch(e) {}
    renderApiLog();
    throw e;
  }
}

function renderApiLog() {
  const el = document.getElementById('apiLogEntries');
  if (!el) return;
  if (!API_LOG.length) {
    el.innerHTML = '<span style="color:#999">Sin llamadas registradas</span>';
    return;
  }
  el.innerHTML = API_LOG.map(l =>
    `<div style="margin-bottom:0.1rem">${l.time} <span style="color:${l.ok ? '#2e7d32' : '#c62828'}">${l.ms}</span> ${l.url}</div>`
  ).join('');
}

function clearApiLog() {
  API_LOG.length = 0;
  try { localStorage.removeItem('gasolineras_api_log'); } catch(e) {}
  renderApiLog();
}

function populateProvinceSelect(provinces) {
  STATE.provinceIdMap = {};
  provinces.forEach(p => { STATE.provinceIdMap[p.name] = p.id; });
  const sorted = provinces.sort((a, b) => a.name.localeCompare(b.name));
  const sel = document.getElementById('provFilter');
  if (!sel) return;
  sel.innerHTML = '<option value="">— Selecciona una provincia —</option>';
  sorted.forEach(p => {
    const o = document.createElement('option');
    o.value = p.name;
    o.textContent = p.name;
    sel.appendChild(o);
  });
}

function populateFuelFilter(data) {
  const fset = new Set();
  data.forEach(d => {
    for (const [n, k] of FUEL_NAMES) { if (getFuelPrice(d, k) !== null) fset.add(n); }
  });
  const sel = document.getElementById('fuelFilter');
  sel.innerHTML = '<option value="">Combustible</option>';
  for (const [gname, members] of Object.entries(FUEL_GROUPS)) {
    if (members.some(m => fset.has(m))) {
      const o = document.createElement('option'); o.value = gname; o.textContent = gname;
      sel.appendChild(o);
    }
  }
  Array.from(fset).filter(f => !GROUP_MEMBERS.has(f)).sort().forEach(f => {
    const o = document.createElement('option'); o.value = f; o.textContent = f;
    sel.appendChild(o);
  });
}

function setLoading(active) {
  document.getElementById('contentArea').classList.toggle('loading', active);
}

function showProvinceScreen() {
  document.getElementById('contentArea').classList.add('no-province');
  STATE.data = [];
  STATE.filtered = [];
}

function showDataScreen() {
  document.getElementById('contentArea').classList.remove('no-province');
  if (STATE.map) setTimeout(() => STATE.map.invalidateSize(), 50);
}

async function fetchProvinces() {
  showProvinceScreen();
  document.getElementById('infoText').textContent = 'Cargando lista de provincias...';
  setActiveTab('tab-map');

  let provinces = await getCachedProvinces();
  if (provinces && provinces.length && typeof provinces[0].id === 'string') {
    STATE.provinces = provinces;
    populateProvinceSelect(provinces);
    document.getElementById('infoText').textContent = 'Selecciona una provincia para ver los precios';
    tryAutoRestoreProvince();
    return;
  }
  if (provinces) await dbDelete('provinces_list');

  try {
    const r = await apiFetch(API_BASE + 'Listados/Provincias/');
    if (!r.ok) throw new Error('HTTP ' + r.status);
    const json = await r.json();
    if (!Array.isArray(json)) throw new Error('Formato inesperado');
    provinces = json.map(p => ({ id: p.IDPovincia, name: p.Provincia }));
    STATE.provinces = provinces;
    populateProvinceSelect(provinces);
    await setCachedProvinces(provinces);
    document.getElementById('infoText').textContent = 'Selecciona una provincia para ver los precios';
    tryAutoRestoreProvince();
  } catch (e) {
    document.getElementById('infoText').textContent = 'Error al cargar provincias: ' + e.message;
  }
  try { await dbDelete('main_cache'); } catch(e) {}
}

function tryAutoRestoreProvince() {
  const saved = loadState();
  if (!saved || !saved.selectedProv) return;
  const name = STATE.provinceIdMap[saved.selectedProv] ? saved.selectedProv
    : STATE.provinceIdMap[saved.selectedProv.toUpperCase()] ? saved.selectedProv.toUpperCase()
    : null;
  if (name) {
    document.getElementById('provFilter').value = name;
    fetchProvinceData(name);
  }
}

async function fetchProvinceData(provinceName) {
  const provId = STATE.provinceIdMap[provinceName];
  if (!provId) {
    document.getElementById('infoText').textContent = 'Error: provincia no válida';
    return;
  }

  document.getElementById('infoText').textContent = 'Cargando datos de ' + provinceName + '...';
  setLoading(true);

  let data = await getCachedProvinceData(provinceName);

  if (!data) {
    try {
      const r = await apiFetch(API_BASE + 'EstacionesTerrestres/FiltroProvincia/' + provId);
      if (!r.ok) throw new Error('HTTP ' + r.status);
      const json = await r.json();
      data = json.ListaEESSPrecio || [];
      if (!data.length) throw new Error('Sin datos');
      await cacheProvinceData(provinceName, data, getCacheTtl());
    } catch (e) {
      document.getElementById('infoText').textContent = 'Error al cargar ' + provinceName + ': ' + e.message;
      setLoading(false);
      return;
    }
  }

  STATE.data = data;
  STATE.selectedProv = provinceName;
  document.getElementById('provFilter').value = provinceName;

  populateFuelFilter(data);
  populateLocFilter();
  populateBrandFilter();

  const saved = loadProvinceFilters(provinceName);
  if (saved) {
    STATE.selectedFuel = saved.selectedFuel || '';
    STATE.selectedLoc = saved.selectedLoc || '';
    STATE.selectedBrands = saved.selectedBrands || [];
    STATE.maxDistance = saved.maxDistance || '';
    STATE.showFavoritesOnly = saved.showFavoritesOnly || false;
    STATE.page = saved.page || 1;
    document.getElementById('search').value = saved.search || '';
    document.getElementById('maxDistance').value = saved.maxDistance || '';
    document.getElementById('fuelFilter').value = STATE.selectedFuel;
    document.getElementById('locFilter').value = STATE.selectedLoc;
    applyBrandFilter();
  } else {
    STATE.selectedFuel = '';
    STATE.selectedLoc = '';
    STATE.selectedBrands = [];
    STATE.selectedId = null;
    STATE.page = 1;
    STATE.maxDistance = '';
    STATE.showFavoritesOnly = false;
    document.getElementById('search').value = '';
    document.getElementById('maxDistance').value = '';
    document.getElementById('fuelFilter').value = '';
    document.getElementById('locFilter').value = '';
  }

  const savedGlobal = loadState();
  if (savedGlobal) {
    if (savedGlobal.activeTab) setActiveTab(savedGlobal.activeTab);
    if (savedGlobal.sortCol) STATE.sortCol = savedGlobal.sortCol;
    if (savedGlobal.sortDir) STATE.sortDir = savedGlobal.sortDir;
    if (savedGlobal.mapCenter && savedGlobal.mapZoom) {
      STATE.map.setView(savedGlobal.mapCenter, savedGlobal.mapZoom);
    }
  }

  showDataScreen();
  document.getElementById('infoText').textContent = data.length + ' gasolineras en ' + provinceName;
  await renderCacheInfo();
  render(true);
  saveState();
  setLoading(false);
}

async function clearCache() {
  try {
    const keys = await dbGetAllKeys();
    for (const key of keys) {
      if (typeof key === 'string' && (key.startsWith('prov_') || key === 'main_cache' || key === 'provinces_list' || key.startsWith('hist_'))) {
        await dbDelete(key);
      }
    }
  } catch (e) {}
  clearProvinceCacheMap();
  STATE.data = [];
  STATE.filtered = [];
  window._historyCache = null;
  showProvinceScreen();
  document.getElementById('infoText').textContent = 'Caché limpiada. Selecciona una provincia.';
  document.getElementById('cacheInfo').innerHTML = '<span style="color:#999">Sin datos en caché</span>';
  document.getElementById('provCacheInfo').innerHTML = '<span style="color:#999">Sin provincias en caché</span>';
  await fetchProvinces();
}

function locateUser() {
  if (!navigator.geolocation) { alert('Geolocalización no soportada'); return; }
  const btn = document.getElementById('geolocBtn');
  btn.textContent = '⏳';
  btn.classList.add('locating');
  navigator.geolocation.getCurrentPosition(
    pos => {
      STATE.userLat = pos.coords.latitude;
      STATE.userLng = pos.coords.longitude;
      updateUserMarker(STATE.userLat, STATE.userLng);
      btn.textContent = '📍';
      btn.classList.remove('locating');
      btn.blur();
      render(true);
    },
    err => {
      btn.textContent = '📍';
      btn.classList.remove('locating');
      btn.blur();
      alert('No se pudo obtener la ubicación: ' + err.message);
    },
    { enableHighAccuracy: true, timeout: 10000 }
  );
}

function formatDateDDMMYYYY(date) {
  const d = date.getDate().toString().padStart(2, '0');
  const m = (date.getMonth() + 1).toString().padStart(2, '0');
  const y = date.getFullYear();
  return d + '-' + m + '-' + y;
}

async function fetchProvinceHistory(provinceName, days) {
  const provId = STATE.provinceIdMap[provinceName];
  if (!provId) return {};
  const dates = [];
  if (!days) days = STATE.historyDays || 14;
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
      const cacheKey = 'hist_' + provId + '_' + dateStr;
      let cached = await dbGet(cacheKey);
      if (cached && cached.data) {
        results[dateStr] = cached.data;
        return;
      }
      try {
        const r = await apiFetch(API_BASE + 'EstacionesTerrestresHist/FiltroProvincia/' + dateStr + '/' + provId);
        if (r.ok) {
          const json = await r.json();
          const list = json.ListaEESSPrecio || [];
          results[dateStr] = list;
          await dbPut(cacheKey, { data: list, timestamp: Date.now() });
        }
      } catch (e) { console.warn('Histórico: error en', dateStr, provId, e.message); }
    });
    await Promise.all(promises);
  }
  return results;
}

function getStationHistory(historyByDate, stationId, fuelName) {
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
