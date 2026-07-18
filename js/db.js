const DB_NAME = 'gasolineras_db';
const DB_VERSION = 2;
const provinceCacheMap = new Map();

function openDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = (e) => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains('cache')) {
        db.createObjectStore('cache');
      }
      if (!db.objectStoreNames.contains('favorites')) {
        db.createObjectStore('favorites', { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains('config')) {
        db.createObjectStore('config');
      }
    };
    req.onsuccess = (e) => resolve(e.target.result);
    req.onerror = (e) => { console.warn('IndexedDB error:', e.target.error); reject(e.target.error); };
  });
}

function dbGet(storeName, key) {
  return new Promise(async (resolve) => {
    try {
      const db = await openDB();
      const tx = db.transaction(storeName, 'readonly');
      const store = tx.objectStore(storeName);
      const req = store.get(key);
      req.onsuccess = () => { db.close(); resolve(req.result); };
      req.onerror = () => { db.close(); resolve(null); };
    } catch(e) { resolve(null); }
  });
}

function dbPut(storeName, key, value) {
  return new Promise(async (resolve) => {
    try {
      const db = await openDB();
      const tx = db.transaction(storeName, 'readwrite');
      const store = tx.objectStore(storeName);
      const req = key !== undefined ? store.put(value, key) : store.put(value);
      req.onsuccess = () => { db.close(); resolve(); };
      req.onerror = () => { db.close(); resolve(); };
    } catch(e) { resolve(); }
  });
}

function dbDelete(storeName, key) {
  return new Promise(async (resolve) => {
    try {
      const db = await openDB();
      const tx = db.transaction(storeName, 'readwrite');
      const store = tx.objectStore(storeName);
      const req = store.delete(key);
      req.onsuccess = () => { db.close(); resolve(); };
      req.onerror = () => { db.close(); resolve(); };
    } catch(e) { resolve(); }
  });
}

function dbClear(storeName) {
  return new Promise(async (resolve) => {
    try {
      const db = await openDB();
      const tx = db.transaction(storeName, 'readwrite');
      const store = tx.objectStore(storeName);
      const req = store.clear();
      req.onsuccess = () => { db.close(); resolve(); };
      req.onerror = () => { db.close(); resolve(); };
    } catch(e) { resolve(); }
  });
}

function dbGetAllKeys(storeName) {
  return new Promise(async (resolve) => {
    try {
      const db = await openDB();
      const tx = db.transaction(storeName, 'readonly');
      const store = tx.objectStore(storeName);
      const req = store.getAllKeys();
      req.onsuccess = () => { db.close(); resolve(req.result); };
      req.onerror = () => { db.close(); resolve([]); };
    } catch(e) { resolve([]); }
  });
}

function dbGetAll(storeName) {
  return new Promise(async (resolve) => {
    try {
      const db = await openDB();
      const tx = db.transaction(storeName, 'readonly');
      const store = tx.objectStore(storeName);
      const req = store.getAll();
      req.onsuccess = () => { db.close(); resolve(req.result); };
      req.onerror = () => { db.close(); resolve([]); };
    } catch(e) { resolve([]); }
  });
}

// ---- Cache operations (store: 'cache') ----

async function getCachedProvinceData(province) {
  if (provinceCacheMap.has(province)) {
    return provinceCacheMap.get(province);
  }
  try {
    const cached = await dbGet('cache', 'prov_' + province);
    if (!cached || !cached.timestamp || !Array.isArray(cached.data)) return null;
    const ttl = (cached.ttl || 12) * 60 * 60 * 1000;
    if (Date.now() - cached.timestamp > ttl) {
      await dbDelete('cache', 'prov_' + province);
      return null;
    }
    provinceCacheMap.set(province, cached.data);
    return cached.data;
  } catch(e) { return null; }
}

async function cacheProvinceData(province, data, ttl) {
  if (!province || !data) return;
  provinceCacheMap.set(province, data);
  try {
    await dbPut('cache', 'prov_' + province, { data, timestamp: Date.now(), ttl: ttl || 12 });
  } catch(e) {}
}

async function getCachedProvinces() {
  try {
    const cached = await dbGet('cache', 'provinces_list');
    if (!cached || !cached.timestamp || !Array.isArray(cached.data)) return null;
    if (Date.now() - cached.timestamp > 7 * 24 * 60 * 60 * 1000) {
      await dbDelete('cache', 'provinces_list');
      return null;
    }
    return cached.data;
  } catch(e) { return null; }
}

async function setCachedProvinces(data) {
  try {
    await dbPut('cache', 'provinces_list', { data, timestamp: Date.now() });
  } catch(e) {}
}

function clearProvinceCacheMap() {
  provinceCacheMap.clear();
}

// ---- Favorites operations (store: 'favorites') ----

async function dbGetAllFavorites() {
  try {
    return await dbGetAll('favorites');
  } catch(e) { return []; }
}

async function dbAddFavorite(fav) {
  if (!fav || !fav.id) return;
  try {
    await dbPut('favorites', undefined, fav);
  } catch(e) {}
}

async function dbRemoveFavorite(id) {
  if (!id) return;
  try {
    await dbDelete('favorites', id);
  } catch(e) {}
}

// ---- Config operations (store: 'config') ----

async function getPushConfig() {
  try {
    const cfg = await dbGet('config', 'push_config');
    return cfg || { checkInterval: 8, priceFallDays: 3, cacheTtl: 12, pushNotificationsEnabled: false, pushOnPriceRise: false, priceCheckMode: 'average' };
  } catch(e) { return { checkInterval: 8, priceFallDays: 3, cacheTtl: 12, pushNotificationsEnabled: false, pushOnPriceRise: false, priceCheckMode: 'average' }; }
}

async function setPushConfig(config) {
  if (!config) return;
  try {
    await dbPut('config', 'push_config', config);
  } catch(e) {}
}
