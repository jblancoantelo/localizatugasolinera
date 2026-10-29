/* =============================================================================
 * Prototipo 6 · «Gestos y atajos» — lógica de la maqueta
 * -----------------------------------------------------------------------------
 * Estado en memoria y datos de window.FAKE (../shared/datos-fake.js).
 * Valida una navegación sin chrome:
 *   · Móvil → carril deslizable (Mapa/Lista/Ambos), hoja de lista arrastrable,
 *     swipe en tarjetas, tirar para refrescar, pulsación larga y menú contextual.
 *   · PC    → navegación en cabecera, paleta de comandos (Ctrl/⌘+K) y atajos
 *     (1-5, j/k, f, /, ?, Esc).
 * Script clásico (sin módulos) para funcionar por file://.
 * ========================================================================== */
(function () {
  'use strict';

  var F = window.FAKE;
  var $ = function (sel, raiz) { return (raiz || document).querySelector(sel); };
  var $$ = function (sel, raiz) { return Array.prototype.slice.call((raiz || document).querySelectorAll(sel)); };

  /* =======================================================================
   * 1. Constantes
   * ===================================================================== */
  var DIAS = [7, 14, 21, 30, 60, 90, 180];
  var CARRIL = ['mapa', 'lista', 'ambos'];
  var ALTURAS_HOJA = [0.20, 0.40, 0.68];      /* fracciones del alto de ventana */
  var UMBRAL_BAJO = 1.50, UMBRAL_ALTO = 1.70; /* leyenda y color de marcador   */

  var ICO = {
    mapa: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"><path d="M9 3 3 5v16l6-2 6 2 6-2V3l-6 2-6-2Z"/><path d="M9 3v16M15 5v16"/></svg>',
    lista: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M8 6h13M8 12h13M8 18h13M3.5 6h.01M3.5 12h.01M3.5 18h.01"/></svg>',
    ambos: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="3"/><path d="M12 3v18M3 13h9"/></svg>',
    ia: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M12 3v3M12 18v3M3 12h3M18 12h3M5.6 5.6l2.1 2.1M16.3 16.3l2.1 2.1M18.4 5.6l-2.1 2.1M7.7 16.3l-2.1 2.1"/><circle cx="12" cy="12" r="3.4"/></svg>',
    config: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M4 7h10M18 7h2M4 17h4M12 17h8"/><circle cx="16" cy="7" r="2.2"/><circle cx="10" cy="17" r="2.2"/></svg>'
  };

  var VISTAS = [
    { id: 'mapa', nombre: 'Mapa', ico: ICO.mapa },
    { id: 'lista', nombre: 'Lista', ico: ICO.lista },
    { id: 'ambos', nombre: 'Ambos', ico: ICO.ambos },
    { id: 'ia', nombre: 'IA', ico: ICO.ia },
    { id: 'config', nombre: 'Config', ico: ICO.config }
  ];

  var PROVEEDORES = [
    { id: 'general', nombre: 'General' },
    { id: 'groq', nombre: 'Groq' },
    { id: 'mistral', nombre: 'Mistral' },
    { id: 'openrouter', nombre: 'OpenRouter' },
    { id: 'llm7', nombre: 'LLM7.io' },
    { id: 'nvidia', nombre: 'NVIDIA' },
    { id: 'google', nombre: 'Google Gemini' },
    { id: 'chrome-nano', nombre: 'Chrome' }
  ];
  var MODELOS = {
    groq: ['qwen/qwen3.8-27b', 'openai/gpt-oss-20b', 'allam-2-7b'],
    mistral: ['open-mistral-nemo', 'ministral-8b-latest', 'codestral-latest'],
    openrouter: ['nvidia/nemotron-3-ultra-550b-a55b:free', 'nvidia/nemotron-3-super-120b-a12b:free'],
    llm7: ['codestral-latest', 'GLM-5.3-Flash', 'minimax-m2.7'],
    nvidia: ['nvidia/nemotron-3-ultra-550b-a55b', 'z-ai/glm-5.3'],
    google: ['gemini-3.8-flash', 'gemini-3.5-flash'],
    'chrome-nano': ['Integrada en el navegador']
  };

  /* Color de marcador: relleno (borde y fondo .sel) y texto oscuro sobre blanco.
     Elegidos para pasar AA (≥4.5:1) con texto blanco encima en estado .sel. */
  var MK = {
    verde:   { bg: '#15793f', txt: '#146b3c' },
    naranja: { bg: '#8a5200', txt: '#8a5200' },
    rojo:    { bg: '#c0392b', txt: '#a3271b' },
    gris:    { bg: '#66727e', txt: '#5c6b7a' }
  };

  /* =======================================================================
   * 2. Estado y utilidades
   * ===================================================================== */
  var estado = {
    vista: 'mapa',
    prov: '28', loc: '', fuel: 'Gasolina 95 E5',
    marcas: new Set(), distMax: 0, soloFav: false, texto: '',
    orden: 'precio-asc',
    porPagina: F.config.pageSize, pagina: 1,
    sortCol: 'precio', sortDir: 'asc',
    seleccion: null,
    favoritos: new Set(F.estaciones.filter(function (e) { return e.fav; }).map(function (e) { return e.id; })),
    descuentos: Object.assign({}, F.descuentos),
    zoom: 1, panX: 0, panY: 0,
    histDias: 14, histFuel: 'Gasolina 95 E5',
    hojaNivel: 0,
    ia: { prov: 'general', modelos: {}, mensajes: {}, enviando: false },
    cfg: {
      cacheTab: 'indexeddb', logTab: 'api',
      ttl: F.config.cacheTtl, pagina: F.config.pageSize,
      push: true, pushSubida: false, intervalo: F.config.checkInterval, diasFall: F.config.priceFallDays,
      modo: F.config.priceCheckMode, claves: false, ocultas: new Set(), pid: 1
    }
  };

  function norm(s) {
    return String(s).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  }
  function eur(p) { return p == null ? '—' : p.toFixed(3).replace('.', ',') + ' €'; }
  function eur2(p) { return p == null ? '—' : p.toFixed(2).replace('.', ','); }
  function km(d) { return d.toFixed(1).replace('.', ',') + ' km'; }
  function pct(v) { return (v >= 0 ? '+' : '') + v.toFixed(1).replace('.', ',') + ' %'; }
  function exc(s) {
    return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;')
      .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }
  function iniciales(marca) {
    return marca.split(/[\s.]+/).filter(Boolean).slice(0, 2)
      .map(function (w) { return w[0]; }).join('').toUpperCase();
  }
  function eById(id) { return F.estaciones.find(function (e) { return e.id === id; }); }
  function esEscritorio() { return window.matchMedia('(min-width: 1000px)').matches; }
  function clasePrecio(p) { return F.colorPrecio(p, UMBRAL_BAJO, UMBRAL_ALTO); }
  function varColor(v) { return v < 0 ? 'txt-verde' : v > 0 ? 'txt-rojo' : ''; }

  /** Precio mostrado = precio del Ministerio menos el descuento por marca. */
  function precioFinal(est, fuel) {
    var p = F.precioDe(est, fuel);
    if (p == null) return null;
    var d = estado.descuentos[est.marca] || 0;
    return Math.round((p - d) * 1000) / 1000;
  }

  /* =======================================================================
   * 3. Filtrado y orden
   * ===================================================================== */
  function filtradas() {
    var lista = F.estacionesDe(estado.prov);
    if (estado.loc) lista = lista.filter(function (e) { return e.localidad === estado.loc; });
    if (estado.fuel) lista = lista.filter(function (e) { return e.precios[estado.fuel] != null; });
    if (estado.marcas.size) lista = lista.filter(function (e) { return estado.marcas.has(e.marca); });
    if (estado.soloFav) lista = lista.filter(function (e) { return estado.favoritos.has(e.id); });
    if (estado.distMax > 0) lista = lista.filter(function (e) { return e.dist <= estado.distMax; });
    if (estado.texto) {
      var q = norm(estado.texto);
      lista = lista.filter(function (e) {
        return norm([e.marca, e.nombre, e.localidad, e.direccion].join(' ')).indexOf(q) !== -1;
      });
    }
    return ordenar(lista);
  }

  function ordenar(lista) {
    var col, dir;
    if (estado.vista === 'ambos') {
      col = estado.sortCol;
      dir = estado.sortDir === 'asc' ? 1 : -1;
    } else {
      col = estado.orden === 'dist' ? 'dist' : 'precio';
      dir = estado.orden === 'precio-desc' ? -1 : 1;
    }
    var cp = function (e) { return precioFinal(e, estado.fuel); };
    return lista.slice().sort(function (a, b) {
      var r;
      if (col === 'precio') {
        var pa = cp(a), pb = cp(b);
        r = (pa == null ? Infinity : pa) - (pb == null ? Infinity : pb);
      } else if (col === 'dist') r = a.dist - b.dist;
      else if (col === 'marca') r = a.marca.localeCompare(b.marca, 'es');
      else if (col === 'localidad') r = a.localidad.localeCompare(b.localidad, 'es');
      else r = a.direccion.localeCompare(b.direccion, 'es');
      if (!r && col !== 'precio') r = (cp(a) || 0) - (cp(b) || 0);
      return r * dir;
    });
  }

  /* =======================================================================
   * 4. Chips de filtro
   * ===================================================================== */
  function renderChips() {
    var html = '';
    html += chip('prov', 'Provincia: ' + (estado.prov ? F.provinciaNombre(estado.prov) : 'Todas'), estado.prov ? 'activo' : '', false);
    html += chip('fuel', estado.fuel || 'Combustible', estado.fuel ? 'activo' : '', false);
    html += chip('loc', estado.loc || 'Localidad', estado.loc ? 'activo' : '', !!estado.loc);
    html += chip('marcas', estado.marcas.size ? 'Marcas · ' + estado.marcas.size : 'Marca', estado.marcas.size ? 'activo' : '', !!estado.marcas.size);
    html += chip('dist', estado.distMax ? '‹ ' + estado.distMax + ' km' : 'Distancia', estado.distMax ? 'activo' : '', !!estado.distMax);
    html += chip('fav', '★ Favoritas', estado.soloFav ? 'activo' : '', false);
    html += chip('orden', ordenTexto(), '', false);
    if (hayFiltros()) html += '<button class="chip sutil" data-chip="limpiar">Limpiar filtros</button>';
    $('#filaChips').innerHTML = html;
  }
  function chip(id, texto, clase, quitar) {
    return '<button class="chip ' + clase + '" data-chip="' + id + '">' + exc(texto) +
      '<span class="chev" aria-hidden="true">' + (id === 'fav' ? '' : '▾') + '</span>' +
      (quitar ? '<span class="quitar" data-quitar="' + id + '" role="button" aria-label="Quitar filtro">✕</span>' : '') +
      '</button>';
  }
  function ordenTexto() {
    return estado.orden === 'precio-asc' ? 'Precio ↑' : estado.orden === 'precio-desc' ? 'Precio ↓' : 'Distancia';
  }
  function hayFiltros() {
    return !!(estado.loc || estado.marcas.size || estado.distMax || estado.soloFav || estado.texto);
  }

  /* =======================================================================
   * 5. Mapa fake (fondo SVG + marcadores con zoom y arrastre)
   * ===================================================================== */
  function pintarFondo(cont) {
    if (!cont || cont.querySelector('svg')) return;
    var m = F.mapa;
    var svg = '<svg viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">';
    svg += '<rect width="100" height="100" fill="#e7edf3"/>';
    m.manchas.forEach(function (b) {
      svg += '<rect x="' + b.x + '" y="' + b.y + '" width="' + b.w + '" height="' + b.h + '" rx="2" fill="#dde5ec"/>';
    });
    svg += '<path d="' + m.agua.d + '" fill="#c9dcea"/>';
    m.viales.forEach(function (v) {
      svg += '<path d="' + v.d + '" fill="none" stroke="' + (v.w > 2 ? '#ffffff' : '#f2f5f8') +
        '" stroke-width="' + (v.w * 2.4) + '" stroke-linecap="round"/>';
      svg += '<path d="' + v.d + '" fill="none" stroke="#e0c9a6" stroke-width="' + v.w +
        '" stroke-linecap="round" vector-effect="non-scaling-stroke"/>';
    });
    svg += '<circle cx="' + m.tuPosicion.mx + '" cy="' + m.tuPosicion.my + '" r="1.4" fill="#1a73e8" opacity=".25"/>';
    svg += '</svg>';
    cont.innerHTML = svg;
  }

  function posMarcador(mx, my) {
    return {
      left: (50 + (mx - 50) * estado.zoom + estado.panX) + '%',
      top: (50 + (my - 50) * estado.zoom + estado.panY) + '%'
    };
  }

  function renderMapa(cont, lista, opciones) {
    opciones = opciones || {};
    if (!cont) return;
    pintarFondo(cont.querySelector('.mapa-fondo') || cont);
    var capa = cont.querySelector('.mapa-marcadores');
    if (!capa) return;
    var html = '';
    if (!opciones.sinYo) {
      var yo = posMarcador(F.mapa.tuPosicion.mx, F.mapa.tuPosicion.my);
      html += '<div class="marcador-yo" style="left:' + yo.left + ';top:' + yo.top + '" aria-hidden="true"></div>';
    }
    lista.slice(0, opciones.tope || 40).forEach(function (e) {
      var p = precioFinal(e, estado.fuel);
      var mk = MK[clasePrecio(p)] || MK.gris;
      var txt = estado.seleccion === e.id ? '#ffffff' : mk.txt;
      var pos = posMarcador(e.mx, e.my);
      html += '<button class="marcador' + (estado.seleccion === e.id ? ' sel' : '') +
        (estado.favoritos.has(e.id) ? ' fav' : '') +
        '" style="left:' + pos.left + ';top:' + pos.top + ';--c:' + mk.bg + ';color:' + txt +
        '" data-marcador="' + e.id + '" aria-label="' +
        exc(e.marca + ' ' + e.nombre + ', ' + (p == null ? 'sin precio' : eur(p))) + '">' +
        (p == null ? '—' : eur2(p)) + '</button>';
    });
    capa.innerHTML = html;
    var fondo = cont.querySelector('.mapa-fondo');
    if (fondo) fondo.style.transform = 'scale(' + (0.9 + estado.zoom * 0.55) + ') translate(' + (estado.panX / 3) + '%,' + (estado.panY / 3) + '%)';
  }

  /* Arrastre del mapa con pointer events (móvil y ratón) */
  var panActivo = null;
  function iniciarPan(cont) {
    if (!cont || cont.dataset.pan) return;
    cont.dataset.pan = '1';
    cont.addEventListener('pointerdown', function (ev) {
      if (ev.target.closest('.marcador, .mapa-hud, .mapa-zoom, .mapa-pista')) return;
      panActivo = { x: ev.clientX, y: ev.clientY, px: estado.panX, py: estado.panY };
      cont.classList.add('arrastrando');
      cont.setPointerCapture(ev.pointerId);
    });
    cont.addEventListener('pointermove', function (ev) {
      if (!panActivo) return;
      var r = cont.getBoundingClientRect();
      estado.panX = Math.max(-30, Math.min(30, panActivo.px + (ev.clientX - panActivo.x) / r.width * 100));
      estado.panY = Math.max(-30, Math.min(30, panActivo.py + (ev.clientY - panActivo.y) / r.height * 100));
      renderMapa(cont, filtradas());
    });
    var soltar = function () { panActivo = null; cont.classList.remove('arrastrando'); };
    cont.addEventListener('pointerup', soltar);
    cont.addEventListener('pointercancel', soltar);
  }

  /* =======================================================================
   * 6. Tarjetas de estación
   * ===================================================================== */
  function tarjetaHTML(e, indice, opts) {
    opts = opts || {};
    var p = precioFinal(e, estado.fuel);
    var barata = p != null && p < UMBRAL_BAJO;
    var desc = estado.descuentos[e.marca] || 0;
    var etiquetas = '';
    if (indice === 0 && estado.orden === 'precio-asc') etiquetas += '<span class="etiqueta ok">★ Más barata</span>';
    if (estado.favoritos.has(e.id)) etiquetas += '<span class="etiqueta info">Favorita</span>';
    if (desc) etiquetas += '<span class="etiqueta aviso">−' + desc.toFixed(2).replace('.', ',') + ' € con descuento</span>';
    if (e.horario === '24 h') etiquetas += '<span class="etiqueta">Abierta 24 h</span>';
    var color = { verde: 'txt-verde', naranja: 'txt-naranja', rojo: 'txt-rojo', gris: '' }[clasePrecio(p)];

    var tarjeta = '<div class="tarjeta' + (barata ? ' barata' : '') + (estado.seleccion === e.id ? ' sel' : '') +
      '" data-estacion="' + e.id + '"' + (opts.shot && indice === 0 ? ' data-shot="detalle"' : '') +
      ' tabindex="0" role="button" aria-label="' +
      exc(e.marca + ' ' + e.nombre + ', ' + (p == null ? 'sin precio' : eur(p))) + '">' +
      '<div class="fila-1">' +
        '<span class="marca-logo" aria-hidden="true">' + iniciales(e.marca) + '</span>' +
        '<span class="nombre">' + exc(e.marca + ' · ' + e.nombre) + '</span>' +
      '</div>' +
      '<div class="precio ' + color + '">' + (p == null ? '—' : eur2(p)) + '<small>' + exc(estado.fuel || 'combustible') + '</small></div>' +
      '<div class="meta">' + exc(e.localidad) + ' · ' + km(e.dist) + ' · ' + exc(e.direccion) + '</div>' +
      '<div class="etiquetas">' + etiquetas + '</div>' +
      '<button class="estrella' + (estado.favoritos.has(e.id) ? ' on' : '') + '" data-fav="' + e.id +
        '" aria-label="' + (estado.favoritos.has(e.id) ? 'Quitar de favoritas' : 'Añadir a favoritas') + '">' +
        (estado.favoritos.has(e.id) ? '★' : '☆') + '</button>' +
    '</div>';

    if (!opts.swipe) return tarjeta;
    return '<div class="deslizable">' +
      '<div class="capa-acciones">' +
        '<button class="accion-desliz fav" data-swipe="fav" data-estacion="' + e.id + '" aria-label="Favorita">' +
          '<span aria-hidden="true">★</span>Favorito</button>' +
        '<button class="accion-desliz det" data-swipe="det" data-estacion="' + e.id + '" aria-label="Ver detalle">' +
          '<span aria-hidden="true">⤢</span>Detalle</button>' +
      '</div>' + tarjeta + '</div>';
  }

  function vacioHTML() {
    return '<div class="vacio"><span class="icono" aria-hidden="true">🔍</span>' +
      '<h3>Sin estaciones con estos filtros</h3>' +
      '<p>Prueba a ampliar la distancia, quitar marcas o cambiar de combustible.</p>' +
      '<button data-accion="limpiar-filtros">Limpiar filtros</button></div>';
  }

  function grupoHTML(texto, cuenta) {
    return '<div class="grupo-cabecera"><span>' + exc(texto) + '</span><span>' + cuenta + ' resultados</span></div>';
  }

  /* =======================================================================
   * 7. Vistas: lista, ambos, hoja del mapa, info
   * ===================================================================== */
  function renderLista() {
    var lista = filtradas();
    var visible = lista.slice(0, 40);
    $('#listaTarjetas').innerHTML = lista.length
      ? grupoHTML('Hoy · ' + F.hoy, lista.length) + visible.map(function (e, i) { return tarjetaHTML(e, i, { swipe: true }); }).join('')
      : vacioHTML();
  }

  function renderHoja() {
    var lista = filtradas();
    var barata = lista.length ? precioFinal(lista[0], estado.fuel) : null;
    var media = F.mediaProvincia(estado.prov, estado.fuel);
    $('#hojaTitulo').textContent = lista.length + ' estaciones';
    $('#hojaSub').textContent = lista.length
      ? 'Más barata ' + eur(barata) + ' · media ' + eur(media)
      : 'Ningún resultado con estos filtros';
    $('#listaHoja').innerHTML = lista.length
      ? lista.slice(0, 12).map(function (e, i) { return tarjetaHTML(e, i, { shot: true }); }).join('')
      : vacioHTML();
  }

  function renderAmbos() {
    var lista = filtradas();
    var porPag = estado.porPagina;
    var total = Math.max(1, Math.ceil(lista.length / (porPag || lista.length || 1)));
    estado.pagina = Math.min(estado.pagina, total);
    var ini = porPag ? (estado.pagina - 1) * porPag : 0;
    var trozo = porPag ? lista.slice(ini, ini + porPag) : lista;
    $('#ambosContador').innerHTML = '<b>' + lista.length + '</b> estaciones · página ' + estado.pagina + ' de ' + total;
    var color = function (p) { return { verde: 'txt-verde', naranja: 'txt-naranja', rojo: 'txt-rojo', gris: '' }[clasePrecio(p)]; };
    $('#tablaCuerpo').innerHTML = trozo.map(function (e) {
      var p = precioFinal(e, estado.fuel);
      return '<tr data-estacion="' + e.id + '"' + (estado.seleccion === e.id ? ' class="sel"' : '') + ' tabindex="0">' +
        '<td>' + exc(e.marca) + '</td>' +
        '<td class="celda-precio ' + color(p) + '">' + eur(p) + '</td>' +
        '<td>' + km(e.dist) + '</td>' +
        '<td>' + exc(e.localidad) + '</td>' +
        '<td>' + exc(e.direccion) + '</td>' +
        '<td class="celda-fav"><button class="fav' + (estado.favoritos.has(e.id) ? ' on' : '') + '" data-fav="' + e.id +
          '" aria-label="Favorito">' + (estado.favoritos.has(e.id) ? '★' : '☆') + '</button></td>' +
      '</tr>';
    }).join('') || '<tr><td colspan="6">' + vacioHTML() + '</td></tr>';
    $$('#tablaEstaciones thead th').forEach(function (th) {
      var f = th.querySelector('.flecha');
      if (f) f.textContent = th.dataset.col === estado.sortCol ? (estado.sortDir === 'asc' ? ' ▲' : ' ▼') : '';
    });
    $('#paginacion').innerHTML =
      '<button data-pagina="prev" ' + (estado.pagina <= 1 ? 'disabled' : '') + ' aria-label="Página anterior">‹</button>' +
      '<span>' + estado.pagina + ' / ' + total + '</span>' +
      '<button data-pagina="next" ' + (estado.pagina >= total ? 'disabled' : '') + ' aria-label="Página siguiente">›</button>';
  }

  function renderInfo() {
    var lista = filtradas();
    var media = F.mediaProvincia(estado.prov, estado.fuel);
    $('#infoTexto').innerHTML = '<b>' + lista.length + '</b> resultados · ' + exc(F.provinciaNombre(estado.prov));
    $('#infoDatos').textContent = lista.length ? 'Media ' + eur(media) + ' · ' + F.hoyCorto : F.hoyCorto;
    $('#leyenda').innerHTML =
      '<span><i class="p-verde"></i>‹ ' + eur2(UMBRAL_BAJO) + '</span>' +
      '<span><i class="p-naranja"></i>' + eur2(UMBRAL_BAJO) + '–' + eur2(UMBRAL_ALTO) + '</span>' +
      '<span><i class="p-rojo"></i>› ' + eur2(UMBRAL_ALTO) + '</span>';
  }

  function render() {
    renderChips();
    renderInfo();
    renderLista();
    renderHoja();
    renderAmbos();
    renderMapa($('#mapa'), filtradas());
    renderMapa($('#ambosMapa'), filtradas(), { sinYo: true });
  }

  /* =======================================================================
   * 8. Hojas (apertura, cierre y arrastre)
   * ===================================================================== */
  function aplicarAlturaHoja() {
    var h = $('#hojaLista');
    if (esEscritorio()) { h.style.removeProperty('--alto'); return; }
    h.style.setProperty('--alto', Math.round(window.innerHeight * ALTURAS_HOJA[estado.hojaNivel]) + 'px');
  }

  function abrirHoja(hoja) {
    hoja.hidden = false;
    /* Retira el toast: flota por encima de la hoja y bloqueaba toques. */
    var aviso = $('#aviso');
    if (aviso && !aviso.hidden) {
      clearTimeout(avisoTimer);
      aviso.classList.remove('visible');
      aviso.hidden = true;
    }
    if (esEscritorio()) return;
    if (hoja.id !== 'hojaLista') {
      var v = $('#velo');
      v.hidden = false;
      requestAnimationFrame(function () { v.classList.add('visible'); });
    }
  }
  function cerrarHoja(hoja) {
    if (esEscritorio()) { hoja.hidden = true; return; }
    var v = $('#velo');
    v.classList.remove('visible');
    setTimeout(function () { hoja.hidden = true; v.hidden = true; }, 240);
  }

  function hojaArrastrable(hoja, agarre, alturas, alCerrar) {
    if (hoja.dataset.drag) return;
    hoja.dataset.drag = '1';
    var arrastrando = false, y0 = 0, base = 0, movido = 0;

    agarre.addEventListener('pointerdown', function (ev) {
      if (esEscritorio()) return;
      arrastrando = true; y0 = ev.clientY; movido = 0;
      base = hoja.getBoundingClientRect().height;
      delete hoja.dataset.arrastro;
      hoja.classList.add('arrastrando', 'sin-transicion');
      agarre.setPointerCapture(ev.pointerId);
    });
    agarre.addEventListener('pointermove', function (ev) {
      if (!arrastrando) return;
      var dy = ev.clientY - y0;
      movido = Math.max(movido, Math.abs(dy));
      var min = window.innerHeight * 0.14;
      var max = window.innerHeight - 140;
      hoja.style.setProperty('--alto', Math.round(Math.max(min, Math.min(max, base - dy))) + 'px');
    });
    var soltar = function () {
      if (!arrastrando) return;
      arrastrando = false;
      hoja.classList.remove('arrastrando', 'sin-transicion');
      if (movido > 8) hoja.dataset.arrastro = '1';
      var alto = hoja.getBoundingClientRect().height;
      if (hoja.id !== 'hojaLista' && alto < window.innerHeight * 0.35) {
        hoja.style.removeProperty('--alto');
        if (alCerrar) alCerrar();
        return;
      }
      var mejor = 0, mejorD = Infinity;
      alturas.forEach(function (a, i) { var d = Math.abs(window.innerHeight * a - alto); if (d < mejorD) { mejorD = d; mejor = i; } });
      if (hoja.id === 'hojaLista') { estado.hojaNivel = mejor; aplicarAlturaHoja(); }
      else hoja.style.setProperty('--alto', Math.round(alturas[mejor] * 100) + '%');
    };
    agarre.addEventListener('pointerup', soltar);
    agarre.addEventListener('pointercancel', soltar);
  }

  function ciclarHoja() {
    estado.hojaNivel = (estado.hojaNivel + 1) % 3;
    aplicarAlturaHoja();
    toast(['Lista compacta', 'Lista media', 'Lista ampliada'][estado.hojaNivel]);
  }

  /* =======================================================================
   * 9. Hoja genérica de opciones (single / multi / slider)
   * ===================================================================== */
  function abrirOpciones(cfg) {
    $('#opcTitulo').textContent = cfg.titulo;
    var cuerpo = $('#opcCuerpo');
    var sel = cfg.tipo === 'multi' ? new Set(cfg.valor || []) : cfg.valor;
    if (cfg.tipo === 'slider') {
      cuerpo.innerHTML = '<label style="display:block"><span style="font-size:13.5px;color:var(--txt-2)">Máximo <b id="opcValor">' +
        (sel ? sel + ' km' : 'Sin límite') + '</b></span>' +
        '<input class="deslizador" type="range" min="' + cfg.min + '" max="' + cfg.max + '" step="' + cfg.paso +
        '" value="' + (sel || cfg.max) + '" id="opcSlider"></label>';
      var sl = $('#opcSlider');
      sl.addEventListener('input', function (ev) {
        sel = Number(ev.target.value);
        $('#opcValor').textContent = (sel === 0 ? 'Sin límite' : sel + ' km');
      });
    } else {
      cuerpo.innerHTML = cfg.opciones.map(function (o) {
        var elegida = cfg.tipo === 'multi' ? sel.has(o.valor) : sel === o.valor;
        return '<button class="opcion' + (elegida ? ' elegida' : '') + '" data-opcion="' + exc(o.valor) + '">' +
          '<span class="marca-check" aria-hidden="true">✓</span><span>' + exc(o.etiqueta) + '</span>' +
          (o.cuenta != null ? '<span class="cuenta">' + o.cuenta + '</span>' : '') + '</button>';
      }).join('');
    }
    cuerpo._sel = cfg.tipo === 'multi' ? new Set(cfg.valor || []) : null;
    cuerpo._valor = cfg.tipo === 'multi' ? null : cfg.valor;
    cuerpo._tipo = cfg.tipo;
    cuerpo._aplicar = cfg.aplicarFn || null;
    $('#opcPie').innerHTML =
      (cfg.limpiar ? '<button class="limpiar" data-opc="limpiar">' + cfg.limpiar + '</button>' : '') +
      '<button class="aplicar" data-opc="aplicar">' + (cfg.aplicar || 'Aplicar') + '</button>';
    abrirHoja($('#hojaOpciones'));
  }

  function hojaProvincia() {
    abrirOpciones({
      titulo: 'Provincia', tipo: 'single', valor: estado.prov, limpiar: 'Todas',
      opciones: F.provincias.map(function (p) {
        return { valor: p.id, etiqueta: p.nombre, cuenta: F.estacionesDe(p.id).length };
      }),
      aplicar: 'Ver estaciones',
      aplicarFn: function (valor, limpiar) {
        estado.prov = limpiar ? '28' : valor;
        estado.loc = ''; estado.marcas.clear(); estado.distMax = 0; estado.pagina = 1;
        render();
      }
    });
  }
  function hojaLocalidad() {
    abrirOpciones({
      titulo: 'Localidad', tipo: 'single', valor: estado.loc, limpiar: 'Todas',
      opciones: F.localidadesDe(estado.prov).map(function (l) {
        return { valor: l, etiqueta: l, cuenta: F.estacionesDe(estado.prov).filter(function (e) { return e.localidad === l; }).length };
      }),
      aplicarFn: function (valor, limpiar) { estado.loc = limpiar ? '' : valor; estado.pagina = 1; render(); }
    });
  }
  function hojaCombustible() {
    abrirOpciones({
      titulo: 'Combustible', tipo: 'single', valor: estado.fuel, limpiar: 'Todos',
      opciones: F.combustiblesVisibles.map(function (c) {
        var n = F.estacionesDe(estado.prov).filter(function (e) { return e.precios[c] != null; }).length;
        return { valor: c, etiqueta: c, cuenta: n ? n + ' estaciones' : 'sin datos' };
      }),
      aplicarFn: function (valor, limpiar) {
        estado.fuel = limpiar ? 'Gasolina 95 E5' : valor;
        estado.histFuel = estado.fuel; estado.pagina = 1; render();
      }
    });
  }
  function hojaMarcas() {
    abrirOpciones({
      titulo: 'Marca', tipo: 'multi', valor: Array.from(estado.marcas), limpiar: 'Todas',
      opciones: F.marcasDe(estado.prov).map(function (m) {
        return { valor: m, etiqueta: m, cuenta: F.estacionesDe(estado.prov).filter(function (e) { return e.marca === m; }).length };
      }),
      aplicar: 'Ver resultados',
      aplicarFn: function (valor, limpiar) { estado.marcas = limpiar ? new Set() : new Set(valor); estado.pagina = 1; render(); }
    });
  }
  function hojaDistancia() {
    abrirOpciones({
      titulo: 'Distancia máxima', tipo: 'slider', valor: estado.distMax, min: 0, max: 50, paso: 1,
      limpiar: 'Sin límite', aplicar: 'Aplicar',
      aplicarFn: function (valor, limpiar) { estado.distMax = limpiar ? 0 : Number(valor); estado.pagina = 1; render(); }
    });
  }
  function hojaOrden() {
    abrirOpciones({
      titulo: 'Ordenar por', tipo: 'single', valor: estado.orden,
      opciones: [
        { valor: 'precio-asc', etiqueta: 'Precio: más barata primero' },
        { valor: 'precio-desc', etiqueta: 'Precio: más cara primero' },
        { valor: 'dist', etiqueta: 'Distancia: más cerca primero' }
      ],
      aplicarFn: function (valor) { estado.orden = valor; render(); }
    });
  }

  /* =======================================================================
   * 10. Detalle de estación
   * ===================================================================== */
  var detalleId = null;

  function abrirDetalle(id) {
    var e = eById(id);
    if (!e) return;
    detalleId = id;
    estado.seleccion = id;
    var p = precioFinal(e, estado.fuel);
    var color = { verde: 'txt-verde', naranja: 'txt-naranja', rojo: 'txt-rojo', gris: '' }[clasePrecio(p)];
    $('#detMarca').textContent = e.marca;
    $('#detTitulo').textContent = e.nombre;
    $('#detPrecio').innerHTML = '<span class="' + color + '">' + eur(p) + '</span><small>/L · ' + exc(estado.fuel) + ' (con descuento)</small>';
    $('#detMeta').textContent = e.direccion + ' · ' + e.localidad + ' (' + F.provinciaNombre(e.prov) + ') · ' + km(e.dist) + ' · ' + e.horario;
    $('#detFav').className = 'accion' + (estado.favoritos.has(e.id) ? ' on' : '');
    $('#detFav').textContent = estado.favoritos.has(e.id) ? '★ Favorita' : '☆ Favorita';

    var precios = Object.keys(e.precios).filter(function (k) { return e.precios[k] != null; });
    var masBarato = precios.slice().sort(function (a, b) { return e.precios[a] - e.precios[b]; })[0];
    var d = estado.descuentos[e.marca] || 0;
    $('#detPanelPrecios').innerHTML = '<div class="lista-combustibles">' + precios.map(function (k) {
      var final = Math.round((e.precios[k] - d) * 1000) / 1000;
      var sub = d
        ? 'Ministerio ' + eur(e.precios[k]) + ' · descuento −' + d.toFixed(2).replace('.', ',') + ' €'
        : (k === estado.fuel ? 'Tu combustible elegido' : 'Precio en el surtidor');
      return '<div class="combustible' + (k === masBarato ? ' mejor' : '') + '">' +
        '<span class="nombre">' + exc(k) + '<span class="sub">' + sub + '</span></span>' +
        '<span class="importe">' + eur(final) + '</span></div>';
    }).join('') + '</div>';

    if (precios.indexOf(estado.histFuel) === -1) estado.histFuel = precios[0];
    $('#histFuel').innerHTML = precios.map(function (k) {
      return '<option value="' + exc(k) + '"' + (k === estado.histFuel ? ' selected' : '') + '>' + exc(k) + '</option>';
    }).join('');
    $('#histDias').innerHTML = DIAS.map(function (n) {
      return '<option value="' + n + '"' + (n === estado.histDias ? ' selected' : '') + '>' + n + ' días</option>';
    }).join('');

    mostrarPanelDetalle('precios');
    abrirHoja($('#hojaDetalle'));
    render();
  }

  function mostrarPanelDetalle(cual) {
    $$('#hojaDetalle .detalle-tab').forEach(function (t) {
      var act = t.dataset.dtab === cual;
      t.classList.toggle('activa', act);
      t.setAttribute('aria-selected', act ? 'true' : 'false');
    });
    $('#detPanelPrecios').hidden = cual !== 'precios';
    $('#detPanelPrecios').classList.toggle('activa', cual === 'precios');
    $('#detPanelHistorico').hidden = cual !== 'historico';
    $('#detPanelHistorico').classList.toggle('activa', cual === 'historico');
    if (cual === 'historico') dibujarGrafica();
  }

  function dibujarGrafica() {
    var cv = $('#histCanvas');
    if (!cv || !detalleId) return;
    var serie = F.historico(detalleId, estado.histFuel, estado.histDias);
    if (!serie.length) return;
    var caja = cv.parentElement;
    var W = caja.clientWidth || 320, H = 190;
    var dpr = Math.min(window.devicePixelRatio || 1, 2);
    cv.width = W * dpr; cv.height = H * dpr;
    cv.style.width = W + 'px'; cv.style.height = H + 'px';
    var ctx = cv.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, W, H);

    var precios = serie.map(function (p) { return p.precio; });
    var min = Math.min.apply(null, precios), max = Math.max.apply(null, precios);
    var media = precios.reduce(function (a, b) { return a + b; }, 0) / precios.length;
    var pad = Math.max(0.004, (max - min) * 0.25);
    min -= pad; max += pad;
    var P = { izq: 46, der: 12, arr: 14, aba: 26 };
    var ancho = W - P.izq - P.der, alto = H - P.arr - P.aba;
    var x = function (i) { return P.izq + (serie.length === 1 ? ancho / 2 : i / (serie.length - 1) * ancho); };
    var y = function (v) { return P.arr + (1 - (v - min) / (max - min)) * alto; };

    ctx.font = '10px ui-monospace, monospace';
    ctx.fillStyle = '#66727e';
    ctx.textAlign = 'right'; ctx.textBaseline = 'middle';
    for (var g = 0; g <= 4; g++) {
      var v = min + (max - min) * g / 4;
      var yy = y(v);
      ctx.strokeStyle = g === 0 ? '#dbe3ea' : '#eef2f6';
      ctx.beginPath(); ctx.moveTo(P.izq, yy); ctx.lineTo(W - P.der, yy); ctx.stroke();
      ctx.fillText(v.toFixed(3).replace('.', ','), P.izq - 6, yy);
    }
    ctx.setLineDash([4, 4]); ctx.strokeStyle = '#b9c4cf';
    ctx.beginPath(); ctx.moveTo(P.izq, y(media)); ctx.lineTo(W - P.der, y(media)); ctx.stroke();
    ctx.setLineDash([]);

    var grad = ctx.createLinearGradient(0, P.arr, 0, P.arr + alto);
    grad.addColorStop(0, 'rgba(26,115,232,.22)');
    grad.addColorStop(1, 'rgba(26,115,232,0)');
    ctx.beginPath();
    serie.forEach(function (p, i) { i ? ctx.lineTo(x(i), y(p.precio)) : ctx.moveTo(x(i), y(p.precio)); });
    ctx.lineTo(x(serie.length - 1), P.arr + alto); ctx.lineTo(x(0), P.arr + alto); ctx.closePath();
    ctx.fillStyle = grad; ctx.fill();

    ctx.beginPath();
    serie.forEach(function (p, i) { i ? ctx.lineTo(x(i), y(p.precio)) : ctx.moveTo(x(i), y(p.precio)); });
    ctx.strokeStyle = '#1667d3'; ctx.lineWidth = 2.2; ctx.lineJoin = 'round'; ctx.stroke();

    var pts = [];
    serie.forEach(function (p, i) {
      var px = x(i), py = y(p.precio);
      pts.push({ x: px, y: py, fecha: p.fecha, precio: p.precio });
      if (serie.length <= 40) {
        ctx.beginPath(); ctx.arc(px, py, 2.4, 0, Math.PI * 2);
        ctx.fillStyle = '#fff'; ctx.fill();
        ctx.strokeStyle = '#1667d3'; ctx.lineWidth = 1.6; ctx.stroke();
      }
    });
    cv._pts = pts;

    var iMin = precios.indexOf(Math.min.apply(null, precios));
    var iMax = precios.indexOf(Math.max.apply(null, precios));
    ctx.font = '10px system-ui, sans-serif'; ctx.textAlign = 'center';
    ctx.fillStyle = '#146b3c';
    ctx.fillText(eur(precios[iMin]), x(iMin), y(precios[iMin]) - 9);
    ctx.fillStyle = '#a3271b';
    ctx.fillText(eur(precios[iMax]), x(iMax), y(precios[iMax]) + 14);

    ctx.fillStyle = '#66727e'; ctx.textBaseline = 'top';
    var paso = Math.max(1, Math.round((serie.length - 1) / 4));
    serie.forEach(function (p, i) {
      if (i % paso === 0 || i === serie.length - 1) {
        ctx.fillText(p.fecha.slice(0, 5), Math.min(W - P.der - 12, Math.max(P.izq + 12, x(i))), P.arr + alto + 8);
      }
    });

    var primero = precios[0], ultimo = precios[precios.length - 1];
    var variacion = (ultimo - primero) / primero * 100;
    $('#histResumen').innerHTML =
      '<div><dt>Media</dt><dd>' + eur(media) + '</dd></div>' +
      '<div><dt>Mínimo</dt><dd class="txt-verde">' + eur(Math.min.apply(null, precios)) + '</dd></div>' +
      '<div><dt>Máximo</dt><dd class="txt-rojo">' + eur(Math.max.apply(null, precios)) + '</dd></div>' +
      '<div><dt>Variación</dt><dd class="' + varColor(variacion) + '">' + pct(variacion) + '</dd></div>' +
      '<div><dt>Días</dt><dd>' + serie.length + '</dd></div>' +
      '<div><dt>Actual</dt><dd>' + eur(ultimo) + '</dd></div>';
  }

  function tooltipGrafica(ev) {
    var cv = $('#histCanvas');
    if (!cv || !cv._pts) return;
    var r = cv.getBoundingClientRect();
    var mx = ev.clientX - r.left;
    var mejor = null;
    cv._pts.forEach(function (p) {
      var d = Math.abs(p.x - mx);
      if (!mejor || d < mejor.d) mejor = { d: d, p: p };
    });
    var tt = $('#histTooltip');
    if (!mejor || mejor.d > 26) { tt.hidden = true; return; }
    tt.hidden = false;
    tt.style.left = mejor.p.x + 'px';
    tt.style.top = mejor.p.y + 'px';
    tt.innerHTML = '<b>' + eur(mejor.p.precio) + '</b><br>' + mejor.p.fecha;
  }

  /* =======================================================================
   * 11. Chat IA (markdown + respuesta simulada)
   * ===================================================================== */
  function nombreProv(id) {
    var p = PROVEEDORES.find(function (x) { return x.id === id; });
    return p ? p.nombre : id;
  }
  function modeloDe(prov) { return estado.ia.modelos[prov] || (MODELOS[prov] || [])[0] || 'integrado'; }
  function iaMensajes(prov) {
    if (!estado.ia.mensajes[prov]) {
      estado.ia.mensajes[prov] = (F.chatsIA[prov] || []).map(function (m) {
        return { rol: m.role === 'user' ? 'usuario' : 'ia', texto: m.content, modelo: modeloDe(prov) };
      });
    }
    return estado.ia.mensajes[prov];
  }
  function proveedoresVisibles() {
    return PROVEEDORES.filter(function (p) { return p.id === 'general' || !estado.cfg.ocultas.has(p.id); });
  }

  function renderIA() {
    var prov = estado.ia.prov;
    if (prov !== 'general' && estado.cfg.ocultas.has(prov)) estado.ia.prov = prov = 'general';
    $('#iaPills').innerHTML = proveedoresVisibles().map(function (p) {
      return '<button class="ia-pill' + (p.id === prov ? ' activo' : '') + '" role="tab" data-iaprov="' + p.id +
        '" aria-selected="' + (p.id === prov) + '">' + exc(p.nombre) + '</button>';
    }).join('');
    if (prov === 'general') {
      var principales = proveedoresVisibles().filter(function (p) { return p.id !== 'general'; });
      $('#iaCabecera').innerHTML = '<span>Misma pregunta a los proveedores visibles, en paralelo.</span>' +
        '<span class="ia-estado ok">✅ ' + principales.length + ' proveedores listos</span>';
    } else {
      $('#iaCabecera').innerHTML =
        '<label style="display:flex;align-items:center;gap:6px">Modelo ' +
        '<select id="iaModelo">' + (MODELOS[prov] || ['integrado']).map(function (m) {
          return '<option' + (m === modeloDe(prov) ? ' selected' : '') + '>' + exc(m) + '</option>';
        }).join('') + '</select></label>' +
        '<button class="mini-btn" data-accion="refrescar-modelos">↻ Modelos</button>' +
        '<span class="ia-estado ' + (prov === 'chrome-nano' ? 'no' : 'ok') + '">' +
        (prov === 'chrome-nano' ? 'Nano en el navegador' : '✅ Clave cargada') + '</span>';
    }
    $('#iaPrompts').innerHTML = F.prompts.map(function (t) {
      return '<button data-prompt="' + exc(t) + '">' + exc(t) + '</button>';
    }).join('');
    pintarMensajesIA();
  }

  function pintarMensajesIA() {
    var caja = $('#iaMensajes');
    var lista = iaMensajes(estado.ia.prov);
    if (!lista.length) {
      caja.innerHTML = '<p class="burbuja ia">Pregúntame por precios, tendencias o por una estación concreta.</p>';
      return;
    }
    caja.innerHTML = lista.map(function (m) {
      if (m.rol === 'grupo') {
        return m.respuestas.map(function (r) {
          return '<div class="burbuja ia proveedor"><div class="proveedor-nombre">' + exc(r.prov) + '</div>' +
            markdownIA(r.texto) + '<div class="meta">⏱ ' + exc(r.modelo) + ' · ' + r.ms + ' s</div></div>';
        }).join('');
      }
      return '<div class="burbuja ' + (m.rol === 'usuario' ? 'usuario' : m.rol === 'error' ? 'error' : 'ia') + '">' +
        (m.rol === 'cargando' ? 'Pensando…' : markdownIA(m.texto)) +
        (m.ms ? '<div class="meta">⏱ ' + exc(m.modelo || 'modelo') + ' · ' + m.ms + ' s</div>' : '') + '</div>';
    }).join('');
    caja.scrollTop = caja.scrollHeight;
  }

  /** Markdown mínimo (títulos, negrita, listas, tablas, código y enlaces). */
  function markdownIA(texto) {
    var lineas = exc(texto).split('\n');
    var salida = [], enLista = null, enTabla = false, enCodigo = false, filasTabla = 0;
    var formato = function (s) {
      return s
        .replace(/`([^`]+)`/g, '<code>$1</code>')
        .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
        .replace(/(^|[\s(])\*([^*\n]+)\*(?=[\s.,;:)]|$)/g, '$1<em>$2</em>')
        .replace(/(^|[\s(])_([^_\n]+)_(?=[\s.,;:)]|$)/g, '$1<em>$2</em>')
        .replace(/\[([^\]]+)\]\((https?:[^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>')
        .replace(/(^|\s)(https?:\/\/\S+)/g, '$1<a href="$2" target="_blank" rel="noopener">$2</a>');
    };
    var cerrarLista = function () { if (enLista) { salida.push('</' + enLista + '>'); enLista = null; } };
    lineas.forEach(function (l) {
      if (l.trim().indexOf('```') === 0) {
        cerrarLista();
        salida.push(enCodigo ? '</code></pre>' : '<pre><code>');
        enCodigo = !enCodigo; return;
      }
      if (enCodigo) { salida.push(l); return; }
      var t = l.trim();
      if (!t) { cerrarLista(); return; }
      var h = t.match(/^(#{1,4})\s+(.*)$/);
      if (h) { cerrarLista(); salida.push('<h4>' + formato(h[2]) + '</h4>'); return; }
      if (/^(-{3,}|\*{3,})$/.test(t)) { cerrarLista(); salida.push('<hr>'); return; }
      if (t.indexOf('|') === 0 && t.lastIndexOf('|') > 0) {
        cerrarLista();
        if (/^\|[\s:|-]+\|$/.test(t)) return;
        var celdas = t.split('|').slice(1, -1).map(function (c) { return c.trim(); });
        if (!enTabla) { enTabla = true; filasTabla = 0; salida.push('<table>'); }
        var esCabecera = filasTabla === 0;
        filasTabla++;
        salida.push('<tr>' + celdas.map(function (c) {
          return (esCabecera ? '<th>' : '<td>') + formato(c) + (esCabecera ? '</th>' : '</td>');
        }).join('') + '</tr>');
        return;
      }
      if (enTabla) { salida.push('</table>'); enTabla = false; }
      if (/^>\s?/.test(t)) { cerrarLista(); salida.push('<blockquote>' + formato(t.replace(/^>\s?/, '')) + '</blockquote>'); return; }
      var ul = t.match(/^[-*]\s+(.*)$/), ol = t.match(/^\d+[.)]\s+(.*)$/);
      if (ul || ol) {
        var tipo = ul ? 'ul' : 'ol';
        if (enLista !== tipo) { cerrarLista(); salida.push('<' + tipo + '>'); enLista = tipo; }
        salida.push('<li>' + formato((ul || ol)[1]) + '</li>'); return;
      }
      cerrarLista();
      salida.push('<p>' + formato(t) + '</p>');
    });
    if (enTabla) salida.push('</table>');
    cerrarLista();
    if (enCodigo) salida.push('</code></pre>');
    return salida.join('');
  }

  function respuestaSimulada(prov, pregunta) {
    var ejemplo = (F.chatsIA[prov] || [])[1];
    if (ejemplo) return ejemplo.content;
    var barata = filtradas()[0];
    if (barata) {
      return 'Con los datos cargados ahora mismo, la estación más barata de **' + F.provinciaNombre(estado.prov) +
        '** para ' + estado.fuel + ' es **' + barata.marca + '** a **' + eur(precioFinal(barata, estado.fuel)) + '**.';
    }
    return 'No hay estaciones que cumplan los filtros actuales; amplía la búsqueda y vuelvo a mirarlo.';
  }

  function marcaTiempo() { return (0.6 + Math.random() * 1.4).toFixed(1).replace('.', ','); }

  function enviarIA(texto) {
    if (!texto.trim() || estado.ia.enviando) return;
    var prov = estado.ia.prov;
    var lista = iaMensajes(prov);
    lista.push({ rol: 'usuario', texto: texto });
    lista.push({ rol: 'cargando' });
    estado.ia.enviando = true;
    pintarMensajesIA();
    setTimeout(function () {
      lista.pop();
      var ms = marcaTiempo();
      if (prov === 'general') {
        var principales = proveedoresVisibles().filter(function (p) { return p.id !== 'general'; });
        lista.push({
          rol: 'grupo', respuestas: principales.slice(0, 3).map(function (p, i) {
            return {
              prov: p.nombre, modelo: modeloDe(p.id),
              ms: (Number(ms.replace(',', '.')) + i * 0.4).toFixed(1).replace('.', ','),
              texto: respuestaSimulada(p.id, texto)
            };
          })
        });
      } else {
        lista.push({ rol: 'ia', modelo: modeloDe(prov), ms: ms, texto: respuestaSimulada(prov, texto) });
      }
      estado.ia.enviando = false;
      pintarMensajesIA();
    }, 1100);
  }

  /* =======================================================================
   * 12. Configuración (acordeón con controles operativos)
   * ===================================================================== */
  function tarjetaConfig(id, icono, titulo, abierta, cuerpo) {
    return '<details class="tarjeta-config"' + (abierta ? ' open' : '') + '>' +
      '<summary><span class="ic" aria-hidden="true">' + icono + '</span>' + exc(titulo) +
      '<span class="chev" aria-hidden="true">›</span></summary>' +
      '<div class="cuerpo">' + cuerpo + '</div></details>';
  }
  function filaAtajo(desc, teclas) {
    return '<div class="ayuda-fila"><span class="desc">' + exc(desc) + '</span><span class="teclas">' +
      teclas.map(function (k) { return '<kbd>' + exc(k) + '</kbd>'; }).join('') + '</span></div>';
  }

  function renderConfig() {
    /* Conserva qué tarjetas estaban desplegadas antes de repintar */
    var abiertas = $$('#configLista details.tarjeta-config').reduce(function (acc, d, i) {
      if (d.open) acc.push(i); return acc;
    }, []);
    var c = estado.cfg;
    var descuentos = Object.keys(estado.descuentos).map(function (m) {
      return '<div class="fila-borrar">' +
        '<input type="text" value="' + exc(m) + '" data-desc-marca="' + exc(m) + '" aria-label="Marca">' +
        '<input type="number" step="0.01" value="' + estado.descuentos[m].toFixed(2) + '" data-desc-valor="' + exc(m) + '" aria-label="Descuento por litro">' +
        '<button data-accion="borrar-descuento" data-marca="' + exc(m) + '" aria-label="Quitar descuento">✕</button></div>';
    }).join('');
    var log = c.logTab === 'api' ? F.logApi : F.logPush;
    var info = F.cacheInfo;

    $('#configLista').innerHTML =
      tarjetaConfig('descuentos', '🏷️', 'Descuentos por marca', true,
        '<p>Se resta al precio mostrado en listas, mapa y leyenda.</p>' + descuentos +
        '<button class="btn-sec" data-accion="add-descuento">+ Añadir marca</button>') +
      tarjetaConfig('cache', '🗃️', 'Caché de datos', false,
        '<div class="mini-cabs">' +
          '<button data-cachetab="indexeddb" class="' + (c.cacheTab === 'indexeddb' ? 'activo' : '') + '">IndexedDB</button>' +
          '<button data-cachetab="localstorage" class="' + (c.cacheTab === 'localstorage' ? 'activo' : '') + '">localStorage</button></div>' +
        (c.cacheTab === 'indexeddb'
          ? '<p>' + info.provincias + ' provincias · ' + info.gasolineras.toLocaleString('es-ES') + ' gasolineras · ' + info.historicoDias + ' días de histórico<br>' +
            exc(info.idb) + ' · actualizado ' + info.ultimaActualizacion + '</p>' +
            '<label>Horas de caché <input type="number" value="' + c.ttl + '" data-cfg="ttl" min="0"></label>' +
            '<button class="btn-sec btn-peligro" data-accion="limpiar-cache">🗑️ Limpiar caché</button>'
          : '<p>' + info.lsClaves + ' claves (estado, filtros por provincia, logs y chats de IA).</p>' +
            '<button class="btn-sec btn-peligro" data-accion="limpiar-cache">🗑️ Borrar claves</button>')) +
      tarjetaConfig('paginacion', '📄', 'Paginación', false,
        '<label>Resultados por página <select data-cfg="pagina">' + F.config.paginas.map(function (n) {
          return '<option value="' + n + '"' + (n === c.pagina ? ' selected' : '') + '>' + (n === 0 ? 'Todos' : n) + '</option>';
        }).join('') + '</select></label>') +
      tarjetaConfig('log', '📝', 'Registro de actividad', false,
        '<div class="mini-cabs">' +
          '<button data-logtab="api" class="' + (c.logTab === 'api' ? 'activo' : '') + '">API</button>' +
          '<button data-logtab="push" class="' + (c.logTab === 'push' ? 'activo' : '') + '">Push</button></div>' +
        '<div class="consola">' + log.map(function (l) {
          var ko = (l.estado === 200 || l.estado === 'ok') ? '' : ' ko';
          return '<div><b>' + l.t + '</b> ' + exc(l.url) + ' <span class="' + ko.trim() + '">' +
            l.estado + (l.ms != null ? ' · ' + l.ms + ' ms' : '') + '</span></div>';
        }).join('') + '</div>' +
        '<button class="btn-sec btn-peligro" data-accion="limpiar-log">🗑️ Borrar registro</button>') +
      tarjetaConfig('push', '🔔', 'Notificaciones push', false,
        '<label><input type="checkbox" data-tap-exenta data-cfg-chk="push"' + (c.push ? ' checked' : '') + '> Avisar cuando baje el precio</label>' +
        '<label><input type="checkbox" data-tap-exenta data-cfg-chk="pushSubida"' + (c.pushSubida ? ' checked' : '') + '> Avisar cuando suba el precio</label>' +
        '<label>Intervalo de chequeo <input type="number" data-cfg="intervalo" value="' + c.intervalo + '" min="1" max="24"> h</label>' +
        '<label>Días de ventana <input type="number" data-cfg="diasFall" value="' + c.diasFall + '" min="2" max="90"> d</label>' +
        '<div class="mini-cabs">' +
          '<button data-modo="average" class="' + (c.modo === 'average' ? 'activo' : '') + '">Promedio</button>' +
          '<button data-modo="consecutive" class="' + (c.modo === 'consecutive' ? 'activo' : '') + '">Consecutivos</button></div>' +
        '<button class="btn-sec btn-primario" data-accion="probar-push">Enviar notificación de prueba</button>') +
      tarjetaConfig('claves', '🔑', 'Claves API · IA', false,
        '<p>Cifradas en el código fuente; se descargan con la contraseña y quedan en localStorage.</p>' +
        '<div class="fila-borrar"><input type="password" placeholder="Contraseña" data-cfg="pass">' +
        '<button class="btn-sec btn-primario" data-accion="cargar-claves">Cargar</button></div>' +
        '<div class="rejilla-2">' +
          ['Google Gemini', 'Groq', 'Mistral', 'OpenRouter', 'LLM7.io (opcional)', 'NVIDIA (por proxy)'].map(function (n) {
            return '<label> ' + n + ' <input type="password" value="' + (c.claves ? '••••••••••' : '') + '" placeholder="API Key" aria-label="' + exc(n) + '"></label>';
          }).join('') + '</div>') +
      tarjetaConfig('pestanas-ia', '💬', 'Pestañas de IA', false,
        '<p>Desmarca los proveedores que no uses: desaparecen del chat. Siempre debe quedar uno.</p>' +
        '<div class="rejilla-2">' + PROVEEDORES.slice(1).map(function (p) {
          return '<label><input type="checkbox" data-tap-exenta data-ia-visible="' + p.id + '"' +
            (c.ocultas.has(p.id) ? '' : ' checked') + '> ' + exc(p.nombre) + '</label>';
        }).join('') + '</div>') +
      tarjetaConfig('atajos', '⌨️', 'Atajos de teclado', false,
        '<p>Los atajos de una sola tecla se ignoran mientras escribes en un campo.</p>' +
        filaAtajo('Buscar estación', ['/']) +
        filaAtajo('Paleta de comandos', ['Ctrl', 'K']) +
        filaAtajo('Abrir o cerrar esta ayuda', ['?']) +
        filaAtajo('Ir a Mapa, Lista, Ambos, IA, Config', ['1', '5']) +
        filaAtajo('Estación siguiente / anterior', ['J', 'K']) +
        filaAtajo('Marcar como favorita la selección', ['F']) +
        filaAtajo('Cerrar cualquier capa', ['Esc'])) +
      tarjetaConfig('actualizar', '🔄', 'Actualización de la app', true,
        '<p>Versión actual <b>' + exc(F.versionApp.texto) + '</b></p>' +
        '<button class="btn-sec btn-primario" data-accion="buscar-actualizacion">Buscar actualizaciones</button>');
    var nuevos = $$('#configLista details.tarjeta-config');
    abiertas.forEach(function (i) { if (nuevos[i]) nuevos[i].open = true; });
  }

  /* =======================================================================
   * 13. Navegación (nav de 5 destinos + carril de 3 páginas)
   * ===================================================================== */
  function pintarNavegacion() {
    var html = VISTAS.map(function (v) {
      return '<button data-vista="' + v.id + '" class="' + (estado.vista === v.id ? 'activo' : '') +
        '" aria-label="' + v.nombre + '">' + v.ico + '<span>' + v.nombre + '</span></button>';
    }).join('');
    $('#navInferior').innerHTML = html;
    $('#navSuperior').innerHTML = html;
    var marca = $('#navInferior [data-vista="lista"]');
    if (marca) marca.dataset.shot = 'vista';
  }

  function actualizarNav() {
    $$('#navInferior button, #navSuperior button').forEach(function (b) {
      b.classList.toggle('activo', b.dataset.vista === estado.vista);
    });
    $$('#indicador .punto').forEach(function (b) {
      var act = b.dataset.vista === estado.vista;
      b.classList.toggle('activo', act);
      b.setAttribute('aria-selected', act ? 'true' : 'false');
    });
    var etq = $('#indicador .indicador-etiqueta');
    var v = VISTAS.find(function (x) { return x.id === estado.vista; });
    if (etq && v) etq.textContent = v.nombre;
  }

  function indiceCarril() { var i = CARRIL.indexOf(estado.vista); return i < 0 ? 0 : i; }

  function actualizarCarril(animar) {
    var i = indiceCarril();
    var c = $('#carril');
    c.classList.toggle('animando', !!animar);
    c.style.transform = 'translateX(' + (-i * 100) + '%)';
    $$('#carril .panel').forEach(function (p) { p.classList.toggle('activa', p.dataset.vista === estado.vista); });
  }

  function actualizarVisibilidadHoja() {
    var h = $('#hojaLista');
    if (esEscritorio()) h.hidden = (estado.vista === 'ia' || estado.vista === 'config');
    else h.hidden = (estado.vista !== 'mapa');
  }

  function setVista(id, animar) {
    var suelta = (id === 'ia' || id === 'config');
    estado.vista = id;
    $('#carril').style.display = suelta ? 'none' : '';
    $('#vista-ia').classList.toggle('activa', id === 'ia');
    $('#vista-config').classList.toggle('activa', id === 'config');
    if (!suelta) actualizarCarril(animar);
    if (!esEscritorio()) $('#indicador').style.display = suelta ? 'none' : '';
    if (id !== 'ambos') estado.pagina = 1;
    if (id === 'ia') renderIA();
    if (id === 'config') renderConfig();
    actualizarNav();
    actualizarVisibilidadHoja();
  }

  function pintarIndicador() {
    var html = CARRIL.map(function (v) {
      var nom = VISTAS.find(function (x) { return x.id === v; }).nombre;
      return '<button class="punto" data-vista="' + v + '" role="tab" aria-selected="false" aria-label="' + nom + '"><i></i></button>';
    }).join('');
    $('#indicador').innerHTML = html + '<span class="indicador-etiqueta">Mapa</span>';
  }

  /* =======================================================================
   * 14. Paleta de comandos
   * ===================================================================== */
  function comandosBase() {
    var grupos = [
      { grupo: 'Navegación', items: VISTAS.map(function (v, i) {
        return { ic: '', t: 'Ir a ' + v.nombre, s: 'Cambiar de vista', k: String(i + 1), run: function () { setVista(v.id, true); } };
      }) },
      { grupo: 'Acciones', items: [
        { ic: '🧹', t: 'Limpiar filtros', s: 'Quita localidad, marcas, distancia y búsqueda', run: limpiarFiltros },
        { ic: '★', t: 'Alternar solo favoritas', s: 'Mostrar u ocultar las estaciones guardadas', run: function () { estado.soloFav = !estado.soloFav; estado.pagina = 1; render(); toast(estado.soloFav ? 'Mostrando solo favoritas' : 'Mostrando todas'); } },
        { ic: '❓', t: 'Abrir ayuda de gestos y atajos', s: 'Qué se puede hacer sin chrome', k: '?', run: abrirAyuda },
        { ic: '🔄', t: 'Cambiar de provincia', s: 'Abrir el selector de provincia', run: hojaProvincia }
      ] }
    ];
    var est = F.estacionesDe(estado.prov).slice(0, 12);
    if (est.length) {
      grupos.push({ grupo: 'Estaciones', items: est.map(function (e) {
        return { ic: '⛽', t: e.marca + ' · ' + e.nombre, s: e.localidad + ' · ' + eur(precioFinal(e, estado.fuel)),
          run: (function (id) { return function () { setVista('mapa'); abrirDetalle(id); }; })(e.id) };
      }) });
    }
    return grupos;
  }

  function renderPaleta(filtro) {
    var q = norm(filtro || '');
    var grupos = comandosBase().map(function (g) {
      return { grupo: g.grupo, items: g.items.filter(function (it) { return !q || norm(it.t + ' ' + it.s).indexOf(q) !== -1; }) };
    }).filter(function (g) { return g.items.length; });
    paletaItems = [];
    var html = '';
    grupos.forEach(function (g) {
      html += '<div class="paleta-grupo">' + exc(g.grupo) + '</div>';
      g.items.forEach(function (it) {
        var idx = paletaItems.length;
        paletaItems.push(it);
        html += '<button class="paleta-item" data-paleta="' + idx + '" role="option">' +
          '<span class="pi" aria-hidden="true">' + it.ic + '</span>' +
          '<span class="pt"><b>' + exc(it.t) + '</b><small>' + exc(it.s) + '</small></span>' +
          (it.k ? '<span class="pa">' + exc(it.k) + '</span>' : '') + '</button>';
      });
    });
    $('#paletaLista').innerHTML = html || '<div class="paleta-vacio">Sin comandos que coincidan</div>';
    paletaIdx = 0;
    marcarPaleta();
  }

  var paletaItems = [], paletaIdx = 0;

  function marcarPaleta() {
    $$('#paletaLista .paleta-item').forEach(function (b, i) { b.classList.toggle('activo', i === paletaIdx); });
    var act = $('#paletaLista .paleta-item.activo');
    if (act && act.scrollIntoView) act.scrollIntoView({ block: 'nearest' });
  }

  function abrirPaleta() {
    $('#paleta').hidden = false;
    $('#paletaInput').value = '';
    renderPaleta('');
    $('#paletaInput').focus();
  }
  function cerrarPaleta() { $('#paleta').hidden = true; }
  function ejecutarPaleta(i) {
    var it = paletaItems[i];
    cerrarPaleta();
    if (it && it.run) it.run();
  }

  /* =======================================================================
   * 15. Ayuda de gestos y atajos
   * ===================================================================== */
  function gestoDemo(cls, titulo, desc) {
    return '<div class="gesto"><span class="demo ' + cls + '" aria-hidden="true"><i></i></span>' +
      '<span class="txt"><b>' + esc(titulo) + '</b><span>' + esc(desc) + '</span></span></div>';
  }
  function abrirAyuda() {
    $('#ayudaCuerpo').innerHTML =
      '<h3>Gestos (móvil)</h3>' +
      gestoDemo('der', 'Desliza en el carril', 'Cambia entre Mapa, Lista y Ambos') +
      gestoDemo('der', 'Desliza una tarjeta', 'Descubre acciones rápidas: favorita y detalle') +
      gestoDemo('arr', 'Arrastra la hoja', 'Ajusta la altura de la lista del mapa') +
      gestoDemo('pulso', 'Mantén pulsado un marcador', 'Abre el menú de acciones de la estación') +
      gestoDemo('tirar', 'Tira hacia abajo en la lista', 'Actualiza los precios') +
      '<h3>Atajos de teclado (PC)</h3>' +
      filaAtajo('Buscar estación', ['/']) +
      filaAtajo('Paleta de comandos', ['Ctrl', 'K']) +
      filaAtajo('Ir a Mapa, Lista, Ambos, IA, Config', ['1', '5']) +
      filaAtajo('Estación siguiente / anterior', ['J', 'K']) +
      filaAtajo('Favorita de la selección', ['F']) +
      filaAtajo('Cerrar capas y esta ayuda', ['Esc']);
    $('#ayuda').hidden = false;
  }
  function cerrarAyuda() { $('#ayuda').hidden = true; }
  /** Escapa solo lo justo para el HTML de la ayuda (evita "undefined" visibles). */
  function esc(s) { return exc(s == null ? '' : s); }

  /* =======================================================================
   * 16. Menú contextual, toast y utilidades de UI
   * ===================================================================== */
  function abrirMenu(e, x, y) {
    if (!e) return;
    var p = precioFinal(e, estado.fuel);
    var fav = estado.favoritos.has(e.id);
    var caja = $('#menuContexto');
    caja.innerHTML =
      '<div class="menu-cab">' + exc(e.marca) + ' · ' + eur2(p) + '</div>' +
      '<button data-maccion="abrir" data-id="' + e.id + '"><span class="ic" aria-hidden="true">🔎</span>Ver detalle</button>' +
      '<button data-maccion="fav" data-id="' + e.id + '"><span class="ic" aria-hidden="true">' + (fav ? '★' : '☆') + '</span>' +
        (fav ? 'Quitar de favoritas' : 'Añadir a favoritas') + '</button>' +
      '<button data-maccion="ruta" data-id="' + e.id + '"><span class="ic" aria-hidden="true">🧭</span>Cómo llegar</button>' +
      '<button data-maccion="compartir" data-id="' + e.id + '"><span class="ic" aria-hidden="true">↗</span>Compartir</button>';
    caja.hidden = false;
    var r = caja.getBoundingClientRect();
    caja.style.left = Math.max(8, Math.min(x, window.innerWidth - r.width - 8)) + 'px';
    caja.style.top = Math.max(8, Math.min(y, window.innerHeight - r.height - 8)) + 'px';
    menuTs = Date.now();
  }
  var menuTs = 0;
  function cerrarMenu() { $('#menuContexto').hidden = true; }

  var avisoTimer = null;
  function toast(msg) {
    var a = $('#aviso');
    a.textContent = msg;
    a.hidden = false;
    a.classList.add('visible');
    clearTimeout(avisoTimer);
    avisoTimer = setTimeout(function () {
      a.classList.remove('visible');
      setTimeout(function () { a.hidden = true; }, 200);
    }, 2400);
  }

  function limpiarFiltros() {
    estado.loc = ''; estado.marcas.clear(); estado.distMax = 0;
    estado.soloFav = false; estado.texto = ''; estado.pagina = 1; estado.orden = 'precio-asc';
    $('#buscador').value = ''; $('#btnLimpiarBusqueda').hidden = true;
    render();
    toast('Filtros limpiados');
  }

  function cerrarTodo() {
    if (!$('#paleta').hidden) { cerrarPaleta(); return true; }
    if (!$('#ayuda').hidden) { cerrarAyuda(); return true; }
    if (!$('#menuContexto').hidden) { cerrarMenu(); return true; }
    if (!$('#hojaOpciones').hidden) { cerrarHoja($('#hojaOpciones')); return true; }
    if (!$('#hojaDetalle').hidden) { cerrarHoja($('#hojaDetalle')); return true; }
    return false;
  }

  function moverSeleccion(paso) {
    if (estado.vista === 'ia' || estado.vista === 'config') setVista('lista', true);
    var lista = filtradas();
    if (!lista.length) return;
    var i = lista.map(function (e) { return e.id; }).indexOf(estado.seleccion);
    i = Math.max(0, Math.min(lista.length - 1, (i < 0 ? (paso > 0 ? -1 : 0) : i) + paso));
    estado.seleccion = lista[i].id;
    render();
    var card = $('#listaTarjetas .tarjeta.sel') || $('#listaHoja .tarjeta.sel');
    if (card && card.scrollIntoView) card.scrollIntoView({ block: 'nearest' });
  }

  function toggleFav(id) {
    if (estado.favoritos.has(id)) estado.favoritos.delete(id); else estado.favoritos.add(id);
    render();
    if (detalleId === id) abrirDetalle(id);
  }

  function accionConfig(a, el) {
    if (a === 'limpiar-filtros') { limpiarFiltros(); return; }
    if (a === 'limpiar-cache') { toast('Caché de la maqueta borrada (simulado)'); return; }
    if (a === 'limpiar-log') { toast('Registro borrado (simulado)'); return; }
    if (a === 'probar-push') { toast('🔔 Prueba: Ballenoil Villaverde ha bajado 0,02 €'); return; }
    if (a === 'refrescar-modelos') {
      var prov = estado.ia.prov;
      estado.ia.modelos[prov] = (MODELOS[prov] || ['integrado'])[0];
      renderIA(); toast('Catálogo de modelos actualizado'); return;
    }
    if (a === 'cargar-claves') {
      var pass = $('[data-cfg="pass"]');
      if (!pass || !pass.value) { toast('Escribe la contraseña de las claves'); return; }
      estado.cfg.claves = true; renderConfig(); toast('Claves cargadas para 5 proveedores'); return;
    }
    if (a === 'buscar-actualizacion') {
      el.disabled = true; el.textContent = 'Buscando…';
      setTimeout(function () {
        el.disabled = false; el.textContent = 'Buscar actualizaciones';
        toast('Ya tienes la última versión (' + F.versionApp.texto + ')');
      }, 900);
      return;
    }
    if (a === 'add-descuento') {
      var marca = F.marcasDe('28').find(function (m) { return !estado.descuentos[m]; }) || 'Nueva marca';
      estado.descuentos[marca] = 0.01; renderConfig(); render(); return;
    }
    if (a === 'borrar-descuento') { delete estado.descuentos[el.dataset.marca]; renderConfig(); render(); return; }
  }

  /* =======================================================================
   * 17. Gestos de móvil (mapa, hojas, tarjetas, tirar y carril)
   * ===================================================================== */
  /* Pulsación larga (y clic derecho) sobre un marcador → menú contextual */
  function pulsacionLarga(cont) {
    if (!cont || cont.dataset.largo) return;
    cont.dataset.largo = '1';
    var timer = null, objetivo = null, x0 = 0, y0 = 0;
    var cancelar = function () { clearTimeout(timer); timer = null; objetivo = null; };
    cont.addEventListener('pointerdown', function (ev) {
      var mk = ev.target.closest('[data-marcador]');
      if (!mk) return;
      objetivo = mk.dataset.marcador;
      x0 = ev.clientX; y0 = ev.clientY;
      timer = setTimeout(function () {
        var est = eById(objetivo);
        if (est) { abrirMenu(est, x0, y0); if (navigator.vibrate) navigator.vibrate(15); }
        timer = null; objetivo = null;
      }, 480);
    });
    cont.addEventListener('pointermove', function (ev) {
      if (timer && (Math.abs(ev.clientX - x0) > 9 || Math.abs(ev.clientY - y0) > 9)) cancelar();
    });
    cont.addEventListener('pointerup', cancelar);
    cont.addEventListener('pointercancel', cancelar);
    cont.addEventListener('contextmenu', function (ev) {
      var mk = ev.target.closest('[data-marcador]');
      if (!mk) return;
      ev.preventDefault();
      cancelar();
      abrirMenu(eById(mk.dataset.marcador), ev.clientX, ev.clientY);
    });
  }

  /* Swipe horizontal en las tarjetas de la lista → acciones rápidas */
  function swipeTarjetas(cont) {
    if (!cont || cont.dataset.swipe) return;
    cont.dataset.swipe = '1';
    var act = null;
    cont.addEventListener('pointerdown', function (ev) {
      if (ev.pointerType === 'mouse') return;
      if (ev.target.closest('[data-swipe]')) return;
      var t = ev.target.closest('.deslizable');
      if (!t) return;
      delete t.dataset.movido;
      act = { caja: t, card: t.querySelector('.tarjeta'), x0: ev.clientX, y0: ev.clientY, dx: 0, eje: null };
    });
    cont.addEventListener('pointermove', function (ev) {
      if (!act) return;
      var dx = ev.clientX - act.x0, dy = ev.clientY - act.y0;
      if (!act.eje) {
        if (Math.abs(dx) < 9 && Math.abs(dy) < 9) return;
        act.eje = Math.abs(dx) > Math.abs(dy) ? 'x' : 'y';
        if (act.eje === 'x') { try { act.caja.setPointerCapture(ev.pointerId); } catch (e) { /* sin captura */ } }
      }
      if (act.eje !== 'x' || !act.card) return;
      var base = act.caja.dataset.abierta === '1' ? -152 : 0;
      act.dx = Math.max(-152, Math.min(0, base + dx));
      act.card.style.transform = 'translateX(' + act.dx + 'px)';
    });
    var soltar = function () {
      if (!act) return;
      if (act.eje === 'x' && act.card) {
        if (Math.abs(act.dx) > 12) act.caja.dataset.movido = '1';
        var abrir = act.dx < -76;
        act.card.style.transform = abrir ? 'translateX(-152px)' : '';
        act.caja.dataset.abierta = abrir ? '1' : '';
      }
      act = null;
    };
    cont.addEventListener('pointerup', soltar);
    cont.addEventListener('pointercancel', soltar);
  }

  /* Tirar hacia abajo en la parte superior de la lista → refrescar */
  function tirarRefrescar(cont) {
    if (!cont || cont.dataset.tirar) return;
    cont.dataset.tirar = '1';
    var el = $('#tirar'), txt = $('#tirarTexto');
    var y0 = null, alto = 0;
    cont.addEventListener('touchstart', function (ev) {
      if (cont.scrollTop > 2 || ev.touches.length !== 1) { y0 = null; return; }
      y0 = ev.touches[0].clientY;
    }, { passive: true });
    cont.addEventListener('touchmove', function (ev) {
      if (y0 == null) return;
      var dy = ev.touches[0].clientY - y0;
      if (dy <= 0) {
        el.classList.remove('sin-transicion');
        el.style.height = '0px'; el.classList.remove('listo'); alto = 0; return;
      }
      alto = Math.min(78, dy * 0.5);
      el.classList.add('sin-transicion');
      el.style.height = alto + 'px';
      el.classList.toggle('listo', alto > 52);
      txt.textContent = alto > 52 ? 'Suelta para actualizar' : 'Tira para actualizar';
    }, { passive: true });
    var soltar = function () {
      if (y0 == null) return;
      y0 = null;
      el.classList.remove('sin-transicion');
      if (alto > 52) {
        el.classList.add('girando');
        txt.textContent = 'Actualizando precios…';
        el.style.height = '52px';
        setTimeout(function () {
          el.classList.remove('girando', 'listo');
          el.style.height = '0px';
          txt.textContent = 'Tira para actualizar';
          toast('Precios actualizados · ' + F.hoyCorto);
          render();
        }, 950);
      } else {
        el.style.height = '0px';
        el.classList.remove('listo');
        txt.textContent = 'Tira para actualizar';
      }
      alto = 0;
    };
    cont.addEventListener('touchend', soltar);
    cont.addEventListener('touchcancel', soltar);
  }

  /* Deslizar sobre el carril → cambiar de página (Mapa / Lista / Ambos) */
  function deslizarCarril() {
    var c = $('#carril');
    if (!c || c.dataset.deslizado) return;
    c.dataset.deslizado = '1';
    var x0 = null, y0 = 0, bloqueado = true;
    c.addEventListener('touchstart', function (ev) {
      if (esEscritorio() || ev.touches.length !== 1) { x0 = null; return; }
      if (ev.target.closest('.mapa, .ambos-mapa, .lista-scroll, .fila-chips, .tabla-envoltorio, .ia-pills, .ia-mensajes, .ia-prompts')) {
        bloqueado = true; x0 = null; return;
      }
      bloqueado = false; x0 = ev.touches[0].clientX; y0 = ev.touches[0].clientY;
    }, { passive: true });
    c.addEventListener('touchend', function (ev) {
      if (bloqueado || x0 == null) return;
      var t = ev.changedTouches[0];
      var dx = t.clientX - x0, dy = t.clientY - y0;
      x0 = null;
      if (Math.abs(dx) < 60 || Math.abs(dx) < Math.abs(dy) * 1.3) return;
      var i = indiceCarril() + (dx < 0 ? 1 : -1);
      if (i < 0 || i >= CARRIL.length) return;
      setVista(CARRIL[i], true);
    }, { passive: true });
  }

  /* =======================================================================
   * 18. Arranque y cableado de eventos
   * ===================================================================== */
  function init() {
    pintarNavegacion();
    pintarIndicador();

    /* ---- Delegación global de clics ---- */
    document.addEventListener('click', function (ev) {
      var t = ev.target;

      /* Navegación principal (nav de arriba/abajo y puntos del carril) */
      var nav = t.closest('button[data-vista]');
      if (nav) { setVista(nav.dataset.vista, true); return; }

      /* Menú contextual de un marcador */
      var mac = t.closest('[data-maccion]');
      if (mac) {
        var mid = mac.dataset.id, macc = mac.dataset.maccion;
        cerrarMenu();
        if (macc === 'abrir') abrirDetalle(mid);
        else if (macc === 'fav') { toggleFav(mid); toast(estado.favoritos.has(mid) ? 'Añadida a favoritas' : 'Quitada de favoritas'); }
        else toast(macc === 'ruta' ? 'Cómo llegar (simulado)' : 'Enlace copiado (simulado)');
        return;
      }

      /* Botones de abrir / cerrar capas */
      if (t.closest('#detalleCerrar')) { cerrarHoja($('#hojaDetalle')); return; }
      if (t.closest('#opcionesCerrar')) { cerrarHoja($('#hojaOpciones')); return; }
      if (t.closest('#paletaCerrar')) { cerrarPaleta(); return; }
      if (t.closest('#ayudaCerrar') || t.closest('#ayudaEntendido')) { cerrarAyuda(); return; }
      if (t.closest('#btnPaleta')) { abrirPaleta(); return; }
      if (t.closest('#btnAyudaGestos') || t.closest('#btnAyudaMapa')) { abrirAyuda(); return; }
      if (t.id === 'velo') { cerrarHoja($('#hojaDetalle')); cerrarHoja($('#hojaOpciones')); return; }
      if (t.id === 'paleta') { cerrarPaleta(); return; }
      if (t.id === 'ayuda') { cerrarAyuda(); return; }

      /* Zoom y centrado del mapa */
      if (t.closest('#btnZoomMas')) { estado.zoom = Math.min(2.6, estado.zoom * 1.25); renderMapa($('#mapa'), filtradas()); renderMapa($('#ambosMapa'), filtradas(), { sinYo: true }); return; }
      if (t.closest('#btnZoomMenos')) { estado.zoom = Math.max(0.7, estado.zoom / 1.25); renderMapa($('#mapa'), filtradas()); renderMapa($('#ambosMapa'), filtradas(), { sinYo: true }); return; }
      if (t.closest('#btnCentrar')) { estado.zoom = 1; estado.panX = 0; estado.panY = 0; renderMapa($('#mapa'), filtradas()); renderMapa($('#ambosMapa'), filtradas(), { sinYo: true }); toast('Centrado en tu ubicación'); return; }

      /* Agarres de las hojas y botón de ciclo */
      var ag = t.closest('#agarreLista, #agarreDetalle, #agarreOpciones');
      if (ag) {
        var caja = ag.closest('.hoja-lista, .hoja');
        if (caja && caja.dataset.arrastro === '1') { delete caja.dataset.arrastro; return; }
        if (ag.id === 'agarreLista') { ciclarHoja(); return; }
        if (ag.id === 'agarreDetalle') { cerrarHoja($('#hojaDetalle')); return; }
        cerrarHoja($('#hojaOpciones')); return;
      }
      if (t.closest('#btnHojaCiclo')) { ciclarHoja(); return; }

      /* Chips de filtro */
      var quitar = t.closest('[data-quitar]');
      if (quitar) {
        ev.stopPropagation();
        var q = quitar.dataset.quitar;
        if (q === 'loc') estado.loc = '';
        else if (q === 'marcas') estado.marcas.clear();
        else if (q === 'dist') estado.distMax = 0;
        estado.pagina = 1; render(); return;
      }
      var chip = t.closest('[data-chip]');
      if (chip) {
        var ch = chip.dataset.chip;
        if (ch === 'prov') hojaProvincia();
        else if (ch === 'fuel') hojaCombustible();
        else if (ch === 'loc') hojaLocalidad();
        else if (ch === 'marcas') hojaMarcas();
        else if (ch === 'dist') hojaDistancia();
        else if (ch === 'orden') hojaOrden();
        else if (ch === 'fav') { estado.soloFav = !estado.soloFav; estado.pagina = 1; render(); toast(estado.soloFav ? 'Mostrando solo favoritas' : 'Mostrando todas'); }
        else if (ch === 'limpiar') limpiarFiltros();
        return;
      }

      /* Acciones que revela el swipe de una tarjeta */
      var sw = t.closest('[data-swipe]');
      if (sw) {
        var sid = sw.dataset.estacion;
        var caja2 = sw.closest('.deslizable');
        if (caja2) {
          caja2.dataset.abierta = ''; delete caja2.dataset.movido;
          var card2 = caja2.querySelector('.tarjeta');
          if (card2) card2.style.transform = '';
        }
        if (sw.dataset.swipe === 'fav') { toggleFav(sid); toast(estado.favoritos.has(sid) ? 'Añadida a favoritas' : 'Quitada de favoritas'); }
        else abrirDetalle(sid);
        return;
      }

      /* Favoritos (estrella de tarjeta y celda de la tabla) */
      var fav = t.closest('[data-fav]');
      if (fav) { toggleFav(fav.dataset.fav); return; }

      /* Acciones del panel de detalle */
      if (t.closest('#detFav')) { if (detalleId) toggleFav(detalleId); return; }
      if (t.closest('#detRuta')) { toast('Cómo llegar (simulado)'); return; }
      if (t.closest('#detCompartir')) { toast('Enlace copiado (simulado)'); return; }
      if (t.closest('#detLlamar')) { toast('Llamando a la estación (simulado)'); return; }

      /* Pestañas del detalle (Precios / Histórico) */
      var dtab = t.closest('.detalle-tab');
      if (dtab) { mostrarPanelDetalle(dtab.dataset.dtab); return; }

      /* Abrir el detalle desde una tarjeta o una fila de la tabla */
      var est = t.closest('[data-estacion]');
      if (est) {
        var dl = est.closest('.deslizable');
        if (dl) {
          if (dl.dataset.movido === '1') { delete dl.dataset.movido; return; }
          if (dl.dataset.abierta === '1') {
            dl.dataset.abierta = '';
            var card3 = dl.querySelector('.tarjeta');
            if (card3) card3.style.transform = '';
            return;
          }
        }
        abrirDetalle(est.dataset.estacion); return;
      }
      var mk = t.closest('[data-marcador]');
      if (mk) { if (Date.now() - menuTs < 600) return; abrirDetalle(mk.dataset.marcador); return; }

      /* Hoja genérica de opciones */
      var op = t.closest('[data-opcion]');
      if (op) {
        var cuerpo = $('#opcCuerpo');
        var valor = op.dataset.opcion;
        if (cuerpo._tipo === 'multi') {
          if (cuerpo._sel.has(valor)) cuerpo._sel.delete(valor); else cuerpo._sel.add(valor);
          op.classList.toggle('elegida');
        } else {
          $$('#opcCuerpo .opcion').forEach(function (b) { b.classList.toggle('elegida', b === op); });
          cuerpo._valor = valor;
        }
        return;
      }
      var ope = t.closest('[data-opc]');
      if (ope) {
        var cp = $('#opcCuerpo');
        var limpiar = ope.dataset.opc === 'limpiar';
        var val;
        if (cp._tipo === 'multi') val = Array.from(cp._sel || []);
        else if (cp._tipo === 'slider') val = Number($('#opcSlider').value);
        else val = cp._valor;
        if (cp._aplicar) cp._aplicar(val, limpiar);
        cerrarHoja($('#hojaOpciones')); return;
      }

      /* Paginación y orden por columnas (vista Ambos) */
      var pag = t.closest('[data-pagina]');
      if (pag && !pag.disabled) { estado.pagina += pag.dataset.pagina === 'prev' ? -1 : 1; renderAmbos(); return; }
      var th = t.closest('#tablaEstaciones thead th');
      if (th && th.dataset.col) {
        if (th.dataset.col === estado.sortCol) estado.sortDir = estado.sortDir === 'asc' ? 'desc' : 'asc';
        else { estado.sortCol = th.dataset.col; estado.sortDir = 'asc'; }
        estado.vista = 'ambos'; renderAmbos(); return;
      }

      /* Chat IA */
      var pill = t.closest('[data-iaprov]');
      if (pill) { estado.ia.prov = pill.dataset.iaprov; renderIA(); return; }
      var prompt = t.closest('[data-prompt]');
      if (prompt) { enviarIA(prompt.dataset.prompt); return; }

      /* Paleta de comandos */
      var pal = t.closest('[data-paleta]');
      if (pal) { ejecutarPaleta(Number(pal.dataset.paleta)); return; }

      /* Config: sub-pestañas y modos */
      var ct = t.closest('[data-cachetab]');
      if (ct) { estado.cfg.cacheTab = ct.dataset.cachetab; renderConfig(); return; }
      var lt = t.closest('[data-logtab]');
      if (lt) { estado.cfg.logTab = lt.dataset.logtab; renderConfig(); return; }
      var md = t.closest('[data-modo]');
      if (md) { estado.cfg.modo = md.dataset.modo; renderConfig(); return; }

      /* Acciones sueltas (config, estado vacío, etc.) */
      var acc = t.closest('[data-accion]');
      if (acc) { accionConfig(acc.dataset.accion, acc); return; }

      /* Clic fuera: cierra el menú contextual si estaba abierto */
      if (!$('#menuContexto').hidden) cerrarMenu();
    });

    /* ---- Buscador ---- */
    $('#buscador').addEventListener('input', function (ev) {
      estado.texto = ev.target.value;
      $('#btnLimpiarBusqueda').hidden = !estado.texto;
      estado.pagina = 1;
      render();
    });
    $('#btnLimpiarBusqueda').addEventListener('click', function () {
      estado.texto = ''; $('#buscador').value = '';
      $('#btnLimpiarBusqueda').hidden = true; render();
    });

    /* ---- Chat IA: enviar ---- */
    $('#iaForm').addEventListener('submit', function (ev) {
      ev.preventDefault();
      var texto = $('#iaInput').value;
      $('#iaInput').value = '';
      enviarIA(texto);
    });

    /* ---- Selects y controles de config (delegado) ---- */
    document.addEventListener('change', function (ev) {
      var t = ev.target;
      if (t.id === 'histFuel') { estado.histFuel = t.value; dibujarGrafica(); return; }
      if (t.id === 'histDias') { estado.histDias = Number(t.value); dibujarGrafica(); return; }
      if (t.id === 'iaModelo') { estado.ia.modelos[estado.ia.prov] = t.value; return; }
      if (t.matches('[data-cfg-chk]')) { estado.cfg[t.dataset.cfgChk] = t.checked; toast(t.checked ? 'Aviso activado' : 'Aviso desactivado'); return; }
      if (t.matches('[data-ia-visible]')) {
        var id = t.dataset.iaVisible;
        if (t.checked) estado.cfg.ocultas.delete(id);
        else {
          var visibles = PROVEEDORES.slice(1).filter(function (p) { return !estado.cfg.ocultas.has(p.id) || p.id === id; });
          if (visibles.length <= 1) { t.checked = true; toast('Debe quedar al menos un proveedor visible'); return; }
          estado.cfg.ocultas.add(id);
        }
        toast('Pestañas de IA actualizadas'); return;
      }
      if (t.matches('[data-desc-valor]')) { estado.descuentos[t.dataset.descValor] = Number(t.value) || 0; render(); return; }
      if (t.matches('[data-desc-marca]')) {
        var viejo = t.dataset.descMarca, nuevo = t.value;
        var val = estado.descuentos[viejo]; delete estado.descuentos[viejo];
        estado.descuentos[nuevo] = val; renderConfig(); render(); return;
      }
      if (t.matches('[data-cfg]')) {
        var clave = t.dataset.cfg;
        estado.cfg[clave] = t.type === 'number' ? Number(t.value) : t.value;
        if (clave === 'pagina') { estado.porPagina = Number(t.value); estado.pagina = 1; render(); }
        return;
      }
    });

    /* ---- Teclado: paleta (Ctrl/⌘+K), atajos y Esc ---- */
    document.addEventListener('keydown', function (ev) {
      if ((ev.ctrlKey || ev.metaKey) && (ev.key === 'k' || ev.key === 'K')) {
        ev.preventDefault();
        if ($('#paleta').hidden) abrirPaleta(); else cerrarPaleta();
        return;
      }
      if (!$('#paleta').hidden) {
        if (ev.key === 'ArrowDown') { ev.preventDefault(); paletaIdx = Math.min(paletaItems.length - 1, paletaIdx + 1); marcarPaleta(); return; }
        if (ev.key === 'ArrowUp') { ev.preventDefault(); paletaIdx = Math.max(0, paletaIdx - 1); marcarPaleta(); return; }
        if (ev.key === 'Enter') { ev.preventDefault(); ejecutarPaleta(paletaIdx); return; }
        if (ev.key === 'Escape') { ev.preventDefault(); cerrarPaleta(); return; }
        return;
      }
      if (ev.key === 'Escape') { if (cerrarTodo()) ev.preventDefault(); return; }
      if (/input|select|textarea/i.test(ev.target.tagName) || ev.target.isContentEditable) return;
      if (ev.key === '?') { ev.preventDefault(); if ($('#ayuda').hidden) abrirAyuda(); else cerrarAyuda(); return; }
      if (ev.key === '/') { ev.preventDefault(); setVista('lista', true); setTimeout(function () { $('#buscador').focus(); }, 80); return; }
      if (/^[1-5]$/.test(ev.key)) { setVista(VISTAS[Number(ev.key) - 1].id, true); return; }
      if (ev.key === 'j' || ev.key === 'J') { moverSeleccion(1); return; }
      if (ev.key === 'k' || ev.key === 'K') { moverSeleccion(-1); return; }
      if (ev.key === 'f' || ev.key === 'F') {
        if (estado.seleccion) { toggleFav(estado.seleccion); toast(estado.favoritos.has(estado.seleccion) ? 'Añadida a favoritas' : 'Quitada de favoritas'); }
        return;
      }
      if (ev.key === 'Enter' && ev.target.matches('[data-estacion]')) abrirDetalle(ev.target.dataset.estacion);
    });
    $('#paletaInput').addEventListener('input', function (ev) { renderPaleta(ev.target.value); });

    /* ---- Gráfica del histórico: tooltip y recálculo al redimensionar ---- */
    window.addEventListener('resize', function () {
      aplicarAlturaHoja();
      if (detalleId && !$('#detPanelHistorico').hidden) dibujarGrafica();
    });
    var cvHist = $('#histCanvas');
    cvHist.addEventListener('mousemove', tooltipGrafica);
    cvHist.addEventListener('mouseleave', function () { $('#histTooltip').hidden = true; });
    cvHist.addEventListener('touchmove', function (ev) {
      var tg = ev.touches[0];
      tooltipGrafica({ clientX: tg.clientX, clientY: tg.clientY });
    }, { passive: true });

    /* ---- Gestos ---- */
    iniciarPan($('#mapa'));
    iniciarPan($('#ambosMapa'));
    pulsacionLarga($('#mapa'));
    pulsacionLarga($('#ambosMapa'));
    swipeTarjetas($('#listaScroll'));
    tirarRefrescar($('#listaScroll'));
    deslizarCarril();
    hojaArrastrable($('#hojaLista'), $('#agarreLista'), ALTURAS_HOJA, null);
    hojaArrastrable($('#hojaDetalle'), $('#agarreDetalle'), [0.92], function () { cerrarHoja($('#hojaDetalle')); });
    hojaArrastrable($('#hojaOpciones'), $('#agarreOpciones'), [0.86], function () { cerrarHoja($('#hojaOpciones')); });

    /* ---- Arranque ---- */
    setVista('mapa');
    aplicarAlturaHoja();
    render();
    toast('Prototipo 6 · gestos y atajos listos');
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
