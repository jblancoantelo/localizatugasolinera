const TILE_CONFIGS = {
  street: {
    url: 'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png',
    opts: { maxZoom: 19, attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>, &copy; <a href="https://carto.com/">CARTO</a>' }
  },
  satellite: {
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
    opts: { maxZoom: 19, attribution: '&copy; <a href="https://www.esri.com/">ESRI</a>' }
  },
  standard: {
    url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
    opts: { maxZoom: 19, attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>' }
  },
  cycling: {
    url: 'https://{s}.tile-cyclosm.openstreetmap.fr/cyclosm/{z}/{x}/{y}.png',
    opts: { maxZoom: 19, attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>, <a href="https://www.cyclosm.org">CyclOSM</a>' }
  }
};

function popupHtml(d) {
  const items = [];
  for (const [name, key] of FUEL_NAMES) {
    const display = getFuelPriceDisplay(d, key);
    if (display !== null) {
      const dv = getDiscountedFuelPrice(d, key);
      items.push(`<span style="display:inline-block;width:9px;height:9px;border-radius:50%;border:1px solid #999;background:${fuelColorHex(dv)};margin-right:3px"></span> ${name}: ${display}`);
    }
  }
  const isFav = STATE.favorites.includes(d.IDEESS);
  const star = `<span class="fav-btn${isFav ? ' on' : ''}" data-id="${d.IDEESS}">${isFav ? '★' : '☆'}</span> `;
  const histLink = `<a class="popup-hist-link" data-id="${d.IDEESS}">📊 Histórico</a>`;
  const html = `<strong>${star}${d.Rótulo||''}</strong><br>${d.Dirección||''}, ${d.Localidad||''}`;
  return items.length ? `${html}<br><br>${items.join('<br>')}<br>${histLink}` : html + `<br>${histLink}`;
}

function initMap() {
  STATE.map = L.map('map').setView([40.4168, -3.7038], 6);
  setTileLayer(STATE.selectedTile);
}

function setTileLayer(name) {
  const cfg = TILE_CONFIGS[name] || TILE_CONFIGS.street;
  if (STATE.tileLayer) STATE.map.removeLayer(STATE.tileLayer);
  STATE.tileLayer = L.tileLayer(cfg.url, cfg.opts).addTo(STATE.map);
  STATE.selectedTile = name;
}

function updateUserMarker(lat, lng) {
  const s = STATE;
  if (s.userMarker) { s.map.removeLayer(s.userMarker); s.userMarker = null; }
  if (lat === null || lng === null) return;
  s.userMarker = L.circleMarker([lat, lng], {
    radius: 12,
    fillColor: '#1a73e8',
    color: '#fff',
    weight: 3,
    opacity: 1,
    fillOpacity: 0.85
  });
  s.userMarker.bindPopup('<strong>Tu ubicación</strong>');
  s.userMarker.addTo(s.map);
}

function updateMarkers(fitBounds, onMarkerClick) {
  const s = STATE;
  s.markers.forEach(m => s.map.removeLayer(m));
  s.markers = [];
  s.markerMap = {};
  const bounds = [];
  s.filtered.forEach(d => {
    const lat = parseFloat(norm(d.Latitud));
    const lng = parseFloat(norm(d['Longitud (WGS84)']));
    if (isNaN(lat)||isNaN(lng)) return;
    const p = getSelectedFuelPrice(d);
    const isSelected = d.IDEESS === s.selectedId;
    const m = L.circleMarker([lat,lng], {
      radius: isSelected ? 14 : 9,
      fillColor: isSelected ? '#ffeb3b' : fuelColorHex(p),
      color: isSelected ? '#d50000' : '#000',
      weight: isSelected ? 3 : 2,
      opacity: 1,
      fillOpacity: 1
    });
    m.bindPopup(popupHtml(d), { maxWidth: 320 });
    m.on('click', () => {
      s.selectedId = d.IDEESS;
      if (onMarkerClick) onMarkerClick(d.IDEESS);
    });
    m.addTo(s.map);
    s.markers.push(m);
    s.markerMap[d.IDEESS] = m;
    bounds.push([lat,lng]);
  });
  if (s.selectedId && s.markerMap[s.selectedId]) {
    s.markerMap[s.selectedId].openPopup();
  }
  if (fitBounds && bounds.length) s.map.fitBounds(bounds, { padding: [20,20], maxZoom: 14 });
}
