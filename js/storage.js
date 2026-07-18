let _cacheExpiryLabel = '';
let _savePending = false;

const STATE_KEY = 'gasolineras_state';
const PROV_FILTER_PREFIX = 'gasolineras_prov_filters_';

function getCacheTtl() {
  const v = parseInt(document.getElementById('cacheTtl').value);
  return (isNaN(v) || v < 0) ? 12 : v;
}

function isLocalStorageAvailable() {
  try { const k = '_test_'; localStorage.setItem(k, '1'); localStorage.removeItem(k); return true; }
  catch(e) { return false; }
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
    const cached = await dbGet('cache', 'prov_' + prov);
    if (!cached || !cached.timestamp || !Array.isArray(cached.data)) {
      el.innerHTML = '<span style="color:#999">Sin datos en caché</span>';
      return;
    }
    const count = cached.data.length;
    const loaded = new Date(cached.timestamp);
    const ttlHours = cached.ttl || 12;
    const expires = new Date(cached.timestamp + ttlHours * 60 * 60 * 1000);
    _cacheExpiryLabel = ' · Expira ' + expires.toLocaleString([], {day:'2-digit',month:'2-digit',year:'numeric',hour:'2-digit',minute:'2-digit'});
    el.innerHTML = '<span>' + count + ' gasolineras · Cargado: ' + loaded.toLocaleString() + _cacheExpiryLabel + '</span>';
  } catch(e) {
    el.innerHTML = '<span style="color:#999">No disponible</span>';
  }
}

async function renderProvinceCacheInfo() {
  const el = document.getElementById('provCacheInfo');
  if (!el) return;
  try {
    const keys = await dbGetAllKeys('cache');
    if (!keys.length) {
      el.innerHTML = '<span style="color:#999">Sin datos en IndexedDB</span>';
      return;
    }
    const sections = [];
    const provKeys = keys.filter(k => typeof k === 'string' && k.startsWith('prov_'));
    if (provKeys.length) {
      const items = [];
      for (const key of provKeys) {
        const entry = await dbGet('cache', key);
        if (entry && Array.isArray(entry.data)) {
          const provName = key.slice(5);
          const ttl = (entry.ttl || 12) * 60 * 60 * 1000;
          const valid = Date.now() - entry.timestamp <= ttl;
          items.push(provName + ' (' + entry.data.length + ')' + (valid ? '' : ' ⏳'));
        }
      }
      sections.push('<b>Provincias (' + items.length + '):</b> ' + items.join(' · '));
    }
    const histKeys = keys.filter(k => typeof k === 'string' && k.startsWith('hist_'));
    if (histKeys.length) {
      sections.push('<b>Histórico:</b> ' + histKeys.length + ' entradas');
    }
    const otherKeys = keys.filter(k => typeof k === 'string' && !k.startsWith('prov_') && !k.startsWith('hist_'));
    if (otherKeys.length) {
      sections.push('<b>Otras (' + otherKeys.length + '):</b> ' + otherKeys.join(', '));
    }
    el.innerHTML = '<span>' + sections.join('<br>') + '</span>';
  } catch(e) {
    el.innerHTML = '<span style="color:#999">No disponible</span>';
  }
}

function loadProvinceFilters(prov) {
  try {
    const raw = localStorage.getItem(PROV_FILTER_PREFIX + prov);
    return raw ? JSON.parse(raw) : null;
  } catch(e) { return null; }
}

function saveProvinceFilters(prov) {
  if (!prov) return;
  try {
    const filters = {
      search: document.getElementById('search').value,
      selectedFuel: STATE.selectedFuel,
      selectedLoc: STATE.selectedLoc,
      selectedBrands: STATE.selectedBrands,
      maxDistance: STATE.maxDistance,
      showFavoritesOnly: STATE.showFavoritesOnly,
      page: STATE.page
    };
    localStorage.setItem(PROV_FILTER_PREFIX + prov, JSON.stringify(filters));
  } catch(e) {}
}

function saveState() {
  if (_savePending) { _savePending = 'pending'; return; }
  _savePending = true;
  Promise.resolve().then(() => {
    const needsResave = _savePending === 'pending';
    _savePending = false;
    if (needsResave) { saveState(); return; }
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
      activeTab: s.activeTab,
      selectedTile: s.selectedTile,
      mapCenter: center ? [center.lat, center.lng] : null,
      mapZoom: zoom,
      maxDistance: s.maxDistance,
      pageSize: s.pageSize,
      favorites: s.favorites,
      showFavoritesOnly: s.showFavoritesOnly,
      userLat: s.userLat,
      userLng: s.userLng,
      checkInterval: s.checkInterval,
      priceFallDays: s.priceFallDays,
      priceCheckMode: s.priceCheckMode,
      pushNotificationsEnabled: s.pushNotificationsEnabled,
      pushOnPriceRise: s.pushOnPriceRise
    };
    try { localStorage.setItem(STATE_KEY, JSON.stringify(data)); } catch(e) {}
    saveProvinceFilters(s.selectedProv);
  });
}

function loadState() {
  try {
    const raw = localStorage.getItem(STATE_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch(e) { return null; }
}

function renderLocalStorageCache() {
  const el = document.getElementById('lsCacheInfo');
  if (!el) return;
  try {
    const items = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (!key || !key.startsWith('gasolineras_')) continue;
      const val = localStorage.getItem(key);
      let desc = val;
      try { const p = JSON.parse(val); desc = typeof p === 'object' ? JSON.stringify(p).slice(0, 120) + (JSON.stringify(p).length > 120 ? '…' : '') : val; } catch(e) {}
      const btn = '<button class="ls-del-btn" data-ls-key="' + key + '" style="background:#e65100;color:#fff;border:none;border-radius:3px;padding:0 4px;cursor:pointer;font-size:0.6rem;margin-right:4px">✕</button>';
      items.push('<div style="margin-bottom:0.2rem;font-size:0.7rem">' + btn + '<b>' + key + '</b>: ' + desc + '</div>');
    }
    el.innerHTML = items.length ? items.join('') : '<span style="color:#999">Sin datos de la app en localStorage</span>';
  } catch(e) {
    el.innerHTML = '<span style="color:#999">No disponible</span>';
  }
}

function initLogTabs() {
  document.querySelectorAll('.config-log-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('.config-log-tab').forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      const id = tab.dataset.logtab;
      document.querySelectorAll('.config-log-panel').forEach(p => p.style.display = 'none');
      const panel = document.querySelector('.config-log-panel[data-logpanel="' + id + '"]');
      if (panel) panel.style.display = 'block';
    });
  });
}

function initCacheTabs() {
  document.querySelectorAll('.config-cache-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('.config-cache-tab').forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      const id = tab.dataset.cachetab;
      document.querySelectorAll('.config-cache-panel').forEach(p => p.style.display = 'none');
      const panel = document.querySelector('.config-cache-panel[data-cachepanel="' + id + '"]');
      if (panel) panel.style.display = 'block';
      if (id === 'localstorage') renderLocalStorageCache();
    });
  });
}
