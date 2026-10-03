const API_BASE = 'https://sedeaplicaciones.minetur.gob.es/ServiciosRESTCarburantes/PreciosCarburantes/';
const API_LOG_RING = (typeof createRingLog === 'function') ? createRingLog(30) : (() => {
  const arr = [];
  return { push(v){ arr.push(v); if (arr.length>30) arr.shift(); return arr.slice(); }, clear(){ arr.length=0; }, all(){ return arr.slice(); } };
})();

async function apiFetch(url) {
  const start = performance.now();
  try {
    const res = await fetch(url, { headers: { 'Accept': 'application/json' } });
    const ms = (performance.now() - start).toFixed(0);
    API_LOG_RING.push({ url, ms: ms + 'ms', time: (() => { const d = new Date(); return d.getDate().toString().padStart(2,'0') + '/' + (d.getMonth()+1).toString().padStart(2,'0') + '/' + d.getFullYear().toString().slice(-2) + ' ' + d.getHours().toString().padStart(2,'0') + ':' + d.getMinutes().toString().padStart(2,'0') + ':' + d.getSeconds().toString().padStart(2,'0'); })(), ok: res.ok });
    try { localStorage.setItem('gasolineras_api_log', JSON.stringify(API_LOG_RING.all())); } catch(e) {}
    renderApiLog();
    return res;
  } catch (e) {
    const ms = (performance.now() - start).toFixed(0);
    API_LOG_RING.push({ url, ms: ms + 'ms', time: (() => { const d = new Date(); return d.getDate().toString().padStart(2,'0') + '/' + (d.getMonth()+1).toString().padStart(2,'0') + '/' + d.getFullYear().toString().slice(-2) + ' ' + d.getHours().toString().padStart(2,'0') + ':' + d.getMinutes().toString().padStart(2,'0') + ':' + d.getSeconds().toString().padStart(2,'0'); })(), ok: false, error: e.message });
    try { localStorage.setItem('gasolineras_api_log', JSON.stringify(API_LOG_RING.all())); } catch(e2) {}
    renderApiLog();
    throw e;
  }
}

function renderApiLog() {
  const el = document.getElementById('apiLogEntries');
  if (!el) return;
    if (!API_LOG_RING.all().length) {
    el.innerHTML = '<span style="color:#999">Sin llamadas registradas</span>';
    return;
  }
    el.innerHTML = API_LOG_RING.all().slice().reverse().map(l =>
    `<div style="margin-bottom:0.1rem">${l.time} <span style="color:${l.ok ? '#2e7d32' : '#c62828'}">${l.ms}</span> ${l.url}</div>`
  ).join('');
}

function clearApiLog() {
  API_LOG_RING.clear();
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
  if (provinces) await dbDelete('cache', 'provinces_list');

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
    STATE.booting = false;
  }
  try { await dbDelete('cache', 'main_cache'); } catch(e) {}
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
  STATE.booting = false;

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
    const keys = await dbGetAllKeys('cache');
    for (const key of keys) {
      if (typeof key === 'string' && (key.startsWith('prov_') || key === 'main_cache' || key === 'provinces_list' || key.startsWith('hist_'))) {
        await dbDelete('cache', key);
      }
    }
  } catch (e) {}
  clearProvinceCacheMap();
  STATE.data = [];
  STATE.filtered = [];
  window._historyCache = null;
  window._aiHistoryCache = null;
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

// El histórico vive en js/history.js (compartido con el Service Worker).
// Aquí solo se resuelve el nombre de la provincia a su id.
function fetchProvinceHistory(provinceName, days) {
  return fetchHistoryByProvinceId(STATE.provinceIdMap[provinceName], days);
}
