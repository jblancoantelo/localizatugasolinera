const API_BASE = 'https://sedeaplicaciones.minetur.gob.es/ServiciosRESTCarburantes/PreciosCarburantes/';

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
    const r = await fetch(API_BASE + 'Listados/Provincias/', { headers: { 'Accept': 'application/json' } });
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
      const r = await fetch(API_BASE + 'EstacionesTerrestres/FiltroProvincia/' + provId, {
        headers: { 'Accept': 'application/json' }
      });
      if (!r.ok) throw new Error('HTTP ' + r.status);
      const json = await r.json();
      data = json.ListaEESSPrecio || [];
      if (!data.length) throw new Error('Sin datos');
      await cacheProvinceData(provinceName, data);
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
      if (typeof key === 'string' && (key.startsWith('prov_') || key === 'main_cache' || key === 'provinces_list')) {
        await dbDelete(key);
      }
    }
  } catch (e) {}
  provinceCacheMap.clear();
  STATE.data = [];
  STATE.filtered = [];
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
      updatePosInfo();
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
