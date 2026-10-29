/* =============================================================
   Utilidades compartidas de los prototipos. window.UI
   - mapaFake(): mapa dibujado con SVG (sin tiles ni red)
   - grafica(): gráfica de evolución en SVG
   - marcoMovil / ajustarMarco: previsualización en la galería
   ============================================================= */
(function () {
  'use strict';

  // --- Formato precio (es) ---
  function fmtPrecio(v) {
    return v.toFixed(3).replace('.', ',') + ' €';
  }
  function fmtDist(km) {
    return km < 1 ? Math.round(km * 1000) + ' m' : km.toFixed(1).replace('.', ',') + ' km';
  }

  // --- Color semáforo por precio (verde < naranja < rojo, percentiles) ---
  function colorPrecio(v, min, max) {
    if (v == null) return '#9aa0a6';
    const mid = min + (max - min) / 2;
    if (v <= min + (mid - min) * 0.6) return 'var(--barata, #1e8e3e)';
    if (v >= max - (max - mid) * 0.6) return 'var(--cara, #d93025)';
    return 'var(--media, #f9a825)';
  }

  // --- Mapa fake: SVG con calles + parque + agua, marcadores en % ---
  // opts: { seleccionId, onClick(id), estilo: 'claro'|'oscuro', yo:{x,y} }
  function mapaFake(cont, estaciones, opts) {
    opts = opts || {};
    const oscuro = opts.estilo === 'oscuro';
    cont.classList.add('mf-wrap');
    cont.innerHTML =
      '<svg class="mf-bg" viewBox="0 0 400 500" preserveAspectRatio="xMidYMid slice" aria-hidden="true">' +
      '<rect width="400" height="500" fill="' + (oscuro ? '#17181c' : '#f3efe6') + '"/>' +
      // parque
      '<path d="M0 330 Q 90 300 150 350 T 300 360 L 400 380 L 400 500 L 0 500 Z" fill="' + (oscuro ? '#1c2a1e' : '#d9eadb') + '"/>' +
      // agua
      '<path d="M280 0 Q 250 120 320 220 T 380 420 L 400 460 L 400 0 Z" fill="' + (oscuro ? '#16222c' : '#cfe3ef') + '" opacity="0.9"/>' +
      // retícula de calles
      calles(oscuro) +
      '</svg>' +
      '<div class="mf-markers"></div>' +
      (opts.yo ? '<div class="mf-me" style="left:' + opts.yo.x + '%;top:' + opts.yo.y + '%" title="Tu ubicación"></div>' : '') +
      '<div class="mf-ctrl"><button class="mf-btn mf-in" title="Acercar">＋</button><button class="mf-btn mf-out" title="Alejar">−</button></div>' +
      '<div class="mf-attrib">Prototipo · mapa simulado</div>';

    const mk = cont.querySelector('.mf-markers');
    // marcadores agrupados de forma simple
    estaciones.forEach(function (e) {
      const b = document.createElement('button');
      b.className = 'mf-pin' + (e.id === opts.seleccionId ? ' sel' : '') + (e._fav ? ' fav' : '');
      b.style.left = e.x + '%';
      b.style.top = e.y + '%';
      b.dataset.id = e.id;
      b.innerHTML = '<span class="mf-pin-price">' + fmtPrecio(e._pvp).replace(' €', '') + '</span>';
      b.style.setProperty('--pin', e._color || '#d93025');
      b.title = e.rotulo + ' · ' + e.dir;
      b.addEventListener('click', function (ev) { ev.stopPropagation(); if (opts.onClick) opts.onClick(e.id); });
      mk.appendChild(b);
    });
    cont.querySelector('.mf-in').addEventListener('click', function () { cont.classList.add('mf-zoom'); });
    cont.querySelector('.mf-out').addEventListener('click', function () { cont.classList.remove('mf-zoom'); });
    return cont;
  }

  function calles(oscuro) {
    const c = oscuro ? '#23252b' : '#ffffff';
    const c2 = oscuro ? '#2b2e35' : '#e9e3d6';
    let s = '';
    // vías principales (radial tipo Madrid)
    const principales = [
      'M200 500 L210 0', 'M0 250 L400 240', 'M40 500 L160 0', 'M360 500 L250 0',
      'M0 120 L400 140', 'M0 380 L400 360'
    ];
    principales.forEach(function (d, i) {
      s += '<path d="' + d + '" stroke="' + (i < 2 ? c : c2) + '" stroke-width="' + (i < 2 ? 9 : 6) + '" fill="none"/>';
    });
    // secundarias
    for (let i = 1; i <= 8; i++) {
      const y = i * 58;
      s += '<path d="M0 ' + y + ' L400 ' + (y - 8) + '" stroke="' + c2 + '" stroke-width="3" fill="none"/>';
    }
    for (let i = 1; i <= 7; i++) {
      const x = i * 52;
      s += '<path d="M' + x + ' 0 L' + (x + 12) + ' 500" stroke="' + c2 + '" stroke-width="3" fill="none"/>';
    }
    // manzanas
    for (let i = 0; i < 26; i++) {
      const rx = (i * 73) % 380, ry = (i * 121) % 470;
      s += '<rect x="' + rx + '" y="' + ry + '" width="' + (18 + (i % 4) * 8) + '" height="' + (14 + (i % 3) * 8) + '" rx="2" fill="' + (oscuro ? '#1c1e23' : '#ece6d8') + '" opacity="0.7"/>';
    }
    return s;
  }

  // --- Gráfica SVG de evolución de precio ---
  // serie: [{fechaTxt, precio}], opts: { alto, color, mostrarFechas }
  function grafica(serie, opts) {
    opts = opts || {};
    const W = 600, H = opts.alto || 220, padL = 42, padR = 10, padT = 14, padB = 26;
    if (!serie || !serie.length) return '<div class="g-vacio">Sin datos</div>';
    const precios = serie.map(function (p) { return p.precio; });
    let min = Math.min.apply(null, precios), max = Math.max.apply(null, precios);
    const margen = Math.max(0.005, (max - min) * 0.2);
    min -= margen; max += margen;
    const iw = W - padL - padR, ih = H - padT - padB;
    const color = opts.color || 'var(--acento, #1a73e8)';

    function X(i) { return padL + (serie.length === 1 ? iw / 2 : (i / (serie.length - 1)) * iw); }
    function Y(v) { return padT + ih - ((v - min) / (max - min)) * ih; }

    let line = '', area = '';
    serie.forEach(function (p, i) { line += (i ? ' L' : 'M') + X(i).toFixed(1) + ' ' + Y(p.precio).toFixed(1); });
    area = line + ' L' + X(serie.length - 1).toFixed(1) + ' ' + (padT + ih) + ' L' + X(0).toFixed(1) + ' ' + (padT + ih) + ' Z';

    // rejilla Y (3 líneas)
    let grid = '', ejeY = '';
    for (let g = 0; g <= 2; g++) {
      const v = min + ((max - min) * g) / 2, y = Y(v);
      grid += '<line x1="' + padL + '" y1="' + y.toFixed(1) + '" x2="' + (W - padR) + '" y2="' + y.toFixed(1) + '" class="g-grid"/>';
      ejeY += '<text x="' + (padL - 6) + '" y="' + (y + 3).toFixed(1) + '" text-anchor="end" class="g-lab">' + v.toFixed(3).replace('.', ',') + '</text>';
    }
    // fechas: 4 etiquetas
    let ejeX = '';
    const paso = Math.max(1, Math.floor((serie.length - 1) / 3));
    serie.forEach(function (p, i) {
      if (i % paso === 0 || i === serie.length - 1) {
        ejeX += '<text x="' + X(i).toFixed(1) + '" y="' + (H - 8) + '" text-anchor="middle" class="g-lab">' + p.fechaTxt.slice(0, 5) + '</text>';
      }
    });
    // puntos + hover
    let puntos = '';
    serie.forEach(function (p, i) {
      puntos += '<circle cx="' + X(i).toFixed(1) + '" cy="' + Y(p.precio).toFixed(1) + '" r="' + (i === serie.length - 1 ? 4.5 : 2.5) + '" class="g-dot" style="animation-delay:' + (i * 18) + 'ms"/>';
    });
    const ultimo = serie[serie.length - 1];
    const etiquetaUltimo =
      '<g class="g-tag"><rect x="' + (X(serie.length - 1) - 46) + '" y="' + (Y(ultimo.precio) - 26) + '" width="46" height="18" rx="4"/>' +
      '<text x="' + (X(serie.length - 1) - 23) + '" y="' + (Y(ultimo.precio) - 13) + '" text-anchor="middle">' + ultimo.precio.toFixed(3).replace('.', ',') + '</text></g>';

    return '<svg class="g-svg" viewBox="0 0 ' + W + ' ' + H + '" preserveAspectRatio="none" role="img" aria-label="Evolución del precio">' +
      '<defs><linearGradient id="gGrad" x1="0" y1="0" x2="0" y2="1">' +
      '<stop offset="0%" stop-color="' + color + '" stop-opacity="0.28"/><stop offset="100%" stop-color="' + color + '" stop-opacity="0"/>' +
      '</linearGradient></defs>' +
      grid + '<path d="' + area + '" fill="url(#gGrad)"/>' +
      '<path d="' + line + '" fill="none" stroke="' + color + '" stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round" class="g-line"/>' +
      puntos + etiquetaUltimo + ejeY + ejeX +
      '</svg>';
  }

  // --- Badge de marca (círculo con color) ---
  function badgeMarca(marcaId, tam) {
    const m = window.PETROL.marcador(marcaId);
    const t = tam || 34;
    return '<span class="badge-marca" style="--c:' + m.color + ';width:' + t + 'px;height:' + t + 'px;font-size:' + Math.round(t * 0.42) + 'px">' + m.nombre.slice(0, 2).toUpperCase() + '</span>';
  }

  // --- Toast ---
  function toast(txt, ms) {
    let t = document.querySelector('.proto-toast');
    if (!t) {
      t = document.createElement('div');
      t.className = 'proto-toast';
      document.body.appendChild(t);
    }
    t.textContent = txt;
    t.classList.add('show');
    clearTimeout(t._timer);
    t._timer = setTimeout(function () { t.classList.remove('show'); }, ms || 1800);
  }

  // --- Iconos inline (SVG) para no depender de emoji en一些 sitios ---
  const ICONOS = {
    estrella: '<svg viewBox="0 0 24 24"><path d="M12 2l2.9 6.3 6.9.8-5.1 4.7 1.4 6.8L12 17.3 5.9 20.6l1.4-6.8L2.2 9.1l6.9-.8z"/></svg>',
    campana: '<svg viewBox="0 0 24 24"><path d="M12 22a2.5 2.5 0 0 0 2.4-2h-4.8A2.5 2.5 0 0 0 12 22zm7-6v-5c0-3.2-2.1-5.8-5-6.4V4a2 2 0 1 0-4 0v.6C7.1 5.2 5 7.8 5 11v5l-2 2v1h18v-1z"/></svg>',
    ubicar: '<svg viewBox="0 0 24 24"><path d="M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8zm8.9 3.5-.2-1.7 1.3-1a1 1 0 0 0-.4-1.8l-1.6-.3-.7-1.5 1-1.1a1 1 0 0 0-.5-1.7l-1.6-.5L16.5 2 15 3.1a1 1 0 0 0-.6.1L12.9 2.4a1 1 0 0 0-.8 1V4.5L9.7 5.5 8.4 4.4a1 1 0 0 0-1.5.4L5.5 6.7l-1.6.5a1 1 0 0 0-.5 1.7l1 1.1-.7 1.5-1.6.3a1 1 0 0 0-.4 1.8l1.3 1-.2 1.7a1 1 0 0 0 .6 1.1l1.7.6.4 1.8-1.1 1.1a1 1 0 0 0 .5 1.7l1.7.4.8 1.5-1 1.2a1 1 0 0 0 .5 1.7l1.8.2.9 1.4a1 1 0 0 0 1.7-.3l.9-1.4 1.8-.2a1 1 0 0 0 .5-1.7l-1-1.2.8-1.5 1.7-.4a1 1 0 0 0 .5-1.7L19 20l.4-1.8 1.7-.6a1 1 0 0 0 .8-1.1z" fill="none" stroke="currentColor" stroke-width="1.6"/></svg>',
    filtro: '<svg viewBox="0 0 24 24"><path d="M3 5h18l-7 8v6l-4 2v-8z" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/></svg>',
    lupa: '<svg viewBox="0 0 24 24"><circle cx="11" cy="11" r="7" fill="none" stroke="currentColor" stroke-width="1.8"/><path d="M20 20l-4-4" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>',
    ajustes: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="3.2" fill="none" stroke="currentColor" stroke-width="1.8"/><path d="M12 2v3m0 14v3M2 12h3m14 0h3M4.9 4.9l2.1 2.1m10 10 2.1 2.1M19.1 4.9 17 7m-10 10-2.1 2.1" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>',
    chat: '<svg viewBox="0 0 24 24"><path d="M4 5h16v11H8l-4 4z" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/></svg>',
    lista: '<svg viewBox="0 0 24 24"><path d="M8 6h13M8 12h13M8 18h13M3.5 6h.01M3.5 12h.01M3.5 18h.01" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>',
    mapa: '<svg viewBox="0 0 24 24"><path d="M9 3 3 5v16l6-2 6 2 6-2V3l-6 2-6-2zm0 0v16m6-14v16" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/></svg>',
    combo: '<svg viewBox="0 0 24 24"><path d="M4 4h7v7H4zM13 4h7v7h-7zM4 13h7v7H4zM13 13h7v7h-7z" fill="none" stroke="currentColor" stroke-width="1.6"/></svg>'
  };
  function icono(nombre, cls) {
    return '<i class="ico ' + (cls || '') + '">' + (ICONOS[nombre] || '') + '</i>';
  }

  // --- Marco de móvil para la galería (?preview=phone) ---
  function esPreviewMovil() {
    return /[?&]preview=phone/.test(location.search);
  }
  function aplicarPreviewMovil() {
    if (!esPreviewMovil()) return;
    document.documentElement.classList.add('preview-phone');
    // contenedor fijo tipo dispositivo
    const w = parseInt((location.search.match(/w=(\d+)/) || [0, 390])[1], 10);
    const h = parseInt((location.search.match(/h=(\d+)/) || [0, 844])[1], 10);
    document.documentElement.style.setProperty('--prev-w', w + 'px');
    document.documentElement.style.setProperty('--prev-h', h + 'px');
  }

  window.UI = {
    fmtPrecio, fmtDist, colorPrecio,
    mapaFake, grafica, badgeMarca, toast, icono,
    esPreviewMovil, aplicarPreviewMovil
  };
})();
