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
  document.getElementById('cacheTtl').addEventListener('change', saveState);
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
  }
  renderApiLog();
});
