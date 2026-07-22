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

function drawPopupPriceChart(canvas, data) {
  const ctx = canvas.getContext('2d');
  const dpr = window.devicePixelRatio || 1;
  const rect = canvas.getBoundingClientRect();
  const W = rect.width;
  const H = rect.height;
  canvas.width = W * dpr;
  canvas.height = H * dpr;
  ctx.scale(dpr, dpr);

  ctx.clearRect(0, 0, W, H);

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
  data.forEach((d, i) => {
    ctx.fillStyle = '#999';
    const parts = d.date.split('-');
    const dd = parseInt(parts[0], 10);
    const mm = parseInt(parts[1], 10);
    ctx.fillText(dd + '-' + mm, xPos(i), H - PAD.bottom + 3);
  });

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

  const minD = data.reduce((a, b) => a.price < b.price ? a : b);
  const maxD = data.reduce((a, b) => a.price > b.price ? a : b);

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
    drawPopupTooltip(canvas, nearest);
  }
}

function onPopupChartLeave(e) {
  const canvas = e.target;
  if (canvas._chartData) {
    drawPopupPriceChart(canvas, canvas._chartData);
  }
}

function drawPopupTooltip(canvas, point) {
  const ctx = canvas.getContext('2d');
  const dpr = window.devicePixelRatio || 1;
  const rect = canvas.getBoundingClientRect();
  ctx.scale(dpr, dpr);

  const parts = String(point.date).split('-');
  const dateLabel = parts.length === 3 ? parts[2] + '-' + parts[1] + '-' + parts[0] : point.date;
  const priceLabel = point.price.toFixed(3).replace('.', ',') + ' €';
  ctx.font = 'bold 11px system-ui, sans-serif';
  const pm = ctx.measureText(priceLabel);
  ctx.font = '10px system-ui, sans-serif';
  const dm = ctx.measureText(dateLabel);
  const pw = pm.width, dw = dm.width;
  const tw = Math.max(pw, dw);
  const lh = 16;
  const pad = 6;
  const bw = tw + pad * 2;
  const bh = lh * 2 + pad * 2;
  let bx = point.x - bw / 2;
  let by = point.y - bh - 10;
  if (bx < 2) bx = 2;
  if (bx + bw > rect.width - 2) bx = rect.width - bw - 2;
  if (by < 2) by = point.y + 10;

  ctx.fillStyle = 'rgba(0,0,0,0.8)';
  ctx.beginPath();
  ctx.roundRect(bx, by, bw, bh, 4);
  ctx.fill();

  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 11px system-ui, sans-serif';
  ctx.fillText(priceLabel, bx + bw / 2, by + pad + lh / 2);
  ctx.font = '10px system-ui, sans-serif';
  ctx.fillText(dateLabel, bx + bw / 2, by + pad + lh + lh / 2);
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
