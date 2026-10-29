/* ============================================================================
   ProtoMap — mapa sintético 100 % offline
   ----------------------------------------------------------------------------
   Genera teselas SVG (calles, manzanas, parques, río, rondas y etiquetas) con
   una semilla fija, proyecta las gasolineras reales del dataset y las dibuja
   como píldoras con el precio. Soporta pan, zoom, clústeres, radio de
   distancia, ubicación del usuario y selección.
   No usa red ni Leaflet: el objetivo es validar la interfaz, no los tiles.
   ========================================================================== */
const ProtoMap = (() => {
  'use strict';

  const KM_PER_DEG_LAT = 110.57;

  function hash(s) { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }
  function rng(a) { return function () { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }

  /* --- Generación de la ciudad ----------------------------------------- */
  function buildSvg(seedStr, size) {
    const rnd = rng(hash(seedStr));
    const half = size / 2;
    const outer = size * 2.6;
    const step = 108;
    const parts = [];

    /* extrarradio (campo) y mancha urbana */
    parts.push(`<rect x="${-outer / 2}" y="${-outer / 2}" width="${outer}" height="${outer}" fill="var(--map-field)"/>`);
    for (let i = 0; i < 26; i++) {
      const w = 260 + rnd() * 420, h = 200 + rnd() * 380;
      const x = -outer / 2 + rnd() * (outer - w), y = -outer / 2 + rnd() * (outer - h);
      if (Math.hypot(x + w / 2, y + h / 2) < half * 1.05) continue;
      parts.push(`<rect x="${x.toFixed(0)}" y="${y.toFixed(0)}" width="${w.toFixed(0)}" height="${h.toFixed(0)}" rx="20" fill="var(--map-field-2)" opacity=".7"/>`);
    }
    parts.push(`<rect x="${-half}" y="${-half}" width="${size}" height="${size}" rx="${half * 0.42}" fill="var(--map-road-2)"/>`);

    /* manzanas: rejilla girada con huecos aleatorios y plazas */
    const cells = [];
    for (let gx = -half - 200; gx < half + 200; gx += step) {
      for (let gy = -half - 200; gy < half + 200; gy += step) {
        const d = Math.hypot(gx, gy) / half;
        if (d > 0.92) continue;
        const r = rnd();
        if (r < 0.05) continue;                                  // plaza / hueco
        const inset = 3 + rnd() * 7;
        const w = step - inset * 2, h = step - inset * 1.6;
        const tall = rnd() < 0.12;                               // edificio grande
        cells.push(`<rect x="${(gx + inset).toFixed(1)}" y="${(gy + inset).toFixed(1)}" width="${(tall ? w + 26 : w).toFixed(1)}" height="${h.toFixed(1)}" rx="${(1 + rnd() * 3).toFixed(1)}" fill="var(--map-block)"${tall ? ' opacity=".75"' : ''}/>`);
      }
    }
    parts.push(`<g opacity=".96" transform="rotate(-13)">${cells.join('')}</g>`);

    /* parques */
    const parks = [[-320, 220, 300, 210], [420, -260, 240, 260], [-620, -420, 190, 150], [180, 520, 260, 170], [660, 480, 150, 120]];
    parks.forEach(([x, y, w, h]) => {
      parts.push(`<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${Math.min(w, h) / 3}" fill="var(--map-park)" opacity=".92"/>`);
    });
    parts.push(`<ellipse cx="-140" cy="-560" rx="140" ry="90" fill="var(--map-park)" opacity=".85"/>`);

    /* río */
    const river = `M ${-half} ${120} C ${-900} ${200}, ${-520} ${-40}, ${-240} ${-90} S ${260} ${-40}, ${520} ${60} S ${1100} ${240}, ${half} ${180}`;
    parts.push(`<path d="${river}" fill="none" stroke="var(--map-water)" stroke-width="52" stroke-linecap="round" opacity=".95"/>`);
    parts.push(`<ellipse cx="700" cy="-620" rx="120" ry="80" fill="var(--map-water)" opacity=".9"/>`);

    /* rondas y autovías */
    const ring = `M 0 -900 A 900 900 0 1 1 -1 -900`;
    parts.push(`<path d="${ring}" fill="none" stroke="var(--map-casing)" stroke-width="20"/>`);
    parts.push(`<path d="${ring}" fill="none" stroke="#f6c98a" stroke-width="14"/>`);
    const roads = [
      [`M ${-half} -140 L ${half} 60`, 15],
      [`M ${-260} ${-half} L ${180} ${half}`, 14],
      [`M ${-half} 420 L ${half} 300`, 11],
      [`M ${-half} -520 L ${half} -400`, 11],
      [`M ${520} ${-half} L ${300} ${half}`, 12],
      [`M ${-520} ${-half} L ${-380} ${half}`, 10],
      [`M ${-half} ${-half} L 320 -140`, 12],
      [`M ${half} ${-half} L -220 470`, 11],
    ];
    roads.forEach(([d, w]) => {
      parts.push(`<path d="${d}" fill="none" stroke="var(--map-casing)" stroke-width="${w + 5}" stroke-linecap="round"/>`);
      parts.push(`<path d="${d}" fill="none" stroke="var(--map-road)" stroke-width="${w}" stroke-linecap="round"/>`);
    });
    /* Las avenidas siguen el mismo giro que la trama urbana */
    parts.splice(parts.length - roads.length * 2, 0, '<g transform="rotate(-13)">');
    parts.push('</g>');

    /* etiquetas de zona (se pintan como capa HTML para que no escalen con el SVG) */
    const labels = [
      ['CENTRO', 0, 40], ['CHAMBERÍ', -260, -180], ['SALAMANCA', 300, -120],
      ['RETIRO', 430, 240], ['LA LATINA', -140, 300], ['TETUÁN', -120, -520],
      ['ARGANZUELA', 260, 470], ['M-30', 300, -860], ['A-2', 700, -300], ['M-30', -840, 300],
    ];

    return { svg: parts.join(''), labels, half };
  }

  /* --- Instancia -------------------------------------------------------- */
  function create(host, opts = {}) {
    const stations = opts.stations || PROTO.STATIONS;
    const user = opts.showUser === false ? null : (opts.user || PROTO.USER);
    const center = opts.center || { lat: user ? user.lat : 40.42, lng: user ? user.lng : -3.70 };
    const worldSize = 4400;
    const { svg, labels } = buildSvg(opts.seed || 'madrid-28', worldSize);
    const pxPerKm0 = 26;                                     // escala base: 26 px por km
    const kmLon = 111.32 * Math.cos(center.lat * Math.PI / 180);

    host.classList.add('pm');
    /* OJO: .pm-canvas va transformado (pan/zoom), así que la capa de marcadores
       y la de controles van FUERA: sus posiciones son coordenadas de pantalla. */
    host.innerHTML = `
      <div class="pm-canvas">
        <svg class="pm-svg" width="${worldSize}" height="${worldSize}" viewBox="${-worldSize / 2} ${-worldSize / 2} ${worldSize} ${worldSize}">${svg}</svg>
        ${labels.map(l => `<div class="pm-label" style="left:${l[1]}px;top:${l[2]}px">${l[0]}</div>`).join('')}
      </div>
      <div class="pm-markers"></div>
      <div class="pm-ctrl">
        <button class="iconbtn" data-pm="in" title="Acercar">${Proto.icon('plus')}</button>
        <button class="iconbtn" data-pm="out" title="Alejar">${Proto.icon('minus')}</button>
        <button class="iconbtn" data-pm="where" title="Mi ubicación">${Proto.icon('crosshair')}</button>
        ${opts.showLayers ? `<button class="iconbtn" data-pm="layers" title="Capas">${Proto.icon('layers')}</button>` : ''}
      </div>
      <div class="pm-scale"><span class="bar"></span><span class="pm-scale-txt">1 km</span></div>
      <div class="pm-attrib">© Prototipo · datos simulados</div>`;

    const canvas = host.querySelector('.pm-canvas');
    const svgEl = host.querySelector('.pm-svg');
    const markerLayer = host.querySelector('.pm-markers');
    /* El SVG se posiciona con su esquina superior izquierda en (0,0) del mundo */
    svgEl.style.left = (-worldSize / 2) + 'px';
    svgEl.style.top = (-worldSize / 2) + 'px';
    svgEl.style.position = 'absolute';

    let z = opts.zoom || 1;
    let tx = 0, ty = 0;                                      // traslación en px de pantalla
    let radiusKm = opts.radiusKm || 0;
    let selected = null;
    let visible = stations.slice();
    const listeners = { marker: [], move: [] };

    const project = (lat, lng) => ({
      x: (lng - center.lng) * kmLon * pxPerKm0,
      y: -(lat - center.lat) * KM_PER_DEG_LAT * pxPerKm0,
    });
    const screenOf = (lat, lng) => {
      const p = project(lat, lng);
      return { x: p.x * z + tx + host.clientWidth / 2, y: p.y * z + ty + host.clientHeight / 2 };
    };

    function applyTransform() {
      canvas.style.transform = `translate(${tx + host.clientWidth / 2}px, ${ty + host.clientHeight / 2}px) scale(${z})`;
      const txt = host.querySelector('.pm-scale-txt');
      if (txt) { const km = 40 / (pxPerKm0 * z); txt.textContent = km >= 1 ? km.toFixed(0) + ' km' : (km * 1000).toFixed(0) + ' m'; }
      renderMarkers();
      listeners.move.forEach(f => f({ z, tx, ty }));
    }

    /* --- Marcadores --------------------------------------------------- */
    function renderMarkers() {
      const W = host.clientWidth, H = host.clientHeight;
      const items = visible.map(st => {
        const s = screenOf(st.lat, st.lng);
        return { st, s, price: PROTO.finalPrice(st, opts.fuel || 'g95') };
      }).filter(i => i.s.x > -80 && i.s.x < W + 80 && i.s.y > -60 && i.s.y < H + 60);

      const stats = opts.stats || PROTO.stats(visible, opts.fuel || 'g95');
      /* Clústeres por distancia (disco de 46 px), no por rejilla: agrupar por
         celdas dejaba pines de celdas vecinas asomando bajo el círculo. */
      const R = 46, usedIds = new Set(), groups = [];
      items
        .slice()
        .sort((a, b) => (a.price ?? 9) - (b.price ?? 9))
        .forEach(i => {
          if (usedIds.has(i.st.id) || i.st.id === selected) return;
          const near = items.filter(j => !usedIds.has(j.st.id) && Math.hypot(j.s.x - i.s.x, j.s.y - i.s.y) <= R);
          if (near.length < 3 || near.some(j => j.st.id === selected)) return;
          near.forEach(j => usedIds.add(j.st.id));
          groups.push(near);
        });

      const html = [];
      groups.forEach(list => {
        const cx = list.reduce((a, i) => a + i.s.x, 0) / list.length;
        const cy = list.reduce((a, i) => a + i.s.y, 0) / list.length;
        const d = (34 + Math.min(list.length, 12) * 2.4).toFixed(0);
        html.push(`<button class="pm-cluster" style="left:${cx.toFixed(1)}px;top:${cy.toFixed(1)}px;width:${d}px;height:${d}px;z-index:${8 + list.length}" data-cluster="${list.map(i => i.st.id).join(',')}">${list.length}</button>`);
      });
      items.forEach(({ st, s, price }) => {
        if (usedIds.has(st.id)) return;
        const lvl = stats ? PROTO.level(price, stats.lo, stats.hi) : 'mid';
        html.push(`<button class="pm-marker ${lvl} ${st.fav ? 'fav' : ''} ${st.id === selected ? 'on' : ''}" style="left:${s.x.toFixed(1)}px;top:${s.y.toFixed(1)}px" data-id="${st.id}" aria-label="${Proto.esc(st.name)} ${price != null ? PROTO.money(price, 3) : ''}">
          <span class="pm-pin"><span class="pm-dot"></span>${price != null ? price.toFixed(3).replace('.', ',') : '—'}</span></button>`);
      });

      /* usuario, radio y punto seleccionado */
      if (user) {
        const u = screenOf(user.lat, user.lng);
        if (radiusKm) html.push(`<div class="pm-radius" style="left:${u.x.toFixed(1)}px;top:${u.y.toFixed(1)}px;width:${(radiusKm * pxPerKm0 * z * 2).toFixed(0)}px;height:${(radiusKm * pxPerKm0 * z * 2).toFixed(0)}px"></div>`);
        html.push(`<div class="pm-user" style="left:${u.x.toFixed(1)}px;top:${u.y.toFixed(1)}px"><span class="pulse"></span><span class="core"></span></div>`);
      }
      markerLayer.innerHTML = html.join('');
    }

    /* --- Interacción -------------------------------------------------- */
    let dragging = false, moved = false, sx = 0, sy = 0, stx = 0, sty = 0;
    host.addEventListener('pointerdown', (e) => {
      if (e.target.closest('.pm-ctrl') || e.target.closest('.pm-marker') || e.target.closest('.pm-cluster')) return;
      dragging = true; moved = false;
      sx = e.clientX; sy = e.clientY; stx = tx; sty = ty;
      host.classList.add('grabbing');
      host.setPointerCapture?.(e.pointerId);
    });
    host.addEventListener('pointermove', (e) => {
      if (!dragging) return;
      tx = stx + (e.clientX - sx); ty = sty + (e.clientY - sy);
      if (Math.abs(e.clientX - sx) + Math.abs(e.clientY - sy) > 4) moved = true;
      clampPan(); applyTransform();
    });
    const endPan = () => { dragging = false; host.classList.remove('grabbing'); };
    host.addEventListener('pointerup', endPan);
    host.addEventListener('pointercancel', endPan);
    host.addEventListener('click', (e) => {
      if (moved) return;
      const m = e.target.closest('.pm-marker');
      if (m) { select(m.dataset.id, { fromClick: true }); return; }
      const c = e.target.closest('.pm-cluster');
      if (c) {
        const ids = c.dataset.cluster.split(',');
        const list = ids.map(id => stations.find(s => s.id === id)).filter(Boolean);
        const lat = list.reduce((a, s) => a + s.lat, 0) / list.length;
        const lng = list.reduce((a, s) => a + s.lng, 0) / list.length;
        zoomTo(z * 1.9, lat, lng);
        return;
      }
      const ctrl = e.target.closest('[data-pm]');
      if (ctrl) {
        if (ctrl.dataset.pm === 'in') zoomTo(z * 1.4);
        if (ctrl.dataset.pm === 'out') zoomTo(z / 1.4);
        if (ctrl.dataset.pm === 'where') { if (user) zoomTo(Math.max(z, 1.6), user.lat, user.lng); }
        if (ctrl.dataset.pm === 'layers') listeners.layers?.forEach(f => f());
        return;
      }
      opts.onBackground && opts.onBackground();
    });
    host.addEventListener('wheel', (e) => {
      e.preventDefault();
      const f = Math.exp(-e.deltaY * 0.0016);
      z = Math.min(8, Math.max(0.35, z * f));
      clampPan(); applyTransform();
    }, { passive: false });

    /* doble toque = acercar */
    let lastTap = 0;
    host.addEventListener('pointerup', (e) => {
      if (moved || e.pointerType === 'mouse') return;
      const now = Date.now();
      if (now - lastTap < 320) { zoomTo(z * 1.6); }
      lastTap = now;
    });

    function clampPan() {
      const lim = (worldSize / 2) * z;
      tx = Math.max(-lim + 60, Math.min(lim - 60, tx));
      ty = Math.max(-lim + 60, Math.min(lim - 60, ty));
    }
    function zoomTo(nz, lat, lng) {
      if (!host.clientWidth || !host.clientHeight) { pendingView = () => zoomTo(nz, lat, lng); return; }
      nz = Math.min(8, Math.max(0.35, nz));
      if (lat != null) {
        const p = project(lat, lng);
        tx = -p.x * nz; ty = -p.y * nz;
        z = nz; clampPan();
      } else { z = nz; clampPan(); }
      applyTransform();
    }
    function select(id, { fromClick, pan } = {}) {
      selected = id;
      if (id && pan !== false) {
        const st = stations.find(s => s.id === id);
        if (st) { const s = screenOf(st.lat, st.lng); if (s.x < 40 || s.x > host.clientWidth - 40 || s.y < 90 || s.y > host.clientHeight - 90) zoomTo(Math.max(z, 1.5), st.lat, st.lng); }
      }
      renderMarkers();
      if (id && fromClick) listeners.marker.forEach(f => f(id));
    }

    /* --- Arranque ----------------------------------------------------- */
    /* El mapa puede estar dentro de una pestaña oculta (0×0 px): no se puede
       medir hasta que se muestre. Guardamos la vista pendiente y la aplicamos
       en cuanto el contenedor tenga tamaño. */
    let pendingView = () => {
      if (opts.fit === 'stations') fit(visible, { padding: opts.padding ?? 46 });
      else zoomTo(opts.zoom || 1.35, center.lat, center.lng);
    };
    function runPending() {
      if (!pendingView || !host.clientWidth || !host.clientHeight) return;
      const fn = pendingView; pendingView = null; fn();
    }
    if (window.ResizeObserver) new ResizeObserver(() => { pendingView ? runPending() : applyTransform(); }).observe(host);
    else window.addEventListener('resize', () => { pendingView ? runPending() : applyTransform(); });
    requestAnimationFrame(runPending);

    function fit(list, { padding = 40 } = {}) {
      if (!host.clientWidth || !host.clientHeight) { pendingView = () => fit(list, { padding }); return; }
      const L = (list && list.length ? list : stations);
      const pts = L.map(s => project(s.lat, s.lng));
      const xs = pts.map(p => p.x), ys = pts.map(p => p.y);
      const minX = Math.min(...xs), maxX = Math.max(...xs), minY = Math.min(...ys), maxY = Math.max(...ys);
      const W = host.clientWidth - padding * 2, H = host.clientHeight - padding * 2;
      const spanX = Math.max(maxX - minX, 2), spanY = Math.max(maxY - minY, 2);
      z = Math.min(6, Math.max(0.4, Math.min(W / spanX, H / spanY)));
      const cx = (minX + maxX) / 2, cy = (minY + maxY) / 2;
      tx = -cx * z; ty = -cy * z;
      clampPan(); applyTransform();
    }

    return {
      focus(id) { select(id, { pan: true }); },
      select,
      fit,
      setStations(list) { visible = list.slice(); renderMarkers(); },
      setRadius(km) { radiusKm = km || 0; renderMarkers(); },
      zoomTo,
      get zoom() { return z; },
      on(evt, fn) { (listeners[evt] = listeners[evt] || []).push(fn); },
      get selected() { return selected; },
      screenOf,
      host,
    };
  }

  return { create };
})();
