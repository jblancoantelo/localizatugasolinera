function render(fitBounds) {
  const s = STATE;
  const q = document.getElementById('search').value.toLowerCase().trim();
  const sf = s.selectedFuel;
  const sl = s.selectedLoc;
  const sb = s.selectedBrands;

  let arr = s.data;
  if (q) arr = arr.filter(d => (d.Localidad||'').toLowerCase().includes(q) || (d.Dirección||'').toLowerCase().includes(q) || (d.Rótulo||'').toLowerCase().includes(q));
  if (sf) {
    const group = FUEL_GROUPS[sf];
    if (group) {
      arr = arr.filter(d => group.some(name => getFuelPrice(d, FUEL_KEYS[name]) !== null));
    } else {
      const key = FUEL_KEYS[sf];
      arr = arr.filter(d => getFuelPrice(d, key) !== null);
    }
  }
  if (sl) arr = arr.filter(d => d.Localidad === sl);
  if (sb.length) arr = arr.filter(d => sb.includes(d.Rótulo));
  if (s.userLat!==null) arr.forEach(d => { d._dist = dist(s.userLat,s.userLng,parseFloat(norm(d.Latitud)),parseFloat(norm(d['Longitud (WGS84)']))); });
  else arr.forEach(d => d._dist = null);
  const maxDist = parseFloat(document.getElementById('maxDistance').value);
  if (s.userLat !== null && !isNaN(maxDist) && maxDist > 0) {
    arr = arr.filter(d => d._dist !== null && d._dist <= maxDist);
  }
  if (s.showFavoritesOnly && s.favorites.length) {
    arr = arr.filter(d => s.favorites.includes(d.IDEESS));
  }
  s.filtered = arr;

  const idsHash = arr.map(d => d.IDEESS).join(',');
  const filteredChanged = idsHash !== s._prevFilteredIds;
  s._prevFilteredIds = idsHash;

  const cheapestMap = {};
  arr.forEach(d => {
    const p = getSelectedFuelPrice(d);
    if (p === null) return;
    const prov = d.Provincia;
    if (!cheapestMap[prov] || p < cheapestMap[prov].price) {
      cheapestMap[prov] = { id: d.IDEESS, price: p };
    }
  });
  arr.forEach(d => {
    d._cheapest = cheapestMap[d.Provincia]?.id === d.IDEESS;
  });

  const allPrices = [];
  if (sf) {
    const group = FUEL_GROUPS[sf];
    if (group) {
      arr.forEach(d => { for (const name of group) { const p = getDiscountedFuelPrice(d, FUEL_KEYS[name]); if (p !== null) allPrices.push(p); } });
    } else {
      const key = FUEL_KEYS[sf];
      arr.forEach(d => { const p = getDiscountedFuelPrice(d, key); if (p !== null) allPrices.push(p); });
    }
  } else {
    arr.forEach(d => { for (const [, k] of FUEL_NAMES) { const p = getDiscountedFuelPrice(d, k); if (p !== null) allPrices.push(p); } });
  }
  allPrices.sort((a,b) => a-b);
  if (allPrices.length >= 3) {
    s._lo = allPrices[Math.floor(allPrices.length * 0.20)];
    s._hi = allPrices[Math.floor(allPrices.length * 0.60)];
  } else {
    s._lo = undefined;
    s._hi = undefined;
  }
  const leg = document.getElementById('legend');
  if (s._lo !== undefined) {
    leg.innerHTML = `<span><span class="dot g"></span> ≤${s._lo.toFixed(3).replace('.',',')}</span><span><span class="dot o"></span> ${s._lo.toFixed(3).replace('.',',')}–${s._hi.toFixed(3).replace('.',',')}</span><span><span class="dot r"></span> &gt;${s._hi.toFixed(3).replace('.',',')}</span>`;
  } else {
    leg.innerHTML = '<span><span class="dot g"></span> &lt;1,50</span><span><span class="dot o"></span> 1,50–1,70</span><span><span class="dot r"></span> &gt;1,70</span>';
  }
  doSort();
  document.getElementById('infoText').textContent = `${arr.length}${s.selectedProv ? ' de ' + s.data.length + ' en ' + s.selectedProv : ''}${_cacheExpiryLabel}`;


  if (filteredChanged) {
    updateMarkers(fitBounds, (id) => {
      render(false);
      const m2 = STATE.markerMap[id];
      if (m2) m2.openPopup();
      const row = document.querySelector(`tr[data-id="${id}"]`);
      if (row) row.scrollIntoView({ block: 'center' });
    });
  } else if (fitBounds && s.markers.length) {
    const bounds = s.markers.map(m => m.getLatLng());
    if (bounds.length) s.map.fitBounds(bounds, { padding: [20,20], maxZoom: 14 });
  }

  const favBtn = document.getElementById('favToggleBtn');
  if (favBtn) {
    favBtn.classList.toggle('active', s.showFavoritesOnly);
    const cnt = s.favorites.length;
    favBtn.textContent = cnt ? `★ ${cnt}` : '☆';
  }
  saveState();
}

function toggleFavorite(id) {
  const s = STATE;
  const idx = s.favorites.indexOf(id);
  if (idx >= 0) {
    s.favorites.splice(idx, 1);
    dbRemoveFavorite(id);
  } else {
    s.favorites.push(id);
    const d = s.data.find(x => x.IDEESS === id);
    if (d) {
      dbAddFavorite({
        id: d.IDEESS,
        provinceName: s.selectedProv,
        provinceId: s.provinceIdMap ? s.provinceIdMap[s.selectedProv] : null,
        brand: d.Rótulo
      });
    }
  }
  render(false);
  const d = s.data.find(x => x.IDEESS === id);
  if (d) {
    const m = s.markerMap[id];
    if (m && m.getPopup()) m.setPopupContent(popupHtml(d));
    if (s.selectedId === id) {
      const isFav = s.favorites.includes(id);
      document.getElementById('detailBrand').innerHTML = '<span class="fav-btn' + (isFav ? ' on' : '') + '" data-id="' + id + '">' + (isFav ? '★' : '☆') + '</span> ' + (d.Rótulo || '');
    }
  }
}

function setActiveTab(tabId) {
  const s = STATE;
  s.activeTab = tabId;
  const ca = document.getElementById('contentArea');
  const hasNoProvince = ca.classList.contains('no-province');
  ca.className = 'content ' + tabId;
  if (hasNoProvince && tabId !== 'tab-config') ca.classList.add('no-province');

  document.querySelectorAll('.bottom-tab').forEach(t => {
    t.classList.toggle('active', t.dataset.tab === tabId);
  });

  if (tabId !== 'tab-table' && tabId !== 'tab-both') {
    document.getElementById('detailPanel').classList.remove('show');
    STATE.selectedId = null;
  }

  if (tabId !== 'tab-map' && tabId !== 'tab-both') {
    if (s.map) s.map.closePopup();
  }

  if (tabId === 'tab-config') {
    renderDiscountConfig();
    renderCacheInfo();
    renderProvinceCacheInfo();
  }

  if (tabId === 'tab-map' || tabId === 'tab-both') {
    if (s.map) setTimeout(() => s.map.invalidateSize(), 100);
  }

  saveState();
}

function populateLocFilter() {
  const locSet = new Set();
  STATE.data.forEach(d => {
    if (d.Localidad) locSet.add(d.Localidad);
  });
  const sel = document.getElementById('locFilter');
  sel.innerHTML = '<option value="">Localidad</option>';
  Array.from(locSet).sort().forEach(l => {
    const o = document.createElement('option');
    o.value = l; o.textContent = l;
    sel.appendChild(o);
  });
  sel.value = STATE.selectedLoc && locSet.has(STATE.selectedLoc) ? STATE.selectedLoc : '';
}

function populateBrandFilter() {
  const sl = STATE.selectedLoc;
  const brandMap = {};
  STATE.data.forEach(d => {
    if (!d.Rótulo) return;
    if (sl && d.Localidad !== sl) return;
    brandMap[d.Rótulo.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'')] = d.Rótulo;
  });
  const sorted = Object.keys(brandMap).sort().map(k => brandMap[k]);
  const dd = document.getElementById('brandFilterDropdown');
  dd.innerHTML = `<input type="text" class="brandSearch" placeholder="Buscar marca...">
    <div class="brandList">
      <label class="selectAll"><input type="checkbox" id="brandSelectAll" checked> Todas</label>
    </div>`;
  const list = dd.querySelector('.brandList');
  sorted.forEach(b => {
    list.innerHTML += `<label><input type="checkbox" value="${b.replace(/"/g,'&quot;')}" checked> ${b}</label>`;
  });

  const saved = loadProvinceFilters(STATE.selectedProv);
  const savedBrands = saved ? saved.selectedBrands || [] : [];
  if (savedBrands.length) {
    list.querySelectorAll('input[type="checkbox"]:not(#brandSelectAll)').forEach(cb => {
      cb.checked = savedBrands.includes(cb.value);
    });
    const all = list.querySelectorAll('input[type="checkbox"]:not(#brandSelectAll)');
    const allChecked = all.length === list.querySelectorAll('input[type="checkbox"]:not(#brandSelectAll):checked').length;
    document.getElementById('brandSelectAll').checked = allChecked;
    STATE.selectedBrands = allChecked ? [] : savedBrands;
  } else {
    STATE.selectedBrands = [];
  }

  const hasSelection = STATE.selectedBrands.length > 0;
  document.getElementById('brandFilterBtn').textContent = hasSelection ? `Marcas (${STATE.selectedBrands.length})` : 'Todas';

  const searchInput = dd.querySelector('.brandSearch');
  searchInput.addEventListener('input', () => {
    const q = searchInput.value.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().trim();
    list.querySelectorAll('label:not(.selectAll)').forEach(l => {
      l.classList.toggle('hide', q && !l.textContent.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().includes(q));
    });
  });

  document.getElementById('brandSelectAll').addEventListener('change', e => {
    list.querySelectorAll('input[type="checkbox"]:not(#brandSelectAll)').forEach(cb => cb.checked = e.target.checked);
    applyBrandFilter();
  });
  list.querySelectorAll('input[type="checkbox"]:not(#brandSelectAll)').forEach(cb => {
    cb.addEventListener('change', applyBrandFilter);
  });
}

function applyBrandFilter() {
  const dd = document.getElementById('brandFilterDropdown');
  const checked = [];
  dd.querySelectorAll('input[type="checkbox"]:not(#brandSelectAll)').forEach(cb => { if (cb.checked) checked.push(cb.value); });
  const all = dd.querySelectorAll('input[type="checkbox"]:not(#brandSelectAll)');
  const allChecked = all.length === checked.length;
  document.getElementById('brandSelectAll').checked = allChecked;
  document.getElementById('brandFilterBtn').textContent = checked.length && !allChecked ? `Marcas (${checked.length})` : 'Todas';
  STATE.selectedBrands = allChecked ? [] : checked;
  render(false);
}

function renderDiscountConfig() {
  const list = document.getElementById('discountList');
  if (!list) return;
  const brandSet = new Set();
  STATE.data.forEach(d => {
    if (!d.Rótulo) return;
    if (STATE.selectedLoc && d.Localidad !== STATE.selectedLoc) return;
    brandSet.add(d.Rótulo);
  });
  const dl = document.getElementById('brandOptions');
  dl.innerHTML = '';
  Array.from(brandSet).sort().forEach(b => {
    const o = document.createElement('option');
    o.value = b; dl.appendChild(o);
  });
  list.innerHTML = '';
  Object.keys(STATE.discounts).forEach(brand => {
    addDiscountRow(brand, STATE.discounts[brand]);
  });
}

function addEmptyDiscountRow() {
  addDiscountRow('', 0);
}

function addDiscountRow(brand, cents) {
  const list = document.getElementById('discountList');
  const row = document.createElement('div');
  row.className = 'discount-row';
  const brandInput = document.createElement('input');
  brandInput.type = 'text';
  brandInput.className = 'discountBrand';
  brandInput.placeholder = 'Marca';
  brandInput.setAttribute('list', 'brandOptions');
  brandInput.value = brand;
  const centsInput = document.createElement('input');
  centsInput.type = 'number';
  centsInput.className = 'discountCents';
  centsInput.placeholder = '¢';
  centsInput.value = cents;
  centsInput.min = 0;
  const removeBtn = document.createElement('button');
  removeBtn.className = 'discountRemove';
  removeBtn.textContent = '✕';
  removeBtn.addEventListener('click', () => {
    row.remove();
    saveDiscountsFromUI();
  });
  [brandInput, centsInput].forEach(inp => inp.addEventListener('change', saveDiscountsFromUI));
  row.appendChild(brandInput);
  row.appendChild(centsInput);
  row.appendChild(removeBtn);
  list.appendChild(row);
}

function saveDiscountsFromUI() {
  const newDiscounts = {};
  document.querySelectorAll('.discount-row').forEach(row => {
    const brand = row.querySelector('.discountBrand').value.trim();
    const cents = parseInt(row.querySelector('.discountCents').value, 10);
    if (brand && !isNaN(cents) && cents > 0) newDiscounts[brand] = cents;
  });
  STATE.discounts = newDiscounts;
  saveState();
  render(false);
}


