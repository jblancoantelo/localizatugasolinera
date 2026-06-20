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

  document.getElementById('search').addEventListener('input', () => render(false));
  document.getElementById('fuelFilter').addEventListener('change', e => { STATE.selectedFuel = e.target.value; render(false); });
  document.getElementById('provFilter').addEventListener('change', e => {
    if (e.target.value) {
      fetchProvinceData(e.target.value);
    }
  });
  document.getElementById('provFilterInit').addEventListener('change', e => {
    if (e.target.value) {
      document.getElementById('provFilter').value = e.target.value;
      fetchProvinceData(e.target.value);
    }
  });
  document.getElementById('locFilter').addEventListener('change', e => {
    STATE.selectedLoc = e.target.value;
    populateBrandFilter();
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
  document.getElementById('favToggleBtn').addEventListener('click', () => {
    STATE.showFavoritesOnly = !STATE.showFavoritesOnly;
    STATE.page = 1;
    render(false);
  });

  document.getElementById('resetFiltersBtn').addEventListener('click', () => {
    if (STATE.selectedProv) {
      fetchProvinceData(STATE.selectedProv);
    } else {
      document.getElementById('search').value = '';
      STATE.selectedFuel = '';
      STATE.selectedLoc = '';
      STATE.selectedBrands = [];
      STATE.selectedId = null;
      STATE.page = 1;
      STATE.maxDistance = '';
      STATE.showFavoritesOnly = false;
      document.getElementById('maxDistance').value = '';
      document.getElementById('fuelFilter').value = '';
      document.getElementById('favToggleBtn').classList.remove('active');
      document.getElementById('favToggleBtn').textContent = '☆';
      render(false);
    }
  });

  document.getElementById('brandFilterBtn').addEventListener('click', e => {
    e.stopPropagation();
    document.getElementById('brandFilterDropdown').classList.toggle('open');
  });
  document.addEventListener('click', () => document.getElementById('brandFilterDropdown').classList.remove('open'));

  document.querySelectorAll('#viewBtns button').forEach(b => {
    b.addEventListener('click', () => setViewMode(b.dataset.mode));
  });

  document.querySelector('#table thead').addEventListener('click', e => {
    const th = e.target.closest('th');
    if (th) toggleSort(th.dataset.col);
  });
  document.querySelector('#table tbody').addEventListener('click', e => {
    const favBtn = e.target.closest('.fav-btn');
    if (favBtn) {
      const tr = favBtn.closest('tr');
      if (tr) { toggleFavorite(tr.dataset.id); render(false); }
      return;
    }
    const tr = e.target.closest('tr');
    if (!tr) return;
    STATE.selectedId = tr.dataset.id;
    render(false);
    const m = STATE.markerMap[STATE.selectedId];
    if (m) { m.openPopup(); STATE.map.panTo(m.getLatLng()); }
  });

  const resizeHandle = document.getElementById('resizeHandle');
  const mapEl = document.getElementById('map');
  let dragging = false;
  const resizePointerDown = (startY, clientYProp) => {
    dragging = true;
    resizeHandle.classList.add('active');
    document.body.classList.add('dragging');
    const startH = mapEl.offsetHeight;
    function onMove(ev) {
      if (!dragging) return;
      const newH = Math.max(100, startH + ev[clientYProp] - startY);
      mapEl.style.height = newH + 'px';
      if (STATE.map) STATE.map.invalidateSize();
    }
    function onUp() {
      dragging = false;
      resizeHandle.classList.remove('active');
      document.body.classList.remove('dragging');
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
      document.removeEventListener('touchmove', onMove);
      document.removeEventListener('touchend', onUp);
      STATE.mapHeight = mapEl.offsetHeight;
      saveState();
    }
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
    document.addEventListener('touchmove', onMove, { passive: true });
    document.addEventListener('touchend', onUp);
  };
  resizeHandle.addEventListener('mousedown', e => resizePointerDown(e.clientY, 'clientY'));
  resizeHandle.addEventListener('touchstart', e => {
    const t = e.touches[0];
    resizePointerDown(t.clientY, 'clientY');
  }, { passive: true });

  document.getElementById('configToggleBtn').addEventListener('click', async () => {
    document.getElementById('configPanel').classList.toggle('open');
    document.getElementById('configToggleBtn').classList.toggle('active');
    renderDiscountConfig();
    await renderCacheInfo();
    await renderProvinceCacheInfo();
  });
  document.getElementById('addDiscountBtn').addEventListener('click', addEmptyDiscountRow);
  document.getElementById('cacheTtl').addEventListener('change', saveState);

  document.addEventListener('click', e => {
    const fb = e.target.closest('.fav-btn');
    if (fb && fb.closest('#detail')) {
      const id = fb.dataset.id;
      if (id) { toggleFavorite(id); updateDetail(); saveState(); }
    }
  });

  const saved = loadState();
  if (saved) {
    if (saved.discounts) STATE.discounts = saved.discounts;
    if (saved.favorites) STATE.favorites = saved.favorites;
    if (saved.sortCol) STATE.sortCol = saved.sortCol;
    if (saved.sortDir) STATE.sortDir = saved.sortDir;
    if (saved.viewMode) setViewMode(saved.viewMode);
    if (saved.selectedTile) { document.getElementById('mapStyle').value = saved.selectedTile; setTileLayer(saved.selectedTile); }
    if (saved.mapCenter && saved.mapZoom) {
      STATE.map.setView(saved.mapCenter, saved.mapZoom);
    }
    if (saved.pageSize !== undefined) { STATE.pageSize = saved.pageSize; document.getElementById('pageSize').value = saved.pageSize === 0 ? '0' : String(saved.pageSize); }
    if (saved.mapHeight) {
      document.getElementById('map').style.height = saved.mapHeight + 'px';
      STATE.mapHeight = saved.mapHeight;
      if (STATE.map) setTimeout(() => STATE.map.invalidateSize(), 50);
    }
  }
});