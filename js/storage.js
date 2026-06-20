let _cacheExpiryLabel = '';

const STATE_KEY = 'gasolineras_state';
const DB_NAME = 'gasolineras_db';
const DB_VERSION = 1;
const STORE_NAME = 'cache';

const provinceCacheMap = new Map();

function openDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = (e) => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    };
    req.onsuccess = (e) => resolve(e.target.result);
    req.onerror = (e) => { console.warn('IndexedDB error:', e.target.error); reject(e.target.error); };
  });
}

function dbGet(key) {
  return new Promise(async (resolve, reject) => {
    try {
      const db = await openDB();
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const req = store.get(key);
      req.onsuccess = () => { db.close(); resolve(req.result); };
      req.onerror = () => { db.close(); resolve(null); };
    } catch(e) { resolve(null); }
  });
}

function dbPut(key, value) {
  return new Promise(async (resolve, reject) => {
    try {
      const db = await openDB();
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const req = store.put(value, key);
      req.onsuccess = () => { db.close(); resolve(); };
      req.onerror = () => { db.close(); resolve(); };
    } catch(e) { resolve(); }
  });
}

function dbDelete(key) {
  return new Promise(async (resolve, reject) => {
    try {
      const db = await openDB();
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const req = store.delete(key);
      req.onsuccess = () => { db.close(); resolve(); };
      req.onerror = () => { db.close(); resolve(); };
    } catch(e) { resolve(); }
  });
}

function dbClear() {
  return new Promise(async (resolve, reject) => {
    try {
      const db = await openDB();
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const req = store.clear();
      req.onsuccess = () => { db.close(); resolve(); };
      req.onerror = () => { db.close(); resolve(); };
    } catch(e) { resolve(); }
  });
}

function dbGetAllKeys() {
  return new Promise(async (resolve, reject) => {
    try {
      const db = await openDB();
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const req = store.getAllKeys();
      req.onsuccess = () => { db.close(); resolve(req.result); };
      req.onerror = () => { db.close(); resolve([]); };
    } catch(e) { resolve([]); }
  });
}

function getCacheTtl() {
  const v = parseInt(document.getElementById('cacheTtl').value);
  return (isNaN(v) || v < 0) ? 12 : v;
}

function isLocalStorageAvailable() {
  try { const k = '_test_'; localStorage.setItem(k, '1'); localStorage.removeItem(k); return true; }
  catch(e) { return false; }
}

async function getCachedProvinceData(province) {
  if (provinceCacheMap.has(province)) {
    return provinceCacheMap.get(province);
  }
  try {
    const cached = await dbGet('prov_' + province);
    if (!cached || !cached.timestamp || !Array.isArray(cached.data)) return null;
    const ttl = (cached.ttl || 12) * 60 * 60 * 1000;
    if (Date.now() - cached.timestamp > ttl) {
      await dbDelete('prov_' + province);
      return null;
    }
    provinceCacheMap.set(province, cached.data);
    return cached.data;
  } catch(e) {
    return null;
  }
}

async function cacheProvinceData(province, data) {
  provinceCacheMap.set(province, data);
  try {
    const ttl = getCacheTtl();
    await dbPut('prov_' + province, { data, timestamp: Date.now(), ttl });
  } catch(e) {}
}

async function getCachedProvinces() {
  try {
    const cached = await dbGet('provinces_list');
    if (!cached || !cached.timestamp || !Array.isArray(cached.data)) return null;
    if (Date.now() - cached.timestamp > 7 * 24 * 60 * 60 * 1000) {
      await dbDelete('provinces_list');
      return null;
    }
    return cached.data;
  } catch(e) {
    return null;
  }
}

async function setCachedProvinces(data) {
  try {
    await dbPut('provinces_list', { data, timestamp: Date.now() });
  } catch(e) {}
}

async function renderCacheInfo() {
  const el = document.getElementById('cacheInfo');
  _cacheExpiryLabel = '';
  if (!el) return;
  const prov = STATE.selectedProv;
  if (!prov) {
    el.innerHTML = '<span style="color:#999">Selecciona una provincia</span>';
    return;
  }
  try {
    const cached = await dbGet('prov_' + prov);
    if (!cached || !cached.timestamp || !Array.isArray(cached.data)) {
      el.innerHTML = '<span style="color:#999">Sin datos en caché</span>';
      return;
    }
    const count = cached.data.length;
    const loaded = new Date(cached.timestamp);
    const ttlHours = cached.ttl || 12;
    const expires = new Date(cached.timestamp + ttlHours * 60 * 60 * 1000);
    const now = Date.now();
    _cacheExpiryLabel = ` · Expira ${expires.toLocaleString([], {day:'2-digit',month:'2-digit',year:'numeric',hour:'2-digit',minute:'2-digit'})}`;
    el.innerHTML = `<span>${count} gasolineras · Cargado: ${loaded.toLocaleString()}${_cacheExpiryLabel}</span>`;
  } catch(e) {
    el.innerHTML = '<span style="color:#999">No disponible</span>';
  }
}

async function renderProvinceCacheInfo() {
  const el = document.getElementById('provCacheInfo');
  if (!el) return;
  try {
    const keys = await dbGetAllKeys();
    const provKeys = keys.filter(k => typeof k === 'string' && k.startsWith('prov_'));
    if (!provKeys.length) {
      el.innerHTML = '<span style="color:#999">Sin provincias en caché</span>';
      return;
    }
    const items = [];
    for (const key of provKeys) {
      const entry = await dbGet(key);
      if (entry && Array.isArray(entry.data)) {
        const provName = key.slice(5);
        const ttl = (entry.ttl || 12) * 60 * 60 * 1000;
        const valid = Date.now() - entry.timestamp <= ttl;
        items.push(`${provName} (${entry.data.length})${valid ? '' : ' ⏳'}`);
      }
    }
    el.innerHTML = '<span>' + items.join(' · ') + '</span>';
  } catch(e) {
    el.innerHTML = '<span style="color:#999">No disponible</span>';
  }
}

function saveState() {
  const s = STATE;
  const center = s.map ? s.map.getCenter() : null;
  const zoom = s.map ? s.map.getZoom() : null;
  const data = {
    search: document.getElementById('search').value,
    selectedFuel: s.selectedFuel,
    selectedProv: s.selectedProv,
    selectedLoc: s.selectedLoc,
    selectedBrands: s.selectedBrands,
    discounts: s.discounts,
    sortCol: s.sortCol,
    sortDir: s.sortDir,
    selectedId: s.selectedId,
    viewMode: s.viewMode,
    selectedTile: s.selectedTile,
    mapHeight: s.mapHeight || null,
    mapCenter: center ? [center.lat, center.lng] : null,
    mapZoom: zoom,
    maxDistance: s.maxDistance,
    pageSize: s.pageSize,
    favorites: s.favorites,
    showFavoritesOnly: s.showFavoritesOnly
  };
  try { localStorage.setItem(STATE_KEY, JSON.stringify(data)); } catch(e) {}
}

function loadState() {
  try {
    const raw = localStorage.getItem(STATE_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch(e) { return null; }
}
