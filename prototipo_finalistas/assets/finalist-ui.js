// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 Juan Blanco Antelo — Localiza tu Gasolinera

/* ============================================================================
   FinalistUI — interfaz compartida por los tres finalistas
   ----------------------------------------------------------------------------
   Los tres shells (pulgar, torre, una app) usan los mismos renderizadores:
   lista, tabla, mapa, ficha, comparador, planificador, asistente, insights,
   configuración, chat IA, modo conducción y paleta de comandos.
   ========================================================================== */
const FinalistUI = (() => {
  'use strict';

  const C = FinalistCore;
  const S = C.state;
  const esc = Proto.esc;

  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));
  const fmtL = C.fmtL;
  const fmtEur = C.fmtEur;
  const fmt1 = C.fmt1;

  const ui = {
    layout: 'thumb',
    root: null,
    sheetCtl: null,
    detailSheetCtl: null,
    detailCtl: null,
    detailEl: null,
    maps: {},
    pager: 0,
    selId: null,
    towerPanel: 'explorar',
    inspTab: 'ficha',
    panelEl: null,
    lastOverlay: null,
    driveIdx: 0,
  };

  /* Equivalentes sintéticos de los 10 estilos de mapa de la app. El color se
     aplica con variables CSS sobre el SVG del mapa, sin red. */
  const MAP_STYLES = [
    ['claro', 'Claro'],
    ['oscuro', 'Oscuro'],
    ['satelite', 'Satélite'],
    ['terreno', 'Terreno'],
    ['trafico', 'Tráfico'],
    ['noche', 'Noche'],
    ['papel', 'Papel'],
    ['azul', 'Azul'],
    ['minimal', 'Minimal'],
    ['contraste', 'Alto contraste'],
  ];

  const PALETTE = ['#0b62d6', '#00875a', '#c26b00'];

  /* === 1. Piezas comunes ================================================ */
  function brandLogo(st, cls = 'sm') {
    const m = PROTO.brandMeta(st.brand);
    return `<span class="brandlogo ${cls}" style="background:${m.color};color:${m.ink}">${esc(st.brand.slice(0, 2))}</span>`;
  }

  function priceTag(st, fuel = S.fuel, cls = 'p-sm') {
    const p = C.priceOf(st, fuel);
    if (p == null) return '<span class="fl-dim">—</span>';
    const s = C.stats();
    const lvl = s ? PROTO.level(p, s.lo, s.hi) : 'mid';
    return `<span class="price ${cls} ${lvl}">${p.toFixed(3).replace('.', ',')}<span class="p-unit">€/L</span></span>`;
  }

  function deltaTag(st, days = 14) {
    const t = PROTO.seriesStats(PROTO.series(st, S.fuel, days));
    if (!t) return '';
    const flat = Math.abs(t.diff) < 0.0005;
    const cls = flat ? 'flat' : t.diff < 0 ? 'down' : 'up';
    const ic = flat ? 'minus' : t.diff < 0 ? 'trendDown' : 'trendUp';
    return `<span class="delta ${cls}">${Proto.icon(ic, 'xs')}${Math.abs(t.diff * 100).toFixed(1).replace('.', ',')} ¢</span>`;
  }

  function badges(st, km = null) {
    const meta = PROTO.brandMeta(st.brand);
    const out = [];
    if (meta.discount) out.push(`<span class="badge ok">-${meta.discount} ¢ app</span>`);
    if (km != null) out.push(`<span class="badge">${Proto.icon('route', 'xs')} ${PROTO.dist(km)} · ${PROTO.driveMin(km)} min</span>`);
    out.push(`<span class="badge">${st.schedule === '24h' ? '24 h' : esc(st.schedule)}</span>`);
    if (st.updatedMin > 25) out.push(`<span class="badge warn">${PROTO.since(st.updatedMin)}</span>`);
    return out.join('');
  }

  function rowHtml(st, { mini = false, selected = false } = {}) {
    const km = PROTO.kmFromUser(st);
    const meta = PROTO.brandMeta(st.brand);
    const p = C.priceOf(st);
    const best = p != null && p === (C.stats() || {}).min;
    const stats = C.stats();
    const lvl = stats && p != null ? PROTO.level(p, stats.lo, stats.hi) : 'mid';
    return `<div class="fl-row ${mini ? 'fl-row-min' : ''} ${selected ? 'on' : ''}" data-fl-act="detail" data-id="${st.id}" role="button" tabindex="0" aria-label="${esc(st.name)}">
      ${brandLogo(st)}
      <span class="fl-grow">
        <span class="fl-name"><span>${esc(st.name)}</span>${best ? '<span class="badge ok">mín</span>' : ''}</span>
        <span class="fl-meta">${esc(st.address)} · ${esc(st.city)}</span>
        <span class="fl-meta badges">${badges(st, km)}</span>
      </span>
      <span class="fl-side">
        <span class="price p-sm ${lvl}">${p != null ? p.toFixed(3).replace('.', ',') : '—'}<span class="p-unit">€/L</span></span>
        <small>${meta.discount ? '-' + meta.discount + ' ¢' : ''} ${deltaTag(st)}</small>
      </span>
      <span class="fl-actions">
        <button class="fl-mini ${S.compare.includes(st.id) ? 'on' : ''}" data-fl-act="compare" data-id="${st.id}" title="Comparar" aria-label="Comparar ${esc(st.name)}">${Proto.icon('compare', 'sm')}</button>
        <button class="fl-mini ${st.fav ? 'on' : ''}" data-fl-act="fav" data-id="${st.id}" title="Favorito" aria-label="Favorito">${Proto.icon(st.fav ? 'starFill' : 'star', st.fav ? 'sm fill' : 'sm')}</button>
      </span>
    </div>`;
  }

  function pagerHtml(total, size, page) {
    const pages = size ? Math.max(1, Math.ceil(total / size)) : 1;
    return `<div class="fl-pager">
      <select class="select-native" data-fl-field="pageSize" aria-label="Resultados por página" style="width:auto;min-height:32px">
        ${[5, 10, 15, 30, 50, 100, 0].map(n => `<option value="${n}" ${n === size ? 'selected' : ''}>${n || 'Todas'}</option>`).join('')}
      </select>
      <div class="segmented">
        <button data-fl-act="page" data-page="prev" aria-label="Anterior" ${page <= 0 ? 'disabled' : ''}>◀</button>
        <button data-fl-act="page" data-page="next" aria-label="Siguiente" ${page >= pages - 1 ? 'disabled' : ''}>▶</button>
      </div>
      <span class="fl-tiny">${size ? `${page + 1} / ${pages}` : 'todo'} · ${total} estaciones</span>
      <span class="fl-grow"></span>
      <span class="fl-tiny">${fmtL((C.stats() || {}).min)}–${fmtL((C.stats() || {}).max)}</span>
    </div>`;
  }

  function listData() {
    const all = C.list();
    const size = S.pageSize;
    const pages = size ? Math.max(1, Math.ceil(all.length / size)) : 1;
    if (ui.pager > pages - 1) ui.pager = pages - 1;
    if (ui.pager < 0) ui.pager = 0;
    const slice = size ? all.slice(ui.pager * size, (ui.pager + 1) * size) : all;
    return { all, slice, size, page: ui.pager };
  }

  function renderList(host, { mini = false, pager = true } = {}) {
    const { all, slice, size, page } = listData();
    if (!all.length) {
      host.innerHTML = `<div class="fl-empty">${Proto.icon('search')}<b>Sin resultados</b>Prueba con otra provincia, combustible o quita filtros.</div>`;
      Proto.hydrateIcons(host);
      return;
    }
    host.innerHTML = `<div class="fl-list">${slice.map(st => rowHtml(st, { mini, selected: ui.selId === st.id })).join('')}</div>` +
      (pager ? pagerHtml(all.length, size, page) : '');
    Proto.hydrateIcons(host);
  }

  function tableRows(host) {
    const { all, slice, size, page } = listData();
    if (!all.length) { host.innerHTML = '<div class="fl-empty"><b>Sin resultados</b>Cambia los filtros.</div>'; return; }
    const sortBtn = (key, label) => `<button data-fl-act="sort" data-key="${key}" class="${S.sort === key ? 'on' : ''}">${label}${S.sort === key ? (S.dir === 'asc' ? ' ▲' : ' ▼') : ''}</button>`;
    host.innerHTML = `<div class="fl-table-wrap"><table class="fl-table">
      <thead><tr>
        <th>Marca</th><th>Estación</th><th>${sortBtn('price', 'Precio')}</th><th>14 d</th>
        <th>${sortBtn('distance', 'Distancia')}</th><th>${sortBtn('updated', 'Actualizado')}</th>
        <th>Localidad</th><th>Calle</th><th></th>
      </tr></thead>
      <tbody>${slice.map(st => {
        const p = C.priceOf(st);
        const stats = C.stats();
        const lvl = stats && p != null ? PROTO.level(p, stats.lo, stats.hi) : 'mid';
        return `<tr data-fl-act="detail" data-id="${st.id}">
          <td>${brandLogo(st)} <span class="fl-small">${esc(st.brand)}</span></td>
          <td><b>${esc(st.name)}</b></td>
          <td><span class="price p-sm ${lvl}">${p != null ? p.toFixed(3).replace('.', ',') : '—'}<span class="p-unit">€/L</span></span></td>
          <td>${deltaTag(st)}</td>
          <td class="fl-num">${PROTO.dist(PROTO.kmFromUser(st))}</td>
          <td class="fl-num">${PROTO.since(st.updatedMin)}</td>
          <td>${esc(st.city)}</td>
          <td>${esc(st.address)}</td>
          <td><button class="fl-mini ${S.compare.includes(st.id) ? 'on' : ''}" data-fl-act="compare" data-id="${st.id}" title="Comparar">${Proto.icon('compare', 'sm')}</button></td>
        </tr>`;
      }).join('')}</tbody>
    </table></div>` + (size ? `<div class="fl-pager"><div class="segmented">
        <button data-fl-act="page" data-page="prev" ${page <= 0 ? 'disabled' : ''}>◀</button>
        <button data-fl-act="page" data-page="next" ${page >= Math.max(1, Math.ceil(all.length / size)) - 1 ? 'disabled' : ''}>▶</button>
      </div><span class="fl-tiny">${page + 1} / ${Math.max(1, Math.ceil(all.length / size))} · ${all.length} filas</span></div>` : '');
    Proto.hydrateIcons(host);
  }

  /* === 2. Mapa ========================================================== */
  function ensureMap(kind, host) {
    if (!host) return null;
    if (ui.maps[kind] && ui.maps[kind].host.isConnected) return ui.maps[kind];
    if (ui.maps[kind]) delete ui.maps[kind];
    if (typeof ProtoMap === 'undefined') return null;
    const opts = { fuel: S.fuel, stations: C.list(), zoom: 1.25, showLayers: false };
    const ctl = ProtoMap.create(host, opts);
    ctl.on('marker', (id) => openDetail(id));
    host.dataset.mapstyle = S.mapStyle;
    ui.maps[kind] = { ctl, opts, host };
    return ui.maps[kind];
  }

  function syncMaps() {
    for (const kind of Object.keys(ui.maps)) {
      const m = ui.maps[kind];
      m.host.dataset.mapstyle = S.mapStyle;
      m.opts.fuel = S.fuel;
      m.ctl.setStations(C.list());
      m.ctl.setRadius(S.maxKm || 0);
      if (ui.selId) m.ctl.select(ui.selId);
    }
  }

  /* === 3. Ficha ========================================================= */
  function detailAction(act, st) {
    if (act === 'compare') {
      C.toggleCompare(st.id);
      Proto.toast(S.compare.includes(st.id) ? 'Añadida al comparador' : 'Quitada del comparador', { iconName: 'compare' });
      repaint({ keepDetail: true });
      return true;
    }
    if (act === 'route') { openDrive(st.id); return true; }
    if (act === 'alert') {
      Proto.toast('Aviso creado: te avisamos si baja de ' + fmtL(Math.max(0.2, (C.priceOf(st) || 0) - 0.03)), { iconName: 'bell' });
      return true;
    }
    if (act === 'fav') {
      C.toggleFav(st.id);
      Proto.toast(st.fav ? st.name + ' en favoritos' : 'Quitada de favoritos', { iconName: st.fav ? 'starFill' : 'star' });
      repaint({ keepDetail: true });
      ui.detailCtl?.redraw();
      return true;
    }
    return false;
  }

  function detailOptions() {
    return {
      fuel: S.fuel, days: 14, list: C.list(),
      onAction: detailAction,
      onFuel: (f) => { S.fuel = f; C.save(); syncFilterInputs(); repaint({ keepDetail: true }); ui.detailCtl?.redraw(); },
    };
  }

  function mountDetailBody(host, id) {
    const st = C.byId(id);
    if (!st) return;
    host.innerHTML = '';
    ui.detailCtl = Proto.stationDetail(host, st, detailOptions());
  }

  function ensureDetailSheet() {
    if (ui.detailEl) return;
    const el = Proto.el(`<div class="sheet fl-det-sheet" data-sheet>
      <div class="sheet-head"><span class="sheet-grab"></span><h2>Ficha de la estación</h2><div class="spacer"></div>
        <button class="iconbtn" data-fl-act="close-detail" aria-label="Cerrar">${Proto.icon('close')}</button></div>
      <div class="sheet-body fl-det-body"></div>
    </div>`);
    document.body.appendChild(el);
    Proto.hydrateIcons(el);
    ui.detailEl = el;
    ui.detailSheetCtl = Proto.sheet(el, { snaps: ['half', 'full'], start: 'full', full: 0.9, onClose: () => { ui.detailCtl = null; } });
  }

  function openDetailSheet(id) {
    ensureDetailSheet();
    mountDetailBody($('.fl-det-body', ui.detailEl), id);
    ui.detailSheetCtl.open('full');
  }

  function openDetailOverlay(id) {
    const ov = overlayShell('Ficha de la estación', 'info', { scroll: true, className: 'fl-detail-overlay' });
    mountDetailBody(ov.host, id);
    ov.host.classList.add('fl-det-body');
  }

  function openDetail(id) {
    const st = C.byId(id);
    if (!st) return;
    ui.selId = id;
    if (ui.layout === 'tower') {
      if (window.innerWidth > 1180) {
        ui.inspTab = 'ficha';
        renderInspector();
        const m = ui.maps.explore;
        if (m) m.ctl.focus(id);
        return;
      }
      openDetailSheet(id);
      return;
    }
    if (ui.layout === 'thumb') { openDetailSheet(id); return; }
    if (window.innerWidth >= 860) openDetailOverlay(id);
    else openDetailSheet(id);
    if (ui.maps[kindOfCurrentPane()]) ui.maps[kindOfCurrentPane()].ctl.focus(id);
  }

  function kindOfCurrentPane() {
    if (ui.layout === 'unified') return S.lastTab === 'ambos' ? 'both' : 'uni';
    return 'thumb';
  }

  /* === 4. Inspector de la torre ======================================== */
  function renderInspector() {
    const host = $('#flInspectorBody');
    if (!host) return;
    const ficha = ui.inspTab === 'ficha' && ui.selId;
    host.innerHTML = ficha ? '' : '<div data-insights></div>';
    if (ficha) {
      const st = C.byId(ui.selId);
      if (!st) { ui.selId = null; return renderInspector(); }
      const head = document.createElement('div');
      head.className = 'fl-between fl-mb2';
      head.innerHTML = `<span class="fl-card-title">${esc(st.name)}</span>
        <button class="fl-iconbtn" data-fl-act="insp-close" title="Cerrar ficha">${Proto.icon('close', 'sm')}</button>`;
      host.appendChild(head);
      const body = document.createElement('div');
      host.appendChild(body);
      ui.detailCtl = Proto.stationDetail(body, st, detailOptions());
    } else {
      renderInsights($('[data-insights]', host));
    }
    $$('[data-fl-act="insp"]').forEach(b => b.classList.toggle('on', b.dataset.val === (ficha ? 'ficha' : 'insights')));
    Proto.hydrateIcons(host);
  }

  /* === 5. Cabecera de resumen ========================================== */
  function summaryHtml() {
    const s = C.stats();
    if (!s) return '';
    return `<div class="fl-between fl-wrap">
      <span class="fl-total">${s.count} estaciones · ${esc(C.fuelName())} <small>· media ${fmtL(s.avg)}</small></span>
      <span class="fl-tiny">${fmtL(s.min)} — ${fmtL(s.max)}</span>
    </div>`;
  }

  function kpisHtml() {
    const s = C.stats();
    const list = C.list();
    if (!s) return '';
    const save = (s.avg - s.min) * S.litros;
    return `<div class="fl-kpis">
      <div class="fl-kpi"><div class="k">Más barata</div><div class="v num">${fmtL(s.min)}</div><div class="s">${esc(C.best(list).city)}</div></div>
      <div class="fl-kpi"><div class="k">Media</div><div class="v num">${fmtL(s.avg)}</div><div class="s">${s.count} estaciones</div></div>
      <div class="fl-kpi"><div class="k">Ahorro ${S.litros} L</div><div class="v num">${fmtEur(save)}</div><div class="s">frente a la media</div></div>
      <div class="fl-kpi"><div class="k">Favoritas</div><div class="v num">${PROTO.favorites().length}</div><div class="s">con aviso de precio</div></div>
    </div>`;
  }

  /* === 6. Filtros ====================================================== */
  function optionList(values, current) {
    return values.map(v => `<option value="${esc(v)}" ${v === current ? 'selected' : ''}>${esc(v)}</option>`).join('');
  }

  function fillFilterOptions(scope = document) {
    $$('[data-fl-field="province"]', scope).forEach(el => {
      el.innerHTML = '<option value="">Todas las provincias</option>' + optionList(C.provinces(), S.province);
    });
    $$('[data-fl-field="locality"]', scope).forEach(el => {
      el.innerHTML = '<option value="">Todas las localidades</option>' + optionList(C.localities(), S.locality);
    });
    $$('[data-fl-field="fuel"]', scope).forEach(el => {
      el.innerHTML = C.fuels().map(f => `<option value="${f.id}" ${f.id === S.fuel ? 'selected' : ''}>${esc(f.name)}</option>`).join('');
    });
    $$('[data-fl-field="sort"]', scope).forEach(el => {
      el.innerHTML = [['price', 'Precio'], ['distance', 'Distancia'], ['rating', 'Valoración'], ['updated', 'Actualización'], ['saving', 'Descuento'], ['brand', 'Marca'], ['name', 'Nombre']]
        .map(([v, l]) => `<option value="${v}" ${v === S.sort ? 'selected' : ''}>${l}</option>`).join('');
    });
    $$('[data-fl-field="mapStyle"]', scope).forEach(el => {
      el.innerHTML = MAP_STYLES.map(([v, l]) => `<option value="${v}" ${v === S.mapStyle ? 'selected' : ''}>${l}</option>`).join('');
    });
    $$('[data-brand-host]', scope).forEach(el => {
      el.innerHTML = C.brands().map(b => {
        const m = PROTO.brandMeta(b);
        return `<button class="chip ${S.brands.includes(b) ? 'on' : ''}" data-fl-brand="${esc(b)}" aria-pressed="${S.brands.includes(b)}">
          <i style="width:8px;height:8px;border-radius:50%;background:${m.color}"></i>${esc(b)}</button>`;
      }).join('');
    });
    $$('[data-fl-out="brands"]', scope).forEach(el => { el.textContent = S.brands.length || ''; el.hidden = !S.brands.length; });
  }

  function syncFilterInputs(scope = document) {
    const set = (key, val) => $$(`[data-fl-field="${key}"]`, scope).forEach(el => { el.value = val; });
    set('province', S.province);
    set('locality', S.locality);
    set('fuel', S.fuel);
    set('sort', S.sort);
    set('mapStyle', S.mapStyle);
    set('pageSize', S.pageSize);
    $$('[data-fl-field="maxKm"]', scope).forEach(el => { el.value = S.maxKm; });
    $$('[data-fl-out="maxKm"]', scope).forEach(el => { el.textContent = S.maxKm ? S.maxKm + ' km' : 'Sin límite'; });
    $$('[data-fl-act="favorites-only"]', scope).forEach(el => el.classList.toggle('on', S.favoritesOnly));
    $$('[data-fl-act="cheap-only"]', scope).forEach(el => el.classList.toggle('on', S.cheapOnly));
    $$('[data-fl-out="brands"]', scope).forEach(el => { el.textContent = S.brands.length || ''; el.hidden = !S.brands.length; });
  }

  function toolbarHtml() {
    return `<div class="fl-group">
        <select class="select-native" data-fl-field="province" aria-label="Provincia"></select>
        <select class="select-native" data-fl-field="locality" aria-label="Localidad"></select>
        <select class="select-native" data-fl-field="fuel" aria-label="Combustible"></select>
      </div>
      <span class="fl-sep"></span>
      <div class="fl-group" style="position:relative">
        <button class="chip" data-fl-act="brands-toggle">${Proto.icon('sliders', 'xs')} Marca <span class="badge" data-fl-out="brands" hidden></span></button>
        <div class="fl-brandpop" data-brandpop hidden>
          <div class="fl-between fl-mb2"><b class="fl-small">Filtrar por marca</b><button class="chip" data-fl-act="brands-clear">Todas</button></div>
          <div class="chips wrap" data-brand-host></div>
        </div>
      </div>
      <div class="fl-group fl-km">
        ${Proto.icon('route', 'xs')}
        <input type="range" data-fl-field="maxKm" min="0" max="60" step="1" value="0" aria-label="Distancia máxima">
        <b class="fl-tiny" data-fl-out="maxKm">Sin límite</b>
      </div>
      <span class="fl-sep"></span>
      <button class="chip" data-fl-act="favorites-only">${Proto.icon('star', 'xs')} Favoritos</button>
      <button class="chip" data-fl-act="cheap-only">${Proto.icon('percent', 'xs')} Descuento</button>
      <select class="select-native" data-fl-field="sort" aria-label="Ordenar"></select>
      <span class="fl-grow"></span>
      <button class="fl-iconbtn" data-fl-act="search-toggle" title="Buscar">${Proto.icon('search', 'sm')}</button>
      <button class="chip" data-fl-act="reset">${Proto.icon('refresh', 'xs')} Limpiar</button>`;
  }

  function searchRowHtml() {
    return `<div class="fl-searchrow" hidden>
      <label class="fl-search">${Proto.icon('search', 'sm')}
        <input type="search" data-fl-search placeholder="Marca, calle o localidad…" autocomplete="off" aria-label="Buscar estación">
      </label>
    </div>`;
  }

  function setFilter(patch) {
    Object.assign(S, patch);
    ui.pager = 0;
    C.save();
    fillFilterOptions();
    syncFilterInputs();
    repaint();
  }

  /* === 7. Panel: comparador ============================================ */
  function panelCompare(host) {
    const m = C.compareMetrics();
    const picks = m.rows.map(r => `<span class="fl-pick">${esc(PROTO.shortName ? PROTO.shortName(r.st.name) : r.st.name)} <b>${fmtL(r.price)}</b>
      <button data-fl-act="cmp-remove" data-id="${r.id}" aria-label="Quitar">${Proto.icon('close', 'xs')}</button></span>`).join('');
    const all = C.scoped();
    const options = PROTO.sortStations(all, 'price', 'asc', S.fuel)
      .filter(st => !S.compare.includes(st.id) && C.priceOf(st) != null)
      .map(st => `<option value="${st.id}">${esc(st.name)} · ${fmtL(C.priceOf(st))}</option>`).join('');

    const heroV = m.rows.length ? (m.worth ? '+' + fmtEur(m.saving) : fmtEur(m.saving)) : '—';
    let heroText = 'Selecciona al menos dos estaciones para comparar.';
    if (m.rows.length && m.base) {
      if (m.worth) heroText = `Descontados ${PROTO.dist(m.winner.detour)} de desvío (ida y vuelta), ${esc(m.winner.st.name)} te sale ${fmtEur(m.saving)} mejor que quedarte con ${esc(m.base.st.name)}.`;
      else if (m.tie) heroText = `${esc(m.winner.st.name)} está a ${PROTO.driveMin(m.winner.km)} min y el desvío se come el ahorro: empate técnico.`;
      else heroText = `Ninguna compensa el desvío: quédate con ${esc(m.base.st.name)}, la más cercana de las seleccionadas.`;
    }

    host.innerHTML = `<div class="fl-panel">
      <header class="fl-panel-head">
        <div><h2>Comparador con coste real</h2><p>El ahorro se calcula con el desvío de ida y vuelta, tu consumo y los litros que vas a echar. Sin trampas.</p></div>
        <button class="btn sm soft" data-fl-act="cmp-auto">${Proto.icon('sparkles', 'xs')} Selección inteligente</button>
      </header>

      <div class="fl-card">
        <div class="fl-between fl-wrap">
          <div class="fl-card-title">${Proto.icon('compare', 'sm')} Estaciones (${m.rows.length}/3)</div>
          <select class="select-native" data-fl-field="cmp-add" aria-label="Añadir estación" style="width:auto;max-width:280px">
            <option value="">+ Añadir estación…</option>${options}
          </select>
        </div>
        <div class="fl-cmp-picks fl-mt2">${picks || '<span class="fl-tiny">Sin selección</span>'}</div>
        <div class="fl-grid3 fl-mt3">
          <label class="fl-col"><span class="fl-tiny">Litros a repostar</span>
            <input class="input" type="number" min="5" max="150" step="5" data-fl-field="litros" value="${S.litros}" style="min-height:38px;padding:0 10px;border:1px solid var(--line);border-radius:10px;background:var(--surface)"></label>
          <label class="fl-col"><span class="fl-tiny">Consumo (L/100 km)</span>
            <input class="input" type="number" min="3" max="20" step="0.1" data-fl-field="cons" value="${S.cons}" style="min-height:38px;padding:0 10px;border:1px solid var(--line);border-radius:10px;background:var(--surface)"></label>
          <label class="fl-col"><span class="fl-tiny">Desvío extra (km)</span>
            <input class="input" type="number" min="0" max="40" step="0.5" data-fl-field="detourExtra" value="${S.detourExtra}" style="min-height:38px;padding:0 10px;border:1px solid var(--line);border-radius:10px;background:var(--surface)"></label>
        </div>
      </div>

      <div class="fl-cmp-hero ${m.tie ? 'tie' : ''}">
        <div class="fl-hero-row">
          <div><div class="k">${m.worth ? 'Merece la pena el desvío' : m.tie ? 'Empate técnico' : 'Veredicto'}</div>
          <div class="v">${heroV}</div></div>
          <div class="k">Ahorro neto vs. la más cercana</div>
        </div>
        <p>${heroText}</p>
      </div>

      ${m.rows.length ? `<div class="fl-grid2">
        <div class="fl-card"><div class="fl-card-title">${Proto.icon('trendDown', 'sm')} Serie de 14 días</div>
          <div class="fl-tiny fl-mb2">Precio final con descuento de marca</div>
          <div class="chartbox" style="position:relative"><canvas data-h="180"></canvas></div>
          <div class="chips wrap fl-mt2">${m.rows.map((r, i) => `<span class="chip soft"><i style="width:8px;height:8px;border-radius:50%;background:${PALETTE[i]}"></i>${esc(r.st.brand)}</span>`).join('')}</div>
        </div>
        <div class="fl-card" style="overflow-x:auto">
          <div class="fl-card-title">${Proto.icon('wallet', 'sm')} Coste del depósito</div>
          <table class="fl-cmp-table fl-mt2">
            <thead><tr><th>Concepto</th>${m.rows.map(r => `<th>${esc(r.st.brand)}</th>`).join('')}</tr></thead>
            <tbody>
              <tr><td>Precio</td>${m.rows.map(r => `<td class="num">${fmtL(r.price)}</td>`).join('')}</tr>
              <tr><td>Distancia</td>${m.rows.map(r => `<td class="num">${PROTO.dist(r.km)}</td>`).join('')}</tr>
              <tr><td>Desvío ida/vuelta</td>${m.rows.map(r => `<td class="num">${r.detour ? PROTO.dist(r.detour * 2) : '—'}</td>`).join('')}</tr>
              <tr><td>Coste del desvío</td>${m.rows.map(r => `<td class="num">${r.detourCost ? fmtEur(r.detourCost) : '—'}</td>`).join('')}</tr>
              <tr><td>Depósito ${S.litros} L</td>${m.rows.map(r => `<td class="num">${fmtEur(r.tankCost)}</td>`).join('')}</tr>
              <tr><td>Ahorro bruto</td>${m.rows.map(r => `<td class="num">${r.gross >= 0 ? '+' : ''}${fmtEur(r.gross)}</td>`).join('')}</tr>
              <tr class="${m.winner ? 'win' : ''}"><td>Neto</td>${m.rows.map(r => `<td class="num"><b>${r.net >= 0 ? '+' : ''}${fmtEur(r.net)}</b></td>`).join('')}</tr>
            </tbody>
          </table>
        </div>
      </div>` : ''}

      <div class="fl-grid2">
        <div class="fl-card"><div class="fl-card-title">${Proto.icon('info', 'sm')} Cómo se calcula</div>
          <ul class="fl-small fl-dim fl-mt2" style="display:grid;gap:6px;list-style:disc;padding-left:18px">
            <li>Ahorro bruto = (precio de la más cercana − precio de la estación) × litros.</li>
            <li>Coste del desvío = km extra × 2 × consumo/100 × precio.</li>
            <li>Neto = ahorro bruto − coste del desvío. Por debajo de 0,50 € se considera empate.</li>
          </ul>
        </div>
        <div class="fl-card"><div class="fl-card-title">${Proto.icon('star', 'sm')} Sugerencias</div>
          <div class="fl-col fl-mt2">
            ${C.recommend(70).slice(0, 3).map(r => `<button class="fl-row fl-row-min" data-fl-act="cmp-add" data-id="${r.st.id}">
              ${brandLogo(r.st)}<span class="fl-grow"><span class="fl-name"><span>${esc(r.st.name)}</span></span>
              <span class="fl-meta">${r.why.join(' · ')}</span></span>
              <span class="fl-side">${priceTag(r.st)}</span></button>`).join('')}
          </div>
        </div>
      </div>
    </div>`;

    const canvas = $('canvas', host);
    if (canvas && m.rows.length) {
      ProtoChart.draw(canvas, {
        series: m.rows.map((r, i) => ({
          label: r.st.brand, color: PALETTE[i],
          data: PROTO.series(r.st, S.fuel, 14).map(d => ({ date: d.date, price: d.price })),
        })),
      });
    }
    Proto.hydrateIcons(host);
  }

  /* === 8. Panel: planificador ========================================== */
  function panelPlan(host) {
    const c = C.planCalc();
    if (!c) { host.innerHTML = '<div class="fl-empty"><b>Sin datos</b>Elige una provincia con estaciones.</div>'; return; }
    const tank = c.tank;
    const days = c.fc;
    const weekHtml = days.map((d, i) => {
      const best = i === c.bestIdx;
      const diff = d.price - c.price;
      return `<div class="fl-day ${best ? 'best' : ''}"><div class="d">${esc(d.day)}</div><div class="p num">${d.price.toFixed(3).replace('.', ',')}</div>
        <div class="t ${diff < 0 ? 'fl-pill ok' : diff > 0 ? 'fl-pill bad' : 'fl-tiny'}">${Math.abs(diff) < 0.0005 ? '=' : (diff < 0 ? '−' : '+') + Math.abs(diff * 100).toFixed(1).replace('.', ',') + '¢'}</div></div>`;
    }).join('');

    const alt = C.recommend(50).slice(0, 3);

    host.innerHTML = `<div class="fl-panel">
      <header class="fl-panel-head">
        <div><h2>Planificador de depósito</h2><p>Tu depósito, tu consumo y la previsión de la próxima semana. Decide hoy con números, no con corazonadas.</p></div>
        <span class="fl-pill ${c.tone === 'ok' ? 'ok' : c.tone === 'warn' ? 'warn' : ''}">${esc(C.fuelName())}</span>
      </header>

      <div class="fl-grid2">
        <div class="fl-card fl-plan-hero">
          <div class="fl-between"><div class="fl-card-title">${Proto.icon('car', 'sm')} Depósito</div><span class="fl-pill ${c.pct < 25 ? 'bad' : c.pct < 50 ? 'warn' : 'ok'}">${c.pct}%</span></div>
          <div class="fl-gauge ${c.pct < 25 ? 'low' : ''} fl-mt3"><span style="width:${c.pct}%"></span></div>
          <div class="fl-between fl-mt2 fl-small"><span>${fmt1(c.level)} L de ${tank} L</span><span class="fl-dim">${c.autonomy.toFixed(0)} km de autonomía</span></div>

          <div class="fl-kpis fl-mt3">
            <div class="fl-kpi"><div class="k">Llenar ahora</div><div class="v num">${fmtEur(c.costNow)}</div><div class="s">${fmt1(c.refill)} L · ${fmtL(c.price)}</div></div>
            <div class="fl-kpi"><div class="k">Mejor día</div><div class="v num">${c.fc[c.bestIdx].price.toFixed(3).replace('.', ',')}</div><div class="s">${esc(c.fc[c.bestIdx].day)} · ahorro ${fmtEur(c.saveWait)}</div></div>
          </div>

          <div class="fl-grid3 fl-mt3">
            <label class="fl-col"><span class="fl-tiny">Capacidad (L)</span>
              <input type="number" min="20" max="120" step="5" data-fl-field="plan.tank" value="${tank}" style="min-height:36px;padding:0 8px;border:1px solid var(--line);border-radius:10px;background:var(--surface)"></label>
            <label class="fl-col"><span class="fl-tiny">Nivel actual (L)</span>
              <input type="range" min="0" max="${tank}" step="1" data-fl-field="plan.level" value="${c.level}">
              <b class="fl-tiny" data-fl-out="plan.level">${fmt1(c.level)} L</b></label>
            <label class="fl-col"><span class="fl-tiny">Consumo (L/100)</span>
              <input type="number" min="3" max="20" step="0.1" data-fl-field="plan.cons" value="${c.cons}" style="min-height:36px;padding:0 8px;border:1px solid var(--line);border-radius:10px;background:var(--surface)"></label>
          </div>
        </div>

        <div class="fl-card">
          <div class="fl-card-title">${Proto.icon('wallet', 'sm')} Presupuesto</div>
          <div class="fl-row fl-mt3" style="gap:10px">
            <input type="range" min="30" max="600" step="10" data-fl-field="plan.budget" value="${S.plan.budget}" style="flex:1">
            <b class="fl-num">${fmtEur(S.plan.budget, 0)}</b>
          </div>
          <div class="fl-tiny">Gastado este mes (simulado): ${fmtEur(S.plan.spent)}</div>
          <div class="fl-bar fl-mt2"><span style="width:${Math.min(100, Math.round(S.plan.spent / Math.max(1, S.plan.budget) * 100))}%;background:${S.plan.spent > S.plan.budget ? 'var(--bad)' : 'var(--brand)'}"></span></div>
          <div class="fl-between fl-mt2 fl-small"><span>Queda ${fmtEur(c.budgetLeft)}</span><span class="fl-dim">${c.tanksLeft.toFixed(1)} depósitos</span></div>
          <div class="fl-divider fl-mt3"></div>
          <div class="fl-kpis fl-mt2">
            <div class="fl-kpi"><div class="k">Coste / km</div><div class="v num">${(c.costPerKm * 100).toFixed(1).replace('.', ',')}</div><div class="s">céntimos</div></div>
            <div class="fl-kpi"><div class="k">2 depósitos/mes</div><div class="v num">${fmtEur(c.monthCost)}</div><div class="s">${fmtEur(c.monthCost * 12)} al año</div></div>
          </div>
        </div>
      </div>

      <div class="fl-card">
        <div class="fl-between fl-wrap"><div class="fl-card-title">${Proto.icon('trendUp', 'sm')} Previsión a 7 días · ${esc(c.st.name)}</div>
          <span class="fl-tiny">Determinista, con la serie de 28 días</span></div>
        <div class="chartbox fl-mt3" style="position:relative"><canvas data-h="190"></canvas></div>
        <div class="fl-week fl-mt3">${weekHtml}</div>
      </div>

      <div class="fl-grid2">
        <div class="fl-card ${c.tone === 'ok' ? 'fl-reco' : c.tone === 'warn' ? 'fl-reco bad' : ''}">
          <div class="fl-card-title">${Proto.icon(c.tone === 'ok' ? 'check' : 'info', 'sm')} Recomendación</div>
          <p class="fl-small fl-mt2">${esc(c.advice)}</p>
          <div class="fl-row fl-mt3" style="gap:8px;flex-wrap:wrap">
            <button class="btn sm primary" data-fl-act="detail" data-id="${c.st.id}">${Proto.icon('info', 'xs')} Ver ficha</button>
            <button class="btn sm soft" data-fl-act="drive" data-id="${c.st.id}">${Proto.icon('navigate', 'xs')} Ir ahora</button>
            <button class="btn sm ghost" data-fl-act="cmp-add" data-id="${c.st.id}">${Proto.icon('compare', 'xs')} Comparar</button>
          </div>
        </div>
        <div class="fl-card">
          <div class="fl-card-title">${Proto.icon('route', 'sm')} Alternativas</div>
          <div class="fl-col fl-mt2">
            ${alt.map(r => `<button class="fl-row fl-row-min" data-fl-act="detail" data-id="${r.st.id}">
              ${brandLogo(r.st)}<span class="fl-grow"><span class="fl-name"><span>${esc(r.st.name)}</span></span>
              <span class="fl-meta">${PROTO.dist(r.km)} · ${r.why.join(' · ')}</span></span>
              <span class="fl-side">${priceTag(r.st)}</span></button>`).join('')}
          </div>
        </div>
      </div>
    </div>`;

    const canvas = $('canvas', host);
    if (canvas) {
      const near = C.nearest(C.scoped());
      const s1 = days.map(d => ({ date: d.label, price: d.price }));
      const fc2 = C.forecastFor(near, S.fuel, 7).map(d => ({ date: d.label, price: d.price }));
      ProtoChart.draw(canvas, {
        series: [
          { label: c.st.brand, color: PALETTE[0], data: s1 },
          ...(near && near.id !== c.st.id ? [{ label: near.brand + ' (cerca)', color: PALETTE[1], data: fc2 }] : []),
        ],
      });
    }
    Proto.hydrateIcons(host);
  }

  /* === 9. Panel: asistente ============================================= */
  function panelAssistant(host) {
    const st = S.assistant;
    const step = st.step;
    const steps = `<div class="fl-steps">${[0, 1, 2].map(i => `<span class="${i <= step ? 'on' : ''}"></span>`).join('')}</div>`;
    let body = '';

    if (step === 0) {
      body = `<div class="fl-card">
        <div class="fl-card-title">1 · ¿Qué vas a repostar?</div>
        <p class="fl-tiny fl-mt1">Elige combustible y cuántos litros. Con eso ya puedo calcular el coste real.</p>
        <div class="fl-choice fl-mt3">
          ${C.fuels().map(f => `<button class="${st.fuel === f.id ? 'on' : ''}" data-fl-act="assist-fuel" data-id="${f.id}">
            <b>${esc(f.name)}</b><small>${Proto.icon(f.icon, 'xs')} ${f.id === 'adblue' ? 'granel' : 'suministro en estación'}</small></button>`).join('')}
        </div>
        <label class="fl-col fl-mt3" style="max-width:180px"><span class="fl-tiny">Litros</span>
          <input type="number" min="5" max="150" step="5" data-fl-field="assistant.litros" value="${st.litros}" style="min-height:38px;padding:0 10px;border:1px solid var(--line);border-radius:10px;background:var(--surface)"></label>
      </div>`;
    } else if (step === 1) {
      body = `<div class="fl-card">
        <div class="fl-card-title">2 · ¿Qué pesa más?</div>
        <p class="fl-tiny fl-mt1">Mueve la balanza: a la izquierda, la estación más cercana; a la derecha, la más barata.</p>
        <div class="fl-row fl-mt4" style="gap:12px">
          <span class="fl-tiny">Cerca</span>
          <input type="range" min="0" max="100" step="5" data-fl-field="assistant.weight" value="${st.weight}" style="flex:1">
          <span class="fl-tiny">Barato</span>
        </div>
        <div class="fl-between fl-tiny"><span>${100 - st.weight}% distancia</span><b>${st.weight}% precio</b></div>
        <div class="fl-choice fl-mt4">
          <button class="${st.need === 'precio' ? 'on' : ''}" data-fl-act="assist-need" data-id="precio"><b>Precio</b><small>El depósito más barato</small></button>
          <button class="${st.need === 'rapidez' ? 'on' : ''}" data-fl-act="assist-need" data-id="rapidez"><b>Rapidez</b><small>Llegar y repostar</small></button>
          <button class="${st.need === 'servicios' ? 'on' : ''}" data-fl-act="assist-need" data-id="servicios"><b>Servicios</b><small>Lavado, café, 24 h</small></button>
        </div>
      </div>`;
    } else {
      const weight = st.need === 'precio' ? 85 : st.need === 'rapidez' ? 20 : 55;
      const recos = C.recommend(weight);
      const top = recos[0];
      const s = C.stats();
      const save = s && top ? (s.avg - top.price) * st.litros : 0;
      body = `<div class="fl-card fl-reco">
          <div class="fl-between fl-wrap"><div class="fl-card-title">${Proto.icon('sparkles', 'sm')} Tu mejor opción</div>
            <span class="fl-pill ok">${esc(C.fuelName(st.fuel))}</span></div>
          <div class="fl-row fl-mt3" style="gap:12px">
            ${top ? brandLogo(top.st, 'lg') : ''}
            <div class="fl-grow"><div style="font-size:var(--t-xl);font-weight:800">${esc(top ? top.st.name : '—')}</div>
              <div class="fl-small fl-dim">${top ? `${esc(top.st.address)} · ${esc(top.st.city)}` : ''}</div>
              <div class="fl-row fl-wrap fl-mt2" style="gap:6px">${top ? top.why.map(w => `<span class="badge ok">${esc(w)}</span>`).join('') : ''}</div></div>
            <div class="fl-tr">${top ? priceTag(top.st, st.fuel, 'p-lg') : ''}<div class="fl-tiny">${top ? `${PROTO.dist(top.km)} · ${PROTO.driveMin(top.km)} min` : ''}</div></div>
          </div>
          <p class="fl-small fl-mt3">${top ? `Llenar ${st.litros} L te cuesta <b>${fmtEur(top.price * st.litros)}</b>${save > 0.5 ? ` y ahorras <b>${fmtEur(save)}</b> frente a la media` : ''}.` : ''}</p>
          <div class="fl-row fl-mt3" style="gap:8px;flex-wrap:wrap">
            ${top ? `<button class="btn sm primary" data-fl-act="detail" data-id="${top.st.id}">Ver ficha</button>
              <button class="btn sm soft" data-fl-act="drive" data-id="${top.st.id}">${Proto.icon('navigate', 'xs')} Conducir</button>
              <button class="btn sm ghost" data-fl-act="cmp-add" data-id="${top.st.id}">${Proto.icon('compare', 'xs')} Comparar</button>` : ''}
          </div>
        </div>
        <div class="fl-card fl-mt3">
          <div class="fl-card-title">${Proto.icon('list', 'sm')} Las 3 mejores para ti</div>
          <div class="fl-col fl-mt2">
            ${recos.slice(0, 3).map((r, i) => `<button class="fl-row fl-row-min" data-fl-act="detail" data-id="${r.st.id}">
              <span class="badge ${i === 0 ? 'ok' : ''}" style="width:26px;height:26px;display:grid;place-items:center;border-radius:50%">${i + 1}</span>
              ${brandLogo(r.st)}
              <span class="fl-grow"><span class="fl-name"><span>${esc(r.st.name)}</span></span>
                <span class="fl-meta">${r.why.join(' · ')}</span>
                <span class="fl-bar fl-mt1" style="max-width:160px"><span style="width:${Math.round(r.score * 100)}%"></span></span></span>
              <span class="fl-side"><b>${fmtL(r.price)}</b><small>${PROTO.dist(r.km)}</small></span></button>`).join('')}
          </div>
        </div>
        <div class="fl-card fl-mt3">
          <div class="fl-card-title">${Proto.icon('info', 'sm')} Por qué esta recomendación</div>
          <p class="fl-small fl-dim fl-mt1">He puntuado ${C.scoped().length} estaciones de ${esc(S.province || 'todas las provincias')} mezclando precio (${st.weight}%), distancia (${100 - st.weight}%), valoración y descuentos. No hay ningún modelo de IA de por medio: son tus datos y una fórmula que puedes auditar.</p>
        </div>`;
    }

    host.innerHTML = `<div class="fl-panel">
      <header class="fl-panel-head">
        <div><h2>Asistente de repostaje</h2><p>Tres preguntas y una recomendación explicada. Luego tú decides.</p></div>
        <span class="fl-pill">${step + 1} / 3</span>
      </header>
      ${steps}
      ${body}
      <div class="fl-between">
        <button class="btn sm ghost" data-fl-act="assist-back" ${step === 0 ? 'disabled' : ''}>← Atrás</button>
        ${step < 2
          ? `<button class="btn sm primary" data-fl-act="assist-next">${step === 0 ? 'Continuar' : 'Ver recomendación'} →</button>`
          : `<button class="btn sm soft" data-fl-act="assist-reset">${Proto.icon('refresh', 'xs')} Empezar de nuevo</button>`}
      </div>
    </div>`;
    Proto.hydrateIcons(host);
  }

  /* === 10. Panel: insights ============================================ */
  function renderInsights(host) {
    if (!host) return;
    const items = C.insights();
    host.innerHTML = `<div class="fl-insights">
      <div class="fl-between fl-mb2"><span class="fl-card-title">${Proto.icon('sparkles', 'sm')} Insights de la zona</span>
        <span class="fl-pill">${esc(C.fuelName())}</span></div>
      ${items.map(it => `<button class="fl-insight ${it.tone || ''}" data-fl-act="insight" data-act="${it.act || ''}" data-id="${it.id || ''}">
        <span class="i">${Proto.icon(it.icon, 'sm')}</span>
        <span class="fl-grow"><span class="t">${esc(it.title)}</span><span class="x">${esc(it.text)}</span>
          <span class="go">${it.act === 'comparar' ? 'Abrir comparador' : it.act === 'detalle' ? 'Ver ficha' : 'Explorar'} ${Proto.icon('chevronRight', 'xs')}</span></span>
      </button>`).join('')}
    </div>`;
    Proto.hydrateIcons(host);
  }

  function panelInsights(host) {
    host.innerHTML = `<div class="fl-panel">
      <header class="fl-panel-head"><div><h2>Insights</h2><p>Lo que dicen los datos sin que tengas que buscarlo.</p></div></header>
      <div data-ins></div>
      <div class="fl-card"><div class="fl-card-title">${Proto.icon('sparkles', 'sm')} ¿Quieres una recomendación?</div>
        <p class="fl-small fl-dim fl-mt2">El asistente hace tres preguntas y te dice dónde repostar hoy.</p>
        <button class="btn sm primary fl-mt3" data-fl-act="assistant">${Proto.icon('sparkles', 'xs')} Abrir asistente</button></div>
    </div>`;
    renderInsights($('[data-ins]', host));
  }

  /* === 11. Panel: chat IA ============================================= */
  function panelIa(host) {
    ProtoFeat.iaPanel(host, {
      list: () => C.list(),
      proxyOk: true,
      hidden: S.iaHidden,
      onOpenStation: (id) => openDetail(id),
    });
  }

  /* === 12. Panel: configuración ======================================= */
  function panelConfig(host) {
    const keys = (() => { try { return Object.keys(localStorage).filter(k => k.startsWith('gasolineras_finalistas')); } catch (e) { return []; } })();
    host.innerHTML = `<div class="fl-panel">
      <header class="fl-panel-head"><div><h2>Configuración</h2><p>Las 8 tarjetas de la app, más el tema y la persistencia del prototipo.</p></div>
        <span class="fl-pill">v1 · prototipo</span></header>

      <div class="fl-grid2">
        <div class="fl-card">
          <div class="fl-card-title">${Proto.icon('palette', 'sm')} Apariencia</div>
          <div class="fl-row fl-mt3" style="gap:8px">
            <button class="chip" data-fl-act="theme-set" data-id="light">${Proto.icon('sun', 'xs')} Claro</button>
            <button class="chip" data-fl-act="theme-set" data-id="dark">${Proto.icon('moon', 'xs')} Oscuro</button>
          </div>
          <p class="fl-tiny fl-mt2">El tema se guarda y se aplica al instante.</p>
        </div>
        <div class="fl-card">
          <div class="fl-card-title">${Proto.icon('lock', 'sm')} Persistencia</div>
          <p class="fl-small fl-dim fl-mt1">${keys.length ? keys.join(', ') : 'Sin claves guardadas'} · filtros, comparador, plan y asistente.</p>
          <div class="fl-row fl-mt3" style="gap:8px;flex-wrap:wrap">
            <button class="btn sm soft" data-fl-act="export">${Proto.icon('share', 'xs')} Copiar estado</button>
            <button class="btn sm danger" data-fl-act="reset-all">${Proto.icon('refresh', 'xs')} Reiniciar</button>
          </div>
        </div>
      </div>

      <div data-cfg-host></div>
    </div>`;
    ProtoFeat.configPanel($('[data-cfg-host]', host), {
      pageSize: S.pageSize,
      getHiddenIa: () => S.iaHidden,
      onIaTabs: (ids) => { S.iaHidden = ids; C.save(); },
      onPageSize: (n) => { S.pageSize = n; ui.pager = 0; C.save(); repaint(); },
      onDiscounts: () => { syncMaps(); repaint({ keepDetail: true, skipPanel: true }); },
      onTestPush: () => Proto.toast('Notificación de prueba encolada (mock)', { iconName: 'bell' }),
    });
    Proto.hydrateIcons(host);
  }

  /* === 13. Despacho de paneles ======================================== */
  const PANELS = {
    comparar: { title: 'Comparador', icon: 'compare', render: panelCompare, scroll: true },
    plan: { title: 'Planificador', icon: 'wallet', render: panelPlan, scroll: true },
    asistente: { title: 'Asistente', icon: 'sparkles', render: panelAssistant, scroll: true },
    insights: { title: 'Insights', icon: 'sparkles', render: panelInsights, scroll: true },
    ia: { title: 'Chat IA', icon: 'send', render: panelIa, scroll: false },
    config: { title: 'Configuración', icon: 'gear', render: panelConfig, scroll: true },
  };

  function overlayShell(title, iconName, { scroll = true, className = '' } = {}) {
    const el = Proto.el(`<div class="pf-overlay on ${className}" role="dialog" aria-label="${esc(title)}">
      <header class="topbar">
        <span class="topbar-title"><span class="ico" data-ico="${iconName}" style="color:var(--brand)"></span>${esc(title)}</span>
        <div class="spacer"></div>
        <button class="iconbtn" data-fl-act="close-overlay" title="Cerrar">${Proto.icon('close')}</button>
      </header>
      <div class="pf-overlay-body"></div>
    </div>`);
    document.body.appendChild(el);
    Proto.hydrateIcons(el);
    let host;
    if (scroll) {
      host = document.createElement('div');
      host.className = 'pf-scroll';
      host.style.paddingBottom = '24px';
      el.querySelector('.pf-overlay-body').appendChild(host);
    } else {
      host = el.querySelector('.pf-overlay-body');
    }
    const close = () => {
      el.remove();
      if (ui.lastOverlay === el) ui.lastOverlay = null;
      document.removeEventListener('keydown', onKey);
      if (ui.layout === 'thumb') {
        S.lastTab = 'mapa'; C.save();
        setThumbNav('mapa');
      }
    };
    el._flClose = close;
    const onKey = (e) => { if (e.key === 'Escape') close(); };
    document.addEventListener('keydown', onKey);
    el.addEventListener('click', (e) => { if (e.target.closest('[data-fl-act="close-overlay"]')) close(); });
    ui.lastOverlay = el;
    return { el, host, close };
  }

  function openPanelOverlay(kind) {
    const p = PANELS[kind];
    if (!p) return;
    closeOverlays();
    const ov = overlayShell(p.title, p.icon, { scroll: p.scroll });
    ov.el.dataset.flPanel = kind;
    p.render(ov.host);
    return ov;
  }

  function closeOverlays() {
    $$('.pf-overlay.on').forEach(el => { if (el._flClose) el._flClose(); else el.remove(); });
    ui.lastOverlay = null;
  }

  /* === 14. Modo conducción ============================================ */
  function openDrive(startId) {
    const base = startId || ui.selId || (C.best(C.list()) || {}).id;
    const recos = C.recommend(S.assistant.need === 'rapidez' ? 20 : 55).slice(0, 4);
    let idx = Math.max(0, recos.findIndex(r => r.st.id === base));
    if (idx < 0) idx = 0;

    const el = Proto.el(`<div class="fl-drive" role="dialog" aria-label="Modo conducción"></div>`);
    document.body.appendChild(el);

    function paint() {
      const r = recos[idx];
      if (!r) { el.innerHTML = '<div class="fl-empty"><b>Sin estaciones</b></div>'; return; }
      const price = r.price;
      el.innerHTML = `<div class="fl-drive-top">
          <span class="fl-pill" style="background:rgba(255,255,255,.12);color:#fff">${Proto.icon('navigate', 'xs')} Modo conducción</span>
          <span class="fl-grow"></span>
          <button class="fl-iconbtn" data-fl-act="drive-close" aria-label="Salir">${Proto.icon('close', 'sm')}</button>
        </div>
        <div class="fl-drive-main">
          <div class="k">${idx === 0 ? 'Mejor opción para ti' : 'Alternativa ' + idx}</div>
          <div class="n">${esc(r.st.name)}</div>
          <div class="p num">${price.toFixed(3).replace('.', ',')}<small>€/L</small></div>
          <div class="d">
            <span>${PROTO.dist(r.km)}</span>
            <span>${PROTO.driveMin(r.km)} min</span>
            <span>${esc(r.st.city)}</span>
            <span>${esc(C.fuelName())}</span>
          </div>
        </div>
        <div class="fl-drive-actions">
          <button class="next" data-fl-act="drive-next">${Proto.icon('refresh', 'sm')} Siguiente</button>
          <button class="go" data-fl-act="drive-arrive">${Proto.icon('check', 'sm')} He llegado</button>
        </div>
        <button class="fl-drive-ghost" data-fl-act="drive-close">Salir del modo conducción</button>`;
      Proto.hydrateIcons(el);
    }
    paint();

    el.addEventListener('click', (e) => {
      const a = e.target.closest('[data-fl-act]');
      if (!a) return;
      const act = a.dataset.flAct;
      if (act === 'drive-close') { el.remove(); return; }
      if (act === 'drive-next') { idx = (idx + 1) % recos.length; paint(); return; }
      if (act === 'drive-arrive') {
        const id = recos[idx].st.id;
        el.remove();
        openDetail(id);
        Proto.toast('Has llegado: ficha de ' + recos[idx].st.name, { iconName: 'check' });
      }
    });
  }

  /* === 15. Paleta de comandos ========================================= */
  function commands() {
    const base = [
      { id: 'mapa', label: 'Ir al mapa', icon: 'map', keys: 'mapa explorar' },
      { id: 'lista', label: 'Ver lista de estaciones', icon: 'list', keys: 'lista tabla estaciones' },
      { id: 'comparar', label: 'Abrir comparador', icon: 'compare', keys: 'comparar ahorro desvio' },
      { id: 'plan', label: 'Abrir planificador', icon: 'wallet', keys: 'plan deposito presupuesto prevision' },
      { id: 'asistente', label: 'Abrir asistente', icon: 'sparkles', keys: 'asistente recomendacion' },
      { id: 'insights', label: 'Abrir insights', icon: 'grid', keys: 'insights datos zona analisis' },
      { id: 'ia', label: 'Abrir chat IA', icon: 'send', keys: 'ia chat preguntar modelo' },
      { id: 'config', label: 'Abrir configuración', icon: 'gear', keys: 'config ajustes descuentos cache' },
      { id: 'favoritos', label: 'Ver solo favoritos', icon: 'star', keys: 'favoritos guardadas' },
      { id: 'drive', label: 'Modo conducción', icon: 'navigate', keys: 'conducir ruta navegar' },
      { id: 'theme', label: 'Cambiar tema claro/oscuro', icon: 'moon', keys: 'tema oscuro claro' },
      { id: 'reset', label: 'Limpiar filtros', icon: 'refresh', keys: 'limpiar reset filtros' },
      { id: 'export', label: 'Copiar resumen de precios', icon: 'share', keys: 'copiar exportar resumen' },
    ];
    return base;
  }

  function openPalette() {
    if (ui.paletteEl) { ui.paletteEl.remove(); ui.paletteEl = null; }
    const el = Proto.el(`<div class="fl-cmdk on" role="dialog" aria-label="Paleta de comandos">
      <div class="fl-cmdk-box">
        <input type="search" placeholder="Escribe un comando o una pantalla…" aria-label="Buscar comando" autocomplete="off">
        <div class="fl-cmdk-list"></div>
      </div>
    </div>`);
    document.body.appendChild(el);
    ui.paletteEl = el;
    const input = $('input', el);
    const list = $('.fl-cmdk-list', el);
    let rows = commands(), idx = 0;

    function paint() {
      list.innerHTML = rows.length ? rows.map((c, i) => `<button class="fl-cmdk-item ${i === idx ? 'on' : ''}" data-cmd="${c.id}">
        ${Proto.icon(c.icon, 'sm')}<span>${esc(c.label)}</span><small>${c.keys.split(' ')[0]}</small></button>`).join('')
        : '<div class="fl-cmdk-empty">Sin comandos para esa búsqueda.</div>';
      Proto.hydrateIcons(list);
      const on = $('.fl-cmdk-item.on', list);
      if (on) on.scrollIntoView({ block: 'nearest' });
    }
    function run(id) {
      const c = commands().find(x => x.id === id);
      el.remove(); ui.paletteEl = null;
      document.removeEventListener('keydown', onKey);
      if (!c) return;
      if (id === 'theme') { Proto.theme.toggle(); return; }
      if (id === 'reset') { resetFilters(); return; }
      if (id === 'export') { exportState(); return; }
      if (id === 'favoritos') { setFilter({ favoritesOnly: true }); go('mapa'); return; }
      if (id === 'drive') { openDrive(); return; }
      go(id);
    }
    function onKey(e) {
      if (e.key === 'Escape') { el.remove(); ui.paletteEl = null; document.removeEventListener('keydown', onKey); }
      if (e.key === 'ArrowDown') { e.preventDefault(); idx = Math.min(rows.length - 1, idx + 1); paint(); }
      if (e.key === 'ArrowUp') { e.preventDefault(); idx = Math.max(0, idx - 1); paint(); }
      if (e.key === 'Enter') { e.preventDefault(); if (rows[idx]) run(rows[idx].id); }
    }
    input.addEventListener('input', () => {
      const q = normalize(input.value);
      rows = commands().filter(c => normalize(c.label + ' ' + c.keys).includes(q));
      idx = 0; paint();
    });
    el.addEventListener('click', (e) => {
      const b = e.target.closest('[data-cmd]');
      if (b) { run(b.dataset.cmd); return; }
      if (e.target === el) { el.remove(); ui.paletteEl = null; document.removeEventListener('keydown', onKey); }
    });
    document.addEventListener('keydown', onKey);
    paint();
    setTimeout(() => input.focus(), 30);
  }

  function normalize(s) {
    return String(s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  }

  /* === 16. Export / reset ============================================= */
  function exportState() {
    const s = C.stats();
    const lines = [
      `Precios · ${C.fuelName()} · ${S.province || 'todas las provincias'}`,
      `${C.list().length} estaciones · mín ${fmtL(s.min)} · media ${fmtL(s.avg)} · máx ${fmtL(s.max)}`,
      '',
      ...C.list().slice(0, 10).map((st, i) => `${i + 1}. ${st.name} — ${fmtL(C.priceOf(st))} — ${PROTO.dist(PROTO.kmFromUser(st))}`),
    ].join('\n');
    if (navigator.clipboard?.writeText) navigator.clipboard.writeText(lines).then(
      () => Proto.toast('Resumen copiado al portapapeles', { iconName: 'share' }),
      () => Proto.toast('No se pudo copiar', { iconName: 'alert' }),
    );
    else Proto.toast('Portapapeles no disponible', { iconName: 'alert' });
  }

  function resetFilters() {
    const patch = { province: 'Madrid', locality: '', brands: [], maxKm: 0, q: '', favoritesOnly: false, cheapOnly: false, sort: 'price', dir: 'asc' };
    S.brands = [];
    setFilter(patch);
    const search = $('[data-fl-search]');
    if (search) search.value = '';
    Proto.toast('Filtros restablecidos', { iconName: 'refresh' });
  }

  /* === 17. Repintado ================================================== */
  function repaint({ keepDetail = false, skipPanel = false } = {}) {
    if (ui.layout === 'thumb') repaintThumb();
    else if (ui.layout === 'tower') repaintTower({ skipPanel });
    else repaintUnified();
    if (!keepDetail) { /* la ficha abierta se queda como está */ }
  }

  function repaintThumb() {
    fillFilterOptions();
    syncFilterInputs();
    const body = $('#flSheetBody');
    if (body) {
      const s = C.stats();
      body.innerHTML = `<div class="fl-sheet-summary">
          <span class="fl-total">${s ? s.count : 0} estaciones <small>· ${fmtL(s ? s.avg : null)} media</small></span>
          <span class="fl-grow"></span>
          <button class="chip" data-fl-act="insights">${Proto.icon('sparkles', 'xs')} Insights</button>
        </div>
        <div class="fl-sheet-filters">
          <button class="chip" data-fl-act="favorites-only">${Proto.icon('star', 'xs')} Favoritos</button>
          <button class="chip" data-fl-act="cheap-only">${Proto.icon('percent', 'xs')} Descuento</button>
          <span class="fl-grow"></span>
          <select class="select-native" data-fl-field="sort" aria-label="Orden" style="width:auto;min-height:30px;border-radius:99px;font-size:var(--t-2xs)"></select>
        </div>
        <div class="fl-sheet-tools">
          <button class="chip" data-fl-act="comparar">${Proto.icon('compare', 'xs')} Comparar</button>
          <button class="chip" data-fl-act="plan">${Proto.icon('wallet', 'xs')} Plan</button>
          <button class="chip" data-fl-act="assistente">${Proto.icon('sparkles', 'xs')} Asistente</button>
          <button class="chip" data-fl-act="drive">${Proto.icon('navigate', 'xs')} Conducir</button>
        </div>
        <div data-list></div>`;
      fillFilterOptions(body);
      syncFilterInputs(body);
      renderList($('[data-list]', body));
      Proto.hydrateIcons(body);
    }
    const sub = $('#flThumbSub');
    if (sub) sub.textContent = `${S.province || 'Todas'} · ${C.list().length} estaciones`;
    syncMaps();
  }

  function repaintTower({ skipPanel = false } = {}) {
    fillFilterOptions();
    syncFilterInputs();
    const kpi = $('#flRailKpis');
    if (kpi) { kpi.innerHTML = kpisHtml(); Proto.hydrateIcons(kpi); }
    const sub = $('#flRailSub');
    if (sub) sub.textContent = `${C.list().length} estaciones · ${fmtL((C.stats() || {}).min)}`;
    if (!skipPanel) {
      if (ui.towerPanel === 'explorar') renderSplit($('#flCenterBody'));
      else showTowerPanel(ui.towerPanel);
    }
    renderInspector();
    syncMaps();
  }

  function repaintUnified() {
    fillFilterOptions();
    syncFilterInputs();
    const tab = S.lastTab || 'mapa';
    if (tab === 'tabla') tableRows($('#flTableUni'));
    else if (tab === 'ambos') renderList($('#flListBoth'));
    const sub = $('#flSub');
    if (sub) sub.textContent = `${S.province || 'Todas'} · ${C.list().length} estaciones · ${C.fuelName()}`;
    syncMaps();
  }

  /* === 18. Eventos globales =========================================== */
  function valueOf(el) {
    if (el.type === 'checkbox') return el.checked;
    if (el.type === 'number' || el.type === 'range') return Number(el.value);
    return el.value;
  }

  document.addEventListener('change', (e) => {
    const brand = e.target.closest('[data-fl-brand]');
    if (brand) {
      const b = brand.dataset.flBrand;
      const i = S.brands.indexOf(b);
      if (i >= 0) S.brands.splice(i, 1); else S.brands.push(b);
      C.save(); ui.pager = 0; fillFilterOptions(); repaint(); return;
    }
    const el = e.target.closest('[data-fl-field]');
    if (!el) return;
    const key = el.dataset.flField;
    const v = valueOf(el);

    if (key === 'mapStyle') { S.mapStyle = v; C.save(); syncMaps(); return; }

    if (key === 'cmp-add') {
      if (v) { C.toggleCompare(v); C.save(); }
      repaintPanel('comparar');
      return;
    }
    if (key === 'province') { S.province = v; S.locality = ''; S.brands = []; C.save(); ui.pager = 0; fillFilterOptions(); repaint(); return; }
    if (key === 'locality' || key === 'fuel' || key === 'sort' || key === 'pageSize' || key === 'maxKm' || key === 'litros' || key === 'cons' || key === 'detourExtra') {
      S[key] = v;
      if (key === 'fuel') S.assistant.fuel = v;
      if (key === 'pageSize' || key === 'sort') ui.pager = 0;
      C.save();
      if (key === 'litros' || key === 'cons' || key === 'detourExtra') repaintPanel('comparar');
      else repaint();
      return;
    }
    if (key.startsWith('plan.')) {
      C.setPlan({ [key.slice(5)]: v });
      if (ui.layout === 'tower' && ui.towerPanel === 'plan') showTowerPanel('plan');
      else repaintPanel('plan');
      return;
    }
    if (key.startsWith('assistant.')) {
      C.setAssistant({ [key.slice(10)]: v });
      if (key === 'assistant.fuel') { S.fuel = v; C.save(); }
      repaintPanel('asistente');
      return;
    }
  });

  document.addEventListener('input', (e) => {
    const out = e.target.closest('input[type="range"][data-fl-field]');
    if (out) {
      const key = out.dataset.flField;
      const label = $(`[data-fl-out="${key}"]`);
      if (label) label.textContent = key === 'plan.level' ? fmt1(out.value) + ' L' : out.value ? out.value + ' km' : 'Sin límite';
    }
    const search = e.target.closest('[data-fl-search]');
    if (search) {
      S.q = search.value.trim();
      C.save(); ui.pager = 0;
      repaintListOnly();
    }
  });

  function repaintListOnly() {
    if (ui.layout === 'thumb') {
      const host = $('#flSheetBody [data-list]');
      if (host) renderList(host);
    } else if (ui.layout === 'tower') {
      const host = $('#flCenterBody [data-list]');
      if (host) renderList(host);
    } else {
      if (S.lastTab === 'tabla') tableRows($('#flTableUni'));
      else if (S.lastTab === 'ambos') renderList($('#flListBoth'));
    }
    syncMaps();
  }

  function repaintPanel(kind) {
    if (ui.layout === 'tower') {
      if (ui.towerPanel === kind) showTowerPanel(kind);
      return;
    }
    const ov = $$('.pf-overlay.on').find(el => el.dataset.flPanel === kind);
    if (ov) {
      const host = $('.pf-scroll', ov) || $('.pf-overlay-body', ov);
      host.innerHTML = '';
      PANELS[kind].render(host);
    }
  }

  /* === 19. Clics ====================================================== */
  function go(kind) {
    if (ui.layout === 'thumb') {
      if (kind === 'mapa' || kind === 'lista') {
        S.lastTab = kind; C.save();
        $$('.fl-thumb-nav [data-tab]').forEach(b => b.classList.toggle('on', b.dataset.tab === kind));
        if (kind === 'lista') ui.sheetCtl.open('full');
        else ui.sheetCtl.open('half');
        return;
      }
      openPanelOverlay(kind);
      return;
    }
    if (ui.layout === 'tower') { showTowerPanel(kind); return; }
    if (['mapa', 'tabla', 'ambos'].includes(kind)) {
      S.lastTab = kind; C.save();
      $$('.fl-bottomnav [data-tab]').forEach(b => b.classList.toggle('on', b.dataset.tab === kind));
      showUnifiedPane(kind);
      return;
    }
    openPanelOverlay(kind);
  }

  function setThumbNav(kind) {
    $$('.fl-thumb-nav [data-tab]').forEach(b => b.classList.toggle('on', b.dataset.tab === kind));
  }

  document.addEventListener('click', (e) => {
    const brandChip = e.target.closest('[data-fl-brand]');
    if (brandChip && !brandChip.disabled) {
      const b = brandChip.dataset.flBrand;
      const i = S.brands.indexOf(b);
      if (i >= 0) S.brands.splice(i, 1); else S.brands.push(b);
      C.save(); ui.pager = 0; fillFilterOptions(); repaint();
      return;
    }
    const btn = e.target.closest('[data-fl-act]');
    if (!btn) return;
    const act = btn.dataset.flAct;
    const id = btn.dataset.id;

    switch (act) {
      case 'detail': openDetail(id); return;
      case 'compare': C.toggleCompare(id); Proto.toast(S.compare.includes(id) ? 'Añadida al comparador' : 'Quitada del comparador', { iconName: 'compare' }); repaint({ keepDetail: true }); return;
      case 'cmp-add': C.toggleCompare(id); repaintPanel('comparar'); Proto.toast('Añadida al comparador', { iconName: 'compare' }); return;
      case 'cmp-remove': S.compare = S.compare.filter(x => x !== id); C.save(); repaintPanel('comparar'); return;
      case 'cmp-auto': {
        S.compare = [];
        const seeds = [C.nearest(C.scoped()), C.best(C.scoped()), PROTO.favorites()[0]].filter(Boolean);
        seeds.forEach(s => { if (!S.compare.includes(s.id) && S.compare.length < 3) S.compare.push(s.id); });
        C.save(); repaintPanel('comparar'); Proto.toast('Selección inteligente aplicada', { iconName: 'sparkles' }); return;
      }
      case 'fav': { const st = C.toggleFav(id); if (!st) return; Proto.toast(st.fav ? 'Añadida a favoritos' : 'Quitada de favoritos', { iconName: st.fav ? 'starFill' : 'star' }); repaint({ keepDetail: true }); return; }
      case 'page': {
        const pages = S.pageSize ? Math.max(1, Math.ceil(C.list().length / S.pageSize)) : 1;
        ui.pager = btn.dataset.page === 'next' ? Math.min(pages - 1, ui.pager + 1) : Math.max(0, ui.pager - 1);
        repaint(); return;
      }
      case 'sort': {
        const key = btn.dataset.key;
        if (S.sort === key) S.dir = S.dir === 'asc' ? 'desc' : 'asc'; else { S.sort = key; S.dir = 'asc'; }
        C.save(); ui.pager = 0; repaint(); return;
      }
      case 'favorites-only': S.favoritesOnly = !S.favoritesOnly; C.save(); ui.pager = 0; repaint(); return;
      case 'cheap-only': S.cheapOnly = !S.cheapOnly; C.save(); ui.pager = 0; repaint(); return;
      case 'brands-toggle': { const p = $('[data-brandpop]', btn.parentElement); if (p) p.hidden = !p.hidden; return; }
      case 'brands-clear': S.brands = []; C.save(); fillFilterOptions(); repaint(); return;
      case 'search-toggle': { const row = $('.fl-searchrow'); if (!row) return; row.hidden = !row.hidden; if (!row.hidden) $('input', row).focus(); return; }
      case 'reset': resetFilters(); return;
      case 'close-overlay': closeOverlays(); return;
      case 'close-detail': ui.detailSheetCtl.close(); return;
      case 'insight': {
        const target = btn.dataset.act;
        if (target === 'detalle') { openDetail(btn.dataset.id); return; }
        if (target === 'comparar') { go('comparar'); return; }
        if (target === 'favoritos') { setFilter({ favoritesOnly: true }); return; }
        if (ui.layout === 'tower') showTowerPanel('explorar'); else go(ui.layout === 'unified' ? 'mapa' : 'mapa');
        return;
      }
      case 'assist-fuel': C.setAssistant({ fuel: id }); S.fuel = id; C.save(); fillFilterOptions(); repaintPanel('asistente'); return;
      case 'assist-need': {
        const weight = id === 'precio' ? 85 : id === 'rapidez' ? 20 : 55;
        C.setAssistant({ need: id, weight }); repaintPanel('asistente'); return;
      }
      case 'assist-next': C.setAssistant({ step: Math.min(2, S.assistant.step + 1) }); repaintPanel('asistente'); return;
      case 'assist-back': C.setAssistant({ step: Math.max(0, S.assistant.step - 1) }); repaintPanel('asistente'); return;
      case 'assist-reset': C.setAssistant({ step: 0, done: false }); repaintPanel('asistente'); return;
      case 'theme-set': Proto.theme.set(id); return;
      case 'theme': Proto.theme.toggle(); return;
      case 'export': exportState(); return;
      case 'reset-all': C.reset(); ui.pager = 0; ui.selId = null; fillFilterOptions(); repaint(); Proto.toast('Preferencias reiniciadas', { iconName: 'refresh' }); return;
      case 'insp-close': ui.selId = null; ui.inspTab = 'insights'; renderInspector(); return;
      case 'insp': ui.inspTab = btn.dataset.val; renderInspector(); return;
      case 'cmdk': openPalette(); return;
      case 'drive': openDrive(id); return;
      case 'drive-close': return;
      default: break;
    }

    if (['mapa', 'lista', 'tabla', 'ambos', 'comparar', 'plan', 'asistente', 'insights', 'ia', 'config', 'explorar'].includes(act)) {
      go(act); return;
    }
  });

  document.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
      e.preventDefault(); openPalette();
    }
  });

  /* === 20. Shells ===================================================== */
  function navHtml(tabs, cls = '') {
    return `<nav class="bottomnav ${cls}">${tabs.map(t => `<button class="nav-btn ${t.id === S.lastTab ? 'on' : ''}" data-fl-act="${t.id}" data-tab="${t.id}">
      ${Proto.icon(t.icon)}<span>${t.label}</span></button>`).join('')}</nav>`;
  }

  function buildThumb(root) {
    root.innerHTML = `<div class="fl-app fl-thumb">
      <div class="fl-thumb-map" id="flMap"></div>
      <select class="select-native fl-mapstyle-map" data-fl-field="mapStyle" aria-label="Estilo de mapa" title="Estilo de mapa"></select>
      <div class="fl-thumb-top">
        <label class="fl-search">${Proto.icon('search', 'sm')}
          <input type="search" data-fl-search placeholder="Busca marca, calle o localidad…" aria-label="Buscar" autocomplete="off">
          <button class="fl-iconbtn" data-fl-act="cmdk" title="Comandos" style="width:30px;height:30px">${Proto.icon('grid', 'sm')}</button>
        </label>
        <div class="fl-chipbar">
          <a class="chip" href="index.html" title="Volver a finalistas" style="text-decoration:none">←</a>
          <select class="select-native" data-fl-field="province" aria-label="Provincia" style="min-height:32px;max-width:150px;border-radius:99px;background:var(--glass)"></select>
          <select class="select-native" data-fl-field="fuel" aria-label="Combustible" style="min-height:32px;max-width:170px;border-radius:99px;background:var(--glass)"></select>
        </div>
      </div>

      <button class="fl-fab-assist" data-fl-act="asistente" title="Asistente de repostaje" aria-label="Asistente">${Proto.icon('sparkles')}</button>

      <section class="sheet" id="flSheet" aria-label="Estaciones">
        <div class="sheet-head"><span class="sheet-grab"></span><h2>Estaciones cerca</h2>
          <span class="fl-tiny" id="flThumbSub"></span><div class="spacer"></div>
          <button class="iconbtn" data-fl-act="insights" title="Insights">${Proto.icon('sparkles', 'sm')}</button>
        </div>
        <div class="sheet-body" id="flSheetBody"></div>
      </section>

      ${navHtml(C.TABS.thumb, 'fl-thumb-nav')}
    </div>`;
    ui.sheetCtl = Proto.sheet($('#flSheet'), { scrim: false, snaps: ['peek', 'half', 'full'], start: 'half', peek: 186, half: 0.46, full: 0.84 });
    ui.sheetCtl.open('half');
    requestAnimationFrame(() => ensureMap('thumb', $('#flMap')));
  }

  function railFiltersHtml() {
    return `<div class="fl-rail-filters">
      <select class="select-native" data-fl-field="province" aria-label="Provincia"></select>
      <select class="select-native" data-fl-field="locality" aria-label="Localidad"></select>
      <select class="select-native" data-fl-field="fuel" aria-label="Combustible"></select>
      <select class="select-native" data-fl-field="sort" aria-label="Orden"></select>
      <select class="select-native" data-fl-field="mapStyle" aria-label="Estilo de mapa"></select>
      <div class="fl-row"><span class="fl-tiny">Máx.</span><input type="range" data-fl-field="maxKm" min="0" max="60" step="1" value="0" style="flex:1"><b class="fl-tiny" data-fl-out="maxKm">Sin límite</b></div>
      <div class="fl-row" style="gap:6px"><button class="chip" data-fl-act="favorites-only">${Proto.icon('star', 'xs')} Favoritos</button>
        <button class="chip" data-fl-act="cheap-only">${Proto.icon('percent', 'xs')} Descuento</button></div>
      <details><summary class="fl-tiny" style="cursor:pointer;padding:4px 0">Marcas</summary><div class="chips wrap fl-mt1" data-brand-host></div></details>
    </div>`;
  }

  function buildTower(root) {
    root.innerHTML = `<div class="fl-tower">
      <aside class="fl-rail">
        <div class="fl-rail-brand"><span class="logo">${Proto.icon('droplet', 'sm')}</span>
          <span><b>Torre de control</b><small id="flRailSub">—</small></span></div>
        <nav class="fl-rail-nav">
          ${C.TABS.tower.map(t => `<button data-fl-act="${t.id}" data-tab="${t.id}">${Proto.icon(t.icon, 'sm')} ${t.label}${t.id === 'comparar' ? '<span class="badge">' + S.compare.length + '</span>' : ''}</button>`).join('')}
        </nav>
        <div class="fl-rail-sec">Filtros</div>
        ${railFiltersHtml()}
        <div class="fl-rail-sec">Resumen</div>
        <div id="flRailKpis"></div>
        <div class="fl-rail-foot">
          <button class="btn sm soft" data-fl-act="cmdk">${Proto.icon('grid', 'xs')} Comandos <span class="fl-tiny">Ctrl K</span></button>
          <button class="btn sm ghost" data-fl-act="theme">${Proto.icon('moon', 'xs')} Cambiar tema</button>
          <a class="btn sm ghost" href="index.html" style="text-decoration:none">← Finalistas</a>
        </div>
      </aside>

      <section class="fl-center">
        <header class="fl-center-top">
          <label class="fl-search">${Proto.icon('search', 'sm')}<input type="search" data-fl-search placeholder="Buscar estación, calle o localidad…" aria-label="Buscar"></label>
          <button class="fl-iconbtn" data-fl-act="drive" title="Modo conducción">${Proto.icon('navigate', 'sm')}</button>
          <button class="fl-iconbtn" data-fl-act="asistente" title="Asistente">${Proto.icon('sparkles', 'sm')}</button>
          <button class="fl-iconbtn" data-fl-act="cmdk" title="Comandos">${Proto.icon('grid', 'sm')}</button>
        </header>
        <div class="fl-mobile-filters">
          <select class="select-native" data-fl-field="province" aria-label="Provincia"></select>
          <select class="select-native" data-fl-field="fuel" aria-label="Combustible"></select>
          <select class="select-native" data-fl-field="sort" aria-label="Orden"></select>
          <select class="select-native" data-fl-field="mapStyle" aria-label="Estilo de mapa"></select>
          <button class="chip" data-fl-act="favorites-only">${Proto.icon('star', 'xs')} Favoritos</button>
          <button class="chip" data-fl-act="cheap-only">${Proto.icon('percent', 'xs')} Descuento</button>
        </div>
        <div class="fl-center-body" id="flCenterBody"></div>
      </section>

      <aside class="fl-inspector">
        <div class="fl-inspector-head">
          <div class="segmented">
            <button data-fl-act="insp" data-val="ficha">Ficha</button>
            <button data-fl-act="insp" data-val="insights" class="on">Insights</button>
          </div>
          <button class="fl-iconbtn" data-fl-act="insp-close" title="Limpiar selección">${Proto.icon('close', 'sm')}</button>
        </div>
        <div class="fl-inspector-body" id="flInspectorBody"></div>
      </aside>

      <nav class="bottomnav fl-tower-nav">${C.TABS.tower.map(t => `<button class="nav-btn" data-fl-act="${t.id}" data-tab="${t.id}">
        ${Proto.icon(t.icon)}<span>${t.label}</span></button>`).join('')}</nav>
    </div>`;
  }

  function buildUnified(root) {
    root.innerHTML = `<div class="fl-app fl-unified">
      <header class="topbar">
        <a class="fl-iconbtn" href="index.html" title="Volver a finalistas" style="text-decoration:none">${Proto.icon('arrowLeft', 'sm')}</a>
        <span class="brandlogo sm" style="background:var(--brand);color:#fff">${Proto.icon('droplet', 'sm')}</span>
        <span class="topbar-title">Localiza tu gasolinera</span>
        <span class="topbar-sub" id="flSub">—</span>
        <div class="spacer"></div>
        <button class="fl-iconbtn" data-fl-act="cmdk" title="Comandos (Ctrl K)">${Proto.icon('grid', 'sm')}</button>
        <button class="fl-iconbtn" data-fl-act="asistente" title="Asistente">${Proto.icon('sparkles', 'sm')}</button>
        <button class="fl-iconbtn" data-fl-act="drive" title="Modo conducción">${Proto.icon('navigate', 'sm')}</button>
        <button class="fl-iconbtn" data-theme-toggle title="Tema"></button>
      </header>
      <div class="fl-toolbar" id="flToolbar">${toolbarHtml()}</div>
      ${searchRowHtml()}
      <main class="content" id="flPanes">
        <section class="pane on" data-pane="mapa">
          <div id="flMapUni" style="position:absolute;inset:0"></div>
          <select class="select-native fl-mapstyle-map" data-fl-field="mapStyle" aria-label="Estilo de mapa" title="Estilo de mapa"></select>
        </section>
        <section class="pane" data-pane="tabla"><div id="flTableUni" class="fl-scroll" style="height:100%"></div></section>
        <section class="pane pane-both" data-pane="ambos">
          <div class="fl-list-pane"><div id="flListBoth"></div></div>
          <div class="fl-map-pane"><div id="flMapBoth" style="position:absolute;inset:0"></div></div>
        </section>
      </main>
      ${navHtml(C.TABS.unified, 'fl-bottomnav')}
    </div>`;
  }

  function showUnifiedPane(tab) {
    $$('.pane', $('#flPanes')).forEach(p => p.classList.toggle('on', p.dataset.pane === tab));
    if (tab === 'mapa') requestAnimationFrame(() => ensureMap('uni', $('#flMapUni')));
    if (tab === 'tabla') tableRows($('#flTableUni'));
    if (tab === 'ambos') {
      renderList($('#flListBoth'));
      requestAnimationFrame(() => ensureMap('both', $('#flMapBoth')));
    }
    syncMaps();
  }

  function renderSplit(host) {
    if (!host) return;
    host.innerHTML = `<div class="fl-split">
      <div class="fl-list-pane"><div data-list></div></div>
      <div class="fl-map-pane"><div data-map></div></div>
    </div>`;
    renderList($('[data-list]', host));
    requestAnimationFrame(() => ensureMap('explore', $('[data-map]', host)));
  }

  function showTowerPanel(kind) {
    ui.towerPanel = kind;
    S.lastPanel = kind; C.save();
    $$('.fl-rail-nav button, .fl-tower-nav button').forEach(b => b.classList.toggle('on', b.dataset.tab === kind));
    const body = $('#flCenterBody');
    if (!body) return;
    body.innerHTML = '';
    if (kind === 'explorar') { renderSplit(body); return; }
    if (kind === 'ia') { panelIa(body); return; }
    const scroll = document.createElement('div');
    scroll.className = 'fl-scroll';
    scroll.style.flex = '1 1 auto';
    scroll.style.minHeight = '0';
    body.appendChild(scroll);
    const panel = PANELS[kind];
    if (panel) panel.render(scroll);
    else if (kind === 'insights') panelInsights(scroll);
  }

  /* === 21. Arranque =================================================== */
  function mount({ layout = 'thumb', host } = {}) {
    C.load();
    ProtoFeat.injectCss();
    ui.layout = layout;
    document.body.classList.add('fl-body');
    document.body.dataset.fl = layout;
    const root = host || document.getElementById('app') || document.body.appendChild(Object.assign(document.createElement('div'), { id: 'app' }));
    ui.root = root;

    if (layout === 'thumb') {
      if (!['mapa', 'lista'].includes(S.lastTab)) { S.lastTab = 'mapa'; C.save(); }
      buildThumb(root);
      ui.sheetCtl && ui.sheetCtl.open('half');
    } else if (layout === 'tower') {
      buildTower(root);
      ui.towerPanel = S.lastPanel && ['explorar', 'comparar', 'plan', 'asistente', 'insights', 'ia', 'config'].includes(S.lastPanel) ? S.lastPanel : 'explorar';
      showTowerPanel(ui.towerPanel);
      ui.selId = S.driveId || null;
      renderInspector();
    } else {
      buildUnified(root);
      const tab = S.lastTab && ['mapa', 'tabla', 'ambos'].includes(S.lastTab) ? S.lastTab : 'mapa';
      if (tab !== S.lastTab) { S.lastTab = tab; C.save(); }
      showUnifiedPane(tab);
    }

    fillFilterOptions();
    syncFilterInputs();
    repaint();
    Proto.boot();
    Proto.toast('Finalista cargado · datos simulados', { iconName: 'check' });
  }

  return {
    mount, go, repaint, openDetail, openDrive, openPalette,
    ui,
  };
})();
