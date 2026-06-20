const API_BASE = 'https://sedeaplicaciones.minetur.gob.es/ServiciosRESTCarburantes/PreciosCarburantes/';

function populateProvinceSelect(provinces) {
  STATE.provinceIdMap = {};
  provinces.forEach(p => { STATE.provinceIdMap[p.name] = p.id; });
  const sorted = provinces.sort((a, b) => a.name.localeCompare(b.name));
  ['provFilter', 'provFilterInit'].forEach(id => {
    const sel = document.getElementById(id);
    if (!sel) return;
    sel.innerHTML = '<option value="">— Selecciona una provincia —</option>';
    sorted.forEach(p => {
      const o = document.createElement('option');
      o.value = p.name;
      o.textContent = p.name;
      sel.appendChild(o);
    });
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

function showProvinceScreen() {
  document.getElementById('noProvinceMsg').classList.remove('hide');
  document.getElementById('map').classList.add('hide');
  document.getElementById('tableWrap').classList.add('hide');
  document.getElementById('info').classList.add('hide');
  document.getElementById('legend').classList.add('hide');
  STATE.data = [];
  STATE.filtered = [];
}

function showDataScreen() {
  document.getElementById('noProvinceMsg').classList.add('hide');
  document.getElementById('map').classList.remove('hide');
  document.getElementById('tableWrap').classList.remove('hide');
  document.getElementById('info').classList.remove('hide');
  document.getElementById('legend').classList.remove('hide');
  if (STATE.map) setTimeout(() => STATE.map.invalidateSize(), 50);
}

async function fetchProvinces() {
  showProvinceScreen();
  document.getElementById('infoText').textContent = 'Cargando lista de provincias...';

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
    document.getElementById('provFilterInit').value = name;
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
      return;
    }
  }

  STATE.data = data;
  STATE.selectedProv = provinceName;
  document.getElementById('provFilter').value = provinceName;
  document.getElementById('provFilterInit').value = provinceName;
  STATE.selectedLoc = '';
  STATE.selectedBrands = [];
  STATE.selectedId = null;
  STATE.selectedFuel = '';
  STATE.page = 1;
  document.getElementById('search').value = '';
  document.getElementById('maxDistance').value = '';
  document.getElementById('fuelFilter').value = '';
  document.getElementById('locFilter').value = '';

  populateFuelFilter(data);
  populateLocFilter();
  populateBrandFilter();
  showDataScreen();
  document.getElementById('infoText').textContent = data.length + ' gasolineras en ' + provinceName;
  await renderCacheInfo();
  render(true);
  saveState();
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