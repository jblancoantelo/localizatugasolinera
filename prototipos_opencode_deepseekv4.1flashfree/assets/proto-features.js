/* ============================================================================
   ProtoFeat — capa de PARIDAD FUNCIONAL compartida por todos los prototipos
   ----------------------------------------------------------------------------
   Implementa, con datos fake y sin red, las funciones de la app real que faltan
   en varios diseños para que todos se puedan validar de igual a igual:

     · iaPanel()      chat IA completo: General + 7 proveedores, modelo por
                      proveedor con refresco, contexto inspeccionable, editar,
                      cancelar, borrar hilo, marca de agua (modelo · tiempo),
                      prompts en General y respuestas con estaciones citadas
     · configPanel()  Config completa: descuentos por marca (mueven precios),
                      caché IDB/LS con borrado, paginación, registro API/Push,
                      push (intervalos + probar), claves IA, pestañas visibles,
                      actualización de la app
     · overlay()      contenedor a pantalla completa para montar IA/Config en
                      diseños sin panel propio
     · pager()        paginación 5/10/15/30/50/100/Todas con ◀ ▶
     · mapStyleSelect() los 10 estilos de mapa (filtro CSS simulado)
     · legend() / empty()  leyenda de precios y estado vacío

   Requiere proto-data.js, proto-ui.js y proto-chart.js (en este orden).
   ========================================================================== */
const ProtoFeat = (() => {
  'use strict';

  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const esc = (s) => Proto.esc(s);

  /* === 0. CSS propio (se inyecta una sola vez) ========================== */
  function injectCss() {
    if (document.getElementById('pf-css')) return;
    const st = document.createElement('style');
    st.id = 'pf-css';
    st.textContent = `
      .pf-ia { display: flex; flex-direction: column; flex: 1; min-height: 0; }
      .pf-ia-tabs { flex: 0 0 auto; padding: 8px 12px 6px; }
      .pf-ia-bar { display: flex; align-items: center; gap: 8px; padding: 7px 12px; border-bottom: 1px solid var(--line); background: var(--surface); flex: 0 0 auto; }
      .pf-ia-bar .select-native { width: auto; min-width: 128px; max-width: 46%; min-height: 34px; font-size: var(--t-xs); padding-block: 4px; }
      .pf-ia-status { font-size: var(--t-3xs); color: var(--fg-2); font-weight: 700; white-space: nowrap; }
      .pf-ia-msgs { flex: 1 1 auto; overflow-y: auto; overscroll-behavior: contain; padding: 12px; display: flex; flex-direction: column; gap: 10px; }
      .pf-msg { max-width: 88%; padding: 9px 12px; border-radius: 15px; font-size: var(--t-sm); line-height: 1.5; }
      .pf-msg.user { align-self: flex-end; background: var(--brand); color: var(--brand-ink); border-bottom-right-radius: 5px; }
      .pf-msg.user .pf-edit { background: none; border: 0; color: inherit; opacity: .75; margin-left: 6px; vertical-align: -2px; }
      .pf-msg.assistant { align-self: flex-start; background: var(--surface); border: 1px solid var(--line); border-bottom-left-radius: 5px; }
      .pf-msg.error { align-self: flex-start; background: var(--bad-bg); border: 1px solid var(--bad-line); color: var(--bad); }
      .pf-msg.pf-label { max-width: none; font-weight: 800; font-size: var(--t-2xs); color: var(--fg-2); padding: 2px 4px; }
      .pf-msg .pf-meta { font-size: var(--t-3xs); color: var(--fg-3); margin-top: 6px; }
      .pf-msg.loading { align-self: flex-start; background: var(--surface); border: 1px solid var(--line); color: var(--fg-2); animation: pfPulse 1.1s ease-in-out infinite; }
      @keyframes pfPulse { 50% { opacity: .55; } }
      .pf-cite { display: flex; align-items: center; gap: 8px; margin-top: 8px; padding: 8px; border: 1px solid var(--line); border-radius: 11px; background: var(--bg-2); cursor: pointer; }
      .pf-cite:hover { border-color: var(--brand-line); }
      .pf-ia-prompts { flex: 0 0 auto; padding: 0 12px 6px; }
      .pf-ia-form { flex: 0 0 auto; display: flex; gap: 8px; padding: 8px 12px; border-top: 1px solid var(--line); background: var(--surface); }
      .pf-overlay { position: fixed; inset: 0; z-index: 80; background: var(--bg); display: none; flex-direction: column; }
      .pf-overlay.on { display: flex; }
      /* El proto-tag es fixed con z-index 200: se oculta mientras hay un overlay
         a pantalla completa, si no se pinta encima de la cabecera. */
      body:has(.pf-overlay.on) .proto-tag { opacity: 0; pointer-events: none; }
      .pf-overlay-body { flex: 1; min-height: 0; display: flex; flex-direction: column; overflow: hidden; }
      .pf-scroll { flex: 1; overflow-y: auto; overscroll-behavior: contain; }
      .pf-pager { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; padding: 10px 12px; }
      .pf-pager .pf-count { font-size: var(--t-2xs); color: var(--fg-2); margin-left: auto; }
      .pf-pager .select-native { width: auto; min-height: 36px; font-size: var(--t-xs); padding-block: 4px; }
      .pf-sec { padding: 14px 16px; border-bottom: 1px solid var(--line); background: var(--surface); }
      .pf-sec h3 { font-size: var(--t-2xs); font-weight: 800; letter-spacing: .07em; text-transform: uppercase; color: var(--fg-3); margin-bottom: 10px; }
      .pf-ctx-pre { font-family: var(--mono); font-size: var(--t-2xs); line-height: 1.6; white-space: pre-wrap; color: var(--fg-2); }
      .pf-kv { display: flex; justify-content: space-between; gap: 10px; font-size: var(--t-xs); padding: 5px 0; border-bottom: 1px dashed var(--line); }
      .pf-kv:last-child { border-bottom: 0; }
      [data-discval] { white-space: nowrap; min-width: 2.6em; text-align: right; }
      .pf-ia-empty { margin: auto; text-align: center; color: var(--fg-2); font-size: var(--t-xs); max-width: 36ch; }

      /* --- Explorador de datos (paridad de filtros/lista/mapa/ficha) --- */
      .pf-ex { display: flex; flex-direction: column; flex: 1; min-height: 0; min-width: 0; width: 100%; }
      .pf-ex-tools { flex: 0 0 auto; display: flex; flex-direction: column; gap: 7px; padding: 8px 12px; background: var(--surface); border-bottom: 1px solid var(--line); min-width: 0; }
      .pf-ex-search { display: flex; align-items: center; gap: 7px; min-height: 38px; padding: 0 11px; background: var(--bg-2); border: 1px solid var(--line); border-radius: 999px; color: var(--fg-3); }
      .pf-ex-search input { flex: 1; min-width: 0; border: 0; outline: 0; background: none; color: var(--fg); font: inherit; font-size: var(--t-sm); }
      .pf-ex-line { display: flex; align-items: center; gap: 6px; flex-wrap: wrap; }
      .pf-ex-line .select-native { width: auto; min-height: 34px; font-size: var(--t-xs); padding-block: 3px; padding-inline: 8px; }
      .pf-ex-line .chip { min-height: 34px; font-size: var(--t-2xs); }
      .pf-ex-line .chip.on { border-color: var(--brand); color: var(--brand); background: var(--brand-soft); }
      .pf-ex-filters { display: flex; flex-direction: column; gap: 7px; padding: 9px; border: 1px dashed var(--line-2); border-radius: 12px; background: var(--bg-2); }
      .pf-ex-filters[hidden] { display: none; }
      .pf-ex-fline { display: flex; gap: 7px; flex-wrap: wrap; }
      .pf-ex-fline > * { flex: 1 1 128px; min-width: 0; }
      .pf-ex-fline .select-native { width: 100%; min-height: 34px; font-size: var(--t-xs); }
      .pf-ex-km { display: flex; align-items: center; gap: 8px; font-size: var(--t-2xs); color: var(--fg-2); }
      .pf-ex-km input[type=range] { flex: 1; accent-color: var(--brand); }
      .pf-ex-brands { display: flex; gap: 5px; flex-wrap: wrap; max-height: 96px; overflow-y: auto; }
      .pf-ex-brands .chip { min-height: 28px; font-size: var(--t-3xs); padding: 0 9px; }
      .pf-ex-mapbox { position: relative; height: 176px; border-radius: 14px; overflow: hidden; border: 1px solid var(--line); background: var(--map-bg); }
      .pf-ex-map { position: absolute; inset: 0; }
      .pf-ex-maptools { position: absolute; top: 7px; right: 7px; z-index: 6; }
      .pf-ex-maptools .select-native { min-height: 32px; max-width: 148px; font-size: var(--t-3xs); background: var(--surface); box-shadow: var(--sh-1); }
      .pf-ex-summary { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; font-size: var(--t-2xs); color: var(--fg-2); }
      .pf-ex-summary .pf-ex-total { font-weight: 700; }
      .pf-ex-list { flex: 1 1 auto; min-width: 0; min-height: 0; overflow-y: auto; overscroll-behavior: contain; padding: 8px 12px 14px; display: flex; flex-direction: column; gap: 6px; }
      .pf-ex-item { display: flex; align-items: center; gap: 10px; width: 100%; padding: 9px 10px; background: var(--surface); border: 1px solid var(--line); border-radius: 12px; cursor: pointer; text-align: left; }
      .pf-ex-item:hover, .pf-ex-item:focus-visible { border-color: var(--brand-line); }
      .pf-ex-main { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 2px; }
      .pf-ex-main b { font-size: var(--t-sm); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
      .pf-ex-main small { color: var(--fg-3); font-size: var(--t-3xs); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
      .pf-ex-price { flex: 0 0 auto; display: flex; flex-direction: column; align-items: flex-end; gap: 1px; }
      .pf-ex-price .p-sm { font-size: var(--t-sm); }
      .pf-ex-price small { font-size: var(--t-3xs); color: var(--fg-3); }
      .pf-ex-fav { flex: 0 0 auto; }
      .pf-ex-empty { padding: 18px 4px; }
      .pf-ex-detail { z-index: 90; }
      .pf-ex-detail-body { padding: 14px 16px 48px; }
      @media (min-width: 900px) {
        .pf-ex-mapbox { height: 210px; }
        .pf-ex-list { padding-bottom: 20px; }
      }
    `;
    document.head.appendChild(st);
  }

  /* === 1. Estilos de mapa (10, orden A-Z como la app; por defecto Satélite) */
  const MAP_STYLES = ['Calle', 'Ciclismo', 'Estándar', 'Humanitario', 'NatGeo', 'Oscuro', 'Relieve', 'Satélite', 'Satélite con nombres', 'Topográfico'];
  const STYLE_FILTERS = {
    'Oscuro': 'invert(1) hue-rotate(185deg) brightness(.94) contrast(1.05)',
    'Relieve': 'sepia(.4) saturate(1.2) contrast(1.03)',
    'NatGeo': 'saturate(1.35) contrast(1.06)',
    'Topográfico': 'sepia(.55) hue-rotate(-18deg) saturate(1.25)',
    'Satélite con nombres': 'saturate(1.18) contrast(1.04)',
    'Satélite': 'saturate(1.08)',
    'Calle': '',
    'Ciclismo': 'hue-rotate(-12deg) saturate(1.1)',
    'Estándar': 'contrast(1.02)',
    'Humanitario': 'sepia(.15) saturate(1.05)',
  };
  function mapStyleSelect(selectEl, { mapHost, onChange } = {}) {
    injectCss();
    selectEl.innerHTML = MAP_STYLES.map(s => `<option value="${esc(s)}" ${s === 'Satélite' ? 'selected' : ''}>${esc(s)}</option>`).join('');
    selectEl.addEventListener('change', () => {
      const v = selectEl.value;
      if (mapHost) mapHost.style.filter = STYLE_FILTERS[v] || '';
      Proto.toast('Vista del mapa: ' + v, { iconName: 'layers' });
      onChange?.(v);
    });
    return { set(v) { selectEl.value = v; selectEl.dispatchEvent(new Event('change')); } };
  }

  /* === 2. Paginación ==================================================== */
  const PAGE_SIZES = [5, 10, 15, 30, 50, 100, 0];
  function pager(host, { size = 30, total = 0, onChange, label = 'resultados' } = {}) {
    injectCss();
    const state = { size, page: 0, total };
    host.innerHTML = `
      <div class="pf-pager">
        <select class="select-native pf-size" aria-label="Resultados por página">
          ${PAGE_SIZES.map(n => `<option value="${n}" ${n === size ? 'selected' : ''}>${n || 'Todas'}</option>`).join('')}
        </select>
        <div class="segmented">
          <button data-pg="prev" aria-label="Anterior">◀</button>
          <button data-pg="next" aria-label="Siguiente">▶</button>
        </div>
        <span class="pf-pg-info tiny muted"></span>
        <span class="pf-count">${total} ${label}</span>
      </div>`;
    const info = $('.pf-pg-info', host);
    const pages = () => state.size ? Math.max(1, Math.ceil(state.total / state.size)) : 1;
    function paint() {
      const p = pages();
      state.page = Math.max(0, Math.min(p - 1, state.page));
      info.textContent = state.size ? `${state.page + 1} / ${p}` : 'todo';
      $('.pf-size', host).value = state.size;
      $$('[data-pg]', host).forEach(b => b.disabled = false);
    }
    $('.pf-size', host).addEventListener('change', (e) => {
      state.size = +e.target.value; state.page = 0; paint(); onChange?.(state.size, state.page);
    });
    host.addEventListener('click', (e) => {
      const b = e.target.closest('[data-pg]'); if (!b) return;
      state.page += b.dataset.pg === 'next' ? 1 : -1; paint(); onChange?.(state.size, state.page);
    });
    paint();
    return {
      slice(list) { return state.size ? list.slice(state.page * state.size, (state.page + 1) * state.size) : list; },
      set(n) { state.total = n; paint(); },
      setPage(n) { state.page = Math.max(0, n | 0); paint(); },
      setSize(n) { state.size = +n; state.page = 0; paint(); onChange?.(state.size, state.page); },
      get size() { return state.size; },
      get page() { return state.page; },
      el: host,
    };
  }

  /* === 3. Leyenda de precios y estado vacío ============================= */
  function legend(stats) {
    if (!stats) return '';
    return `<span class="chip soft" style="gap:6px"><i style="width:9px;height:9px;border-radius:50%;background:var(--lo)"></i>${PROTO.money(stats.min, 3)}
      <i style="width:9px;height:9px;border-radius:50%;background:var(--mid);margin-left:4px"></i>media
      <i style="width:9px;height:9px;border-radius:50%;background:var(--hi);margin-left:4px"></i>${PROTO.money(stats.max, 3)}</span>`;
  }
  function empty(host, { icon = 'search', title = 'Sin resultados', text = 'Prueba a cambiar los filtros.' } = {}) {
    host.innerHTML = `<div class="empty"><div class="e-icon">${Proto.icon(icon)}</div><h3>${esc(title)}</h3><p>${esc(text)}</p></div>`;
  }

  /* === 3b. Explorador de datos completo ================================ */
  /**
   * explorer(host, {list, fuel, province, pageSize})
   * Reúne en un solo componente la paridad de datos de la app real:
   * búsqueda, combustible, provincia/localidad/marca/distancia, favoritos,
   * orden, paginación, leyenda de precios, 10 estilos de mapa, mapa con pines
   * y ficha de estación con histórico (Proto.stationDetail).
   */
  function explorer(host, opts = {}) {
    injectCss();
    const state = {
      fuel: opts.fuel || 'diesel',
      q: '',
      province: opts.province || '',
      locality: '',
      brands: [],
      maxKm: 0,
      favorites: false,
      cheap: false,
      sort: 'price',
      dir: 'asc',
    };
    const base = () => (opts.list ? opts.list() : PROTO.STATIONS).slice();
    const byId = (id) => base().find(s => s.id === id) || PROTO.STATIONS.find(s => s.id === id);
    const provinces = () => [...new Set(base().map(s => s.province))].sort((a, b) => a.localeCompare(b, 'es'));
    const localities = () => [...new Set(base().filter(s => !state.province || s.province === state.province).map(s => s.city))].sort((a, b) => a.localeCompare(b, 'es'));
    const brandList = () => PROTO.brandsOf(base().filter(s => !state.province || s.province === state.province));
    const fuels = () => PROTO.FUELS.filter(f => base().some(s => s.prices[f.id] != null));

    host.innerHTML = `
      <div class="pf-ex">
        <div class="pf-ex-tools">
          <label class="pf-ex-search"><span class="ico sm" data-ico="search"></span>
            <input data-opt-search type="search" placeholder="Marca, calle o localidad…" aria-label="Buscar estación" autocomplete="off">
          </label>
          <div class="pf-ex-line">
            <select class="select-native" data-opt-fuel aria-label="Combustible"></select>
            <button class="chip" data-opt-filters aria-expanded="false" aria-controls="pfExFilters">${Proto.icon('sliders', 'xs')} Filtros <span class="badge" data-opt-nfilter hidden>0</span></button>
            <button class="chip" data-opt-favonly aria-pressed="false">${Proto.icon('star', 'xs')} Favoritos</button>
            <select class="select-native" data-opt-sort aria-label="Ordenar por"></select>
          </div>
          <div class="pf-ex-filters" id="pfExFilters" data-opt-panel hidden>
            <div class="pf-ex-fline">
              <select class="select-native" data-opt-prov aria-label="Provincia"></select>
              <select class="select-native" data-opt-loc aria-label="Localidad"></select>
            </div>
            <div class="pf-ex-brands" data-opt-brands aria-label="Marcas"></div>
            <div class="pf-ex-km"><span class="ico xs" data-ico="route"></span>
              <input type="range" data-opt-km min="0" max="60" step="1" value="0" aria-label="Distancia máxima">
              <b data-opt-kmval>Sin límite</b>
            </div>
            <div class="pf-ex-fline">
              <label class="row" style="gap:6px;font-size:var(--t-2xs);flex:0 0 auto"><input type="checkbox" data-opt-cheap> Solo con descuento</label>
              <button class="btn sm ghost" data-opt-reset>${Proto.icon('refresh', 'xs')} Limpiar</button>
            </div>
          </div>
          <div class="pf-ex-mapbox" data-opt-mapbox>
            <div class="pf-ex-map" data-opt-map data-map-host></div>
            <div class="pf-ex-maptools"><select class="select-native" data-opt-mapstyle aria-label="Vista del mapa"></select></div>
          </div>
          <div class="pf-ex-summary"><span class="pf-ex-total" data-opt-count>—</span><span data-opt-legend></span></div>
        </div>
        <div class="pf-ex-list" data-opt-list></div>
        <div data-opt-pager></div>
        <div class="pf-overlay pf-ex-detail" data-opt-detail-overlay role="dialog" aria-label="Ficha de la estación">
          <header class="topbar">
            <button class="iconbtn" data-opt-detail-close title="Cerrar"><span data-ico="close"></span></button>
            <span class="topbar-title">Ficha de la estación</span>
          </header>
          <div class="pf-scroll pf-ex-detail-body" data-opt-detail-body></div>
        </div>
      </div>`;
    Proto.hydrateIcons(host);

    const $ = (s) => host.querySelector(s);
    const qEl = $('[data-opt-search]');
    const fuelEl = $('[data-opt-fuel]');
    const sortEl = $('[data-opt-sort]');
    const provEl = $('[data-opt-prov]');
    const locEl = $('[data-opt-loc]');
    const kmEl = $('[data-opt-km]');
    const pagerCtl = pager($('[data-opt-pager]'), {
      size: opts.pageSize ?? 10, total: 0, label: 'estaciones',
      onChange: () => paintList(),
    });

    function filtered() {
      return PROTO.sortStations(PROTO.filterStations(base(), {
        province: state.province || undefined,
        locality: state.locality || undefined,
        fuel: state.fuel,
        brands: state.brands,
        maxKm: state.maxKm || 0,
        favoritesOnly: state.favorites,
        cheapOnly: state.cheap,
        q: state.q || undefined,
      }), state.sort, state.dir, state.fuel);
    }

    function activeFilters() {
      return (state.province ? 1 : 0) + (state.locality ? 1 : 0) + state.brands.length +
        (state.maxKm ? 1 : 0) + (state.favorites ? 1 : 0) + (state.cheap ? 1 : 0) + (state.q ? 1 : 0);
    }

    function paintSelectors() {
      const fs = fuels();
      if (!fs.some(f => f.id === state.fuel)) state.fuel = (fs[0] || PROTO.FUELS[0]).id;
      fuelEl.innerHTML = fs.map(f => `<option value="${f.id}" ${f.id === state.fuel ? 'selected' : ''}>${esc(f.name)}</option>`).join('');
      provEl.innerHTML = '<option value="">Todas las provincias</option>' +
        provinces().map(p => `<option value="${esc(p)}" ${p === state.province ? 'selected' : ''}>${esc(p)}</option>`).join('');
      locEl.innerHTML = '<option value="">Todas las localidades</option>' +
        localities().map(c => `<option value="${esc(c)}" ${c === state.locality ? 'selected' : ''}>${esc(c)}</option>`).join('');
      sortEl.innerHTML = [['price', 'Precio'], ['distance', 'Distancia'], ['rating', 'Valoración'], ['updated', 'Actualización'], ['saving', 'Descuento'], ['brand', 'Marca']]
        .map(([v, l]) => `<option value="${v}" ${v === state.sort ? 'selected' : ''}>${l}</option>`).join('');
      $('[data-opt-brands]').innerHTML = brandList().map(b => {
        const m = PROTO.brandMeta(b);
        return `<button class="chip ${state.brands.includes(b) ? 'on' : ''}" data-brand="${esc(b)}" aria-pressed="${state.brands.includes(b)}">
          <i style="width:8px;height:8px;border-radius:50%;background:${m.color}"></i>${esc(b)}</button>`;
      }).join('');
      kmEl.value = state.maxKm || 0;
      $('[data-opt-kmval]').textContent = state.maxKm ? state.maxKm + ' km' : 'Sin límite';
      $('[data-opt-cheap]').checked = state.cheap;
    }

    function paintList(list = filtered()) {
      const wrap = $('[data-opt-list]');
      const page = pagerCtl.slice(list);
      if (!page.length) {
        empty(wrap, { title: 'Sin resultados', text: 'Ninguna estación coincide con la búsqueda o los filtros.' });
        return;
      }
      const stats = PROTO.stats(list, state.fuel);
      wrap.innerHTML = page.map(st => {
        const price = PROTO.finalPrice(st, state.fuel);
        const lvl = stats ? PROTO.level(price, stats.lo, stats.hi) : 'mid';
        const meta = PROTO.brandMeta(st.brand);
        const km = PROTO.kmFromUser(st);
        return `<div class="pf-ex-item" data-opt-detail="${st.id}" role="button" tabindex="0" aria-label="${esc(st.name)}">
          <span class="brandlogo sm" style="background:${meta.color};color:${meta.ink}">${esc(st.brand.slice(0, 2))}</span>
          <span class="pf-ex-main"><b>${esc(st.name)}</b><small>${esc(st.address)} · ${esc(st.city)} · ${PROTO.dist(km)}</small></span>
          <span class="pf-ex-price"><span class="price p-sm ${lvl}">${PROTO.money(price, 3).replace(' €', '')}<span class="p-unit">€/L</span></span>
            <small>${meta.discount ? '-' + meta.discount + ' ¢' : esc(st.schedule)}</small></span>
          <button class="iconbtn sm pf-ex-fav ${st.fav ? 'on' : ''}" data-opt-fav="${st.id}" title="Favorito" aria-pressed="${st.fav}">${Proto.icon(st.fav ? 'starFill' : 'star', st.fav ? 'sm fill' : 'sm')}</button>
        </div>`;
      }).join('');
    }

    function paint() {
      const list = filtered();
      pagerCtl.set(list.length);
      paintList(list);
      const stats = PROTO.stats(list, state.fuel);
      $('[data-opt-count]').textContent = `${list.length} estaciones · ${PROTO.fuelShort(state.fuel)}`;
      $('[data-opt-legend]').innerHTML = stats ? legend(stats) : '';
      const n = activeFilters();
      const badge = $('[data-opt-nfilter]');
      badge.textContent = n;
      badge.hidden = !n;
      $('[data-opt-favonly]').classList.toggle('on', state.favorites);
      $('[data-opt-favonly]').setAttribute('aria-pressed', String(state.favorites));
      syncMap();
    }

    /* --- Mapa --------------------------------------------------------- */
    let mapCtl = null, mapOpts = null;
    function initMap() {
      if (typeof ProtoMap === 'undefined') { $('[data-opt-mapbox]').hidden = true; return; }
      mapOpts = { fuel: state.fuel, stations: filtered(), showLayers: false, zoom: 1.15 };
      mapCtl = ProtoMap.create($('[data-opt-map]'), mapOpts);
      mapCtl.on('marker', (id) => openDetail(id));
      mapStyleSelect($('[data-opt-mapstyle]'), { mapHost: $('[data-opt-map]') });
    }
    function syncMap() {
      if (!mapCtl) return;
      mapOpts.fuel = state.fuel;
      mapCtl.setStations(filtered());
    }

    /* --- Ficha de estación -------------------------------------------- */
    let detailCtl = null;
    function openDetail(id) {
      const st = byId(id); if (!st) return;
      const ov = $('[data-opt-detail-overlay]');
      const body = $('[data-opt-detail-body]');
      body.innerHTML = '';
      detailCtl = Proto.stationDetail(body, st, {
        fuel: state.fuel, days: 14, list: filtered(),
        onFuel: (f) => { state.fuel = f; fuelEl.value = f; paint(); },
      });
      body.scrollTop = 0;
      ov.classList.add('on');
    }
    function closeDetail() {
      $('[data-opt-detail-overlay]').classList.remove('on');
      detailCtl = null;
    }

    /* --- Eventos ------------------------------------------------------ */
    qEl.addEventListener('input', () => { state.q = qEl.value.trim(); pagerCtl.setPage(0); paint(); });
    fuelEl.addEventListener('change', () => { state.fuel = fuelEl.value; pagerCtl.setPage(0); paint(); });
    sortEl.addEventListener('change', () => { state.sort = sortEl.value; pagerCtl.setPage(0); paint(); });
    provEl.addEventListener('change', () => {
      state.province = provEl.value; state.locality = ''; state.brands = [];
      pagerCtl.setPage(0); paintSelectors(); paint();
    });
    locEl.addEventListener('change', () => { state.locality = locEl.value; pagerCtl.setPage(0); paint(); });
    kmEl.addEventListener('input', () => {
      state.maxKm = +kmEl.value;
      $('[data-opt-kmval]').textContent = state.maxKm ? state.maxKm + ' km' : 'Sin límite';
      pagerCtl.setPage(0); paint();
    });
    $('[data-opt-cheap]').addEventListener('change', (e) => { state.cheap = e.target.checked; pagerCtl.setPage(0); paint(); });
    $('[data-opt-filters]').addEventListener('click', () => {
      const panel = $('[data-opt-panel]');
      panel.hidden = !panel.hidden;
      $('[data-opt-filters]').setAttribute('aria-expanded', String(!panel.hidden));
      $('[data-opt-filters]').classList.toggle('on', !panel.hidden);
    });
    $('[data-opt-favonly]').addEventListener('click', () => {
      state.favorites = !state.favorites; pagerCtl.setPage(0); paint();
    });
    $('[data-opt-brands]').addEventListener('click', (e) => {
      const b = e.target.closest('[data-brand]'); if (!b) return;
      const brand = b.dataset.brand;
      const i = state.brands.indexOf(brand);
      if (i >= 0) state.brands.splice(i, 1); else state.brands.push(brand);
      pagerCtl.setPage(0); paintSelectors(); paint();
    });
    $('[data-opt-reset]').addEventListener('click', () => {
      Object.assign(state, { q: '', province: '', locality: '', brands: [], maxKm: 0, favorites: false, cheap: false, sort: 'price' });
      qEl.value = '';
      pagerCtl.setPage(0); paintSelectors(); paint();
    });
    host.addEventListener('click', (e) => {
      const fav = e.target.closest('[data-opt-fav]');
      if (fav) {
        e.stopPropagation();
        const st = byId(fav.dataset.optFav);
        if (!st) return;
        st.fav = !st.fav;
        Proto.toast(st.fav ? st.name + ' en favoritos' : 'Quitada de favoritos', { iconName: st.fav ? 'starFill' : 'star' });
        paint();
        if (state.favorites) { pagerCtl.setPage(0); paint(); }
        return;
      }
      if (e.target.closest('[data-opt-detail-close]')) { closeDetail(); return; }
      const item = e.target.closest('[data-opt-detail]');
      if (item) openDetail(item.dataset.optDetail);
    });
    host.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        const item = e.target.closest('[data-opt-detail]');
        if (item) { e.preventDefault(); openDetail(item.dataset.optDetail); }
      }
    });
    detailCtl = null;
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && $('[data-opt-detail-overlay]').classList.contains('on')) closeDetail();
    });
    document.addEventListener('proto:theme', () => { if (detailCtl) detailCtl.redraw(); });

    paintSelectors();
    paint();
    requestAnimationFrame(initMap);

    return {
      refresh: () => { paintSelectors(); paint(); },
      get fuel() { return state.fuel; },
      setFuel(f) { state.fuel = f; fuelEl.value = f; paint(); },
      openDetail,
      el: host,
    };
  }

  /* === 4. Overlay a pantalla completa ================================== */
  function overlay({ title = '', icon = 'sparkles', render }) {
    injectCss();
    const el = Proto.el(`
      <div class="pf-overlay" role="dialog" aria-label="${esc(title)}">
        <header class="topbar">
          <span class="topbar-title"><span class="ico" data-ico="${icon}" style="color:var(--brand)"></span>${esc(title)}</span>
          <div class="spacer"></div>
          <button class="iconbtn" data-pf-close title="Cerrar"><span data-ico="close"></span></button>
        </header>
        <div class="pf-overlay-body"></div>
      </div>`);
    document.body.appendChild(el);
    Proto.hydrateIcons(el);
    const body = $('.pf-overlay-body', el);
    let built = false;
    const open = () => {
      if (!built) { render(body); built = true; }
      el.classList.add('on');
      document.addEventListener('keydown', onEsc);
    };
    const close = () => { el.classList.remove('on'); document.removeEventListener('keydown', onEsc); };
    const onEsc = (e) => { if (e.key === 'Escape') close(); };
    $('[data-pf-close]', el).addEventListener('click', close);
    return { el, open, close, get isOpen() { return el.classList.contains('on'); } };
  }

  /* === 5. IA — chat completo =========================================== */
  const PROVIDERS = [
    { id: 'general', label: 'General', model: null, models: [] },
    { id: 'groq', label: 'Groq', model: 'qwen/qwen3.8-27b', models: ['allam-2-7b', 'openai/gpt-oss-120b', 'openai/gpt-oss-20b', 'qwen/qwen3.8-27b'] },
    { id: 'mistral', label: 'Mistral', model: 'open-mistral-nemo', models: ['codestral-latest', 'ministral-8b-latest', 'mistral-medium-latest', 'mistral-small-latest', 'open-mistral-nemo'] },
    { id: 'openrouter', label: 'OpenRouter', model: 'nvidia/nemotron-3-ultra-550b-a55b:free', models: ['nvidia/nemotron-3-super-120b-a12b:free', 'nvidia/nemotron-3-ultra-550b-a55b:free'] },
    { id: 'llm7', label: 'LLM7.io', model: 'codestral-latest', models: ['GLM-5.3-Flash', 'codestral-latest', 'minimax-m2.7', 'mistral-Nemo-Instruct-2407'] },
    { id: 'nvidia', label: 'NVIDIA', model: 'nvidia/nemotron-3-ultra-550b-a55b', models: ['moonshotai/kimi-k3', 'nvidia/nemotron-3-super-120b-a12b', 'nvidia/nemotron-3-ultra-550b-a55b', 'z-ai/glm-5.3'], proxy: true },
    { id: 'google', label: 'Gemini', model: 'gemini-3.8-flash', models: ['gemini-3.5-flash', 'gemini-3.5-flash-lite', 'gemini-3.7-flash', 'gemini-3.8-flash'] },
    { id: 'chrome', label: 'Chrome IA', model: null, models: [] },
  ];
  const providerLabel = (id) => (PROVIDERS.find(p => p.id === id) || {}).label || id;
  const pl = (v, dec = 3) => PROTO.money(v, dec).replace(' €', '') + ' €/L';

  function fakeAnswer(pid, q, list) {
    const sorted = PROTO.sortStations(list, 'price', 'asc', 'diesel');
    const cheap = sorted[0];
    const near = PROTO.nearestStations(list, 3)[0];
    const ql = q.toLowerCase();
    const stats = PROTO.stats(list, 'diesel');
    if (/barat|cerca|dónde|donde|repostar/.test(ql) && cheap) {
      const save = PROTO.savingVsAvg(cheap, list, 'diesel', 50);
      const cite = `<div class="pf-cite" data-open="${cheap.id}"><span class="brandlogo sm" style="background:${PROTO.brandMeta(cheap.brand).color}">${cheap.brand.slice(0, 2)}</span>
        <span class="grow"><span class="small bold">${esc(cheap.name)}</span><br><span class="tiny muted">${PROTO.dist(PROTO.kmFromUser(cheap))} · ${PROTO.driveMin(PROTO.kmFromUser(cheap))} min · diésel ${PROTO.money(PROTO.finalPrice(cheap, 'diesel'), 3)}</span></span>
        <span class="ico" data-ico="chevronRight"></span></div>`;
      const texts = {
        groq: `<b>${esc(cheap.name)}</b> es la más barata: ${pl(PROTO.finalPrice(cheap, 'diesel'))}, un ${PROTO.pct((PROTO.finalPrice(cheap, 'diesel') / stats.avg - 1) * 100)} frente a la media (${pl(stats.avg)}). Ahorro de ${PROTO.money(save, 2)} por depósito de 50 L.`,
        mistral: `He revisado las ${list.length} estaciones: <b>${esc(cheap.name)}</b> sale a ${pl(PROTO.finalPrice(cheap, 'diesel'))}. Segunda opción: ${esc(sorted[1] ? sorted[1].name : '—')}.`,
        openrouter: `Comparadas ${list.length} estaciones, el mejor precio es <b>${esc(cheap.name)}</b> (${pl(PROTO.finalPrice(cheap, 'diesel'))}). La horquilla min–max es de ${pl(stats.spread, 2)}.`,
        llm7: `<b>${esc(cheap.name)}</b> manda: ${pl(PROTO.finalPrice(cheap, 'diesel'))}. Cerca de ti, ${esc(near.name)} a ${PROTO.dist(PROTO.kmFromUser(near))}.`,
        nvidia: `Vía proxy NIM: la estación más barata es <b>${esc(cheap.name)}</b> con ${pl(PROTO.finalPrice(cheap, 'diesel'))}.`,
        google: `<b>${esc(cheap.name)}</b> está a ${pl(PROTO.finalPrice(cheap, 'diesel'))} — la más barata de las ${list.length} cargadas. Ahorras ${PROTO.money(save, 2)} por depósito frente a la media. La más cercana es ${esc(near.name)} (${PROTO.dist(PROTO.kmFromUser(near))}).`,
        chrome: `Respuesta generada en tu dispositivo (Chrome IA): la opción más económica es <b>${esc(cheap.name)}</b> a ${pl(PROTO.finalPrice(cheap, 'diesel'))}.`,
      };
      return { html: texts[pid] + cite, cites: [cheap.id] };
    }
    if (/sube|baja|tendencia|semana|evoluci/.test(ql) && cheap) {
      const s = PROTO.seriesStats(PROTO.series(cheap, 'diesel', 14));
      const dir = s.diff < 0 ? 'bajando' : s.diff > 0 ? 'subiendo' : 'estable';
      return { html: `En 14 días el diésel en ${esc(cheap.name)} va <b>${dir}</b>: ${PROTO.pct(s.diff * 100 / s.avg)} (${PROTO.cents(s.diff)}). Mínimo ${PROTO.money(s.min, 3)} el ${s.minDate}; máximo ${PROTO.money(s.max, 3)} el ${s.maxDate}. Si la curva sigue así, repostar el ${dir === 'bajando' ? 'viernes' : 'sábado'} es tu mejor jugada.` };
    }
    if (/compensa|desv|merece|ahorro/.test(ql) && cheap && near && cheap.id !== near.id) {
      const d = PROTO.kmFromUser(cheap) - PROTO.kmFromUser(near);
      const cost = Math.max(0, d * 2 * stats.avg * 0.064);
      const save = (PROTO.finalPrice(near, 'diesel') - PROTO.finalPrice(cheap, 'diesel')) * 50;
      return { html: `Desvío de <b>${PROTO.dist(Math.max(0, d))} por trayecto</b> (≈ ${PROTO.money(cost, 2)} de combustible): sí compensa si echas 50 L — ${PROTO.money(save, 2)} de ahorro bruto, <b>${PROTO.money(save - cost, 2)} netos</b>.` };
    }
    if (/resumen|madrid|precio/.test(ql)) {
      return { html: `Resumen ${esc(list[0] ? list[0].province : '')}: ${list.length} estaciones · mín ${PROTO.money(stats.min, 3)} · media ${PROTO.money(stats.avg, 3)} · máx ${PROTO.money(stats.max, 3)}. Hay ${PROTO.favorites().length} favoritas guardadas.` };
    }
    const cite = cheap ? `<div class="pf-cite" data-open="${cheap.id}"><span class="brandlogo sm" style="background:${PROTO.brandMeta(cheap.brand).color}">${cheap.brand.slice(0, 2)}</span>
      <span class="grow"><span class="small bold">${esc(cheap.name)}</span><br><span class="tiny muted">la más barata ahora mismo · ${pl(PROTO.finalPrice(cheap, 'diesel'))}</span></span>
      <span class="ico" data-ico="chevronRight"></span></div>` : '';
    return { html: `He mirado tus ${list.length} estaciones y el histórico de 14 días. Dime si quieres precios, tendencia o si te compensa un desvío.${cite}` };
  }

  function iaPanel(host, opts = {}) {
    injectCss();
    const listOf = () => (opts.list ? opts.list() : PROTO.STATIONS);
    const state = {
      active: 'general',
      hidden: new Set(opts.hidden || []),
      chats: {},
      model: {},
      thinking: 0,
      proxyOk: !!opts.proxyOk,
      timers: [],
    };
    PROVIDERS.forEach(p => { if (p.model) state.model[p.id] = p.model; });

    host.innerHTML = `
      <div class="pf-ia">
        <div class="chips pf-ia-tabs"></div>
        <div class="pf-ia-bar">
          <select class="select-native pf-model" aria-label="Modelo"></select>
          <button class="iconbtn sm" data-ia="refresh" title="Actualizar catálogo de modelos"><span data-ico="refresh"></span></button>
          <span class="pf-ia-status"></span>
          <div class="spacer" style="flex:1"></div>
          <button class="iconbtn sm" data-ia="ctx" title="Ver contexto enviado"><span data-ico="info"></span></button>
          <button class="iconbtn sm" data-ia="clear" title="Borrar conversación"><span data-ico="trash"></span></button>
        </div>
        <div class="pf-ia-msgs"></div>
        <div class="chips wrap pf-ia-prompts"></div>
        <form class="pf-ia-form">
          <div class="field pill grow"><span class="ico" data-ico="sparkles"></span>
            <input class="pf-input" placeholder="Pregunta lo que quieras sobre precios…"></div>
          <button class="iconbtn on pf-send" type="submit" style="background:var(--brand);color:var(--brand-ink)"><span data-ico="send"></span></button>
        </form>
      </div>`;
    Proto.hydrateIcons(host);

    const tabs = $('.pf-ia-tabs', host);
    const msgs = $('.pf-ia-msgs', host);
    const modelSel = $('.pf-model', host);
    const status = $('.pf-ia-status', host);
    const prompts = $('.pf-ia-prompts', host);
    const form = $('.pf-ia-form', host);
    const input = $('.pf-input', host);

    const readyPros = () => PROVIDERS.filter(p => p.id !== 'general' && p.id !== 'nvidia' && !state.hidden.has(p.id)).length +
      (!state.hidden.has('nvidia') && state.proxyOk ? 1 : 0);
    const visiblePros = () => PROVIDERS.filter(p => p.id !== 'general' && !state.hidden.has(p.id)).length;

    function seedChat(pid) {
      if (state.chats[pid]) return;
      state.chats[pid] = [{ role: 'assistant', html: pid === 'general'
        ? `Puedo consultar el histórico, comparar estaciones o calcular si te compensa un desvío. En <b>General</b> lanzo tu pregunta a los ${visiblePros()} proveedores a la vez.`
        : `Hola, soy el chat de <b>${providerLabel(pid)}</b>${state.model[pid] ? ' con <b>' + esc(state.model[pid]) + '</b>' : ''}. Pregúntame por precios, tendencias o desvíos.` }];
    }

    function paintTabs() {
      tabs.innerHTML = PROVIDERS.map(p => `<button class="chip ${p.id === state.active ? 'on' : ''}" data-p="${p.id}" ${state.hidden.has(p.id) ? 'hidden' : ''}>${esc(p.label)}</button>`).join('');
      const cur = PROVIDERS.find(p => p.id === state.active);
      status.textContent = state.active === 'general'
        ? `✅ ${readyPros()}/${visiblePros()} proveedores listos`
        : (state.active === 'nvidia' && !state.proxyOk ? '⚠️ sin URL de proxy' : '✅ listo');
      const hasModel = cur && cur.models.length;
      modelSel.style.display = hasModel ? '' : 'none';
      $('[data-ia="refresh"]', host).style.display = hasModel ? '' : 'none';
      if (hasModel) modelSel.innerHTML = cur.models.map(m => `<option ${m === state.model[cur.id] ? 'selected' : ''}>${esc(m)}</option>`).join('');
      prompts.innerHTML = state.active === 'general'
        ? PROTO.AI.prompts.map(p => `<button class="chip" data-pr="${esc(p)}">${esc(p)}</button>`).join('')
        : '';
    }

    function paintMsgs() {
      const chat = state.chats[state.active] || [];
      msgs.innerHTML = chat.map((m, i) => {
        if (m.role === 'user') return `<div class="pf-msg user">${esc(m.text)}<button class="pf-edit" data-edit="${i}" title="Editar"><span class="ico xs" data-ico="pencil"></span></button></div>`;
        if (m.role === 'error') return `<div class="pf-msg error">${m.html}</div>`;
        return `<div class="pf-msg assistant">${m.label ? `<div class="tiny bold muted mb1">${esc(m.label)}</div>` : ''}${m.html}${m.meta ? `<div class="pf-meta">⏱ ${esc(m.meta)}</div>` : ''}</div>`;
      }).join('') + (state.thinking && (!state.thinkingFor || state.thinkingFor === state.active)
        ? `<div class="pf-msg loading">${state.active === 'general' ? `Consultando ${state.thinking} proveedores en paralelo…` : 'Consultando ' + esc(providerLabel(state.active)) + '…'} <button class="btn sm ghost" data-ia="cancel">Cancelar</button></div>`
        : '');
      Proto.hydrateIcons(msgs);
      msgs.scrollTop = msgs.scrollHeight;
    }

    const hash = (s) => { let h = 0; for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0; return h; };

    function answerFor(pid, q) {
      const list = listOf();
      const ms = 700 + (hash(q + pid) % 1400);
      if (pid === 'nvidia' && !state.proxyOk) return { role: 'error', html: '❌ <b>NVIDIA</b>: falta la URL del Worker proxy (Config → IA → probar 🔎). El resto de proveedores no necesitan proxy.', ms: 300 };
      const a = fakeAnswer(pid, q, list);
      const model = state.model[pid] || (pid === 'chrome' ? 'IA nativa del navegador' : '—');
      return { role: 'assistant', html: a.html, meta: `${pid === 'chrome' ? 'Chrome IA' : providerLabel(pid)} · ${model} · ${(ms / 1000).toFixed(1).replace('.', ',')} s`, ms };
    }

    function send() {
      const q = input.value.trim();
      if (!q || state.thinking) return;
      input.value = '';
      const pid = state.active;
      seedChat(pid);
      state.chats[pid].push({ role: 'user', text: q });
      const targets = pid === 'general' ? PROVIDERS.filter(p => p.id !== 'general' && !state.hidden.has(p.id)).map(p => p.id) : [pid];
      state.thinking = targets.length;
      state.thinkingFor = pid;
      paintMsgs();
      let done = 0;
      targets.forEach(t => {
        const a = answerFor(t, q);
        const t1 = setTimeout(() => {
          state.chats[pid].push({ ...a, label: targetLabel(t) });
          done++; state.thinking = targets.length - done;
          if (state.active === pid) paintMsgs();
        }, a.ms);
        state.timers.push(t1);
      });
    }
    const targetLabel = (t) => providerLabel(t);

    function cancel() {
      state.timers.forEach(clearTimeout); state.timers = [];
      if (state.thinkingFor) {
        state.chats[state.thinkingFor].push({ role: 'error', html: '⏹ Cancelado por el usuario.' });
      }
      state.thinking = 0; state.thinkingFor = null; paintMsgs();
    }

    function openCtx() {
      const list = listOf();
      const sheet = Proto.el(`
        <div class="sheet" data-sheet data-snaps="half,full">
          <div class="sheet-head"><span class="sheet-grab"></span><h2>Contexto enviado al modelo</h2><div class="spacer"></div>
            <button class="iconbtn" data-sheet-close><span data-ico="close"></span></button></div>
          <div class="sheet-body"><pre class="pf-ctx-pre"></pre></div>
        </div>`);
      document.body.appendChild(sheet);
      const stats = PROTO.stats(list, 'diesel');
      $('.pf-ctx-pre', sheet).textContent =
        `Provincia: ${list[0] ? list[0].province : '—'} · ${list.length} estaciones cargadas\n` +
        `Caché: datos de hace 8 min (dataSource: cache)\n` +
        `Top 30 estaciones (id · nombre · diésel):\n` +
        PROTO.sortStations(list, 'price', 'asc', 'diesel').slice(0, 30).map(s => `  [${s.id}] ${s.name} · ${PROTO.money(PROTO.finalPrice(s, 'diesel'), 3)}`).join('\n') +
        `\nFavoritos: ${PROTO.favorites().map(s => s.name).join(', ') || '—'}\n` +
        `Histórico: 14 días · mínimo ${PROTO.money(stats.min, 3)} · media ${PROTO.money(stats.avg, 3)} · máximo ${PROTO.money(stats.max, 3)}`;
      const sh = Proto.sheet(sheet, { snaps: ['half', 'full'], start: 'full', full: .94 });
      sh.open('full');
      Proto.hydrateIcons(sheet);
    }

    host.addEventListener('click', (e) => {
      const tab = e.target.closest('[data-p]');
      if (tab) { state.active = tab.dataset.p; seedChat(state.active); paintTabs(); paintMsgs(); return; }
      const pr = e.target.closest('[data-pr]');
      if (pr) { input.value = pr.dataset.pr; send(); return; }
      const act = e.target.closest('[data-ia]');
      if (act) {
        const k = act.dataset.ia;
        if (k === 'refresh') {
          const cur = PROVIDERS.find(p => p.id === state.active);
          act.classList.add('on'); setTimeout(() => act.classList.remove('on'), 700);
          Proto.toast(`Catálogo de ${cur.label} actualizado · ${cur.models.length} modelos`, { iconName: 'refresh' });
        }
        if (k === 'ctx') openCtx();
        if (k === 'clear') { state.chats[state.active] = null; seedChat(state.active); paintMsgs(); Proto.toast('Conversación borrada', { iconName: 'trash' }); }
        if (k === 'cancel') cancel();
        return;
      }
      const ed = e.target.closest('[data-edit]');
      if (ed) {
        const i = +ed.dataset.edit;
        const chat = state.chats[state.active];
        const m = chat[i];
        input.value = m.text; input.focus();
        state.chats[state.active] = chat.slice(0, i);
        paintMsgs(); Proto.toast('Mensaje recuperado; se recortó el hilo', { iconName: 'pencil' });
        return;
      }
      const cite = e.target.closest('[data-open]');
      if (cite) opts.onOpenStation?.(cite.dataset.open);
    });
    form.addEventListener('submit', (e) => { e.preventDefault(); send(); });
    modelSel.addEventListener('change', () => { state.model[state.active] = modelSel.value; });

    seedChat('general');
    paintTabs(); paintMsgs();

    return {
      el: host,
      setHidden(ids) {
        state.hidden = new Set(ids.filter(id => id !== 'general'));
        if (state.hidden.has(state.active)) state.active = 'general';
        paintTabs(); paintMsgs();
      },
      get hidden() { return [...state.hidden]; },
    };
  }

  /* === 6. Config — panel completo ====================================== */
  function configPanel(host, opts = {}) {
    injectCss();
    const st = {
      pageSize: opts.pageSize ?? 30,
      logs: { api: PROTO.API_LOG.map(l => ({ ...l })), push: PROTO.PUSH_LOG.map(l => ({ ...l })) },
      push: { down: true, up: false, every: 8, days: 3, enabled: true },
      keysLoaded: false,
    };
    const now = () => { const d = new Date(); const p = (n) => String(n).padStart(2, '0'); return `${p(d.getDate())}/${p(d.getMonth() + 1)}/${String(d.getFullYear()).slice(2)} ${d.toLocaleTimeString('es-ES', { hour12: false })}`; };

    const brandRows = () => Object.keys(PROTO.BRANDS);

    function section(id, title) { return `<section class="pf-sec" data-sec="${id}"><h3>${title}</h3><div class="pf-sec-body"></div></section>`; }

    host.innerHTML = `<div class="pf-cfg">
      ${section('disc', 'Descuentos por marca')}
      ${section('cache', 'Caché de datos')}
      ${section('paging', 'Paginación')}
      ${section('logs', 'Registro de actividad')}
      ${section('push', 'Notificaciones push')}
      ${section('keys', 'Claves API de IA')}
      ${section('iatabs', 'Pestañas de IA')}
      ${section('update', 'Actualización de la app')}
    </div>`;
    const sec = (id) => $(`[data-sec="${id}"] .pf-sec-body`, host);

    /* --- 1. Descuentos --- */
    function paintDisc() {
      sec('disc').innerHTML = brandRows().map(b => {
        const m = PROTO.brandMeta(b);
        return `<div class="field-row"><div><div class="fr-label">${esc(b)}</div><div class="fr-hint">${esc(m.program || 'Sin programa')} · afecta a precio, KPIs y avisos</div></div>
          <span class="row" style="gap:8px"><input class="range" type="range" min="0" max="20" value="${m.discount}" data-disc="${esc(b)}" style="width:120px"><b class="num" data-discval="${esc(b)}">${m.discount} ¢</b></span></div>`;
      }).join('') + `<p class="tiny dim mt2">Los descuentos se restan al precio oficial y se aplican en toda la app.</p>`;
    }
    sec('disc').addEventListener('input', (e) => {
      const r = e.target.closest('[data-disc]'); if (!r) return;
      const b = r.dataset.disc, v = +r.value;
      PROTO.brandMeta(b).discount = v;
      $(`[data-discval="${b}"]`, host).textContent = v + ' ¢';
      opts.onDiscounts?.(b, v);
    });
    sec('disc').addEventListener('change', (e) => { if (e.target.closest('[data-disc]')) Proto.toast('Descuento aplicado · precios recalculados', { iconName: 'percent' }); });

    /* --- 2. Caché --- */
    let cacheTab = 'idb';
    function paintCache() {
      const idbRows = [
        ['prov_Madrid', '11 estaciones', 'caduca en 22 min'],
        ['prov_Zaragoza', '5 estaciones', 'caduca en 41 min'],
        ['prov_Valencia', '5 estaciones', 'caduca en 18 min'],
        ['prov_Barcelona', '3 estaciones', 'caduca en 55 min'],
        ['hist_28_13-10-2026…', '21 días · 486 series', 'permanente'],
      ];
      const lsRows = [
        ['gasolineras_state', '0,4 KB'], ['gasolineras_prov_filters_Madrid', '1,1 KB'],
        ['gasolineras_ai_last_models', '0,2 KB'], ['gasolineras_ai_chat_groq', '3,8 KB'],
        ['gasolineras_api_log', '1,9 KB'], ['gasolineras_push_log', '1,2 KB'],
        ['gasolineras_ai_hidden_providers', '0,1 KB'],
      ];
      sec('cache').innerHTML = `
        <div class="segmented mb3" data-ctab><button data-val="idb" class="${cacheTab === 'idb' ? 'on' : ''}">IndexedDB</button><button data-val="ls" class="${cacheTab === 'ls' ? 'on' : ''}">localStorage</button></div>
        <div class="pf-cache-list">${(cacheTab === 'idb' ? idbRows : lsRows).map(([k, sub]) => `
          <div class="row-item"><div class="ri-main"><div class="ri-title">${esc(k)}</div><div class="ri-sub">${esc(sub)}</div></div>
          <button class="iconbtn sm" data-cache-x="${esc(k)}" title="Borrar"><span data-ico="close" class="ico sm"></span></button></div>`).join('') || '<p class="tiny dim">Caché vacía.</p>'}</div>
        <div class="row mt3" style="gap:8px"><button class="btn sm soft" data-cache-clear>Limpiar ${cacheTab === 'idb' ? 'IndexedDB' : 'localStorage'}</button><span class="tiny dim">TTL 12 h · renovación automática</span></div>`;
      Proto.hydrateIcons(sec('cache'));
    }
    sec('cache').addEventListener('click', (e) => {
      const tb = e.target.closest('[data-ctab] button');
      if (tb) { cacheTab = tb.dataset.val; paintCache(); return; }
      const x = e.target.closest('[data-cache-x]');
      if (x) { x.closest('.row-item').remove(); Proto.toast('Clave borrada: ' + x.dataset.cacheX, { iconName: 'trash' }); return; }
      if (e.target.closest('[data-cache-clear]')) { paintCache(); $('.pf-cache-list', host).innerHTML = '<p class="tiny dim">Caché vacía.</p>'; Proto.toast('Caché limpiada', { iconName: 'trash' }); }
    });

    /* --- 3. Paginación --- */
    function paintPaging() {
      sec('paging').innerHTML = `<div class="chips wrap">${PAGE_SIZES.map(n => `<button class="chip ${n === st.pageSize ? 'on' : ''}" data-psize="${n}">${n || 'Todas'}</button>`).join('')}</div>
        <p class="tiny dim mt2">Resultados por página en las vistas de lista y tabla.</p>`;
    }
    sec('paging').addEventListener('click', (e) => {
      const b = e.target.closest('[data-psize]'); if (!b) return;
      st.pageSize = +b.dataset.psize; paintPaging();
      opts.onPageSize?.(st.pageSize);
      Proto.toast('Paginación: ' + (st.pageSize || 'Todas'), { iconName: 'list' });
    });

    /* --- 4. Logs --- */
    let logTab = 'api';
    function paintLogs() {
      const rows = logTab === 'api'
        ? st.logs.api.map(l => `<div class="pf-kv"><span class="truncate" style="max-width:58%">${esc('16/10/26 ' + l.time)} · ${esc(l.method)}</span><span><span class="badge ${l.status === '200' ? 'ok' : ''}">${esc(l.status)}</span> <span class="muted">${esc(l.ms)}</span></span></div>`).join('')
        : st.logs.push.map(l => `<div class="pf-kv"><span class="truncate" style="max-width:76%">${esc(l.text)}</span><span class="muted tiny">${esc(l.time)}</span></div>`).join('');
      sec('logs').innerHTML = `
        <div class="row between mb3"><div class="segmented" data-ltab><button data-val="api" class="${logTab === 'api' ? 'on' : ''}">API</button><button data-val="push" class="${logTab === 'push' ? 'on' : ''}">Push</button></div>
        <button class="btn sm ghost" data-log-clear>Limpiar</button></div>
        <div class="pf-log-list">${rows || '<p class="tiny dim">Sin entradas.</p>'}</div>`;
    }
    sec('logs').addEventListener('click', (e) => {
      const tb = e.target.closest('[data-ltab] button');
      if (tb) { logTab = tb.dataset.val; paintLogs(); return; }
      if (e.target.closest('[data-log-clear]')) { st.logs[logTab] = []; paintLogs(); Proto.toast('Registro ' + logTab.toUpperCase() + ' vaciado', { iconName: 'trash' }); }
    });

    /* --- 5. Push --- */
    function paintPush() {
      sec('push').innerHTML = `
        <label class="field-row"><div><div class="fr-label">Bajada de precio</div><div class="fr-hint">Avisa si tu favorita baja ${st.push.days} ¢ en el periodo</div></div>
          <span class="switch"><input type="checkbox" data-push="down" ${st.push.down ? 'checked' : ''}><span class="track"></span></span></label>
        <label class="field-row"><div><div class="fr-label">Subida de precio</div><div class="fr-hint">Aviso preventivo antes de repostar</div></div>
          <span class="switch"><input type="checkbox" data-push="up" ${st.push.up ? 'checked' : ''}><span class="track"></span></span></label>
        <div class="field-row"><div class="fr-label">Revisar cada</div><span class="stepper"><button data-pushstep="every-">−</button><span class="val" data-pushval="every">${st.push.every} h</span><button data-pushstep="every+">+</button></span></div>
        <div class="field-row"><div class="fr-label">Ventana de días</div><span class="stepper"><button data-pushstep="days-">−</button><span class="val" data-pushval="days">${st.push.days}</span><button data-pushstep="days+">+</button></span></div>
        <button class="btn soft block mt3" data-push-test><span data-ico="bell" class="ico sm"></span>Enviar notificación de prueba</button>`;
      Proto.hydrateIcons(sec('push'));
    }
    sec('push').addEventListener('change', (e) => {
      const c = e.target.closest('[data-push]'); if (!c) return;
      st.push[c.dataset.push] = c.checked;
      Proto.toast(c.checked ? 'Aviso activado' : 'Aviso desactivado', { iconName: 'bell' });
    });
    sec('push').addEventListener('click', (e) => {
      const b = e.target.closest('[data-pushstep]');
      if (b) {
        const [k, dir] = [b.dataset.pushstep.slice(0, -1), b.dataset.pushstep.slice(-1)];
        st.push[k] = Math.max(k === 'every' ? 1 : 0, Math.min(k === 'every' ? 24 : 90, st.push[k] + (dir === '+' ? 1 : -1)));
        $(`[data-pushval="${k}"]`, host).textContent = st.push[k] + (k === 'every' ? ' h' : '');
        return;
      }
      if (e.target.closest('[data-push-test]')) {
        st.logs.push.unshift({ time: now(), text: '🔔 Notificación de prueba enviada' });
        if (logTab === 'push') paintLogs();
        Proto.toast('Notificación de prueba enviada', { iconName: 'bell' });
        opts.onTestPush?.();
      }
    });

    /* --- 6. Claves IA --- */
    function paintKeys() {
      sec('keys').innerHTML = st.keysLoaded
        ? `<div class="row wrap" style="gap:6px">
             ${['Google Gemini', 'Groq', 'Mistral', 'OpenRouter'].map(p => `<span class="badge ok">${p} ✓</span>`).join('')}
             <span class="badge warn">LLM7.io (opcional)</span>
             <span class="badge brand">NVIDIA · Worker, sin clave</span>
             <span class="badge">Chrome IA · nativa</span>
           </div>
           <p class="tiny dim mt3">Claves descifradas con la contraseña maestra. NVIDIA no guarda clave: usa el proxy <code>workers/nvidia-proxy.js</code>.</p>
           <button class="btn sm ghost mt2" data-keys-reset>Volver a cargar</button>`
        : `<div class="field-row"><div><div class="fr-label">Contraseña maestra</div><div class="fr-hint">6 caracteres · cifra las claves de los proveedores</div></div>
             <span class="row" style="gap:6px"><input class="input" type="password" maxlength="6" data-keys-pass placeholder="••••••" style="width:96px;min-height:38px;padding:0 10px;border:1px solid var(--line);border-radius:var(--r-sm);background:var(--bg-2)">
             <button class="btn sm primary" data-keys-load>Cargar claves</button></span></div>
           <p class="err tiny" data-keys-err style="color:var(--bad);display:none">Contraseña incorrecta o formato de clave inválido.</p>`;
    }
    sec('keys').addEventListener('click', (e) => {
      if (e.target.closest('[data-keys-load]')) {
        const v = ($('[data-keys-pass]', host) || {}).value || '';
        if (v.length === 6) { st.keysLoaded = true; paintKeys(); Proto.toast('Claves cargadas y descifradas', { iconName: 'key' }); }
        else { $('[data-keys-err]', host).style.display = ''; Proto.toast('La contraseña debe tener 6 caracteres', { iconName: 'alert' }); }
        return;
      }
      if (e.target.closest('[data-keys-reset]')) { st.keysLoaded = false; paintKeys(); }
    });

    /* --- 7. Pestañas IA --- */
    function paintIaTabs() {
      const hidden = new Set(opts.getHiddenIa ? opts.getHiddenIa() : []);
      sec('iatabs').innerHTML = PROVIDERS.filter(p => p.id !== 'general').map(p => `
        <label class="field-row"><span class="fr-label">${esc(p.label)}</span>
        <span class="switch"><input type="checkbox" data-iatab="${p.id}" ${hidden.has(p.id) ? '' : 'checked'}><span class="track"></span></span></label>`).join('') +
        `<p class="tiny dim mt2">Siempre debe quedar al menos una pestaña visible.</p>`;
    }
    sec('iatabs').addEventListener('change', (e) => {
      const c = e.target.closest('[data-iatab]'); if (!c) return;
      let hidden = new Set(opts.getHiddenIa ? opts.getHiddenIa() : []);
      if (c.checked) hidden.delete(c.dataset.iatab); else hidden.add(c.dataset.iatab);
      const total = PROVIDERS.length - 1;
      if (hidden.size >= total) { hidden.delete(c.dataset.iatab); c.checked = true; Proto.toast('Debe quedar al menos una pestaña visible', { iconName: 'alert' }); }
      opts.onIaTabs?.([...hidden]);
      paintIaTabs();
    });

    /* --- 8. Actualización --- */
    function paintUpdate() {
      sec('update').innerHTML = `<div class="pf-kv"><span>Versión instalada</span><b>1.42.0</b></div>
        <div class="pf-kv"><span>Build</span><span class="muted">20261016-0930 (APP_VERSION 42)</span></div>
        <button class="btn primary block mt3" data-up-check><span data-ico="refresh" class="ico sm"></span>Comprobar actualizaciones</button>
        <p class="tiny dim mt2" data-up-hint>El service worker precachea los assets y recarga sola al detectar una versión nueva.</p>`;
      Proto.hydrateIcons(sec('update'));
    }
    sec('update').addEventListener('click', (e) => {
      if (!e.target.closest('[data-up-check]')) return;
      $('[data-up-hint]', host).textContent = 'Comprobando…';
      setTimeout(() => { $('[data-up-hint]', host).textContent = 'Estás al día: 1.42.0 · build 20261016-0930'; Proto.toast('Estás al día', { iconName: 'check' }); }, 900);
    });

    paintDisc(); paintCache(); paintPaging(); paintLogs(); paintPush(); paintKeys(); paintIaTabs(); paintUpdate();
    return { el: host, pageSize: () => st.pageSize };
  }

  return { injectCss, MAP_STYLES, mapStyleSelect, pager, legend, empty, overlay, explorer, iaPanel, configPanel, PROVIDERS };
})();
