document.addEventListener('DOMContentLoaded', () => {
  initMap();
  showProvinceScreen();

  STATE.map.on('contextmenu', e => {
    L.DomEvent.preventDefault(e);
    STATE.userLat = e.latlng.lat;
    STATE.userLng = e.latlng.lng;
    updateUserMarker(STATE.userLat, STATE.userLng);
    updatePosInfo();
    document.getElementById('infoText').textContent = 'Posición manual establecida';
    render(false);
  });

  fetchProvinces();

  document.getElementById('search').addEventListener('input', () => { STATE.page = 1; render(false); });
  document.getElementById('fuelFilter').addEventListener('change', e => { STATE.selectedFuel = e.target.value; STATE.page = 1; render(false); });
  document.getElementById('provFilter').addEventListener('change', e => {
    if (e.target.value) {
      fetchProvinceData(e.target.value);
    }
  });
  document.getElementById('locFilter').addEventListener('change', e => {
    STATE.selectedLoc = e.target.value;
    populateBrandFilter();
    STATE.page = 1;
    render(false);
  });
  document.getElementById('mapStyle').addEventListener('change', e => {
    setTileLayer(e.target.value);
    saveState();
  });
  document.getElementById('geolocBtn').addEventListener('click', locateUser);
  document.getElementById('maxDistance').addEventListener('input', () => { STATE.maxDistance = document.getElementById('maxDistance').value; STATE.page = 1; render(false); });
  document.getElementById('pageSize').addEventListener('change', e => {
    STATE.pageSize = parseInt(e.target.value) || 0;
    STATE.page = 1;
    render(false);
  });
  document.getElementById('prevPage').addEventListener('click', () => { if (STATE.page > 1) { STATE.page--; doSort(); } });
  document.getElementById('nextPage').addEventListener('click', () => {
    const totalPages = STATE.pageSize === 0 ? 1 : Math.ceil(STATE.filtered.length / STATE.pageSize);
    if (STATE.page < totalPages) { STATE.page++; doSort(); }
  });
  document.getElementById('clearCacheBtn').addEventListener('click', clearCache);
  document.getElementById('clearApiLogBtn')?.addEventListener('click', clearApiLog);
  initCacheTabs();
  document.getElementById('favToggleBtn').addEventListener('click', () => {
    STATE.showFavoritesOnly = !STATE.showFavoritesOnly;
    STATE.page = 1;
    render(false);
  });

  document.getElementById('resetFiltersBtn').addEventListener('click', () => {
    if (STATE.data.length) {
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
      document.getElementById('favToggleBtn').classList.remove('active');
      document.getElementById('favToggleBtn').textContent = '☆';
      populateBrandFilter();
      render(false);
    }
  });

  document.getElementById('brandFilterBtn').addEventListener('click', e => {
    e.stopPropagation();
    const btn = e.currentTarget;
    const dd = document.getElementById('brandFilterDropdown');
    const rect = btn.getBoundingClientRect();
    dd.style.left = rect.left + 'px';
    dd.style.top = rect.bottom + 'px';
    dd.classList.toggle('open');
  });
  document.getElementById('brandFilterDropdown').addEventListener('click', e => e.stopPropagation());
  document.addEventListener('click', () => document.getElementById('brandFilterDropdown').classList.remove('open'));

  document.querySelectorAll('.bottom-tab').forEach(tab => {
    tab.addEventListener('click', () => setActiveTab(tab.dataset.tab));
  });

  document.addEventListener('change', e => {
    const container = e.target.closest('.popup-tab-content[data-ptab-content="history"]');
    if (!container) return;
    if (e.target.closest('.popup-history-fuel') || e.target.closest('.popup-history-days')) {
      const station = STATE.data.find(x => x.IDEESS === container.dataset.id);
      if (station) {
        const fuel = container.querySelector('.popup-history-fuel').value;
        loadPopupChartForFuel(container, station, fuel);
      }
    }
  });

  document.addEventListener('click', e => {
    const favBtn = e.target.closest('.fav-btn');
    if (favBtn) {
      const id = favBtn.dataset.id;
      if (id) toggleFavorite(id);
      return;
    }

    const popupTab = e.target.closest('.popup-tab');
    if (popupTab) {
      const tabId = popupTab.dataset.ptab;
      const container = popupTab.closest('.popup-container');
      if (container) {
        container.querySelectorAll('.popup-tab').forEach(t => t.classList.toggle('active', t.dataset.ptab === tabId));
        container.querySelectorAll('.popup-tab-content').forEach(c => {
          c.style.display = c.dataset.ptabContent === tabId ? 'block' : 'none';
        });
        if (tabId === 'history') {
          const hc = container.querySelector('.popup-tab-content[data-ptab-content="history"]');
          if (hc && !hc.dataset.loaded) loadPopupHistory(hc, hc.dataset.id);
        }
      }
      return;
    }

    const th = e.target.closest('.table-wrap th');
    if (th && th.dataset.col) { toggleSort(th.dataset.col); return; }

    const tr = e.target.closest('.table-wrap tr');
    if (!tr) return;

    const id = tr.dataset.id;
    if (!id) return;
    STATE.selectedId = id;
    showDetail(id);
    const m = STATE.markerMap[id];
    if (m) { m.openPopup(); STATE.map.panTo(m.getLatLng()); }
  });

  document.getElementById('historyDays')?.addEventListener('change', e => {
    STATE.historyDays = parseInt(e.target.value) || 14;
    window._historyCache = null;
    const s = STATE;
    if (s.selectedId) {
      const d = s.data.find(x => x.IDEESS === s.selectedId);
      if (d) loadHistory(d);
    }
  });

  document.getElementById('historyFuel')?.addEventListener('change', e => {
    const s = STATE;
    if (s.selectedId) {
      const d = s.data.find(x => x.IDEESS === s.selectedId);
      if (d) loadChartForFuel(d, e.target.value);
    }
  });

  document.getElementById('detailClose').addEventListener('click', () => {
    document.getElementById('detailPanel').classList.remove('show');
    STATE.selectedId = null;
  });

  document.querySelectorAll('.detail-tab').forEach(tab => {
    tab.addEventListener('click', () => switchDetailTab(tab.dataset.dtab));
  });

  document.getElementById('addDiscountBtn').addEventListener('click', addEmptyDiscountRow);
  document.addEventListener('click', e => {
    const btn = e.target.closest('.ls-del-btn');
    if (btn) {
      localStorage.removeItem(btn.dataset.lsKey);
      renderLocalStorageCache();
    }
  });

  const saved = loadState();
  if (saved) {
    if (saved.discounts) STATE.discounts = saved.discounts;
    if (saved.favorites) STATE.favorites = saved.favorites;
    if (saved.sortCol) STATE.sortCol = saved.sortCol;
    if (saved.sortDir) STATE.sortDir = saved.sortDir;
    if (saved.selectedProv) STATE.selectedProv = saved.selectedProv;
    if (saved.activeTab) setActiveTab(saved.activeTab);
    if (saved.selectedTile) { document.getElementById('mapStyle').value = saved.selectedTile; setTileLayer(saved.selectedTile); }
    if (saved.mapCenter && saved.mapZoom) {
      STATE.map.setView(saved.mapCenter, saved.mapZoom);
    }
    if (saved.pageSize !== undefined) {
      STATE.pageSize = saved.pageSize;
      const ps = document.getElementById('pageSize');
      if (ps) ps.value = saved.pageSize === 0 ? '0' : String(saved.pageSize);
    }
    if (saved.selectedFuel) {
      STATE.selectedFuel = saved.selectedFuel;
      document.getElementById('fuelFilter').value = saved.selectedFuel;
    }
    if (saved.selectedLoc) {
      STATE.selectedLoc = saved.selectedLoc;
      document.getElementById('locFilter').value = saved.selectedLoc;
    }
    if (saved.maxDistance) {
      STATE.maxDistance = saved.maxDistance;
      document.getElementById('maxDistance').value = saved.maxDistance;
    }
    if (saved.userLat != null && saved.userLng != null) {
      STATE.userLat = saved.userLat;
      STATE.userLng = saved.userLng;
      updateUserMarker(saved.userLat, saved.userLng);
      updatePosInfo();
    }
    if (saved.checkInterval) STATE.checkInterval = saved.checkInterval;
    if (saved.priceFallDays !== undefined) STATE.priceFallDays = saved.priceFallDays;
    if (saved.pushNotificationsEnabled) STATE.pushNotificationsEnabled = saved.pushNotificationsEnabled;
    if (saved.pushOnPriceRise) STATE.pushOnPriceRise = saved.pushOnPriceRise;
  }

  // Sync push config to IndexedDB for SW access
  setPushConfig({
    checkInterval: STATE.checkInterval,
    priceFallDays: STATE.priceFallDays,
    cacheTtl: getCacheTtl(),
    pushOnPriceRise: STATE.pushOnPriceRise
  });

  function syncPushConfig() {
    setPushConfig({
      checkInterval: STATE.checkInterval,
      priceFallDays: STATE.priceFallDays,
      cacheTtl: getCacheTtl(),
      pushOnPriceRise: STATE.pushOnPriceRise
    });
  }

  document.getElementById('pushNotifBtn').addEventListener('click', async () => {
    const isCurrentlySubscribed = isPushSubscribed();
    if (isCurrentlySubscribed) {
      await unsubscribeUserFromPush();
      STATE.pushNotificationsEnabled = false;
      STATE.pushOnPriceRise = false;
      document.getElementById('pushNotifToggle').checked = false;
      document.getElementById('pushRiseToggle').checked = false;
      document.getElementById('pushNotifBtn').classList.remove('active');
      console.log('[Push] Desuscripción manual desde toolbar');
    } else {
      const success = await subscribeUserToPush();
      if (success) {
        STATE.pushNotificationsEnabled = true;
        document.getElementById('pushNotifToggle').checked = true;
        document.getElementById('pushNotifBtn').classList.add('active');
        syncPushConfig();
        registerPeriodicSync();
        console.log('[Push] Suscripción manual desde toolbar');
      }
    }
    saveState();
  });

  async function trySubscribe() {
    if (isPushSubscribed()) {
      console.log('[Push] Ya suscrito, activando sin llamar a la API');
      document.getElementById('pushNotifBtn').classList.add('active');
      syncPushConfig();
      registerPeriodicSync();
      return true;
    }
    const success = await subscribeUserToPush();
    if (success) {
      console.log('[Push] Suscripción exitosa');
      document.getElementById('pushNotifBtn').classList.add('active');
      syncPushConfig();
      registerPeriodicSync();
    } else {
      console.log('[Push] Error al suscribir');
    }
    return success;
  }

  async function tryUnsubscribe() {
    const sub = getPushSubscription();
    if (sub && !STATE.pushNotificationsEnabled && !STATE.pushOnPriceRise) {
      await unsubscribeUserFromPush();
      console.log('[Push] Desuscripción completada (ningún check activo)');
      document.getElementById('pushNotifBtn').classList.remove('active');
    } else {
      console.log('[Push] No se desuscribe: otros checks aún activos');
    }
  }

  document.getElementById('pushNotifToggle')?.addEventListener('change', async (e) => {
    if (e.target.checked) {
      const ok = await trySubscribe();
      STATE.pushNotificationsEnabled = ok;
      if (!ok) e.target.checked = false;
    } else {
      STATE.pushNotificationsEnabled = false;
      await tryUnsubscribe();
    }
    saveState();
  });

  document.getElementById('pushRiseToggle')?.addEventListener('change', async (e) => {
    if (e.target.checked) {
      const ok = await trySubscribe();
      STATE.pushOnPriceRise = ok;
      if (!ok) e.target.checked = false;
    } else {
      STATE.pushOnPriceRise = false;
      await tryUnsubscribe();
    }
    saveState();
  });

  document.getElementById('checkInterval')?.addEventListener('change', (e) => {
    const v = parseFloat(e.target.value);
    STATE.checkInterval = isNaN(v) || v < 0 ? 8 : v;
    saveState();
    setPushConfig({
      checkInterval: STATE.checkInterval,
      priceFallDays: STATE.priceFallDays,
      cacheTtl: getCacheTtl(),
      pushOnPriceRise: STATE.pushOnPriceRise
    });
    if (STATE.pushNotificationsEnabled || STATE.pushOnPriceRise) {
      registerPeriodicSync();
    }
  });

  document.getElementById('priceFallDays')?.addEventListener('change', (e) => {
    const v = parseInt(e.target.value);
    STATE.priceFallDays = isNaN(v) ? 3 : v;
    saveState();
    setPushConfig({
      checkInterval: STATE.checkInterval,
      priceFallDays: STATE.priceFallDays,
      cacheTtl: getCacheTtl(),
      pushOnPriceRise: STATE.pushOnPriceRise
    });
  });

  document.getElementById('cacheTtl')?.addEventListener('change', () => {
    setPushConfig({
      checkInterval: STATE.checkInterval,
      priceFallDays: STATE.priceFallDays,
      cacheTtl: getCacheTtl(),
      pushOnPriceRise: STATE.pushOnPriceRise
    });
  });

  async function handleTestNotification(mode) {
    if (!isPushSubscribed()) {
      const success = await subscribeUserToPush();
      if (success) {
        STATE.pushNotificationsEnabled = true;
        document.getElementById('pushNotifToggle').checked = true;
        document.getElementById('pushNotifBtn').classList.add('active');
        saveState();
      }
    }
    if (!('Notification' in window)) return;
    if (Notification.permission !== 'granted') {
      const perm = await Notification.requestPermission();
      if (perm !== 'granted') return;
    }
    syncPushConfig();
    registerPeriodicSync();
    if (navigator.serviceWorker.controller) {
      navigator.serviceWorker.controller.postMessage({ type: 'trigger-price-check', mode });
    }
    const label = mode === 'rise' ? 'subida' : 'bajada';
    const reg = await navigator.serviceWorker.ready;
    await reg.showNotification('🧪 Test notificaciones: ' + label, {
      body: 'Chequeo completado para ' + label + ' de precio.',
      icon: 'icons/icon-192.png',
      badge: 'icons/icon-192.png',
      tag: 'push-test',
      requireInteraction: false,
      data: { alerts: [] }
    });
  }

  document.getElementById('pushNotifTestBtn')?.addEventListener('click', () => handleTestNotification('drop'));
  document.getElementById('pushRiseTestBtn')?.addEventListener('click', () => handleTestNotification('rise'));

  // Initialize push notification UI
  if (isPushSubscribed()) {
    document.getElementById('pushNotifBtn')?.classList.add('active');
  }
  const bajadaToggle = document.getElementById('pushNotifToggle');
  if (bajadaToggle) bajadaToggle.checked = STATE.pushNotificationsEnabled;
  const riseToggle = document.getElementById('pushRiseToggle');
  if (riseToggle) riseToggle.checked = STATE.pushOnPriceRise;
  const intervalEl = document.getElementById('checkInterval');
  if (intervalEl) intervalEl.value = STATE.checkInterval;
  const fallDaysEl = document.getElementById('priceFallDays');
  if (fallDaysEl) fallDaysEl.value = STATE.priceFallDays;

  // Handle postMessage from Service Worker
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.addEventListener('message', event => {
      if (event.data.type === 'open-favorite') {
        setActiveTab('tab-table');
        showDetail(event.data.favoriteId);
      }
    });
  }

  // Register periodic sync (with setInterval fallback for desktop)
  let _pushIntervalId = null;
  let _periodicSyncUnavailable = false;
  async function registerPeriodicSync() {
    clearInterval(_pushIntervalId);
    _pushIntervalId = null;
    const intervalMs = STATE.checkInterval * 60 * 60 * 1000;
    if (intervalMs <= 0) return;
    if (!_periodicSyncUnavailable && 'serviceWorker' in navigator) {
      try {
        const reg = await navigator.serviceWorker.ready;
        if ('periodicSync' in reg) {
          await reg.periodicSync.register('check-favorite-prices', {
            minInterval: intervalMs
          });
          console.log('Periodic sync registered with interval:', STATE.checkInterval, 'hours');
        }
      } catch (error) {
        _periodicSyncUnavailable = true;
        if (error.name === 'NotAllowedError') {
          console.warn('Periodic sync no disponible (requiere PWA instalada). Usando fallback setInterval.');
        } else {
          console.error('Error registering periodic sync:', error);
        }
      }
    } else {
      if (!('serviceWorker' in navigator)) _periodicSyncUnavailable = true;
    }
    _pushIntervalId = setInterval(() => {
      if (navigator.serviceWorker.controller) {
        navigator.serviceWorker.controller.postMessage({ type: 'trigger-price-check' });
      }
    }, intervalMs);
    console.log('setInterval fallback registered:', STATE.checkInterval, 'hours');
  }

  renderApiLog();
});
