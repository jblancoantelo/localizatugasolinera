/* =============================================================================
 * Prototipo 1 · «Mapa + hojas» — lógica de la maqueta
 * -----------------------------------------------------------------------------
 * Todo el estado vive en memoria (nada de localStorage) y los datos salen de
 * window.FAKE (../shared/datos-fake.js). La maqueta busca validar:
 *   - Navegación con 5 destinos sin toolbar saturada
 *   - Filtrado real (provincia, localidad, combustible, marcas, distancia,
 *     favoritas y búsqueda) desde chips + hojas
 *   - Mapa con zoom/arrastre y marcadores-precio
 *   - Detalle con histórico dibujado en canvas y tooltip
 *   - Chat IA y Config dentro del mismo lenguaje visual
 * ========================================================================== */
(function () {
  'use strict';

  var F = window.FAKE;
  var $ = function (sel, raiz) { return (raiz || document).querySelector(sel); };
  var $$ = function (sel, raiz) { return Array.prototype.slice.call((raiz || document).querySelectorAll(sel)); };

  /* =======================================================================
   * 1. Estado y utilidades
   * ===================================================================== */
  var DIAS = [7, 14, 21, 30, 60, 90, 180];
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
    google: ['gemini-3.8-flash', 'gemini-3.5-flash']
  };

  var estado = {
    vista: 'mapa',
    prov: '28',
    loc: '',
    fuel: 'Gasolina 95 E5',
    marcas: new Set(),
    distMax: 0,
    soloFav: false,
    texto: '',
    orden: 'precio-asc',
    visibles: 8,                 /* tarjetas mostradas en la vista lista */
    porPagina: F.config.pageSize,
    pagina: 1,
    sortCol: 'precio',
    sortDir: 'asc',
    seleccion: null,
    favoritos: new Set(F.estaciones.filter(function (e) { return e.fav; }).map(function (e) { return e.id; })),
    descuentos: Object.assign({}, F.descuentos),
    zoom: 1, panX: 0, panY: 0,
    histDias: 14,
    histFuel: 'Gasolina 95 E5',
    estiloMapa: 'Satélite',
    ia: { prov: 'general', modelos: {}, mensajes: {}, enviando: false },
    cfg: {
      cacheTab: 'indexeddb', logTab: 'api', ttl: 12, pagina: F.config.pageSize,
      push: true, pushSubida: false, intervalo: 8, diasFall: 3, modo: 'average',
      claves: false, ocultas: new Set(), prompts: [F.prompts[0], F.prompts[1], '', '', '']
    }
  };

  function norm(s) {
    return String(s).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  }
  function eur(p) { return p == null ? '—' : p.toFixed(3).replace('.', ',') + ' €'; }
  function eur2(p) { return p == null ? '—' : p.toFixed(2).replace('.', ','); }
  function km(d) { return d.toFixed(1).replace('.', ',') + ' km'; }
  function pct(v) { return (v >= 0 ? '+' : '') + v.toFixed(1).replace('.', ',') + ' %'; }
  function exc(s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
  function iniciales(marca) {
    return marca.split(/[\s.]+/).filter(Boolean).slice(0, 2).map(function (w) { return w[0]; }).join('').toUpperCase();
  }

  /** Precio mostrado = precio del Ministerio menos el descuento por marca. */
  function precioFinal(est, fuel) {
    var p = F.precioDe(est, fuel);
    if (p == null) return null;
    var d = estado.descuentos[est.marca] || 0;
    return Math.round((p - d) * 1000) / 1000;
  }
  /** Leyenda dinámica: umbrales por tercios de los precios filtrados. */
  function umbrales() {
    var vals = filtradas().map(function (e) { return precioFinal(e, estado.fuel); })
      .filter(function (v) { return v != null; }).sort(function (a, b) { return a - b; });
    if (vals.length < 3) return { bajo: 1.50, alto: 1.70 };
    var ter = function (q) { return vals[Math.min(vals.length - 1, Math.floor(vals.length * q))]; };
    return { bajo: Math.round(ter(0.34) * 100) / 100, alto: Math.round(ter(0.67) * 100) / 100 };
  }
  function clasePrecio(p) {
    if (p == null) return 'gris';
    var u = umbrales();
    if (p < u.bajo) return 'verde';
    if (p <= u.alto) return 'naranja';
    return 'rojo';
  }
  function varColor(v) { return v < 0 ? 'txt-verde' : v > 0 ? 'txt-rojo' : ''; }

  /* =======================================================================
   * 2. Iconos (SVG inline, sin dependencias)
   * ===================================================================== */
  var ICO = {
    ubicacion: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="3.2"/><path d="M12 2v3.2M12 18.8V22M2 12h3.2M18.8 12H22"/></svg>',
    refrescar: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M20 11a8 8 0 1 0-2.3 5.7"/><path d="M20 4v7h-7"/></svg>',
    mapa: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"><path d="M9 3 3 5v16l6-2 6 2 6-2V3l-6 2-6-2Z"/><path d="M9 3v16M15 5v16"/></svg>',
    lista: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M8 6h13M8 12h13M8 18h13M3.5 6h.01M3.5 12h.01M3.5 18h.01"/></svg>',
    ambos: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="3"/><path d="M12 3v18M3 13h9"/></svg>',
    ia: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M12 3v3M12 18v3M3 12h3M18 12h3M5.6 5.6l2.1 2.1M16.3 16.3l2.1 2.1M18.4 5.6l-2.1 2.1M7.7 16.3l-2.1 2.1"/><circle cx="12" cy="12" r="3.4"/></svg>',
    config: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M4 7h10M18 7h2M4 17h4M12 17h8"/><circle cx="16" cy="7" r="2.2"/><circle cx="10" cy="17" r="2.2"/></svg>'
  };

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
    var cp = function (e) { return precioFinal(e, estado.fuel); };
    var col = estado.vista === 'ambos' ? estado.sortCol : (estado.orden === 'dist' ? 'dist' : 'precio');
    var dir = estado.vista === 'ambos'
      ? (estado.sortDir === 'asc' ? 1 : -1)
      : (estado.orden === 'precio-desc' ? -1 : 1);
    var copia = lista.slice();
    copia.sort(function (a, b) {
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
    return copia;
  }

  /* =======================================================================
   * 4. Chips de filtro
   * ===================================================================== */
  function renderChips() {
    var caja = $('#filaChips');
    var html = '';
    html += chip('prov', 'Provincia: ' + (estado.prov ? F.provinciaNombre(estado.prov) : 'Todas'), estado.prov ? 'activo' : '', false);
    html += chip('fuel', estado.fuel || 'Combustible', estado.fuel ? 'activo' : '', false);
    html += chip('loc', estado.loc || 'Localidad', estado.loc ? 'activo' : '', !!estado.loc);
    html += chip('marcas', estado.marcas.size ? 'Marcas · ' + estado.marcas.size : 'Marca', estado.marcas.size ? 'activo' : '', !!estado.marcas.size);
    html += chip('dist', estado.distMax ? '‹ ' + estado.distMax + ' km' : 'Distancia', estado.distMax ? 'activo' : '', !!estado.distMax);
    html += chip('fav', '★ Favoritas', estado.soloFav ? 'activo' : '', false);
    html += chip('orden', ordenTexto(), '', false);
    if (hayFiltros()) html += '<button class="chip sutil" data-chip="limpiar">Limpiar filtros</button>';
    caja.innerHTML = html;
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
   * 5. Mapa (fondo SVG + marcadores con zoom y arrastre)
   * ===================================================================== */
  function pintarFondo(cont) {
    if (cont.querySelector('svg')) return;
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
    var fondo = cont.querySelector('.mapa-fondo') || cont;
    pintarFondo(fondo);
    var capa = cont.querySelector('.mapa-marcadores');
    if (!capa) return;
    var u = umbrales();
    var html = '';
    if (!opciones.sinYo) {
      var yo = posMarcador(F.mapa.tuPosicion.mx, F.mapa.tuPosicion.my);
      html += '<div class="marcador-yo" style="left:' + yo.left + ';top:' + yo.top + '" title="Tu ubicación"></div>';
    }
    lista.slice(0, opciones.tope || 40).forEach(function (e) {
      var p = precioFinal(e, estado.fuel);
      var pos = posMarcador(e.mx, e.my);
      var color = { verde: '#1b8a4b', naranja: '#b26a00', rojo: '#c0392b', gris: '#8695a4' }[clasePrecio(p)];
      html += '<button class="marcador' + (estado.seleccion === e.id ? ' sel' : '') + (estado.favoritos.has(e.id) ? ' fav' : '') +
        '" style="left:' + pos.left + ';top:' + pos.top + ';--c:' + color + '" data-marcador="' + e.id +
        '" aria-label="' + exc(e.marca + ' ' + e.nombre + ', ' + (p == null ? 'sin precio' : eur(p))) + '">' +
        (p == null ? '—' : eur2(p)) + '</button>';
    });
    capa.innerHTML = html;
    /* El fondo se escala y desplaza para dar sensación de zoom sobre el mapa */
    fondo.style.transform = 'scale(' + (0.9 + estado.zoom * 0.55) + ') translate(' + (estado.panX / 3) + '%,' + (estado.panY / 3) + '%)';
  }

  /* Arrastre del mapa con pointer events (móvil y ratón) */
  function activarArrastre(cont) {
    if (!cont || cont.dataset.arrastre) return;
    cont.dataset.arrastre = '1';
    var activo = false, x0 = 0, y0 = 0, px = 0, py = 0;
    cont.addEventListener('pointerdown', function (ev) {
      if (ev.target.closest('.marcador, .mapa-hud, .mapa-zoom')) return;
      activo = true; x0 = ev.clientX; y0 = ev.clientY; px = estado.panX; py = estado.panY;
      cont.classList.add('arrastrando');
      cont.setPointerCapture(ev.pointerId);
    });
    cont.addEventListener('pointermove', function (ev) {
      if (!activo) return;
      var r = cont.getBoundingClientRect();
      estado.panX = Math.max(-30, Math.min(30, px + (ev.clientX - x0) / r.width * 100));
      estado.panY = Math.max(-30, Math.min(30, py + (ev.clientY - y0) / r.height * 100));
      pintarMarcadoresSolo(cont);
    });
    var soltar = function () { activo = false; cont.classList.remove('arrastrando'); };
    cont.addEventListener('pointerup', soltar);
    cont.addEventListener('pointercancel', soltar);
  }
  function pintarMarcadoresSolo(cont) {
    renderMapa(cont, filtradas(), { sinYo: cont.id === 'ambosMapa' });
  }

  /* =======================================================================
   * 6. Tarjetas de estación
   * ===================================================================== */
  function tarjetaHTML(e, indice) {
    var p = precioFinal(e, estado.fuel);
    var u = umbrales();
    var cls = p != null && p < u.bajo ? ' barata' : '';
    var desc = estado.descuentos[e.marca] ? estado.descuentos[e.marca] : 0;
    var etiquetas = '';
    if (indice === 0 && estado.orden === 'precio-asc') etiquetas += '<span class="etiqueta ok">★ Más barata</span>';
    if (estado.favoritos.has(e.id)) etiquetas += '<span class="etiqueta info">Favorita</span>';
    if (desc) etiquetas += '<span class="etiqueta aviso">−' + desc.toFixed(2).replace('.', ',') + ' € con descuento</span>';
    if (e.horario === '24 h') etiquetas += '<span class="etiqueta">Abierta 24 h</span>';
    var color = { verde: 'txt-verde', naranja: 'txt-naranja', rojo: 'txt-rojo', gris: '' }[clasePrecio(p)];
    return '<div class="tarjeta' + cls + (estado.seleccion === e.id ? ' sel' : '') + '" data-estacion="' + e.id + '"' +
      (indice === 0 ? ' data-shot="detalle"' : '') + ' tabindex="0" role="button" ' +
      'aria-label="' + exc(e.marca + ' ' + e.nombre + ', ' + (p == null ? 'sin precio' : eur(p))) + '">' +
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
  }

  function vacioHTML() {
    return '<div class="vacio"><span class="icono" aria-hidden="true">🔍</span>' +
      '<h3>Sin estaciones con estos filtros</h3>' +
      '<p>Prueba a ampliar la distancia, quitar marcas o cambiar de combustible.</p>' +
      '<button data-accion="limpiar-filtros">Limpiar filtros</button></div>';
  }

  /* =======================================================================
   * 7. Vistas: lista, ambos, hoja del mapa
   * ===================================================================== */
  function renderLista() {
    var lista = filtradas();
    var visibles = lista.slice(0, estado.visibles);
    $('#listaContador').innerHTML = '<b>' + lista.length + '</b> estaciones · ' + exc(F.provinciaNombre(estado.prov));
    $('#listaTarjetas').innerHTML = lista.length
      ? grupoHTML('Hoy · viernes 16 de octubre', lista.length) + visibles.map(tarjetaHTML).join('')
      : vacioHTML();
    $('#btnCargarMas').hidden = lista.length <= estado.visibles;
    $('#btnCargarMas').textContent = 'Cargar ' + Math.min(8, lista.length - estado.visibles) + ' estaciones más';
  }

  function grupoHTML(texto, cuenta) {
    return '<div class="grupo-cabecera"><span>' + exc(texto) + '</span><span>' + cuenta + ' resultados</span></div>';
  }

  function renderHoja() {
    var lista = filtradas();
    var barata = lista.length ? precioFinal(lista[0], estado.fuel) : null;
    var media = F.mediaProvincia(estado.prov, estado.fuel);
    $('#hojaTitulo').textContent = lista.length + ' estaciones';
    $('#hojaSub').textContent = lista.length
      ? 'Más barata ' + eur(barata) + ' · media ' + eur(media)
      : 'Ningún resultado con estos filtros';
    $('#listaHoja').innerHTML = lista.length ? lista.slice(0, 12).map(tarjetaHTML).join('') : vacioHTML();
    $('#btnOrdenHoja').textContent = ordenTexto();
    $('#btnOrdenHoja').className = 'mini-btn' + (estado.orden !== 'precio-asc' ? ' activo' : '');
  }

  function renderAmbos() {
    var lista = filtradas();
    var total = Math.max(1, Math.ceil(lista.length / (estado.porPagina || lista.length)));
    estado.pagina = Math.min(estado.pagina, total);
    var ini = estado.porPagina ? (estado.pagina - 1) * estado.porPagina : 0;
    var trozo = estado.porPagina ? lista.slice(ini, ini + estado.porPagina) : lista;
    $('#ambosContador').innerHTML = '<b>' + lista.length + '</b> estaciones · página ' + estado.pagina + ' de ' + total;
    $('#tablaCuerpo').innerHTML = trozo.map(function (e) {
      var p = precioFinal(e, estado.fuel);
      var color = { verde: 'txt-verde', naranja: 'txt-naranja', rojo: 'txt-rojo', gris: '' }[clasePrecio(p)];
      return '<tr data-estacion="' + e.id + '"' + (estado.seleccion === e.id ? ' class="sel"' : '') + ' tabindex="0">' +
        '<td>' + exc(e.marca) + '</td>' +
        '<td class="celda-precio ' + color + '">' + eur(p) + '</td>' +
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
    var barata = lista.length ? precioFinal(lista[0], estado.fuel) : null;
    var u = umbrales();
    $('#infoTexto').innerHTML = '<b>' + lista.length + '</b> resultados' +
      (estado.fuel ? ' · ' + exc(estado.fuel) : '') + ' · ' + exc(F.provinciaNombre(estado.prov));
    $('#infoDatos').textContent = lista.length ? 'Mín ' + eur(barata) + ' · media ' + eur(media) : '';
    $('#leyenda').innerHTML =
      '<span><i class="p-verde"></i>‹ ' + eur2(u.bajo) + '</span>' +
      '<span><i class="p-naranja"></i>' + eur2(u.bajo) + '–' + eur2(u.alto) + '</span>' +
      '<span><i class="p-rojo"></i>› ' + eur2(u.alto) + '</span>';
  }

  function render() {
    renderChips();
    renderInfo();
    renderLista();
    renderHoja();
    renderAmbos();
    var cont = $('#vista-mapa .mapa');
    renderMapa(cont, filtradas());
    renderMapa($('#ambosMapa'), filtradas(), { sinYo: true, sinHoja: true });
    activarArrastre(cont);
    activarArrastre($('#ambosMapa'));
  }

  /* =======================================================================
   * 8. Detalle de estación
   * ===================================================================== */
  var detalleId = null;

  function abrirDetalle(id) {
    var e = F.estaciones.find(function (x) { return x.id === id; });
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

    /* Precios: destacamos el más barato de los que vende */
    var precios = Object.keys(e.precios).filter(function (k) { return e.precios[k] != null; });
    var masBarato = precios.slice().sort(function (a, b) { return e.precios[a] - e.precios[b]; })[0];
    $('#detPanelPrecios').innerHTML = '<div class="lista-combustibles">' + precios.map(function (k) {
      var d = estado.descuentos[e.marca] || 0;
      var final = Math.round((e.precios[k] - d) * 1000) / 1000;
      var act = k === estado.fuel ? ' ·' : '';
      return '<div class="combustible' + (k === masBarato ? ' mejor' : '') + '">' +
        '<span class="nombre">' + exc(k) + '<br><small style="color:var(--txt-3)">' +
        (d ? 'Precio Ministerio ' + eur(e.precios[k]) + ' · descuento −' + d.toFixed(2).replace('.', ',') + ' €' : act || 'Precio en el surtidor') +
        '</small></span>' +
        '<span class="importe">' + eur(final) + '</span></div>';
    }).join('') + '</div>';

    /* Histórico: combustibles del surtidor + días disponibles */
    var opcionesFuel = precios.map(function (k) {
      return '<option value="' + exc(k) + '"' + (k === estado.histFuel ? ' selected' : '') + '>' + exc(k) + '</option>';
    }).join('');
    $('#histFuel').innerHTML = opcionesFuel;
    if (precios.indexOf(estado.histFuel) === -1) estado.histFuel = precios[0];
    $('#histFuel').value = estado.histFuel;
    $('#histDias').innerHTML = DIAS.map(function (d) {
      return '<option value="' + d + '"' + (d === estado.histDias ? ' selected' : '') + '>' + d + ' días</option>';
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

  /* --- Gráfica del histórico en canvas, con tooltip y medias --- */
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

    /* Rejilla + etiquetas de precio */
    ctx.font = '10px ui-monospace, monospace';
    ctx.fillStyle = '#8695a4';
    ctx.textAlign = 'right'; ctx.textBaseline = 'middle';
    for (var g = 0; g <= 4; g++) {
      var v = min + (max - min) * g / 4;
      var yy = y(v);
      ctx.strokeStyle = g === 0 ? '#dbe3ea' : '#eef2f6';
      ctx.beginPath(); ctx.moveTo(P.izq, yy); ctx.lineTo(W - P.der, yy); ctx.stroke();
      ctx.fillText(v.toFixed(3).replace('.', ','), P.izq - 6, yy);
    }
    /* Media del periodo (guía discontinua) */
    ctx.setLineDash([4, 4]); ctx.strokeStyle = '#b9c4cf';
    ctx.beginPath(); ctx.moveTo(P.izq, y(media)); ctx.lineTo(W - P.der, y(media)); ctx.stroke();
    ctx.setLineDash([]);

    /* Área + línea */
    var grad = ctx.createLinearGradient(0, P.arr, 0, P.arr + alto);
    grad.addColorStop(0, 'rgba(26,115,232,.22)');
    grad.addColorStop(1, 'rgba(26,115,232,0)');
    ctx.beginPath();
    serie.forEach(function (p, i) { i ? ctx.lineTo(x(i), y(p.precio)) : ctx.moveTo(x(i), y(p.precio)); });
    ctx.lineTo(x(serie.length - 1), P.arr + alto); ctx.lineTo(x(0), P.arr + alto); ctx.closePath();
    ctx.fillStyle = grad; ctx.fill();

    ctx.beginPath();
    serie.forEach(function (p, i) { i ? ctx.lineTo(x(i), y(p.precio)) : ctx.moveTo(x(i), y(p.precio)); });
    ctx.strokeStyle = '#1a73e8'; ctx.lineWidth = 2.2; ctx.lineJoin = 'round'; ctx.stroke();

    /* Puntos */
    var pts = [];
    serie.forEach(function (p, i) {
      var px = x(i), py = y(p.precio);
      pts.push({ x: px, y: py, fecha: p.fecha, precio: p.precio });
      if (serie.length <= 40) {
        ctx.beginPath(); ctx.arc(px, py, 2.4, 0, Math.PI * 2);
        ctx.fillStyle = '#fff'; ctx.fill();
        ctx.strokeStyle = '#1a73e8'; ctx.lineWidth = 1.6; ctx.stroke();
      }
    });
    cv._pts = pts;

    /* Extremos anotados */
    var iMin = precios.indexOf(Math.min.apply(null, precios));
    var iMax = precios.indexOf(Math.max.apply(null, precios));
    ctx.font = '10px system-ui, sans-serif'; ctx.textAlign = 'center';
    ctx.fillStyle = '#1b8a4b';
    ctx.fillText(eur(min + pad), x(iMin), y(precios[iMin]) - 9);
    ctx.fillStyle = '#c0392b';
    ctx.fillText(eur(max - pad), x(iMax), y(precios[iMax]) + 14);

    /* Fechas (5 etiquetas repartidas) */
    ctx.fillStyle = '#8695a4'; ctx.textAlign = 'center'; ctx.textBaseline = 'top';
    var paso = Math.max(1, Math.round((serie.length - 1) / 4));
    serie.forEach(function (p, i) {
      if (i % paso === 0 || i === serie.length - 1) {
        ctx.fillText(p.fecha.slice(0, 5), Math.min(W - P.der - 12, Math.max(P.izq + 12, x(i))), P.arr + alto + 8);
      }
    });

    /* Resumen numérico */
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
    tt.innerHTML = '<b style="font-family:var(--mono)">' + eur(mejor.p.precio) + '</b><br>' + mejor.p.fecha;
  }

  /* =======================================================================
   * 9. Hojas arrastrables
   * ===================================================================== */
  var esEscritorio = function () { return window.matchMedia('(min-width: 1000px)').matches; };

  /** Hace arrastrable una hoja. `alturas` en % de la ventana. */
  function hojaArrastrable(hoja, agarre, alturas, alCerrar) {
    if (hoja.dataset.drag) return;
    hoja.dataset.drag = '1';
    var arrastrando = false, y0 = 0, base = 0, movido = 0;

    agarre.addEventListener('pointerdown', function (ev) {
      if (esEscritorio()) return;
      arrastrando = true; y0 = ev.clientY; movido = 0;
      base = hoja.getBoundingClientRect().height;
      delete hoja.dataset.arrastro;
      hoja.classList.add('arrastrando');
      agarre.setPointerCapture(ev.pointerId);
    });
    agarre.addEventListener('pointermove', function (ev) {
      if (!arrastrando) return;
      var dy = ev.clientY - y0;
      movido = Math.max(movido, Math.abs(dy));
      /* Tirar hacia abajo reduce la altura de la hoja (como en una app nativa) */
      var alto = Math.max(70, Math.min(window.innerHeight, base - dy));
      hoja.style.setProperty('--alto', alto + 'px');
    });
    var soltar = function () {
      if (!arrastrando) return;
      arrastrando = false;
      hoja.classList.remove('arrastrando');
      if (movido > 8) hoja.dataset.arrastro = '1';
      var alto = hoja.getBoundingClientRect().height;
      if (hoja.id !== 'hojaLista' && alto < window.innerHeight * 0.35) {
        hoja.style.removeProperty('--alto');
        if (alCerrar) alCerrar();
        return;
      }
      var cerca = alturas.map(function (a) { return { a: a, d: Math.abs(window.innerHeight * a / 100 - alto) }; })
        .sort(function (x, y) { return x.d - y.d; })[0];
      hoja.style.setProperty('--alto', cerca.a + '%');
      if (hoja.id === 'hojaLista') hoja.classList.toggle('medio', cerca.a === 58);
    };
    agarre.addEventListener('pointerup', soltar);
    agarre.addEventListener('pointercancel', soltar);
  }

  function abrirHoja(hoja) {
    hoja.hidden = false;
    if (esEscritorio()) { hoja.classList.add('abierta'); return; }
    if (hoja.id !== 'hojaLista') {
      var v = $('#velo');
      v.hidden = false;
      requestAnimationFrame(function () { v.classList.add('visible'); });
    }
    requestAnimationFrame(function () { hoja.classList.add('abierta'); });
  }
  function cerrarHoja(hoja) {
    if (esEscritorio()) { hoja.hidden = true; return; }
    hoja.classList.remove('abierta');
    var v = $('#velo');
    v.classList.remove('visible');
    setTimeout(function () {
      hoja.hidden = true;
      v.hidden = true;
    }, 260);
  }

  /* =======================================================================
   * 10. Hoja genérica de opciones (single / multi / slider)
   * ===================================================================== */
  function abrirOpciones(cfg) {
    $('#opcTitulo').textContent = cfg.titulo;
    var cuerpo = $('#opcCuerpo');
    var seleccion = cfg.tipo === 'multi' ? new Set(cfg.valor || []) : cfg.valor;
    var render = function () {
      if (cfg.tipo === 'slider') {
        cuerpo.innerHTML = '<label style="display:block"><span style="font-size:13.5px;color:var(--txt-2)">Máximo ' +
          '<b id="opcValor">' + (seleccion || 0) + ' km</b></span>' +
          '<input class="deslizador" type="range" min="' + cfg.min + '" max="' + cfg.max + '" step="' + cfg.paso +
          '" value="' + (seleccion || CFG_SLIDER_NEUTRO(cfg)) + '" id="opcSlider" style="width:100%;margin-top:10px"></label>';
        $('#opcSlider').addEventListener('input', function (ev) {
          seleccion = Number(ev.target.value);
          $('#opcValor').textContent = (seleccion === 0 ? 'Sin límite' : seleccion + ' km');
        });
      } else {
        cuerpo.innerHTML = cfg.opciones.map(function (o) {
          var elegida = cfg.tipo === 'multi' ? seleccion.has(o.valor) : seleccion === o.valor;
          return '<button class="opcion' + (elegida ? ' elegida' : '') + '" data-opcion="' + exc(o.valor) + '">' +
            '<span class="marca-check">✓</span><span>' + exc(o.etiqueta) + '</span>' +
            (o.cuenta != null ? '<span class="cuenta">' + o.cuenta + '</span>' : '') + '</button>';
        }).join('');
      }
    };
    render();
    $('#opcPie').innerHTML =
      (cfg.limpiar ? '<button class="limpiar" data-opc="limpiar">' + cfg.limpiar + '</button>' : '') +
      '<button class="aplicar" data-opc="aplicar">' + (cfg.aplicar || 'Aplicar') + '</button>';
    abrirHoja($('#hojaOpciones'));
  }
  function CFG_SLIDER_NEUTRO(cfg) { return cfg.max; }

  /* =======================================================================
   * 11. Chat IA
   * ===================================================================== */
  function iaMensajes(prov) {
    if (!estado.ia.mensajes[prov]) {
      estado.ia.mensajes[prov] = (F.chatsIA[prov] || []).map(function (m) {
        return { rol: m.role === 'user' ? 'usuario' : 'ia', texto: m.content };
      });
    }
    return estado.ia.mensajes[prov];
  }
  function modeloDe(prov) { return estado.ia.modelos[prov] || (MODELOS[prov] || [])[0] || ''; }

  function renderIA() {
    var prov = estado.ia.prov;
    var visibles = PROVEEDORES.filter(function (p) {
      return p.id === 'general' || !estado.cfg.ocultas.has(p.id);
    });
    if (prov !== 'general' && estado.cfg.ocultas.has(prov)) estado.ia.prov = prov = 'general';
    $('#iaPills').innerHTML = visibles.map(function (p) {
      return '<button class="ia-pill' + (p.id === prov ? ' activo' : '') + '" role="tab" data-iaprov="' + p.id +
        '" aria-selected="' + (p.id === prov) + '">' + exc(p.nombre) + '</button>';
    }).join('');
    $('#iaCabecera').innerHTML = prov === 'general'
      ? '<span>Misma pregunta a todos los proveedores visibles, en paralelo.</span>' +
        '<span class="ia-estado ok">✅ 5/7 listos</span>'
      : '<label style="display:flex;align-items:center;gap:6px">Modelo' +
        '<select id="iaModelo">' + (MODELOS[prov] || ['integrado']).map(function (m) {
          return '<option' + (m === modeloDe(prov) ? ' selected' : '') + '>' + exc(m) + '</option>';
        }).join('') + '</select></label>' +
        '<button class="mini-btn" id="iaRefrescar">↻ Modelos</button>' +
        '<span class="ia-estado ' + (prov === 'chrome-nano' ? 'no' : 'ok') + '">' +
        (prov === 'chrome-nano' ? 'Nano en el navegador' : '✅ API Key cargada') + '</span>';
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
        (m.rol === 'cargando' ? 'Pensando… <button class="mini-btn" data-accion="cancelar-ia">Cancelar</button>' : markdownIA(m.texto)) +
        (m.ms ? '<div class="meta">⏱ ' + exc(m.modelo) + ' · ' + m.ms + ' s</div>' : '') + '</div>';
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

  function enviarIA(texto) {
    if (!texto.trim() || estado.ia.enviando) return;
    var prov = estado.ia.prov;
    var lista = iaMensajes(prov);
    lista.push({ rol: 'usuario', texto: texto });
    lista.push({ rol: 'cargando' });
    estado.ia.enviando = true;
    pintarMensajesIA();
    setTimeout(function () {
      lista.pop();                                   /* quitamos el "pensando…" */
      var ms = (0.6 + Math.random() * 1.4).toFixed(1).replace('.', ',');
      if (prov === 'general') {
        lista.push({
          rol: 'grupo', respuestas: [
            { prov: 'Groq', modelo: modeloDe('groq') || 'qwen/qwen3.8-27b', ms: ms, texto: 'Las 3 más baratas de tu provincia son **Ballenoil Villaverde** (1,479 €), **Petroprix Torrejón** (1,469 €) y **Nomo Pozuelo** (1,479 €). El descuento de Repsol (−0,05 €) deja su precio en **1,539 €**.' },
            { prov: 'Mistral', modelo: modeloDe('mistral') || 'open-mistral-nemo', ms: (Number(ms.replace(',', '.')) + 0.4).toFixed(1).replace('.', ','), texto: 'En la última semana la media provincial bajó **0,9 %**. El gasóleo A es el que más ha caído.' },
            { prov: 'LLM7.io', modelo: 'codestral-latest', ms: ms, texto: '| Estación | Precio |\n|---|---|\n| Petroprix Torrejón | 1,469 € |\n| Nomo Pozuelo | 1,479 € |' }
          ]
        });
      } else {
        var ejemplo = (F.chatsIA[prov] || [])[1];
        var barata = filtradas()[0];
        lista.push({
          rol: 'ia', modelo: modeloDe(prov) || 'integrado', ms: ms,
          texto: ejemplo ? ejemplo.content
            : (barata
              ? 'Con los datos cargados ahora mismo, la estación más barata de **' + F.provinciaNombre(estado.prov) +
                '** para ' + estado.fuel + ' es **' + barata.marca + '** a **' + eur(precioFinal(barata, estado.fuel)) + '**.'
              : 'No hay estaciones que cumplan los filtros actuales; amplía la búsqueda y vuelvo a mirarlo.')
        });
      }
      estado.ia.enviando = false;
      pintarMensajesIA();
    }, 1100);
  }

  /* =======================================================================
   * 12. Configuración (acordeón con controles operativos)
   * ===================================================================== */
  function renderConfig() {
    var c = estado.cfg;
    var descuentos = Object.keys(estado.descuentos).map(function (m) {
      return '<div class="fila-borrar"><input type="text" value="' + exc(m) + '" data-desc-marca="' + exc(m) + '" aria-label="Marca">' +
        '<input type="number" step="0.01" value="' + estado.descuentos[m].toFixed(2) + '" data-desc-valor="' + exc(m) + '" aria-label="Descuento en euros por litro">' +
        '<button data-accion="borrar-descuento" data-marca="' + exc(m) + '" aria-label="Quitar descuento">✕</button></div>';
    }).join('');
    var log = c.logTab === 'api' ? F.logApi : F.logPush;
    var prompts = c.prompts.map(function (p, i) {
      return '<div class="fila-borrar"><span style="width:22px;color:var(--azul);font-weight:700">' + (i + 1) + '</span>' +
        '<input type="text" value="' + exc(p) + '" data-prompt="' + i + '" placeholder="Prompt ' + (i + 1) + ' (vacío = oculto)"></div>';
    }).join('');

    $('#configLista').innerHTML =
      tarjetaConfig('descuentos', '🏷️', 'Descuentos por marca', true,
        '<p>Se resta al precio mostrado. Afecta a listas, mapa y leyenda.</p>' + descuentos +
        '<button class="btn-sec" data-accion="add-descuento">+ Añadir marca</button>') +
      tarjetaConfig('cache', '🗃️', 'Caché de datos', false,
        '<div class="mini-cabs"><button data-cachetab="indexeddb" class="' + (c.cacheTab === 'indexeddb' ? 'activo' : '') + '">IndexedDB</button>' +
        '<button data-cachetab="localstorage" class="' + (c.cacheTab === 'localstorage' ? 'activo' : '') + '">localStorage</button></div>' +
        (c.cacheTab === 'indexeddb'
          ? '<p>' + F.cacheInfo.provincias + ' provincias · ' + F.cacheInfo.gasolineras.toLocaleString('es-ES') + ' gasolineras · ' + F.cacheInfo.historicoDias + ' días de histórico<br>' +
            F.cacheInfo.idb + ' · actualizado ' + F.cacheInfo.ultimaActualizacion + '</p>' +
            '<label>Horas de caché <input type="number" value="' + c.ttl + '" data-cfg="ttl" min="0"></label>' +
            '<button class="btn-sec btn-peligro" data-accion="limpiar-cache">🗑️ Limpiar caché</button>'
          : '<p>' + F.cacheInfo.lsClaves + ' claves <code>gasolineras_*</code> (estado, filtros por provincia, logs y chats de IA).</p>' +
            '<button class="btn-sec btn-peligro" data-accion="limpiar-cache">🗑️ Borrar claves</button>')) +
      tarjetaConfig('paginacion', '📄', 'Paginación', false,
        '<label>Resultados por página <select data-cfg="pagina">' + F.config.paginas.map(function (n) {
          return '<option value="' + n + '"' + (n === c.pagina ? ' selected' : '') + '>' + (n === 0 ? 'Todos' : n) + '</option>';
        }).join('') + '</select></label>') +
      tarjetaConfig('log', '📝', 'Registro de actividad', false,
        '<div class="mini-cabs"><button data-logtab="api" class="' + (c.logTab === 'api' ? 'activo' : '') + '">API</button>' +
        '<button data-logtab="push" class="' + (c.logTab === 'push' ? 'activo' : '') + '">Push</button></div>' +
        '<div class="consola">' + log.map(function (l) {
          return '<div><b>' + l.t + '</b> ' + exc(l.url) + ' <span class="' + (l.estado === 200 || l.estado === 'ok' ? '' : 'ko') + '">' +
            l.estado + (l.ms != null ? ' · ' + l.ms + ' ms' : '') + '</span></div>';
        }).join('') + '</div>' +
        '<button class="btn-sec btn-peligro" data-accion="limpiar-log">🗑️ Borrar registro</button>') +
      tarjetaConfig('push', '🔔', 'Notificaciones push', false,
        '<label><input type="checkbox" data-cfg-chk="push"' + (c.push ? ' checked' : '') + '> Avisar cuando baje el precio</label>' +
        '<label><input type="checkbox" data-cfg-chk="pushSubida"' + (c.pushSubida ? ' checked' : '') + '> Avisar cuando suba el precio</label>' +
        '<label>Intervalo de chequeo <input type="number" data-cfg="intervalo" value="' + c.intervalo + '" min="1" max="24"> h</label>' +
        '<label>Días de ventana <input type="number" data-cfg="diasFall" value="' + c.diasFall + '" min="2" max="90"> d</label>' +
        '<div class="mini-cabs"><button data-modo="average" class="' + (c.modo === 'average' ? 'activo' : '') + '">Promedio</button>' +
        '<button data-modo="consecutive" class="' + (c.modo === 'consecutive' ? 'activo' : '') + '">Consecutivos</button></div>' +
        '<button class="btn-sec btn-primario" data-accion="probar-push">Enviar notificación de prueba</button>') +
      tarjetaConfig('claves', '🔑', 'Claves API · IA', false,
        '<p>Cifradas en el código fuente; se descargan con la contraseña y se guardan cifradas en localStorage.</p>' +
        '<div class="fila-borrar"><input type="password" placeholder="Contraseña" data-cfg="pass"><button class="btn-sec btn-primario" data-accion="cargar-claves">Cargar</button></div>' +
        '<div class="rejilla-2">' +
          ['Google Gemini', 'Groq', 'Mistral', 'OpenRouter', 'LLM7.io (opcional)', 'NVIDIA (por proxy)'].map(function (n) {
            return '<label>' + n + '<input type="password" value="' + (c.claves ? '••••••••••' : '') + '" placeholder="API Key"></label>';
          }).join('') +
        '</div>') +
      tarjetaConfig('pestanas-ia', '💬', 'Pestañas de IA', false,
        '<p>Desmarca los proveedores que no uses: desaparecen del chat y de la pestaña General. Siempre debe quedar uno.</p>' +
        '<div class="rejilla-2">' + PROVEEDORES.slice(1).map(function (p) {
          return '<label style="flex-direction:row"><input type="checkbox" data-ia-visible="' + p.id + '"' +
            (c.ocultas.has(p.id) ? '' : ' checked') + '> ' + exc(p.nombre) + '</label>';
        }).join('') + '</div>') +
      tarjetaConfig('prompts', '⚡', 'Prompts rápidos', false,
        '<p>Hasta 5 atajos que aparecen sobre el chat General.</p>' + prompts) +
      tarjetaConfig('actualizar', '🔄', 'Actualización de la app', true,
        '<p>Versión actual <b>' + F.versionApp.texto + '</b></p>' +
        '<button class="btn-sec btn-primario" data-accion="buscar-actualizacion">Buscar actualizaciones</button>' +
        '<p data-accion-texto="actualizacion">Aún no has comprobado si hay una versión nueva.</p>');
  }

  function tarjetaConfig(id, icono, titulo, abierta, cuerpo) {
    return '<details class="tarjeta-config"' + (abierta ? ' open' : '') + ' data-card="' + id + '">' +
      '<summary><span class="ic" aria-hidden="true">' + icono + '</span>' + titulo + '<span class="chev" aria-hidden="true">›</span></summary>' +
      '<div class="cuerpo">' + cuerpo + '</div></details>';
  }

  /* =======================================================================
   * 13. Navegación, hojas de filtro y eventos globales
   * ===================================================================== */
  var VISTAS = [
    { id: 'mapa', nombre: 'Mapa', ico: ICO.mapa },
    { id: 'lista', nombre: 'Lista', ico: ICO.lista },
    { id: 'ambos', nombre: 'Ambos', ico: ICO.ambos },
    { id: 'ia', nombre: 'IA', ico: ICO.ia },
    { id: 'config', nombre: 'Config', ico: ICO.config }
  ];

  function pintarNavegacion() {
    var html = VISTAS.map(function (v) {
      return '<button data-vista="' + v.id + '" class="' + (estado.vista === v.id ? 'activo' : '') + '" aria-label="' + v.nombre + '">' +
        v.ico + '<span>' + v.nombre + '</span></button>';
    }).join('');
    $('#navInferior').innerHTML = html;
    $('#navSuperior').innerHTML = html;
    /* Solo el botón visible en móvil lleva la marca para las capturas */
    var marca = $('#navInferior [data-vista="lista"]');
    if (marca) marca.dataset.shot = 'vista';
  }

  function setVista(id) {
    estado.vista = id;
    $$('.vista').forEach(function (s) { s.classList.toggle('activa', s.dataset.vista === id); });
    $$('#navInferior button, #navSuperior button').forEach(function (b) { b.classList.toggle('activo', b.dataset.vista === id); });
    if (id === 'ia') renderIA();
    if (id === 'config') renderConfig();
    if (id !== 'ambos') estado.pagina = 1;
  }

  function toast(msg) {
    var a = $('#aviso');
    a.textContent = msg;
    a.hidden = false;
    a.classList.add('visible');
    clearTimeout(a._t);
    a._t = setTimeout(function () {
      a.classList.remove('visible');
      setTimeout(function () { a.hidden = true; }, 200);
    }, 2200);
  }

  /* --- Hojas de filtro concretas --- */
  function hojaProvincia() {
    abrirOpciones({
      titulo: 'Provincia', tipo: 'single', valor: estado.prov, limpiar: 'Todas',
      opciones: F.provincias.map(function (p) {
        return { valor: p.id, etiqueta: p.nombre, cuenta: F.estacionesDe(p.id).length };
      }),
      aplicar: 'Ver estaciones'
    });
    $('#opcCuerpo')._aplicar = function (valor, limpiar) {
      estado.prov = limpiar ? '28' : valor;
      estado.loc = ''; estado.marcas.clear(); estado.distMax = 0; estado.pagina = 1; estado.visibles = 8;
      render();
    };
  }
  function hojaLocalidad() {
    var lista = F.localidadesDe(estado.prov);
    abrirOpciones({
      titulo: 'Localidad', tipo: 'single', valor: estado.loc, limpiar: 'Todas',
      opciones: lista.map(function (l) {
        return { valor: l, etiqueta: l, cuenta: F.estacionesDe(estado.prov).filter(function (e) { return e.localidad === l; }).length };
      }),
      aplicar: 'Aplicar'
    });
    $('#opcCuerpo')._aplicar = function (valor, limpiar) {
      estado.loc = limpiar ? '' : valor; estado.pagina = 1; render();
    };
  }
  function hojaCombustible() {
    abrirOpciones({
      titulo: 'Combustible', tipo: 'single', valor: estado.fuel, limpiar: 'Todos',
      opciones: F.combustiblesVisibles.map(function (c) {
        var n = F.estacionesDe(estado.prov).filter(function (e) { return e.precios[c] != null; }).length;
        return { valor: c, etiqueta: c, cuenta: n ? n + ' estaciones' : 'sin datos' };
      }),
      aplicar: 'Aplicar'
    });
    $('#opcCuerpo')._aplicar = function (valor, limpiar) {
      estado.fuel = limpiar ? 'Gasolina 95 E5' : valor; estado.histFuel = estado.fuel; estado.pagina = 1; render();
    };
  }
  function hojaMarcas() {
    var marcas = F.marcasDe(estado.prov);
    abrirOpciones({
      titulo: 'Marca', tipo: 'multi', valor: Array.from(estado.marcas), limpiar: 'Todas',
      opciones: marcas.map(function (m) {
        return { valor: m, etiqueta: m, cuenta: F.estacionesDe(estado.prov).filter(function (e) { return e.marca === m; }).length };
      }),
      aplicar: 'Ver resultados'
    });
    $('#opcCuerpo')._aplicar = function (valor, limpiar) {
      estado.marcas = limpiar ? new Set() : valor;
      estado.pagina = 1; render();
    };
  }
  function hojaDistancia() {
    abrirOpciones({
      titulo: 'Distancia máxima', tipo: 'slider', valor: estado.distMax, min: 0, max: 50, paso: 1,
      limpiar: 'Sin límite', aplicar: 'Aplicar'
    });
    $('#opcCuerpo')._aplicar = function (valor, limpiar) {
      estado.distMax = limpiar ? 0 : valor; estado.pagina = 1; render();
    };
  }
  function hojaOrden() {
    abrirOpciones({
      titulo: 'Ordenar por', tipo: 'single', valor: estado.orden,
      opciones: [
        { valor: 'precio-asc', etiqueta: 'Precio: más barata primero' },
        { valor: 'precio-desc', etiqueta: 'Precio: más cara primero' },
        { valor: 'dist', etiqueta: 'Distancia: más cerca primero' }
      ],
      aplicar: 'Aplicar'
    });
    $('#opcCuerpo')._aplicar = function (valor) {
      estado.orden = valor;
      $$('#segOrdenLista button').forEach(function (b) { b.classList.toggle('activo', b.dataset.orden === valor); });
      render();
    };
  }

  /* =======================================================================
   * 14. Arranque y cableado de eventos
   * ===================================================================== */
  function init() {
    pintarNavegacion();

    /* Navegación */
    document.addEventListener('click', function (ev) {
      var nav = ev.target.closest('button[data-vista], a[data-vista]');
      if (nav) { setVista(nav.dataset.vista); return; }

      /* Abrir detalle */
      var est = ev.target.closest('[data-estacion]');
      if (est && !ev.target.closest('[data-fav]')) { abrirDetalle(est.dataset.estacion); return; }
      var marc = ev.target.closest('[data-marcador]');
      if (marc) { abrirDetalle(marc.dataset.marcador); return; }

      /* Favoritos */
      var fav = ev.target.closest('[data-fav]');
      if (fav) {
        var id = fav.dataset.fav;
        if (estado.favoritos.has(id)) estado.favoritos.delete(id); else estado.favoritos.add(id);
        render();
        if (detalleId === id) abrirDetalle(id);
        return;
      }

      /* Chips */
      var quitar = ev.target.closest('[data-quitar]');
      if (quitar) {
        ev.stopPropagation();
        var q = quitar.dataset.quitar;
        if (q === 'loc') estado.loc = '';
        if (q === 'marcas') estado.marcas.clear();
        if (q === 'dist') estado.distMax = 0;
        render(); return;
      }
      var c = ev.target.closest('[data-chip]');
      if (c) {
        var chip = c.dataset.chip;
        if (chip === 'prov') hojaProvincia();
        else if (chip === 'fuel') hojaCombustible();
        else if (chip === 'loc') hojaLocalidad();
        else if (chip === 'marcas') hojaMarcas();
        else if (chip === 'dist') hojaDistancia();
        else if (chip === 'orden') hojaOrden();
        else if (chip === 'fav') { estado.soloFav = !estado.soloFav; estado.pagina = 1; render(); toast(estado.soloFav ? 'Mostrando solo favoritas' : 'Mostrando todas'); }
        else if (chip === 'limpiar') { limpiarFiltros(); }
        return;
      }

      /* Acciones sueltas */
      var acc = ev.target.closest('[data-accion]');
      if (acc) { accion(acc, ev); return; }

      /* Paginación */
      var pag = ev.target.closest('[data-pagina]');
      if (pag && !pag.disabled) {
        estado.pagina += pag.dataset.pagina === 'prev' ? -1 : 1;
        renderAmbos(); return;
      }
      /* Orden en la tabla */
      var th = ev.target.closest('#tablaEstaciones thead th');
      if (th) {
        var col = th.dataset.col;
        if (col === estado.sortCol) estado.sortDir = estado.sortDir === 'asc' ? 'desc' : 'asc';
        else { estado.sortCol = col; estado.sortDir = 'asc'; }
        renderAmbos(); return;
      }
      /* Segmentado de orden de la lista */
      var seg = ev.target.closest('#segOrdenLista button');
      if (seg) {
        estado.orden = seg.dataset.orden;
        $$('#segOrdenLista button').forEach(function (b) { b.classList.toggle('activo', b === seg); b.setAttribute('aria-pressed', b === seg); });
        render(); return;
      }
      /* Tabs del detalle */
      var dtab = ev.target.closest('.detalle-tab');
      if (dtab) { mostrarPanelDetalle(dtab.dataset.dtab); return; }
      /* Opciones de la hoja genérica */
      var op = ev.target.closest('[data-opcion]');
      if (op) {
        var cuerpo = $('#opcCuerpo');
        if (cuerpo.dataset.tipo === 'multi') { /* gestionado abajo */ }
        var valor = op.dataset.opcion;
        var multi = $('#opcPie').dataset.tipo === 'multi';
        if (multi) {
          var sel = cuerpo._sel;
          if (sel.has(valor)) sel.delete(valor); else sel.add(valor);
          op.classList.toggle('elegida');
        } else {
          $$('#opcCuerpo .opcion').forEach(function (b) { b.classList.toggle('elegida', b === op); });
          cuerpo._valor = valor;
        }
        return;
      }
      var ope = ev.target.closest('[data-opc]');
      if (ope) {
        var cuerpoOpc = $('#opcCuerpo');
        var esLimpiar = ope.dataset.opc === 'limpiar';
        var val = cuerpoOpc._sel ? Array.from(cuerpoOpc._sel) : cuerpoOpc._valor;
        if (cuerpoOpc._aplicar) cuerpoOpc._aplicar(val, esLimpiar);
        cerrarHoja($('#hojaOpciones'));
        return;
      }
      /* IA */
      var pill = ev.target.closest('[data-iaprov]');
      if (pill) { estado.ia.prov = pill.dataset.iaprov; renderIA(); return; }
      if (ev.target.closest('#iaRefrescar')) { toast('Catálogo de modelos actualizado'); return; }
      /* Cerrar detalle */
      if (ev.target.closest('#detalleCerrar')) { cerrarHoja($('#hojaDetalle')); return; }
      if (ev.target.closest('#opcionesCerrar')) { cerrarHoja($('#hojaOpciones')); return; }
      if (ev.target.closest('#velo')) { cerrarHoja($('#hojaDetalle')); cerrarHoja($('#hojaOpciones')); return; }
      if (ev.target.closest('#btnZoomMas')) { estado.zoom = Math.min(2.4, estado.zoom * 1.2); render(); return; }
      if (ev.target.closest('#btnZoomMenos')) { estado.zoom = Math.max(0.7, estado.zoom / 1.2); render(); return; }
      if (ev.target.closest('#btnCentrar')) { estado.zoom = 1; estado.panX = 0; estado.panY = 0; render(); toast('Centrado en tu ubicación'); return; }
      if (ev.target.closest('#btnEstilo')) {
        abrirOpciones({
          titulo: 'Estilo de mapa', tipo: 'single', valor: estado.estiloMapa,
          opciones: ['Satélite', 'Satélite con nombres', 'Calle', 'Oscuro', 'Relieve', 'Topográfico', 'Ciclismo', 'NatGeo', 'Humanitario', 'Estándar']
            .map(function (x) { return { valor: x, etiqueta: x }; }),
          aplicar: 'Aplicar'
        });
        $('#opcCuerpo')._aplicar = function (v) { estado.estiloMapa = v; $('#btnEstilo').textContent = v + ' ▾'; toast('Vista «' + v + '»'); };
        return;
      }
      if (ev.target.closest('#btnCargarMas')) { estado.visibles += 8; renderLista(); return; }
      if (ev.target.closest('#btnUbicacion')) { estado.panX = 0; estado.panY = 0; render(); toast('Ubicación detectada: Madrid centro'); return; }
      if (ev.target.closest('#btnRefrescar')) { toast('Precios actualizados a las ' + new Date().toTimeString().slice(0, 5)); return; }
      if (ev.target.closest('#agarreLista')) {
        var h = $('#hojaLista');
        /* Si el «clic» viene de un arrastre, no cambiamos de altura */
        if (h.dataset.arrastro === '1') { delete h.dataset.arrastro; return; }
        var ciclo = ['muy-bajo', 'medio', 'lleno'];
        var actual = h.classList.contains('lleno') ? 'lleno' : h.classList.contains('medio') ? 'medio' : 'muy-bajo';
        var sig = ciclo[(ciclo.indexOf(actual) + 1) % 3];
        h.classList.toggle('medio', sig === 'medio');
        h.classList.toggle('lleno', sig === 'lleno');
        h.style.removeProperty('--alto');
        return;
      }
      /* Config: cabeceras internas */
      var ct = ev.target.closest('[data-cachetab]');
      if (ct) { estado.cfg.cacheTab = ct.dataset.cachetab; renderConfig(); return; }
      var lt = ev.target.closest('[data-logtab]');
      if (lt) { estado.cfg.logTab = lt.dataset.logtab; renderConfig(); return; }
      var md = ev.target.closest('[data-modo]');
      if (md) { estado.cfg.modo = md.dataset.modo; renderConfig(); return; }
      var mFav = ev.target.closest('[data-accion="ver-favoritas"]');
      if (mFav) { estado.soloFav = true; estado.pagina = 1; setVista('lista'); render(); }
    });

    /* Acciones de configuración y varias */
    function accion(el, ev) {
      var a = el.dataset.accion;
      if (a === 'limpiar-filtros') { limpiarFiltros(); return; }
      if (a === 'cancelar-ia') { toast('Mensaje cancelado'); estado.ia.enviando = false; return; }
      if (a === 'limpiar-cache') { toast('Caché de la maqueta borrada (simulado)'); return; }
      if (a === 'limpiar-log') { toast('Registro borrado (simulado)'); return; }
      if (a === 'probar-push') { toast('🔔 Prueba: Ballenoil Villaverde ha bajado 0,02 €'); return; }
      if (a === 'cargar-claves') {
        var pass = $('[data-cfg="pass"]');
        if (!pass.value) { toast('Escribe la contraseña de las claves'); return; }
        estado.cfg.claves = true; renderConfig(); toast('Claves cargadas para 5 proveedores');
        return;
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
      if (a === 'borrar-descuento') {
        delete estado.descuentos[el.dataset.marca]; renderConfig(); render(); return;
      }
      if (a === 'ver-favoritas') { estado.soloFav = true; setVista('lista'); render(); return; }
    }

    function limpiarFiltros() {
      estado.loc = ''; estado.marcas.clear(); estado.distMax = 0; estado.soloFav = false; estado.texto = '';
      estado.visibles = 8; estado.pagina = 1; estado.orden = 'precio-asc';
      $('#buscador').value = ''; $('#btnLimpiarBusqueda').hidden = true;
      $$('#segOrdenLista button').forEach(function (b) { b.classList.toggle('activo', b.dataset.orden === 'precio-asc'); });
      render();
      toast('Filtros limpiados');
    }

    /* Buscador */
    $('#buscador').addEventListener('input', function (ev) {
      estado.texto = ev.target.value;
      $('#btnLimpiarBusqueda').hidden = !estado.texto;
      estado.visibles = 8; render();
    });
    $('#btnLimpiarBusqueda').addEventListener('click', function () {
      estado.texto = ''; $('#buscador').value = ''; $('#btnLimpiarBusqueda').hidden = true; render();
    });

    /* IA: enviar */
    $('#iaForm').addEventListener('submit', function (ev) {
      ev.preventDefault();
      var t = $('#iaInput').value;
      $('#iaInput').value = '';
      enviarIA(t);
    });

    /* Selects de histórico y de modelo IA (delegado) */
    document.addEventListener('change', function (ev) {
      if (ev.target.id === 'histFuel' || ev.target.id === 'histDias') {
        estado.histFuel = $('#histFuel').value;
        estado.histDias = Number($('#histDias').value);
        dibujarGrafica(); return;
      }
      if (ev.target.id === 'iaModelo') { estado.ia.modelos[estado.ia.prov] = ev.target.value; return; }
      if (ev.target.matches('[data-cfg]')) {
        var clave = ev.target.dataset.cfg;
        estado.cfg[clave] = ev.target.type === 'number' ? Number(ev.target.value) : ev.target.value;
        if (clave === 'pagina') { estado.porPagina = Number(ev.target.value); estado.pagina = 1; render(); }
        if (clave === 'ttl') toast('TTL de caché: ' + estado.cfg.ttl + ' h');
        return;
      }
      if (ev.target.matches('[data-cfg-chk]')) {
        estado.cfg[ev.target.dataset.cfgChk] = ev.target.checked;
        toast(ev.target.checked ? 'Aviso activado' : 'Aviso desactivado');
        return;
      }
      if (ev.target.matches('[data-desc-valor]')) {
        estado.descuentos[ev.target.dataset.descValor] = Number(ev.target.value) || 0;
        render(); return;
      }
      if (ev.target.matches('[data-desc-marca]')) {
        var viejo = ev.target.dataset.descMarca, nuevo = ev.target.value;
        var val = estado.descuentos[viejo]; delete estado.descuentos[viejo];
        estado.descuentos[nuevo] = val; renderConfig(); render(); return;
      }
      if (ev.target.matches('[data-prompt]')) {
        estado.cfg.prompts[Number(ev.target.dataset.prompt)] = ev.target.value; return;
      }
      if (ev.target.matches('[data-ia-visible]')) {
        var id = ev.target.dataset.iaVisible;
        if (ev.target.checked) estado.cfg.ocultas.delete(id);
        else {
          var visibles = PROVEEDORES.slice(1).filter(function (p) { return !estado.cfg.ocultas.has(p.id) || p.id === id; });
          if (visibles.length <= 1) { ev.target.checked = true; toast('Debe quedar al menos un proveedor visible'); return; }
          estado.cfg.ocultas.add(id);
        }
        toast('Pestañas de IA actualizadas');
        return;
      }
    });

    /* Teclado: Esc cierra, Enter abre la tarjeta enfocada */
    document.addEventListener('keydown', function (ev) {
      if (ev.key === 'Escape') {
        if (!$('#hojaOpciones').hidden) { cerrarHoja($('#hojaOpciones')); return; }
        if (!$('#hojaDetalle').hidden) { cerrarHoja($('#hojaDetalle')); return; }
      }
      if (ev.key === 'Enter' && ev.target.matches('[data-estacion]')) {
        abrirDetalle(ev.target.dataset.estacion);
      }
      if (ev.key === '/' && !/input|select|textarea/i.test(ev.target.tagName)) {
        ev.preventDefault(); $('#buscador').focus();
      }
    });

    /* Gráfica: resize + tooltip */
    window.addEventListener('resize', function () {
      if (!$('#detPanelHistorico').hidden) dibujarGrafica();
    });
    $('#histCanvas').addEventListener('mousemove', tooltipGrafica);
    $('#histCanvas').addEventListener('mouseleave', function () { $('#histTooltip').hidden = true; });
    $('#histCanvas').addEventListener('touchmove', function (ev) {
      var t = ev.touches[0];
      tooltipGrafica({ clientX: t.clientX, clientY: t.clientY });
    }, { passive: true });

    /* Hojas arrastrables */
    hojaArrastrable($('#hojaLista'), $('#agarreLista'), [36, 58, 100]);
    hojaArrastrable($('#hojaDetalle'), $('#agarreDetalle'), [92], function () { cerrarHoja($('#hojaDetalle')); });
    hojaArrastrable($('#hojaOpciones'), $('#agarreOpciones'), [88], function () { cerrarHoja($('#hojaOpciones')); });

    /* Multi-selección de la hoja de opciones: guardamos el Set en el cuerpo */
    var pintarOpcionesOriginal = abrirOpciones;
    abrirOpciones = function (cfg) {
      pintarOpcionesOriginal(cfg);
      var cuerpo = $('#opcCuerpo');
      $('#opcPie').dataset.tipo = cfg.tipo;
      if (cfg.tipo === 'multi') {
        cuerpo._sel = new Set(cfg.valor || []);
        $$('#opcCuerpo .opcion').forEach(function (b) {
          b.classList.toggle('elegida', cuerpo._sel.has(b.dataset.opcion));
        });
      } else {
        cuerpo._valor = cfg.valor;
        cuerpo._sel = null;
      }
    };

    /* Arranque */
    setVista('mapa');
    render();
    toast('Prototipo 1 · pulsa un marcador para abrir el detalle');
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
