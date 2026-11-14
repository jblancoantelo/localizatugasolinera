// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 Juan Blanco Antelo — Localiza tu Gasolinera

// === Comparador de precios por litros (botón 🧮 del toolbar) ===
// Coge las N primeras favoritas, resuelve sus datos (provincia cargada, caché o
// API) y calcula lo que cuesta repostar X litros del combustible del filtro.
// El resultado se ordena de más barata a más cara y marca los extremos.

const COMPARE_LITERS_DEFAULT = 25;
const COMPARE_COUNT_DEFAULT = 5;
const COMPARE_LITERS_MIN = 1;
const COMPARE_LITERS_MAX = 1000;

let _cmpFavIds = [];
let _cmpRecords = null;
let _cmpStations = new Map();
let _cmpProvince = new Map();
let _cmpToken = 0;

function cmpEsc(v) {
  return String(v == null ? '' : v).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

function cmpLiters() {
  const v = parseFloat(STATE.compareLiters);
  if (!isFinite(v) || v < COMPARE_LITERS_MIN) return COMPARE_LITERS_DEFAULT;
  return Math.min(COMPARE_LITERS_MAX, v);
}

// Devuelve el nº de favoritas a mostrar: respeta STATE.compareCount pero nunca
// supera las que hay. Si no hay ninguna guardada, cae al valor por defecto.
function cmpCount(max) {
  const n = parseInt(STATE.compareCount, 10);
  const wanted = isFinite(n) && n > 0 ? n : COMPARE_COUNT_DEFAULT;
  return Math.max(1, Math.min(wanted, Math.max(1, max)));
}

function cmpNum(v) {
  return String(v).replace('.', ',');
}

function cmpEuro(v) {
  return v.toFixed(2).replace('.', ',') + ' €';
}

function cmpPrice(v) {
  return v.toFixed(3).replace('.', ',') + ' €/L';
}

function cmpFuelFilterLabel() {
  const sf = STATE.selectedFuel;
  if (!sf) return 'Sin filtro: se usa el primer combustible disponible de cada estación.';
  if (FUEL_GROUPS[sf]) return 'Filtro: ' + sf + ' (el primer combustible del grupo disponible en cada estación).';
  return 'Filtro: ' + sf + '.';
}

function initCompare() {
  const btn = document.getElementById('compareBtn');
  if (!btn) return;

  btn.addEventListener('click', () => { openCompareModal(); });
  document.getElementById('compareClose').addEventListener('click', closeCompareModal);
  document.getElementById('compareOverlay').addEventListener('click', closeCompareModal);

  const litersEl = document.getElementById('compareLiters');
  litersEl.addEventListener('input', () => {
    const v = parseFloat(litersEl.value);
    // Mientras se escribe (campo vacío o "0") no se pisa lo guardado: se
    // corrige al salir del campo.
    if (!isFinite(v) || v < COMPARE_LITERS_MIN) return;
    STATE.compareLiters = Math.min(COMPARE_LITERS_MAX, v);
    saveState();
    cmpRender();
  });
  litersEl.addEventListener('blur', () => {
    const v = cmpLiters();
    STATE.compareLiters = v;
    litersEl.value = v;
    saveState();
    cmpRender();
  });

  const countEl = document.getElementById('compareCount');
  countEl.addEventListener('input', () => {
    const v = parseInt(countEl.value, 10);
    if (!isFinite(v) || v < 1) return;
    STATE.compareCount = Math.min(Math.max(1, _cmpFavIds.length), v);
    saveState();
    cmpRefresh();
  });
  countEl.addEventListener('blur', () => {
    countEl.value = _cmpFavIds.length ? cmpCount(_cmpFavIds.length) : 0;
  });

  document.getElementById('compareCountMinus').addEventListener('click', () => cmpStepCount(-1));
  document.getElementById('compareCountPlus').addEventListener('click', () => cmpStepCount(1));

  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') closeCompareModal();
  });
}

function cmpStepCount(delta) {
  if (!_cmpFavIds.length) return;
  const max = Math.max(1, _cmpFavIds.length);
  const next = Math.max(1, Math.min(max, cmpCount(max) + delta));
  STATE.compareCount = next;
  document.getElementById('compareCount').value = next;
  saveState();
  cmpRefresh();
}

async function openCompareModal() {
  _cmpFavIds = [...new Set((STATE.favorites || []).map(String))];
  _cmpRecords = null;
  _cmpStations = new Map();
  _cmpProvince = new Map();
  _cmpToken++;

  document.getElementById('compareFuelLine').textContent = cmpFuelFilterLabel();
  cmpUpdateControls();
  cmpLoading();
  document.getElementById('compareOverlay').classList.add('show');
  document.getElementById('compareModal').classList.add('show');
  const litersEl = document.getElementById('compareLiters');
  if (litersEl) litersEl.focus();
  await cmpRefresh();
}

function closeCompareModal() {
  document.getElementById('compareOverlay').classList.remove('show');
  document.getElementById('compareModal').classList.remove('show');
  _cmpToken++;
}

function cmpUpdateControls() {
  const total = _cmpFavIds.length;
  const max = Math.max(1, total);
  const litersEl = document.getElementById('compareLiters');
  const countEl = document.getElementById('compareCount');
  const minus = document.getElementById('compareCountMinus');
  const plus = document.getElementById('compareCountPlus');
  const hint = document.getElementById('compareCountHint');

  // No pisar el valor mientras se escribe: los handlers ya mantienen STATE.
  if (document.activeElement !== litersEl) litersEl.value = cmpLiters();
  countEl.max = max;
  countEl.disabled = total === 0;
  if (document.activeElement !== countEl) countEl.value = total ? cmpCount(total) : 0;
  minus.disabled = total < 2 || cmpCount(total) <= 1;
  plus.disabled = total < 2 || cmpCount(total) >= total;
  hint.textContent = total ? 'de ' + total + ' favorita' + (total === 1 ? '' : 's') : 'sin favoritas';
}

function cmpLoading() {
  const body = document.getElementById('compareBody');
  if (!body) return;
  body.innerHTML = '<div class="compare-loading">Cargando precios de tus favoritas…</div>';
  document.getElementById('compareFoot').innerHTML = '';
}

async function cmpRefresh() {
  const token = ++_cmpToken;
  if (!_cmpFavIds.length) { cmpRender(); return; }
  const count = cmpCount(_cmpFavIds.length);
  const pending = _cmpFavIds.slice(0, count).some(id => !_cmpStations.has(id));
  if (pending) {
    cmpLoading();
    await cmpEnsure(count);
    if (token !== _cmpToken) return;
  }
  cmpRender();
}

async function cmpEnsure(count) {
  if (!_cmpRecords) {
    const recs = await dbGetAllFavorites();
    _cmpRecords = new Map((recs || []).map(r => [String(r.id), r]));
  }
  const tasks = [];
  for (const id of _cmpFavIds.slice(0, count)) {
    if (_cmpStations.has(id)) continue;
    const local = STATE.data.find(d => String(d.IDEESS) === id);
    if (local) { _cmpStations.set(id, local); continue; }
    tasks.push(cmpResolveStation(id));
  }
  if (tasks.length) await Promise.all(tasks);
}

async function cmpResolveStation(id) {
  const rec = _cmpRecords ? _cmpRecords.get(id) : null;
  const provName = (rec && rec.provinceName) || STATE.selectedProv;
  const provId = (rec && rec.provinceId) || (provName && STATE.provinceIdMap ? STATE.provinceIdMap[provName] : null);
  if (!provName) { _cmpStations.set(id, null); return; }
  const data = await cmpLoadProvince(provName, provId);
  _cmpStations.set(id, data.find(d => String(d.IDEESS) === id) || null);
}

function cmpLoadProvince(provName, provId) {
  if (_cmpProvince.has(provName)) return _cmpProvince.get(provName);
  const p = (async () => {
    let data = await getCachedProvinceData(provName);
    if (!data && provId) {
      try {
        const r = await apiFetch(API_BASE + 'EstacionesTerrestres/FiltroProvincia/' + provId);
        if (!r.ok) return [];
        const json = await r.json();
        data = Array.isArray(json.ListaEESSPrecio) ? json.ListaEESSPrecio : [];
        if (data.length) await cacheProvinceData(provName, data, getCacheTtl());
      } catch (e) { return []; }
    }
    return data || [];
  })();
  _cmpProvince.set(provName, p);
  return p;
}

function cmpRender() {
  const body = document.getElementById('compareBody');
  const foot = document.getElementById('compareFoot');
  if (!body || !foot) return;

  if (!_cmpFavIds.length) {
    body.innerHTML = '<div class="compare-empty">' +
      '<div class="compare-empty-icon">⭐</div>' +
      '<p>Todavía no tienes gasolineras favoritas.</p>' +
      '<p class="compare-empty-hint">Marca estaciones con la ☆ en el mapa o en la tabla y aparecerán aquí para comparar lo que cuesta repostar.</p>' +
      '</div>';
    foot.innerHTML = '';
    cmpUpdateControls();
    return;
  }

  const liters = cmpLiters();
  const count = cmpCount(_cmpFavIds.length);
  const rows = _cmpFavIds.slice(0, count).map(id => {
    const st = _cmpStations.get(id) || null;
    const price = st ? getSelectedFuelPrice(st) : null;
    return {
      id,
      st,
      price,
      fuel: st ? getSelectedFuelName(st) : '',
      total: price === null ? null : price * liters
    };
  });

  rows.sort((a, b) => {
    if (a.total === null && b.total === null) return String(a.id).localeCompare(String(b.id));
    if (a.total === null) return 1;
    if (b.total === null) return -1;
    return a.total - b.total;
  });

  const priced = rows.filter(r => r.total !== null);
  const cheapestId = priced.length >= 2 ? priced[0].id : null;
  const priciestId = priced.length >= 2 ? priced[priced.length - 1].id : null;
  const best = priced.length ? priced[0].total : null;
  const filterName = STATE.selectedFuel || 'el combustible seleccionado';

  body.innerHTML = rows.map((row, idx) => {
    const cls = ['compare-card'];
    let diffText = '';
    let diffCls = '';

    if (row.total === null) {
      cls.push('noprice');
      diffText = 'Sin precio';
      diffCls = 'none';
    } else if (row.id === cheapestId) {
      cls.push('cheapest');
      diffText = 'Más barata';
      diffCls = 'cheapest';
    } else if (priced.length < 2) {
      diffText = 'Única con precio';
    } else if (best !== null && best > 0) {
      const diff = row.total - best;
      const pct = (diff / best) * 100;
      diffText = '+' + cmpEuro(diff) + ' · +' + pct.toFixed(1).replace('.', ',') + ' %';
      diffCls = row.id === priciestId ? 'priciest' : '';
      if (row.id === priciestId) cls.push('priciest');
    } else {
      diffText = 'Única con precio';
    }

    let name, sub, priceLine;
    if (!row.st) {
      name = 'Estación no disponible';
      sub = 'No se pudieron cargar sus datos';
      priceLine = 'Sin datos';
    } else {
      name = row.st.Rótulo || 'Sin nombre';
      const parts = [];
      if (row.st.Provincia && row.st.Provincia !== STATE.selectedProv) parts.push(row.st.Provincia);
      if (row.st.Localidad) parts.push(row.st.Localidad);
      if (row.st['Dirección']) parts.push(row.st['Dirección']);
      sub = parts.join(' · ') || 'Sin dirección';
      if (row.price === null) {
        priceLine = 'Sin precio para ' + cmpEsc(filterName);
      } else {
        const dto = getDiscount(row.st);
        priceLine = cmpEsc(row.fuel || filterName) + ' · ' + cmpPrice(row.price) +
          (dto ? ' <span class="compare-dto">dto. −' + cmpNum(dto) + ' cts/L</span>' : '');
      }
    }

    return '<div class="' + cls.join(' ') + '" data-id="' + cmpEsc(row.id) + '"' +
      ' data-total="' + (row.total === null ? '' : row.total.toFixed(2)) + '"' +
      ' data-price="' + (row.price === null ? '' : row.price.toFixed(3)) + '"' +
      ' data-fuel="' + cmpEsc(row.fuel) + '">' +
      '<div class="compare-rank">' + (idx + 1) + '</div>' +
      '<div class="compare-main">' +
        '<div class="compare-name">' + cmpEsc(name) + '</div>' +
        '<div class="compare-sub">' + cmpEsc(sub) + '</div>' +
        '<div class="compare-price-line">' + priceLine + '</div>' +
      '</div>' +
      '<div class="compare-total">' +
        '<strong>' + (row.total === null ? '—' : cmpEuro(row.total)) + '</strong>' +
        '<div class="compare-diff ' + diffCls + '">' + diffText + '</div>' +
      '</div>' +
    '</div>';
  }).join('');

  let summary = '';
  if (priced.length >= 2) {
    const worst = priced[priced.length - 1].total;
    const save = worst - best;
    const pct = best > 0 ? (save / best) * 100 : 0;
    summary = '<div class="compare-summary">Con <b>' + cmpNum(liters) + ' L</b> la más barata cuesta <b>' +
      cmpEuro(best) + '</b> y la más cara <b>' + cmpEuro(worst) + '</b>: ahorras <b>' +
      cmpEuro(save) + '</b> (' + pct.toFixed(1).replace('.', ',') + ' %).</div>';
  } else if (priced.length === 1) {
    summary = '<div class="compare-summary">Solo una favorita tiene precio para este combustible: <b>' +
      cmpEuro(best) + '</b> por ' + cmpNum(liters) + ' L.</div>';
  } else {
    summary = '<div class="compare-summary compare-warn">Ninguna de las favoritas tiene precio para el filtro actual.</div>';
  }

  foot.innerHTML = summary +
    '<div class="compare-note">Precios con los descuentos por marca aplicados. Cambia el litraje o el número de favoritas arriba; los totales se recalculan al momento.</div>';

  cmpUpdateControls();
}
