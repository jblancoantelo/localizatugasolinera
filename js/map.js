const OSM_ATTR = '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>';
const ESR_ATTR = '&copy; <a href="https://www.esri.com/">Esri</a>, Maxar, Earthstar Geographics';
const CARTO_ATTR = OSM_ATTR + ', &copy; <a href="https://carto.com/">CARTO</a>';

// Clave gratuita de CARTO Basemaps (carto.com/basemaps/apikey, 5M tiles/mes).
// Sin `?key=` sus raster devuelven 200 con un tile de marca de agua ("API KEY
// REQUIRED", ETag "wm-…") y el mapa queda en gris: no dispara `tileerror`,
// así que el respaldo por errores no llegaría a actuar.
const CARTO_KEY = 'cb1_4eok_1_be0aa666556b7dfa7d95aea0';
const CARTO_QS = '?key=' + CARTO_KEY;

// Cada vista admite varios proveedores (`urls`): si el primero no devuelve tiles
// (host bloqueado, adblock, caída) se pasa al siguiente en vez de dejar el mapa
// en gris. Una entrada puede ser una URL o { url, attribution, maxNativeZoom }.
const TILE_CONFIGS = {
  satellite: {
    urls: [
      'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
      'https://services.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'
    ],
    opts: { maxZoom: 19, attribution: ESR_ATTR }
  },
  hybrid: {
    urls: [
      'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
      'https://services.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'
    ],
    opts: { maxZoom: 19, attribution: ESR_ATTR },
    overlay: {
      url: 'https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}',
      opts: { maxZoom: 19, attribution: '&copy; Esri' }
    }
  },
  street: {
    urls: [
      { url: 'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png' + CARTO_QS, attribution: CARTO_ATTR },
      { url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}', attribution: ESR_ATTR },
      { url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', attribution: OSM_ATTR }
    ],
    opts: { maxZoom: 19 }
  },
  standard: {
    urls: [
      { url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', attribution: OSM_ATTR },
      { url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}', attribution: ESR_ATTR }
    ],
    opts: { maxZoom: 19 }
  },
  hot: {
    urls: [
      { url: 'https://{s}.tile.openstreetmap.fr/hot/{z}/{x}/{y}.png', attribution: OSM_ATTR + ', <a href="https://www.hotosm.org">HOT</a>' },
      { url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', attribution: OSM_ATTR }
    ],
    opts: { maxZoom: 19 }
  },
  cycling: {
    urls: [
      { url: 'https://{s}.tile-cyclosm.openstreetmap.fr/cyclosm/{z}/{x}/{y}.png', attribution: OSM_ATTR + ', <a href="https://www.cyclosm.org">CyclOSM</a>' },
      { url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', attribution: OSM_ATTR }
    ],
    opts: { maxZoom: 19 }
  },
  dark: {
    urls: [
      { url: 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png' + CARTO_QS, attribution: CARTO_ATTR },
      { url: 'https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}', attribution: ESR_ATTR }
    ],
    opts: { maxZoom: 19 }
  },
  topo: {
    urls: [
      { url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Topo_Map/MapServer/tile/{z}/{y}/{x}', attribution: ESR_ATTR },
      { url: 'https://tile.opentopomap.org/{z}/{x}/{y}.png', attribution: OSM_ATTR + ', &copy; <a href="https://opentopomap.org">OpenTopoMap</a> (CC-BY-SA)', maxNativeZoom: 17 },
      { url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', attribution: OSM_ATTR }
    ],
    opts: { maxZoom: 19 }
  },
  natgeo: {
    urls: [
      { url: 'https://server.arcgisonline.com/ArcGIS/rest/services/NatGeo_World_Map/MapServer/tile/{z}/{y}/{x}', attribution: '&copy; Esri, National Geographic, Esri, DeLorme, NAVTEQ', maxNativeZoom: 12 },
      { url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Topo_Map/MapServer/tile/{z}/{y}/{x}', attribution: ESR_ATTR }
    ],
    opts: { maxZoom: 19 }
  },
  relief: {
    urls: [
      { url: 'https://server.arcgisonline.com/ArcGIS/rest/services/Elevation/World_Hillshade/MapServer/tile/{z}/{y}/{x}', attribution: '&copy; Esri' },
      { url: 'https://services.arcgisonline.com/ArcGIS/rest/services/Elevation/World_Hillshade/MapServer/tile/{z}/{y}/{x}', attribution: '&copy; Esri' }
    ],
    opts: { maxZoom: 19 }
  }
};

// Índice de proveedor que ya funcionó en esta sesión: evita reintentar el
// host que falló cada vez que se cambia de vista.
const TILE_URL_PREFERRED = {};

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
  const fuelsHtml = items.length ? `<div class="popup-fuels">${items.join('<br>')}</div>` : '';
  return `<div class="popup-container">
  <div class="popup-tab-content" data-ptab-content="info">
    <strong>${star}${d.Rótulo||''}</strong>
    <div class="popup-addr">${d.Dirección||''}, ${d.Localidad||''}</div>
    ${fuelsHtml}
  </div>
  <div class="popup-tab-content" data-ptab-content="history" style="display:none" data-id="${d.IDEESS}">
    <div style="display:flex;gap:4px;margin-bottom:6px">
      <select class="popup-history-fuel"></select>
      <select class="popup-history-days">
        <option value="7" selected>7d</option>
        <option value="14">14d</option>
        <option value="21">21d</option>
        <option value="30">30d</option>
        <option value="60">60d</option>
        <option value="90">90d</option>
        <option value="180">180d</option>
      </select>
    </div>
    <div class="popup-chart-wrap">
      <canvas class="popup-price-chart"></canvas>
      <div class="popup-history-loading">Cargando histórico...</div>
      <div class="popup-history-error" style="display:none"></div>
    </div>
  </div>
  <div class="popup-tabs">
    <button class="popup-tab active" data-ptab="info">Información</button>
    <button class="popup-tab" data-ptab="history">Histórico</button>
  </div>
</div>`;
}

function initMap() {
  STATE.map = L.map('map').setView([40.4168, -3.7038], 6);
  setTileLayer(STATE.selectedTile);
}

function setTileLayer(name, urlIdx) {
  const cfg = TILE_CONFIGS[name] || TILE_CONFIGS.satellite;
  const entries = cfg.urls;
  let idx = urlIdx != null ? urlIdx : (TILE_URL_PREFERRED[name] || 0);
  if (idx < 0 || idx >= entries.length) idx = 0;
  const entry = typeof entries[idx] === 'string' ? { url: entries[idx] } : entries[idx];

  if (STATE.tileLayer) STATE.map.removeLayer(STATE.tileLayer);
  if (STATE.tileOverlay) { STATE.map.removeLayer(STATE.tileOverlay); STATE.tileOverlay = null; }

  const layer = L.tileLayer(entry.url, Object.assign({}, cfg.opts, entry));
  let ok = 0, errors = 0;
  layer.on('tileload', () => { ok++; TILE_URL_PREFERRED[name] = idx; });
  if (entries.length > 1) {
    layer.on('tileerror', () => {
      errors++;
      if (ok === 0 && errors >= 4 && STATE.tileLayer === layer && idx < entries.length - 1) {
        setTileLayer(name, idx + 1);
      }
    });
  }
  layer.addTo(STATE.map);
  STATE.tileLayer = layer;
  STATE.selectedTile = name;

  if (cfg.overlay) {
    STATE.tileOverlay = L.tileLayer(cfg.overlay.url, cfg.overlay.opts).addTo(STATE.map);
  }
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

function drawPopupPriceChart(canvas, data) {
  const { ctx, W, H } = chartSetupCanvas(canvas);

  const PAD = { top: 14, right: 14, bottom: 18, left: 38 };
  const plotW = Math.max(1, W - PAD.left - PAD.right);
  const plotH = Math.max(1, H - PAD.top - PAD.bottom);

  let minP = Infinity, maxP = -Infinity;
  data.forEach(d => { if (d.price < minP) minP = d.price; if (d.price > maxP) maxP = d.price; });
  const range = maxP - minP;
  const pad = Math.max(range * 0.1, 0.005);
  minP -= pad;
  maxP += pad;

  const xPos = i => PAD.left + (i / Math.max(1, data.length - 1)) * plotW;
  const yPos = p => PAD.top + plotH - ((p - minP) / (maxP - minP)) * plotH;

  const indices = chartIndices(data, 6);
  ctx.strokeStyle = '#e8e8e8';
  ctx.lineWidth = 1;
  const gridCount = 3;
  for (let i = 0; i <= gridCount; i++) {
    const y = PAD.top + (i / gridCount) * plotH;
    ctx.beginPath();
    ctx.moveTo(PAD.left, y);
    ctx.lineTo(W - PAD.right, y);
    ctx.stroke();
    const price = maxP - (i / gridCount) * (maxP - minP);
    ctx.fillStyle = '#999';
    ctx.font = '9px system-ui, sans-serif';
    ctx.textAlign = 'right';
    ctx.textBaseline = 'middle';
    ctx.fillText(price.toFixed(3).replace('.', ','), PAD.left - 8, y);
  }
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  ctx.font = '8px system-ui, sans-serif';
  for (let i = 0; i < indices.length; i++) {
    const idx = indices[i];
    const d = data[idx];
    if (!d) continue;
    const parts = String(d.date).split('-');
    const dd = parseInt(parts[0], 10);
    const mm = parseInt(parts[1], 10);
    ctx.fillStyle = '#999';
    ctx.fillText(dd + '-' + mm, xPos(idx), H - PAD.bottom + 3);
  }

  ctx.strokeStyle = '#1a73e8';
  ctx.lineWidth = 2;
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  ctx.beginPath();
  data.forEach((d, i) => {
    const x = xPos(i);
    const y = yPos(d.price);
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  });
  ctx.stroke();

  const { minD, maxD } = chartMinMax(data);

  const points = data.map((d, i) => ({
    x: xPos(i), y: yPos(d.price), price: d.price, date: d.date
  }));
  canvas._chartPoints = points;
  canvas._chartData = data;

  data.forEach((d, i) => {
    const x = xPos(i);
    const y = yPos(d.price);
    ctx.beginPath();
    ctx.arc(x, y, 3, 0, Math.PI * 2);
    if (d === maxD && maxD !== minD) ctx.fillStyle = '#c62828';
    else if (d === minD) ctx.fillStyle = '#2e7d32';
    else ctx.fillStyle = '#1a73e8';
    ctx.fill();
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 1;
    ctx.stroke();
  });

  data.forEach((d, i) => {
    const x = xPos(i);
    const y = yPos(d.price);
    if (d === minD) {
      ctx.fillStyle = '#2e7d32';
      ctx.font = 'bold 9px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'bottom';
      ctx.fillText(d.price.toFixed(3).replace('.', ',') + '▼', x, y - 4);
    } else if (d === maxD && maxD !== minD) {
      ctx.fillStyle = '#c62828';
      ctx.font = 'bold 9px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'top';
      ctx.fillText('▲' + d.price.toFixed(3).replace('.', ','), x, y + 4);
    } else {
      ctx.fillStyle = '#555';
      ctx.font = '8px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'bottom';
      ctx.fillText(d.price.toFixed(3).replace('.', ','), x, y - 5);
    }
  });

  if (!canvas._chartTooltipAttached) {
    canvas._chartTooltipAttached = true;
    canvas.addEventListener('mousemove', onPopupChartHover);
    canvas.addEventListener('mouseleave', onPopupChartLeave);
  }
}

function onPopupChartHover(e) {
  const canvas = e.target;
  const rect = canvas.getBoundingClientRect();
  const mx = e.clientX - rect.left;
  const my = e.clientY - rect.top;
  const points = canvas._chartPoints;
  if (!points) return;

  let nearest = null;
  let minDist = 12;
  for (const p of points) {
    const dx = mx - p.x;
    const dy = my - p.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    if (dist < minDist) {
      minDist = dist;
      nearest = p;
    }
  }

  if (nearest) {
    drawPopupPriceChart(canvas, canvas._chartData);
    drawTooltip(canvas, nearest);
  }
}

function onPopupChartLeave(e) {
  const canvas = e.target;
  if (canvas._chartData) {
    drawPopupPriceChart(canvas, canvas._chartData);
  }
}

async function loadPopupChartForFuel(container, station, fuelName) {
  const wrap = container.querySelector('.popup-chart-wrap');
  const canvas = wrap.querySelector('.popup-price-chart');
  const loadingEl = wrap.querySelector('.popup-history-loading');
  const errorEl = wrap.querySelector('.popup-history-error');
  const s = STATE;
  const daysEl = container.querySelector('.popup-history-days');
  const days = parseInt(daysEl ? daysEl.value : 7, 10) || 7;
  loadingEl.style.display = 'flex';
  errorEl.style.display = 'none';
  try {
    if (!window._historyCache || window._historyCache.province !== s.selectedProv || window._historyCache.days !== days) {
      const data = await fetchProvinceHistory(s.selectedProv, days);
      window._historyCache = { province: s.selectedProv, days, data };
    }
    const stationData = window._historyCache.data;
    const history = getStationHistory(stationData, station.IDEESS, fuelName);
    if (history.length < 2) {
      loadingEl.style.display = 'none';
      errorEl.textContent = 'No hay suficientes datos históricos';
      errorEl.style.display = 'flex';
      return;
    }
    loadingEl.style.display = 'none';
    const sliced = history.slice(-days);
    requestAnimationFrame(() => drawPopupPriceChart(canvas, sliced));
  } catch (e) {
    loadingEl.style.display = 'none';
    errorEl.textContent = 'Error: ' + (e.message || 'desconocido');
    errorEl.style.display = 'flex';
  }
}

async function loadPopupHistory(container, stationId) {
  const fuelSelect = container.querySelector('.popup-history-fuel');
  const s = STATE;
  if (!s.selectedProv) { container.dataset.loaded = '1'; return; }
  const station = s.data.find(x => x.IDEESS === stationId);
  if (!station) { container.dataset.loaded = '1'; return; }
  const fuelName = populateHistoryFuelSelect(fuelSelect, station, s.selectedFuel);
  await loadPopupChartForFuel(container, station, fuelName);
  container.dataset.loaded = '1';
}
