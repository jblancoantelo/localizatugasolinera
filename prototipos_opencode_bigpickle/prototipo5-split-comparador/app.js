/* =============================================================================
 * Prototipo 5 · Split sincronizado + comparador
 * =============================================================================
 * Script clásico (sin módulos) para que funcione abriendo el index.html por
 * file://. Todos los datos salen de window.FAKE (../shared/datos-fake.js).
 *
 * Índice:
 *   1. Utilidades y estado
 *   2. Datos derivados (filtrado, orden, paginación)
 *   3. Mapa esquemático en SVG + marcadores
 *   4. Sincronía lista ↔ mapa (el corazón del prototipo)
 *   5. Divisor arrastrable, presets y «peek» móvil
 *   6. Detalle de estación + gráfica canvas
 *   7. Comparador (2-4 estaciones)
 *   8. Chat IA
 *   9. Ajustes
 *  10. Navegación, atajos y eventos globales
 * ========================================================================== */
(function () {
  'use strict';

  /* ========================= 1. UTILIDADES Y ESTADO ========================= */

  var F = window.FAKE;
  if (!F) {
    document.body.insertAdjacentHTML('afterbegin',
      '<p style="padding:1rem">No se ha podido cargar <code>../shared/datos-fake.js</code>.</p>');
    return;
  }

  var movimientoReducido = window.matchMedia &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  function $(sel, raiz) { return (raiz || document).querySelector(sel); }
  function $$(sel, raiz) { return Array.prototype.slice.call((raiz || document).querySelectorAll(sel)); }
  function crear(tag, clase, texto) {
    var n = document.createElement(tag);
    if (clase) n.className = clase;
    if (texto != null) n.textContent = texto;
    return n;
  }
  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }
  /** Normaliza para búsquedas sin acentos ni mayúsculas. */
  function norm(s) {
    var t = String(s == null ? '' : s).toLowerCase();
    try { t = t.normalize('NFD').replace(/[\u0300-\u036f]/g, ''); } catch (e) { /* navegador antiguo */ }
    return t;
  }
  var eur = F.eur;                                   /* 1,589 € · «—» si no hay */
  function eurCorto(p) { return p == null ? '—' : p.toFixed(3).replace('.', ','); }
  function km(d) { return d.toFixed(1).replace('.', ',') + ' km'; }
  function pct(v) { return (v > 0 ? '+' : '') + v.toFixed(1).replace('.', ',') + ' %'; }
  function acotar(v, a, b) { return Math.max(a, Math.min(b, v)); }
  /** Hash estable para tiempos «creíbles» que no cambian entre pasadas. */
  function hash(str) {
    var h = 0;
    for (var i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) | 0;
    return Math.abs(h);
  }

  var AI_PROVEEDORES = [
    { id: 'general', nombre: 'General', icono: '🚀', general: true },
    { id: 'groq', nombre: 'Groq', icono: '⚡', defecto: 'qwen/qwen3.8-27b',
      modelos: ['qwen/qwen3.8-27b', 'openai/gpt-oss-20b', 'openai/gpt-oss-120b', 'allam-2-7b'] },
    { id: 'mistral', nombre: 'Mistral', icono: '🌬️', defecto: 'open-mistral-nemo',
      modelos: ['open-mistral-nemo', 'ministral-8b-latest', 'codestral-latest', 'mistral-small-latest', 'mistral-medium-latest'] },
    { id: 'openrouter', nombre: 'OpenRouter', icono: '🔀', defecto: 'nvidia/nemotron-3-ultra-550b-a55b:free',
      modelos: ['nvidia/nemotron-3-ultra-550b-a55b:free', 'nvidia/nemotron-3-super-120b-a12b:free'] },
    { id: 'llm7', nombre: 'LLM7.io', icono: '🆓', defecto: 'codestral-latest',
      modelos: ['codestral-latest', 'GLM-5.3-Flash', 'minimax-m2.7', 'mistral-Nemo-Instruct-2407'] },
    { id: 'nvidia', nombre: 'NVIDIA', icono: '🟩', defecto: 'nvidia/nemotron-3-ultra-550b-a55b',
      modelos: ['nvidia/nemotron-3-ultra-550b-a55b', 'nvidia/nemotron-3-super-120b-a12b',
        'nvidia/nemotron-3.5-lightning-30b-a3b', 'moonshotai/kimi-k3', 'z-ai/glm-5.3',
        'z-ai/glm-5.3-flash', 'openai/gpt-oss-20b'] },
    { id: 'google', nombre: 'Google Gemini', icono: '✨', defecto: 'gemini-3.8-flash',
      modelos: ['gemini-3.8-flash', 'gemini-3.5-flash', 'gemini-3.5-flash-lite', 'gemini-3.7-flash'] },
    { id: 'chrome-nano', nombre: 'Chrome Built-in AI', icono: '🤖', defecto: 'Gemini Nano (local)', modelos: ['Gemini Nano (local)'] }
  ];
  function proveedor(id) {
    for (var i = 0; i < AI_PROVEEDORES.length; i++) if (AI_PROVEEDORES[i].id === id) return AI_PROVEEDORES[i];
    return null;
  }

  var ESTADO = {
    destino: 'mapa',                 /* mapa (split) · lista · ia · favoritas · ajustes */
    preset: 'split',                 /* mapa · split · lista */
    separacion: 52,                  /* % de ancho del mapa en modo split */
    peek: 'cerrado',                 /* móvil: cerrado (132px) · abierto (pantalla completa) */
    seguirHover: true,               /* centrar el mapa al pasar por una fila */

    filtros: {
      prov: '28', loc: '', fuel: 'Gasolina 95 E5',
      marcas: [], distancia: null, soloFavoritas: false, q: ''
    },
    orden: { col: 'precio', dir: 'asc' },
    pagina: 1,
    pageSize: F.config.pageSize,

    favoritos: {},
    marcasPendientes: null,          /* selección temporal del popover de marcas */

    activoId: null,                  /* estación resaltada/seleccionada */
    detalleId: null,
    detalleTab: 'info',
    detalleFuel: null,
    detalleDias: 30,

    comparar: [],

    iaProvider: 'general',
    iaOcultos: [],
    iaModelos: {},
    iaChats: {},
    prompts: F.prompts.slice(),

    descuentos: JSON.parse(JSON.stringify(F.descuentos)),
    push: { activo: false, subida: false, intervalo: F.config.checkInterval, dias: F.config.priceFallDays },
    cacheTtl: F.config.cacheTtl,
    cacheTab: 'indexeddb',
    logTab: 'api'
  };

  F.estaciones.forEach(function (e) { if (e.fav) ESTADO.favoritos[e.id] = true; });
  AI_PROVEEDORES.forEach(function (p) {
    ESTADO.iaChats[p.id] = (F.chatsIA[p.id] || []).slice();
    if (p.defecto) ESTADO.iaModelos[p.id] = p.defecto;
  });

  /* Referencias del DOM que se usan mucho */
  var app = $('#app'), mapaCaja = $('#mapaCaja'), mapaCapa = $('#mapaCapa'),
      cuerpoTabla = $('#cuerpoTabla'), chipsEl = $('#chips'), contadorEl = $('#contador'),
      divisor = $('#divisor'), listaScroll = $('#listaScroll'), panelDetalle = $('#panelDetalle'),
      barraComparar = $('#barraComparar'), hoja = $('#hoja'), hojaFondo = $('#hojaFondo');

  /* ========================= 2. DATOS DERIVADOS ========================= */

  function precioDe(est, fuel) {
    var p = F.precioDe(est, fuel);
    return p == null ? null : p;
  }
  function precioFinal(est, fuel) {
    var p = precioDe(est, fuel);
    if (p == null) return null;
    return Math.round((p - (ESTADO.descuentos[est.marca] || 0)) * 1000) / 1000;
  }
  function descuentoDe(est) { return ESTADO.descuentos[est.marca] || 0; }

  function listaFiltrada() {
    var f = ESTADO.filtros;
    var q = norm(f.q);
    return F.estaciones.filter(function (e) {
      if (f.prov && e.prov !== f.prov) return false;
      if (f.loc && e.localidad !== f.loc) return false;
      if (f.marcas.length && f.marcas.indexOf(e.marca) < 0) return false;
      if (f.distancia != null && e.dist > f.distancia) return false;
      if (f.soloFavoritas && !ESTADO.favoritos[e.id]) return false;
      if (f.fuel && precioDe(e, f.fuel) == null) return false;
      if (q && norm(e.nombre + ' ' + e.direccion + ' ' + e.localidad + ' ' + e.marca).indexOf(q) < 0) return false;
      return true;
    });
  }

  function listaOrdenada() {
    var lista = listaFiltrada();
    var col = ESTADO.orden.col, dir = ESTADO.orden.dir === 'desc' ? -1 : 1;
    lista.sort(function (a, b) {
      var va, vb;
      if (col === 'precio') {
        va = precioFinal(a, ESTADO.filtros.fuel);
        vb = precioFinal(b, ESTADO.filtros.fuel);
        /* Las que no venden ese combustible van al final, nunca "las más baratas" */
        if (va == null) va = Infinity;
        if (vb == null) vb = Infinity;
        if (va === vb) return a.dist - b.dist;
        return (va - vb) * dir;
      }
      if (col === 'dist') return (a.dist - b.dist) * dir;
      va = String(a[col] || ''); vb = String(b[col] || '');
      return va.localeCompare(vb, 'es') * dir;
    });
    return lista;
  }

  function paginaActual() {
    var lista = listaOrdenada();
    var ps = ESTADO.pageSize;
    if (ps === 0) return { total: lista.length, items: lista, paginas: 1, ini: 0 };
    var paginas = Math.max(1, Math.ceil(lista.length / ps));
    if (ESTADO.pagina > paginas) ESTADO.pagina = paginas;
    if (ESTADO.pagina < 1) ESTADO.pagina = 1;
    var ini = (ESTADO.pagina - 1) * ps;
    return { total: lista.length, items: lista.slice(ini, ini + ps), paginas: paginas, ini: ini, lista: lista };
  }

  /** Índice de una estación dentro de la lista ordenada completa. */
  function indiceDe(lista, id) {
    for (var i = 0; i < lista.length; i++) if (lista[i].id === id) return i;
    return -1;
  }
  function estacion(id) {
    for (var i = 0; i < F.estaciones.length; i++) if (F.estaciones[i].id === id) return F.estaciones[i];
    return null;
  }

  /* ========================= 3. MAPA ESQUEMÁTICO ========================= */

  /** Pinta el fondo (manchas, viales, agua) una única vez. */
  function pintarMapaBase() {
    var m = F.mapa, svg = ['<svg class="mapa-svg" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">'];
    m.manchas.forEach(function (z) {
      svg.push('<rect class="mapa-mancha" x="' + z.x + '" y="' + z.y + '" width="' + z.w + '" height="' + z.h + '" rx="1.6"/>');
    });
    m.viales.forEach(function (v) {
      svg.push('<path class="mapa-vial" style="stroke-width:' + v.w + '" d="' + v.d + '"/>');
    });
    svg.push('<path class="mapa-agua" d="' + m.agua.d + '"/>');
    svg.push('</svg><div class="marcadores" id="marcadores"></div>');
    mapaCapa.innerHTML = svg.join('');
  }

  function pintarMarcadores(lista) {
    var cont = $('#marcadores');
    if (!cont) return;

    /* Posición del usuario: referencia visual fija */
    var yo = crear('div', 'tu-posicion');
    yo.style.left = F.mapa.tuPosicion.mx + '%';
    yo.style.top = F.mapa.tuPosicion.my + '%';
    yo.innerHTML = '<span class="punto-yo"></span><span class="etiqueta-yo">' + esc(F.mapa.tuPosicion.label) + '</span>';

    var piezas = [yo.outerHTML];
    lista.forEach(function (e) {
      var crudo = precioDe(e, ESTADO.filtros.fuel);
      var col = F.colorPrecio(crudo);
      piezas.push(
        '<button type="button" class="marcador col-' + col + '" data-id="' + e.id + '"' +
        ' style="left:' + e.mx + '%;top:' + e.my + '%"' +
        ' aria-label="' + esc(e.marca + ' ' + e.nombre + ', ' + eur(crudo) + ', a ' + km(e.dist)) + '">' +
        '<span class="marcador-punto" aria-hidden="true"></span>' +
        '<span class="marcador-precio">' + eurCorto(crudo) + '</span>' +
        '</button>');
    });
    cont.innerHTML = piezas.join('');

    /* La estación activa mantiene su anillo azul tras repintar */
    if (ESTADO.activoId) marcarActivo(ESTADO.activoId);
  }

  /* ========================= 4. SINCRONÍA LISTA ↔ MAPA ========================= */

  var vista = { zoom: 1, tx: 0, ty: 0 };

  function aplicarVista(animar) {
    mapaCapa.style.transition = (animar && !movimientoReducido) ? 'transform 0.3s ease-out' : 'none';
    mapaCapa.style.transform = 'translate(' + vista.tx + 'px,' + vista.ty + 'px) scale(' + vista.zoom + ')';
  }

  /** Limita el desplazamiento para que el mapa nunca deje ver el fondo. */
  function acotarVista() {
    var r = mapaCaja.getBoundingClientRect();
    if (!r.width || !r.height) return;
    var minX = r.width * (1 - vista.zoom), minY = r.height * (1 - vista.zoom);
    vista.tx = acotar(vista.tx, minX, 0);
    vista.ty = acotar(vista.ty, minY, 0);
  }

  /** Centra suavemente la estación `e` en el mapa (sin marear si ya está cerca). */
  function centrarEn(e, forzar) {
    var r = mapaCaja.getBoundingClientRect();
    if (!r.width || !r.height) return;
    var destinoX = r.width / 2 - (e.mx / 100) * r.width * vista.zoom;
    var destinoY = r.height / 2 - (e.my / 100) * r.height * vista.zoom;
    if (!forzar) {
      /* Si el marcador ya está en el tercio central, no movemos nada */
      var dx = Math.abs(destinoX - vista.tx) / r.width;
      var dy = Math.abs(destinoY - vista.ty) / r.height;
      if (dx < 0.12 && dy < 0.12) return;
    }
    vista.tx = destinoX; vista.ty = destinoY;
    acotarVista();
    aplicarVista(true);
  }

  function reiniciarVista() {
    vista.zoom = 1; vista.tx = 0; vista.ty = 0;
    aplicarVista(true);
  }

  function marcarActivo(id) {
    $$('.marcador', mapaCapa).forEach(function (b) {
      b.classList.toggle('seleccionado', b.dataset.id === id);
    });
  }

  /** Resalta fila + marcador y (opcional) centra el mapa. */
  function resaltar(id, centrar) {
    $$('#cuerpoTabla tr').forEach(function (tr) {
      tr.classList.toggle('destacado', tr.dataset.id === id);
    });
    $$('.marcador', mapaCapa).forEach(function (b) {
      b.classList.toggle('destacado', b.dataset.id === id);
    });
    var ocultar = $('#mapaHint');
    if (ocultar) ocultar.classList.add('oculto');
    var e = estacion(id);
    if (e && (centrar || ESTADO.seguirHover)) centrarEn(e, false);
  }

  function quitarResaltado() {
    $$('#cuerpoTabla tr.destacado').forEach(function (tr) { tr.classList.remove('destacado'); });
    $$('.marcador.destacado', mapaCapa).forEach(function (b) { b.classList.remove('destacado'); });
  }

  /** Salta a la página donde vive la fila y la resalta (o la abre). */
  function irAEstacion(id, abrir) {
    var lista = listaOrdenada();
    var idx = indiceDe(lista, id);
    if (idx < 0) return;
    if (ESTADO.pageSize !== 0) {
      var pag = Math.floor(idx / ESTADO.pageSize) + 1;
      if (pag !== ESTADO.pagina) { ESTADO.pagina = pag; renderLista(); }
    }
    ESTADO.activoId = id;
    marcarActivo(id);
    $$('#cuerpoTabla tr').forEach(function (tr) { tr.classList.toggle('activo', tr.dataset.id === id); });
    var fila = $('#cuerpoTabla tr[data-id="' + id + '"]');
    if (fila) {
      fila.scrollIntoView({ block: 'nearest', behavior: movimientoReducido ? 'auto' : 'smooth' });
      fila.focus({ preventScroll: true });
    }
    resaltar(id, true);
    if (abrir) abrirDetalle(id);
  }

  /* ========================= RENDER: LISTA ========================= */

  function renderChips() {
    var f = ESTADO.filtros, out = [];
    function chip(etiqueta, tipo) {
      out.push('<span class="chip">' + esc(etiqueta) +
        '<button type="button" data-quitar="' + tipo + '" aria-label="Quitar filtro ' + esc(etiqueta) + '">✕</button></span>');
    }
    if (f.prov) chip(F.provinciaNombre(f.prov), 'prov');
    if (f.loc) chip(f.loc, 'loc');
    if (f.fuel) chip(f.fuel, 'fuel');
    f.marcas.forEach(function (m, i) { chip(m, 'marca:' + i); });
    if (f.distancia != null) chip('≤ ' + km(f.distancia), 'distancia');
    if (f.soloFavoritas) chip('Solo favoritas', 'favoritas');
    if (f.q) chip('«' + f.q + '»', 'q');
    chipsEl.innerHTML = out.join('');
  }

  function renderLista() {
    var pag = paginaActual();
    var lista = pag.lista || listaOrdenada();
    var fuel = ESTADO.filtros.fuel;

    /* Marca «más barata» = mínimo del conjunto filtrado */
    var mejorId = null, mejorP = Infinity;
    lista.forEach(function (e) {
      var p = precioFinal(e, fuel);
      if (p != null && p < mejorP) { mejorP = p; mejorId = e.id; }
    });

    var html = [], primeraFila = true;
    pag.items.forEach(function (e, i) {
      var crudo = precioDe(e, fuel);
      var fin = precioFinal(e, fuel);
      var desc = descuentoDe(e);
      var col = F.colorPrecio(crudo);
      var serie = F.historico(e.id, fuel || 'Gasolina 95 E5', 7);
      var variacion = serie.length > 1 ? ((serie[serie.length - 1].precio - serie[0].precio) / serie[0].precio) * 100 : 0;
      var tendClase = variacion < -0.05 ? 'baja' : (variacion > 0.05 ? 'sube' : '');
      var comparando = ESTADO.comparar.indexOf(e.id) >= 0;

      html.push(
        '<tr data-id="' + e.id + '" data-idx="' + (pag.ini + i) + '" tabindex="0" role="row"' +
        (e.id === ESTADO.activoId ? ' class="activo"' : '') +
        (e.id === mejorId ? ' data-masbarata="1"' : '') + '>' +
        '<td class="col-check"><input type="checkbox" class="check-comparar" data-comparar="' + e.id + '"' +
          (comparando ? ' checked' : '') + ' aria-label="Añadir ' + esc(e.marca + ' ' + e.localidad) + ' al comparador"></td>' +
        '<td class="col-fav"><button type="button" class="btn-fav' + (ESTADO.favoritos[e.id] ? ' on' : '') +
          '" data-fav="' + e.id + '" aria-pressed="' + (ESTADO.favoritos[e.id] ? 'true' : 'false') +
          '" aria-label="' + (ESTADO.favoritos[e.id] ? 'Quitar de favoritas: ' : 'Marcar como favorita: ') +
          esc(e.marca) + '">' + (ESTADO.favoritos[e.id] ? '★' : '☆') + '</button></td>' +
        '<td class="celda-marca"><span class="marca">' + esc(e.marca) + '</span>' +
          '<span class="nombre">' + esc(e.nombre) + '</span></td>' +
        '<td class="col-precio"><span class="precio ' + col + '">' + eur(crudo) + '</span>' +
          (desc ? '<span class="desc">desc. ' + eurCorto(fin) + ' €</span>' : '') +
          '<span class="tend ' + tendClase + '">7 d ' + pct(variacion) + '</span></td>' +
        '<td class="celda-dist">' + km(e.dist) + '</td>' +
        '<td>' + esc(e.localidad) + '</td>' +
        '<td class="celda-calle" title="' + esc(e.direccion) + '">' + esc(e.direccion) + '</td>' +
        '<td class="col-abrir"><button type="button" class="btn-abrir" data-abrir="' + e.id + '"' +
          (primeraFila ? ' data-shot="detalle"' : '') +
          ' aria-label="Ver detalle de ' + esc(e.marca) + '">›</button></td>' +
        '</tr>');
      primeraFila = false;
    });

    cuerpoTabla.innerHTML = html.join('');

    /* Resalta «más barata» con clase (no con atributo) para el estilo */
    if (mejorId) {
      var fila = $('#cuerpoTabla tr[data-id="' + mejorId + '"]');
      if (fila) fila.classList.add('mas-barata');
    }

    /* Orden: flecha en la cabecera */
    $$('#tabla thead th').forEach(function (th) {
      if (!th.dataset.col) th.removeAttribute('data-activo');
      var btn = $('.th-btn', th);
      if (btn && btn.dataset.orden) {
        var partes = btn.dataset.orden.split(':');
        var flecha = $('.flecha', btn);
        flecha.className = 'flecha';
        if (partes[0] === ESTADO.orden.col) {
          th.setAttribute('data-activo', '1');
          flecha.classList.add(ESTADO.orden.dir === 'desc' ? 'desc' : 'asc');
        }
      }
    });

    /* Estado vacío y contador */
    var vacio = pag.items.length === 0;
    $('#estadoVacio').hidden = !vacio;
    $('#tabla').hidden = vacio;
    var favs = lista.filter(function (e) { return ESTADO.favoritos[e.id]; }).length;
    contadorEl.innerHTML = vacio ? 'Sin resultados'
      : '<b>' + pag.total + '</b> estaciones' + (favs ? ' · <b>' + favs + '</b> favoritas' : '');

    renderPaginacion(pag);
    renderMarcadoresDesdeLista(lista);
  }

  function renderMarcadoresDesdeLista(lista) {
    pintarMarcadores(lista);
    actualizarContadorMapa(lista);
  }

  function actualizarContadorMapa(lista) {
    var el = $('#mapaContador');
    var media = F.mediaProvincia(ESTADO.filtros.prov, ESTADO.filtros.fuel);
    el.textContent = lista.length + ' marcadores' + (media != null ? ' · media ' + eur(media) : '');
  }

  function renderPaginacion(pag) {
    var el = $('#paginacion');
    var opciones = F.config.paginas.map(function (v) {
      return '<option value="' + v + '"' + (v === ESTADO.pageSize ? ' selected' : '') + '>' +
        (v === 0 ? 'Todos' : v) + '</option>';
    }).join('');
    el.innerHTML =
      '<button type="button" data-pag="primera" aria-label="Primera página"' + (ESTADO.pagina <= 1 ? ' disabled' : '') + '>«</button>' +
      '<button type="button" data-pag="anterior" aria-label="Página anterior"' + (ESTADO.pagina <= 1 ? ' disabled' : '') + '>‹</button>' +
      '<span class="pag-info">' + ESTADO.pagina + ' / ' + pag.paginas + '</span>' +
      '<button type="button" data-pag="siguiente" aria-label="Página siguiente"' + (ESTADO.pagina >= pag.paginas ? ' disabled' : '') + '>›</button>' +
      '<button type="button" data-pag="ultima" aria-label="Última página"' + (ESTADO.pagina >= pag.paginas ? ' disabled' : '') + '>»</button>' +
      '<label class="campo campo-mini" style="margin-left:0.4rem"><span class="sr">Resultados por página</span>' +
      '<select id="pageSizeSel" aria-label="Resultados por página">' + opciones + '</select></label>';
  }

  function renderAtajos() {
    var atajos = [['j / k', 'mover'], ['Enter', 'abrir'], ['/', 'buscar'], ['f', 'favoritas'],
      ['c', 'comparar'], ['Esc', 'cerrar']];
    $('#atajos').innerHTML = atajos.map(function (a) {
      return '<span class="atajo"><kbd>' + a[0] + '</kbd> ' + a[1] + '</span>';
    }).join('');
  }

  /* ========================= RENDER GENERAL ========================= */

  function render() {
    renderChips();
    renderLista();
    renderBarraComparar();
    if (ESTADO.detalleId) renderDetalle();
    app.dataset.destino = ESTADO.destino;
    $$('.nav-btn').forEach(function (b) {
      b.classList.toggle('activo', b.dataset.destino === ESTADO.destino);
    });
    $('#btnFavoritos').setAttribute('aria-pressed', ESTADO.filtros.soloFavoritas ? 'true' : 'false');
  }

  /* ========================= 5. DIVISOR Y PRESETS ========================= */

  function aplicarSeparacion() {
    /* El reparto se hace por flex-basis del panel del mapa; la lista ocupa el resto.
       Por debajo de 900 px el CSS manda (columna + peek), así que limpiamos los
       estilos en línea para no pisar las media queries. */
    var lista = $('#panelLista');
    var mapa = $('#panelMapa');
    mapa.style.flex = '';
    lista.style.flex = '';

    if (ESTADO.preset === 'mapa') {
      lista.style.display = 'none';
      divisor.style.display = 'none';
      if (window.innerWidth >= 900) mapa.style.flex = '0 0 100%';
    } else if (ESTADO.preset === 'lista') {
      mapa.style.display = 'none';
      divisor.style.display = 'none';
      lista.style.display = '';
    } else {
      mapa.style.display = '';
      divisor.style.display = '';
      lista.style.display = '';
      if (window.innerWidth >= 900) mapa.style.flex = '0 0 ' + ESTADO.separacion + '%';
    }
    $$('.preset').forEach(function (b) {
      var on = b.dataset.preset === ESTADO.preset;
      b.classList.toggle('activo', on);
      b.setAttribute('aria-pressed', on ? 'true' : 'false');
    });
    aplicarVista(false);
  }

  function iniciarDivisor() {
    var arrastrando = false;
    function alMover(ev) {
      if (!arrastrando) return;
      var r = $('#lienzo').getBoundingClientRect();
      var pct = ((ev.clientX - r.left) / r.width) * 100;
      ESTADO.separacion = acotar(pct, 28, 80);
      $('#panelMapa').style.flex = '0 0 ' + ESTADO.separacion + '%';
    }
    function soltar() {
      if (!arrastrando) return;
      arrastrando = false;
      document.body.classList.remove('arrastrando');
      document.removeEventListener('pointermove', alMover);
      document.removeEventListener('pointerup', soltar);
      aplicarVista(false);
    }
    divisor.addEventListener('pointerdown', function (ev) {
      if (window.innerWidth < 900) return;
      arrastrando = true;
      document.body.classList.add('arrastrando');
      divisor.setPointerCapture && divisor.setPointerCapture(ev.pointerId);
      document.addEventListener('pointermove', alMover);
      document.addEventListener('pointerup', soltar);
    });
    divisor.addEventListener('dblclick', function () {
      ESTADO.separacion = 50;
      ESTADO.preset = 'split';
      aplicarSeparacion();
      mostrarAviso('Reparto 50/50');
    });
    /* Accesible por teclado: flechas mueven el divisor */
    divisor.addEventListener('keydown', function (ev) {
      if (ev.key !== 'ArrowLeft' && ev.key !== 'ArrowRight') return;
      ev.preventDefault();
      ESTADO.preset = 'split';
      ESTADO.separacion = acotar(ESTADO.separacion + (ev.key === 'ArrowRight' ? 2 : -2), 28, 80);
      aplicarSeparacion();
    });
  }

  function setPreset(p) {
    ESTADO.preset = p;
    if (p === 'split') ESTADO.separacion = ESTADO.separacion === 100 || ESTADO.separacion === 0 ? 50 : ESTADO.separacion;
    aplicarSeparacion();
    aplicarVista(false);
  }

  /* Peek móvil: arrastrar el mini-mapa hacia abajo lo lleva a pantalla completa */
  function setPeek(estado) {
    ESTADO.peek = estado;
    app.dataset.peek = estado;
    var btn = $('#btnVerMapa');
    if (btn) btn.textContent = estado === 'abierto' ? '⤡ Ver lista' : '⤢ Ver mapa';
    if (estado === 'abierto') aplicarVista(false);
    else reiniciarVista();
  }

  function iniciarPeek() {
    var agarre = $('#peekAgarre'), arrastrando = false, inicioY = 0, altoBase = 0;
    agarre.addEventListener('pointerdown', function (ev) {
      arrastrando = true;
      inicioY = ev.clientY;
      altoBase = $('#panelMapa').getBoundingClientRect().height;
      agarre.setPointerCapture && agarre.setPointerCapture(ev.pointerId);
    });
    agarre.addEventListener('pointermove', function (ev) {
      if (!arrastrando) return;
      var alto = acotar(altoBase + (ev.clientY - inicioY), 120, window.innerHeight * 0.9);
      $('#panelMapa').style.flex = '0 0 ' + Math.round(alto) + 'px';
    });
    agarre.addEventListener('pointerup', function (ev) {
      if (!arrastrando) return;
      arrastrando = false;
      $('#panelMapa').style.flex = '';
      var alto = altoBase + (ev.clientY - inicioY);
      setPeek(alto > window.innerHeight * 0.42 ? 'abierto' : 'cerrado');
      mostrarAviso(ESTADO.peek === 'abierto' ? 'Mapa a pantalla completa' : 'Lista');
    });
  }

  /* Pan del mapa con el puntero (solo escritorio o peek abierto) */
  function iniciarPanMapa() {
    var arrastrando = false, x0 = 0, y0 = 0, tx0 = 0, ty0 = 0;
    mapaCaja.addEventListener('pointerdown', function (ev) {
      if (ev.target.closest('.marcador') || ev.target.closest('.mapa-popup')) return;
      if (ev.target.closest('.peek-agarre')) return;
      if (window.innerWidth < 900 && ESTADO.peek !== 'abierto') return;
      arrastrando = true;
      x0 = ev.clientX; y0 = ev.clientY; tx0 = vista.tx; ty0 = vista.ty;
      mapaCaja.setPointerCapture && mapaCaja.setPointerCapture(ev.pointerId);
    });
    mapaCaja.addEventListener('pointermove', function (ev) {
      if (!arrastrando) return;
      vista.tx = tx0 + (ev.clientX - x0);
      vista.ty = ty0 + (ev.clientY - y0);
      acotarVista();
      aplicarVista(false);
      ocultarPopupMapa();
    });
    function fin() { arrastrando = false; }
    mapaCaja.addEventListener('pointerup', fin);
    mapaCaja.addEventListener('pointercancel', fin);
    mapaCaja.addEventListener('pointerleave', fin);
  }

  function cambiarZoom(factor) {
    vista.zoom = acotar(vista.zoom * factor, 1, 3.2);
    acotarVista();
    aplicarVista(true);
  }

  /* ========================= POPUP DEL MAPA ========================= */

  function mostrarPopupMapa(e) {
    var p = $('#mapaPopup');
    var marca = e.marca;
    var crudo = precioDe(e, ESTADO.filtros.fuel);
    var fin = precioFinal(e, ESTADO.filtros.fuel);
    var desc = descuentoDe(e);
    p.innerHTML =
      '<h3>' + esc(e.marca) + '</h3>' +
      '<p class="mp-dir">' + esc(e.nombre) + ' · ' + esc(e.localidad) + '</p>' +
      '<div class="mp-fila"><span class="mp-precio">' + eur(crudo) + '</span>' +
      '<span class="etiqueta">' + km(e.dist) + '</span></div>' +
      (desc ? '<p class="mp-dir" style="margin-top:2px">con descuento ' + esc(marca) + ': <b>' + eurCorto(fin) + ' €</b></p>' : '') +
      '<div class="mp-acciones">' +
      '<button type="button" class="btn btn-primario btn-mini" data-pop-abrir="' + e.id + '">Ver detalle</button>' +
      '<button type="button" class="btn btn-secundario btn-mini" data-pop-comparar="' + e.id + '">Comparar</button>' +
      '</div><span class="mp-flecha" aria-hidden="true"></span>';
    p.hidden = false;

    var boton = $('.marcador[data-id="' + e.id + '"]', mapaCapa);
    if (boton) {
      var rb = boton.getBoundingClientRect(), rc = mapaCaja.getBoundingClientRect();
      var x = rb.left - rc.left + rb.width / 2;
      var y = rb.top - rc.top - 6;
      p.style.left = acotar(x, 120, rc.width - 120) + 'px';
      p.style.top = Math.max(y, 96) + 'px';
    }
  }
  function ocultarPopupMapa() { $('#mapaPopup').hidden = true; }

  /* ========================= 6. DETALLE + GRÁFICA ========================= */

  function abrirDetalle(id) {
    ESTADO.detalleId = id;
    ESTADO.activoId = id;
    app.dataset.detalle = 'abierto';
    marcarActivo(id);
    $$('#cuerpoTabla tr').forEach(function (tr) { tr.classList.toggle('activo', tr.dataset.id === id); });
    renderDetalle();
  }
  function cerrarDetalle() {
    app.dataset.detalle = 'cerrado';
    ESTADO.detalleId = null;
  }

  function renderDetalle() {
    var e = estacion(ESTADO.detalleId);
    if (!e) return;
    var fuel = ESTADO.detalleFuel || ESTADO.filtros.fuel || 'Gasolina 95 E5';

    $('#detTitulo').textContent = e.marca;
    $('#detSub').textContent = e.nombre + ' · ' + e.localidad;

    /* --- Información --- */
    var serie7 = F.historico(e.id, fuel, 7);
    var var7 = serie7.length > 1 ? ((serie7[serie7.length - 1].precio - serie7[0].precio) / serie7[0].precio) * 100 : 0;
    var clase7 = var7 < -0.05 ? 'baja' : (var7 > 0.05 ? 'sube' : 'plano');

    var filas = F.combustiblesVisibles.map(function (f) {
      var p = precioDe(e, f);
      var fin = precioFinal(e, f);
      var d = descuentoDe(e);
      if (p == null) return '<div class="det-comb-fila sin-precio"><span class="det-comb-nombre">' + esc(f) + '</span><span>no se vende</span></div>';
      return '<div class="det-comb-fila"><span class="det-comb-nombre">' + esc(f) + '</span>' +
        (d ? '<span class="det-comb-desc">−' + d.toFixed(2).replace('.', ',') + ' €</span>' : '') +
        '<span class="det-comb-precio ' + F.colorPrecio(p) + '" style="color:var(--' + F.colorPrecio(p) + ')">' + eur(fin) + '</span></div>';
    }).join('');

    $('#detPanelInfo').innerHTML =
      '<div class="det-bloque"><h3>Ubicación</h3>' +
      '<p style="font-size:0.85rem">' + esc(e.direccion) + '</p>' +
      '<p style="font-size:0.78rem;color:var(--texto-3)">' + esc(e.localidad) + ' · ' + F.provinciaNombre(e.prov) + '</p>' +
      '<div class="det-meta" style="margin-top:0.5rem">' +
      '<span class="etiqueta acento">📍 ' + km(e.dist) + '</span>' +
      '<span class="etiqueta">🕒 ' + esc(e.horario) + '</span>' +
      '<span class="etiqueta">🆔 ' + esc(e.id) + '</span>' +
      (ESTADO.favoritos[e.id] ? '<span class="etiqueta verde">★ Favorita</span>' : '') +
      '</div></div>' +

      '<div class="det-bloque"><h3>Precios · ' + esc(fuel) + '</h3>' +
      '<div class="det-combustibles">' + filas + '</div></div>' +

      '<div class="det-bloque"><h3>Tendencia 7 días</h3>' +
      '<svg class="spark ' + clase7 + '" viewBox="0 0 300 100" preserveAspectRatio="none" aria-hidden="true">' +
      sparkContenido(serie7) + '</svg>' +
      '<p style="font-size:0.78rem;color:var(--texto-2);margin-top:0.35rem">' +
      'de ' + eur(serie7[0].precio) + ' a ' + eur(serie7[serie7.length - 1].precio) + ' · <b>' + pct(var7) + '</b></p></div>' +

      '<div class="det-acciones">' +
      '<button type="button" class="btn btn-primario" data-det-repostar="' + e.id + '">⛽ Repostar aquí</button>' +
      '<button type="button" class="btn btn-secundario" data-det-comparar="' + e.id + '">⊞ Comparar</button>' +
      '<button type="button" class="btn btn-secundario" data-det-fav="' + e.id + '">' +
      (ESTADO.favoritos[e.id] ? '★ Quitar favorita' : '☆ Favorita') + '</button>' +
      '</div>';

    /* --- Histórico --- */
    var selFuel = $('#detFuel'), selDias = $('#detDias');
    var combustibles = F.combustiblesVisibles.filter(function (f) { return precioDe(e, f) != null; });
    if (!combustibles.length) combustibles = ['Gasolina 95 E5'];
    selFuel.innerHTML = combustibles.map(function (f) {
      return '<option value="' + esc(f) + '"' + (f === fuel ? ' selected' : '') + '>' + esc(f) + '</option>';
    }).join('');
    selDias.value = String(ESTADO.detalleDias);

    if (ESTADO.detalleTab === 'hist') dibujarHistorico();
  }

  /** SVG interno de una sparkline (sin el <svg>). */
  function sparkContenido(serie) {
    var vals = serie.map(function (d) { return d.precio; });
    var min = Math.min.apply(null, vals), max = Math.max.apply(null, vals);
    if (max - min < 0.004) { max += 0.002; min -= 0.002; }
    var n = serie.length;
    function X(i) { return n < 2 ? 150 : (i / (n - 1)) * 300; }
    function Y(v) { return 92 - ((v - min) / (max - min)) * 84; }
    var linea = [], area = [];
    for (var i = 0; i < n; i++) {
      linea.push((i ? 'L' : 'M') + X(i).toFixed(1) + ',' + Y(serie[i].precio).toFixed(1));
      area.push((i ? 'L' : 'M') + X(i).toFixed(1) + ',' + Y(serie[i].precio).toFixed(1));
    }
    var dArea = area.join(' ') + ' L300,100 L0,100 Z';
    return '<path class="spark-area" d="' + dArea + '"/>' +
      '<path class="spark-linea" vector-effect="non-scaling-stroke" d="' + linea.join(' ') + '"/>';
  }

  function dibujarHistorico() {
    var e = estacion(ESTADO.detalleId);
    if (!e) return;
    var canvas = $('#detGrafica');
    var cargando = $('#detCargando');

    /* Pequeño estado de carga para que el patrón quede reflejado en el prototipo */
    cargando.hidden = false;
    var fuel = $('#detFuel').value;
    var dias = parseInt($('#detDias').value, 10);
    ESTADO.detalleFuel = fuel;
    ESTADO.detalleDias = dias;

    setTimeout(function () {
      var serie = F.historico(e.id, fuel, dias);
      cargando.hidden = true;
      pintarGrafica(canvas, serie);
      renderResumenHistorico(serie, fuel);
    }, movimientoReducido ? 0 : 260);
  }

  function renderResumenHistorico(serie, fuel) {
    var vals = serie.map(function (d) { return d.precio; });
    var min = Math.min.apply(null, vals), max = Math.max.apply(null, vals);
    var media = vals.reduce(function (a, b) { return a + b; }, 0) / vals.length;
    var iMin = vals.indexOf(min), iMax = vals.indexOf(max);
    var variacion = ((vals[vals.length - 1] - vals[0]) / vals[0]) * 100;
    $('#detResumen').innerHTML =
      dato('Mínimo', eur(min), serie[iMin].fecha) +
      dato('Máximo', eur(max), serie[iMax].fecha) +
      dato('Media', eur(Math.round(media * 1000) / 1000), serie.length + ' jornadas') +
      dato('Variación', pct(variacion), fuel);
    function dato(t, v, sub) {
      return '<div class="dato"><span>' + esc(t) + '</span><b>' + esc(v) + '</b>' +
        '<span style="font-size:0.75rem">' + esc(sub) + '</span></div>';
    }
  }

  /** Gráfica de líneas con rejilla, extremos y tooltip al pasar el ratón. */
  function pintarGrafica(canvas, serie, hoverIdx) {
    var dpr = window.devicePixelRatio || 1;
    var w = canvas.clientWidth || 320, h = canvas.clientHeight || 200;
    canvas.width = Math.round(w * dpr); canvas.height = Math.round(h * dpr);
    var ctx = canvas.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);

    var pad = { t: 18, r: 14, b: 26, l: 48 };
    var vals = serie.map(function (d) { return d.precio; });
    var min = Math.min.apply(null, vals), max = Math.max.apply(null, vals);
    if (max - min < 0.012) { var m = (max + min) / 2; min = m - 0.006; max = m + 0.006; }
    var margen = (max - min) * 0.16; min -= margen; max += margen;
    var iw = w - pad.l - pad.r, ih = h - pad.t - pad.b;
    function X(i) { return pad.l + (serie.length < 2 ? iw / 2 : iw * i / (serie.length - 1)); }
    function Y(v) { return pad.t + ih * (1 - (v - min) / (max - min)); }

    ctx.font = '11px system-ui, sans-serif';
    ctx.strokeStyle = '#eef1f5';
    ctx.fillStyle = '#9aa0a6';
    ctx.textAlign = 'right'; ctx.textBaseline = 'middle';
    for (var g = 0; g <= 3; g++) {
      var v = min + (max - min) * g / 3, y = Y(v);
      ctx.beginPath(); ctx.moveTo(pad.l, y); ctx.lineTo(w - pad.r, y); ctx.stroke();
      ctx.fillText(v.toFixed(3).replace('.', ','), pad.l - 6, y);
    }

    /* Etiquetas de fecha: como mucho 4, repartidas, para que no se solapen */
    ctx.textAlign = 'center'; ctx.textBaseline = 'top';
    var paso = Math.max(1, Math.ceil(serie.length / 4));
    for (var i2 = 0; i2 < serie.length; i2 += paso) {
      ctx.fillText(serie[i2].fecha.slice(0, 5), X(i2), h - pad.b + 6);
    }

    var pts = serie.map(function (d, i) { return { x: X(i), y: Y(d.precio), d: d }; });

    /* Área con degradado muy suave + línea de acento */
    var grad = ctx.createLinearGradient(0, pad.t, 0, h - pad.b);
    grad.addColorStop(0, 'rgba(26,115,232,0.22)');
    grad.addColorStop(1, 'rgba(26,115,232,0.02)');
    ctx.beginPath();
    pts.forEach(function (p, i) { i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y); });
    ctx.lineTo(pts[pts.length - 1].x, h - pad.b);
    ctx.lineTo(pts[0].x, h - pad.b);
    ctx.closePath(); ctx.fillStyle = grad; ctx.fill();

    ctx.beginPath();
    pts.forEach(function (p, i) { i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y); });
    ctx.strokeStyle = '#1a73e8'; ctx.lineWidth = 2; ctx.lineJoin = 'round'; ctx.stroke();

    /* Extremos marcados: mínimo en verde, máximo en rojo */
    var iMin = vals.indexOf(Math.min.apply(null, vals));
    var iMax = vals.indexOf(Math.max.apply(null, vals));
    [[iMin, '#1e8e3e'], [iMax, '#d93025']].forEach(function (par) {
      ctx.beginPath(); ctx.arc(pts[par[0]].x, pts[par[0]].y, 4, 0, Math.PI * 2);
      ctx.fillStyle = par[1]; ctx.fill();
      ctx.strokeStyle = '#fff'; ctx.lineWidth = 2; ctx.stroke();
    });

    canvas._pts = pts;

    /* Tooltip del punto más cercano */
    if (hoverIdx != null && pts[hoverIdx]) {
      var p = pts[hoverIdx];
      var txt = eur(p.d.precio), sub = p.d.fecha;
      ctx.font = '600 12px system-ui, sans-serif';
      var wT = Math.max(ctx.measureText(txt).width, ctx.measureText(sub).width) + 16;
      var x = acotar(p.x - wT / 2, 4, w - wT - 4);
      var y = acotar(p.y - 44, 4, h - 46);
      ctx.fillStyle = 'rgba(31,41,51,0.92)';
      ctx.beginPath();
      if (ctx.roundRect) { ctx.roundRect(x, y, wT, 40, 8); } else { ctx.rect(x, y, wT, 40); }
      ctx.fill();
      ctx.fillStyle = '#fff'; ctx.textAlign = 'left'; ctx.textBaseline = 'top';
      ctx.fillText(txt, x + 8, y + 6);
      ctx.font = '11px system-ui, sans-serif'; ctx.fillStyle = '#c8d2dc';
      ctx.fillText(sub, x + 8, y + 23);

      ctx.beginPath(); ctx.arc(p.x, p.y, 5, 0, Math.PI * 2);
      ctx.fillStyle = '#1a73e8'; ctx.fill();
      ctx.strokeStyle = '#fff'; ctx.lineWidth = 2; ctx.stroke();
    }
  }

  function iniciarHoverGrafica() {
    var canvas = $('#detGrafica');
    canvas.addEventListener('mousemove', function (ev) {
      if (!canvas._pts) return;
      var r = canvas.getBoundingClientRect();
      var x = ev.clientX - r.left;
      var mejor = 0, dist = Infinity;
      canvas._pts.forEach(function (p, i) {
        var d = Math.abs(p.x - x);
        if (d < dist) { dist = d; mejor = i; }
      });
      pintarGrafica(canvas, canvas._pts.map(function (p) { return p.d; }), mejor);
    });
    canvas.addEventListener('mouseleave', function () {
      if (canvas._pts) pintarGrafica(canvas, canvas._pts.map(function (p) { return p.d; }));
    });
  }

  /* ========================= 7. COMPARADOR ========================= */

  function alternarComparar(id, forzar) {
    var i = ESTADO.comparar.indexOf(id);
    var quiere = forzar != null ? forzar : i < 0;
    if (quiere && i < 0) {
      if (ESTADO.comparar.length >= 4) { mostrarAviso('Máximo 4 estaciones'); return; }
      ESTADO.comparar.push(id);
    } else if (!quiere && i >= 0) {
      ESTADO.comparar.splice(i, 1);
    }
    renderLista();
    renderBarraComparar();
  }

  function renderBarraComparar() {
    var n = ESTADO.comparar.length;
    barraComparar.hidden = n === 0;
    if (!n) return;
    $('#bcTexto').textContent = n + (n === 1 ? ' estación' : ' estaciones');
    $('#bcHint').textContent = n < 2 ? 'Marca entre 2 y 4 para comparar' : 'Listo para comparar';
    var boton = $('#bcComparar');
    boton.disabled = n < 2;
    boton.textContent = n >= 2 ? 'Comparar ' + n : 'Comparar';
    $('#bcMiniaturas').innerHTML = ESTADO.comparar.map(function (id) {
      var e = estacion(id);
      return '<span class="miniatura">' + esc(e.marca) + ' <b>' + eurCorto(precioFinal(e, ESTADO.filtros.fuel)) + ' €</b>' +
        '<button type="button" data-bc-quitar="' + id + '" aria-label="Quitar ' + esc(e.marca) + ' del comparador">✕</button></span>';
    }).join('');
  }

  function abrirComparador() {
    if (ESTADO.comparar.length < 2) { mostrarAviso('Marca al menos 2 estaciones'); return; }
    var ests = ESTADO.comparar.map(estacion);
    var fuelActivo = ESTADO.filtros.fuel;

    /* Combustibles comunes: los que vende al menos una de las elegidas */
    var combustibles = F.combustiblesVisibles.filter(function (f) {
      return ests.some(function (e) { return precioDe(e, f) != null; });
    });

    var cabecera = '<tr><th class="col-estacion">Estación</th>' +
      combustibles.map(function (f) { return '<th style="text-align:right">' + esc(f) + '</th>'; }).join('') +
      '</tr>';

    var filas = combustibles.map(function (f) {
      /* Mejor opción por combustible = precio final (con descuento) más bajo */
      var mejor = null, mejorP = Infinity;
      ests.forEach(function (e) {
        var p = precioFinal(e, f);
        if (p != null && p < mejorP) { mejorP = p; mejor = e.id; }
      });
      return '<tr' + (mejor ? '' : '') + '>' +
        '<td class="celda-nombre"><b>' + esc(f) + '</b></td>' +
        ests.map(function (e) {
          var p = precioDe(e, f), fin = precioFinal(e, f);
          if (p == null) return '<td class="num" style="color:var(--texto-3)">—</td>';
          var esMejor = e.id === mejor;
          return '<td class="num' + (esMejor ? ' mejor' : '') + '">' + eur(fin) +
            (esMejor ? ' <span class="marca-mejor">✓</span>' : '') +
            (descuentoDe(e) ? '<br><small style="font-size:0.75rem;color:var(--texto-3);font-weight:400">bruto ' + eur(p) + '</small>' : '') +
            '</td>';
        }).join('') + '</tr>';
    }).join('');

    var filasMeta =
      '<tr><td class="celda-nombre">Distancia</td>' +
      ests.map(function (e) { return '<td class="num">' + km(e.dist) + '</td>'; }).join('') + '</tr>' +
      '<tr><td class="celda-nombre">Localidad</td>' +
      ests.map(function (e) { return '<td>' + esc(e.localidad) + '</td>'; }).join('') + '</tr>' +
      '<tr><td class="celda-nombre">Horario</td>' +
      ests.map(function (e) { return '<td>' + esc(e.horario) + '</td>'; }).join('') + '</tr>';

    var columnas = ests.map(function (e) {
      var serie = F.historico(e.id, fuelActivo || 'Gasolina 95 E5', 7);
      var v = serie.length > 1 ? ((serie[serie.length - 1].precio - serie[0].precio) / serie[0].precio) * 100 : 0;
      var clase = v < -0.05 ? 'baja' : (v > 0.05 ? 'sube' : 'plano');
      return '<div class="det-bloque" style="flex:1 1 220px">' +
        '<h3>' + esc(e.marca) + '</h3>' +
        '<p style="font-size:0.78rem;color:var(--texto-3)">' + esc(e.nombre) + '</p>' +
        '<p style="margin:0.35rem 0 0.15rem;font-size:1.35rem;font-weight:700;font-variant-numeric:tabular-nums">' +
        eur(precioFinal(e, fuelActivo)) + '</p>' +
        '<p style="font-size:0.75rem;color:var(--texto-3)">' + esc(fuelActivo || 'combustible más barato') + '</p>' +
        '<svg class="spark ' + clase + '" viewBox="0 0 300 100" preserveAspectRatio="none" aria-hidden="true">' +
        sparkContenido(serie) + '</svg>' +
        '<p style="font-size:0.78rem;margin-top:0.2rem">7 días: <b class="tend ' + clase + '">' + pct(v) + '</b></p>' +
        '<button type="button" class="btn btn-secundario btn-mini" style="margin-top:0.5rem" data-comp-repostar="' + e.id + '">Repostar aquí</button>' +
        '</div>';
    }).join('');

    var contenido =
      '<div class="comparativa">' +
      '<div style="display:flex;gap:0.5rem;flex-wrap:wrap">' + columnas + '</div>' +
      '<div class="comp-rejilla"><table class="comp-tabla">' +
      '<thead>' + cabecera + '</thead>' +
      '<tbody>' + filas + '</tbody>' +
      '<tfoot>' + filasMeta + '</tfoot>' +
      '</table></div>' +
      '<p style="font-size:0.78rem;color:var(--texto-3)">El precio destacado en verde es el más bajo con los descuentos de <b>' +
      esc('Ajustes → Descuentos por marca') + '</b> aplicados.</p>' +
      '</div>';

    abrirHoja('Comparar estaciones', contenido);
  }

  /* ========================= HOJA / POPOVER ========================= */

  var focoAnterior = null;
  function abrirHoja(titulo, contenidoHTML) {
    focoAnterior = document.activeElement;
    $('#hojaTitulo').textContent = titulo;
    $('#hojaCuerpo').innerHTML = contenidoHTML;
    hoja.hidden = false;
    hojaFondo.hidden = false;
    var primero = $('button, [href], input, select', hoja);
    if (primero) primero.focus();
  }
  function cerrarHoja() {
    if (hoja.hidden) return;
    hoja.hidden = true;
    hojaFondo.hidden = true;
    if (focoAnterior && focoAnterior.focus) focoAnterior.focus();
  }

  function mostrarPopoverMarcas() {
    var p = $('#popoverMarcas');
    var r = $('#fMarcas').getBoundingClientRect();
    p.hidden = false;
    p.style.top = Math.min(r.bottom + 6, window.innerHeight - 340) + 'px';
    p.style.left = acotar(r.left, 8, window.innerWidth - 288) + 'px';
    ESTADO.marcasPendientes = ESTADO.filtros.marcas.slice();
    pintarPopoverMarcas();
    $('#popoverBuscar').value = '';
    $('#popoverBuscar').focus();
    $('#fMarcas').setAttribute('aria-expanded', 'true');
  }
  function cerrarPopoverMarcas() {
    $('#popoverMarcas').hidden = true;
    $('#fMarcas').setAttribute('aria-expanded', 'false');
  }
  function pintarPopoverMarcas() {
    var q = norm($('#popoverBuscar').value);
    var marcas = F.marcasDe(ESTADO.filtros.prov || '');
    var base = marcas.length ? marcas : F.marcas.slice().sort(function (a, b) { return a.localeCompare(b, 'es'); });
    $('#popoverListaMarcas').innerHTML = base.map(function (m) {
      var visible = !q || norm(m).indexOf(q) >= 0;
      var marcada = ESTADO.marcasPendientes.indexOf(m) >= 0;
      return '<label' + (visible ? '' : ' hidden') + '><input type="checkbox" value="' + esc(m) + '"' +
        (marcada ? ' checked' : '') + '>' + esc(m) + '</label>';
    }).join('');
  }

  function mostrarAviso(texto) {
    var aviso = crear('div', 'aviso', texto);
    $('#avisos').appendChild(aviso);
    setTimeout(function () { aviso.remove(); }, 2200);
  }

  /* ========================= 8. CHAT IA ========================= */

  function proveedoresVisibles() {
    return AI_PROVEEDORES.filter(function (p) {
      return !p.general && ESTADO.iaOcultos.indexOf(p.id) < 0;
    });
  }

  function iaMarkdown(md) {
    var lineas = String(md).split(/\r?\n/), salida = [], i = 0;
    function enLinea(t) {
      t = esc(t);
      t = t.replace(/`([^`]+)`/g, '<code>$1</code>');
      t = t.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
      t = t.replace(/(^|[\s(])\*([^*\n]+)\*(?=[\s).,;:!?]|$)/g, '$1<em>$2</em>');
      t = t.replace(/\[([^\]]+)\]\((https?:[^)\s]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>');
      t = t.replace(/(^|\s)(https?:\/\/[^\s<]+)/g, '$1<a href="$2" target="_blank" rel="noopener">$2</a>');
      return t;
    }
    while (i < lineas.length) {
      var l = lineas[i], m;
      if (/^\s*$/.test(l)) { i++; continue; }
      if (/^```/.test(l)) {
        var codigo = []; i++;
        while (i < lineas.length && !/^```/.test(lineas[i])) { codigo.push(lineas[i]); i++; }
        i++;
        salida.push('<pre class="ia-pre"><code>' + esc(codigo.join('\n')) + '</code></pre>');
        continue;
      }
      if ((m = l.match(/^(#{1,4})\s+(.*)$/))) {
        salida.push('<p class="ia-h ia-h' + m[1].length + '">' + enLinea(m[2]) + '</p>'); i++; continue;
      }
      if (/^\s*(-{3,}|\*{3,})\s*$/.test(l)) { salida.push('<hr>'); i++; continue; }
      if (/^\s*\|/.test(l) && i + 1 < lineas.length && /^\s*\|?[\s:|-]+\|/.test(lineas[i + 1])) {
        var filas = [];
        while (i < lineas.length && /^\s*\|/.test(lineas[i])) { filas.push(lineas[i]); i++; }
        var celdas = filas.map(function (f) {
          return f.replace(/^\s*\|/, '').replace(/\|\s*$/, '').split('|').map(function (c) { return c.trim(); });
        });
        var cuerpo = [celdas[0]].concat(celdas.slice(2));
        salida.push('<table class="ia-tabla"><thead><tr>' +
          cuerpo[0].map(function (c) { return '<th>' + enLinea(c) + '</th>'; }).join('') + '</tr></thead><tbody>' +
          cuerpo.slice(1).map(function (f) {
            return '<tr>' + f.map(function (c) { return '<td>' + enLinea(c) + '</td>'; }).join('') + '</tr>';
          }).join('') + '</tbody></table>');
        continue;
      }
      if ((m = l.match(/^\s*[-*]\s+(.*)$/))) {
        var items = [];
        while (i < lineas.length && (m = lineas[i].match(/^\s*[-*]\s+(.*)$/))) { items.push(m[1]); i++; }
        salida.push('<ul>' + items.map(function (t) { return '<li>' + enLinea(t) + '</li>'; }).join('') + '</ul>');
        continue;
      }
      if ((m = l.match(/^\s*\d+[.)]\s+(.*)$/))) {
        var orden = [];
        while (i < lineas.length && (m = lineas[i].match(/^\s*\d+[.)]\s+(.*)$/))) { orden.push(m[1]); i++; }
        salida.push('<ol>' + orden.map(function (t) { return '<li>' + enLinea(t) + '</li>'; }).join('') + '</ol>');
        continue;
      }
      if (/^\s*>\s?/.test(l)) {
        var cita = [];
        while (i < lineas.length && /^\s*>\s?/.test(lineas[i])) { cita.push(lineas[i].replace(/^\s*>\s?/, '')); i++; }
        salida.push('<blockquote>' + cita.map(enLinea).join('<br>') + '</blockquote>');
        continue;
      }
      var parrafo = [l]; i++;
      while (i < lineas.length && !/^\s*$/.test(lineas[i]) &&
             !/^(#{1,4})\s|^\s*[-*]\s|^\s*\d+[.)]\s|^\s*\||^```|^\s*>/.test(lineas[i])) {
        parrafo.push(lineas[i]); i++;
      }
      salida.push('<p>' + parrafo.map(enLinea).join('<br>') + '</p>');
    }
    return salida.join('');
  }

  function modeloDe(id) {
    var p = proveedor(id);
    return ESTADO.iaModelos[id] || (p && p.defecto) || '—';
  }

  function renderIA() {
    var tabs = AI_PROVEEDORES.map(function (p) {
      var oculto = !p.general && ESTADO.iaOcultos.indexOf(p.id) >= 0;
      return '<button type="button" class="ia-tab' + (p.id === ESTADO.iaProvider ? ' activo' : '') + (oculto ? ' ia-oculto' : '') +
        '" data-ia="' + p.id + '" role="tab" aria-selected="' + (p.id === ESTADO.iaProvider ? 'true' : 'false') + '">' +
        p.icono + ' ' + esc(p.nombre) + '</button>';
    }).join('');

    var paneles = AI_PROVEEDORES.map(function (p) { return panelIA(p); }).join('');

    $('#zonaIA').innerHTML =
      '<div class="ia-marco">' +
      '<div class="ia-tabs" role="tablist" aria-label="Proveedores de IA">' + tabs + '</div>' +
      paneles + '</div>';
    /* Ocultar pestañas desmarcadas en Ajustes → Pestañas de IA */
    $$('#zonaIA .ia-tab.ia-oculto').forEach(function (b) { b.hidden = true; });
  }

  function panelIA(p) {
    var activo = p.id === ESTADO.iaProvider;
    var mensajes = ESTADO.iaChats[p.id] || [];
    var cabecera;
    if (p.general) {
      cabecera = '<span class="ia-estado ok">✅ ' + proveedoresVisibles().length + '/' + (AI_PROVEEDORES.length - 1) +
        ' proveedores listos</span>' +
        '<div class="ia-prompts">' + ESTADO.prompts.map(function (t, i) {
          return t ? '<button type="button" class="ia-prompt" data-prompt="' + esc(t) + '">' + (i + 1) + '. ' + esc(t) + '</button>' : '';
        }).join('') + '</div>';
    } else {
      cabecera =
        '<label class="campo campo-mini"><span class="sr">Modelo</span>' +
        '<select data-modelo="' + p.id + '" aria-label="Modelo de ' + esc(p.nombre) + '">' +
        p.modelos.map(function (m) {
          return '<option value="' + esc(m) + '"' + (m === modeloDe(p.id) ? ' selected' : '') + '>' + esc(m) + '</option>';
        }).join('') + '</select></label>' +
        '<button type="button" class="btn btn-secundario btn-mini" data-refrescar="' + p.id + '" title="Volver a consultar el catálogo de modelos">🔄 Modelos</button>' +
        '<span class="ia-estado" data-estado="' + p.id + '">⚠️ Sin API Key</span>';
    }

    var cuerpo = mensajes.map(function (m) { return burbujaIA(m, p); }).join('') ||
      '<div class="ia-msg vacio">Pregunta lo que quieras sobre precios de carburante.</div>';

    return '<div class="ia-panel' + (activo ? ' activo' : '') + '" data-iapanel="' + p.id + '" role="tabpanel">' +
      '<div class="ia-cabecera">' + cabecera + '</div>' +
      '<div class="ia-chat" data-chat="' + p.id + '">' + cuerpo + '</div>' +
      '<div class="ia-entrada">' +
      '<input type="text" data-iaentrada="' + p.id + '" aria-label="Mensaje para ' + esc(p.nombre) + '" placeholder="' +
      (p.general ? 'Pregunta a todos los proveedores a la vez…' : 'Escribe un mensaje…') + '">' +
      '<button type="button" class="btn btn-primario" data-iaenviar="' + p.id + '">Enviar</button>' +
      '</div></div>';
  }

  function burbujaIA(m, p) {
    var clase = m.role === 'user' ? 'user' : 'assistant';
    var html = clase === 'assistant' ? iaMarkdown(m.content) : esc(m.content);
    var meta = '';
    if (clase === 'assistant') {
      var ms = 600 + (hash((p.id + m.content).slice(0, 40)) % 1900);
      var etiqueta = (ms / 1000).toFixed(1).replace('.', ',') + ' s';
      meta = '<div class="ia-meta">⏱ ' + esc(p.general && m.proveedor ? m.proveedor + ' · ' : '') +
        esc(m.modelo || modeloDe(p.id)) + ' · ' + etiqueta + '</div>';
    }
    return '<div class="ia-msg ' + clase + '">' + html + meta + '</div>';
  }

  function enviarIA(id, texto) {
    texto = (texto || '').trim();
    if (!texto) return;
    var p = proveedor(id);
    if (!ESTADO.iaChats[id]) ESTADO.iaChats[id] = [];
    ESTADO.iaChats[id].push({ role: 'user', content: texto });

    if (p.general) {
      /* Una sola pasada: la misma pregunta a todos los proveedores visibles */
      proveedoresVisibles().forEach(function (prov) {
        var ejemplo = (F.chatsIA[prov.id] || []).filter(function (m) { return m.role === 'assistant'; });
        var contenido = ejemplo.length ? ejemplo[ejemplo.length - 1].content
          : 'No tengo datos suficientes para **' + prov.nombre + '** en este prototipo.';
        ESTADO.iaChats[id].push({ role: 'assistant', content: contenido, modelo: modeloDe(prov.id), proveedor: prov.nombre });
      });
    } else {
      var ejemplos = (F.chatsIA[id] || []).filter(function (m) { return m.role === 'assistant'; });
      var respuesta = ejemplos.length
        ? ejemplos[hash(texto) % ejemplos.length].content
        : 'En este prototipo las respuestas de **' + p.nombre + '** son de ejemplo: los datos reales vienen de `FAKE.estaciones`.';
      ESTADO.iaChats[id].push({ role: 'assistant', content: respuesta, modelo: modeloDe(id) });
    }

    renderIA();
    var chat = $('[data-chat="' + id + '"]');
    if (chat) chat.scrollTop = chat.scrollHeight;
  }

  function refrescarModelos(id) {
    var p = proveedor(id);
    var estado = $('[data-estado="' + id + '"]');
    if (!estado) return;
    estado.textContent = '⏳ Consultando modelos…';
    setTimeout(function () {
      estado.textContent = '✅ ' + p.modelos.length + ' modelos disponibles';
      var sel = $('[data-modelo="' + id + '"]');
      if (sel) sel.value = modeloDe(id);
      mostrarAviso('Catálogo de ' + p.nombre + ' actualizado');
    }, movimientoReducido ? 0 : 600);
  }

  /* ========================= 9. AJUSTES ========================= */

  function renderAjustes() {
    var c = F.cacheInfo, v = F.versionApp;

    var descuentos = Object.keys(ESTADO.descuentos).map(function (m) {
      return '<div class="descuento-fila">' +
        '<input type="text" value="' + esc(m) + '" readonly aria-label="Marca ' + esc(m) + '">' +
        '<input type="number" step="0.01" min="0" max="1" value="' + ESTADO.descuentos[m] + '" data-desc="' + esc(m) + '" aria-label="Descuento de ' + esc(m) + '">' +
        '<button type="button" class="btn-fav" data-desc-borrar="' + esc(m) + '" aria-label="Quitar el descuento de ' + esc(m) + '" style="color:var(--rojo)">✕</button>' +
        '</div>';
    }).join('');

    var opciones = F.config.paginas.map(function (p) {
      return '<option value="' + p + '"' + (p === ESTADO.pageSize ? ' selected' : '') + '>' + (p === 0 ? 'Todos' : p) + '</option>';
    }).join('');

    var registro = (ESTADO.logTab === 'api' ? F.logApi : F.logPush).map(function (l) {
      var err = typeof l.estado === 'number' ? (l.estado >= 400 ? 'err' : 'ok') : (l.estado === 'ok' ? 'ok' : 'err');
      return '<div class="linea"><span class="t">' + esc(l.t) + '</span><span class="u">' + esc(l.url) + '</span>' +
        '<span class="e ' + err + '">' + esc(String(l.estado)) + ' · ' + esc(l.ms) + ' ms</span></div>';
    }).join('');

    var visibilidad = AI_PROVEEDORES.filter(function (p) { return !p.general; }).map(function (p) {
      var visible = ESTADO.iaOcultos.indexOf(p.id) < 0;
      return '<label><input type="checkbox" data-iavis="' + p.id + '"' + (visible ? ' checked' : '') + '>' +
        esc(p.nombre) + '</label>';
    }).join('');

    var prompts = ESTADO.prompts.map(function (t, i) {
      return '<div class="tarjeta-fila"><label style="width:1.4rem">' + (i + 1) + '.</label>' +
        '<input type="text" style="flex:1" value="' + esc(t || '') + '" data-prompt="' + i + '" aria-label="Prompt rápido ' + (i + 1) + '"></div>';
    }).join('');

    $('#zonaAjustes').innerHTML =
      '<div class="ajustes-rejilla">' +

      '<div class="tarjeta"><h3>🏷️ Descuentos por marca</h3>' +
      '<p class="desc">Se restan al precio mostrado en toda la app (lista, mapa y comparador).</p>' +
      descuentos +
      '<button type="button" class="btn btn-secundario btn-mini" id="ajAddDesc">+ Añadir marca</button></div>' +

      '<div class="tarjeta"><h3>🗑️ Caché de datos</h3>' +
      '<div class="subtabs"><button type="button" class="subtab' + (ESTADO.cacheTab === 'indexeddb' ? ' activo' : '') + '" data-sub="indexeddb">IndexedDB</button>' +
      '<button type="button" class="subtab' + (ESTADO.cacheTab === 'localstorage' ? ' activo' : '') + '" data-sub="localstorage">localStorage</button></div>' +
      (ESTADO.cacheTab === 'indexeddb'
        ? '<div class="cache-dato">Provincias cacheadas: <b>' + c.provincias + '</b></div>' +
          '<div class="cache-dato">Gasolineras: <b>' + c.gasolineras.toLocaleString('es-ES') + '</b></div>' +
          '<div class="cache-dato">Días de histórico: <b>' + c.historicoDias + '</b></div>' +
          '<div class="cache-dato"><small>' + esc(c.idb) + '</small></div>'
        : '<div class="cache-dato">Claves <code>gasolineras_*</code>: <b>' + c.lsClaves + '</b></div>' +
          '<div class="cache-dato">Última actualización: <b>' + esc(c.ultimaActualizacion) + '</b></div>') +
      '<div class="tarjeta-fila" style="margin-top:0.6rem"><label>Horas de caché</label>' +
      '<input type="number" id="ajCacheTtl" min="0" max="72" value="' + ESTADO.cacheTtl + '">' +
      '<button type="button" class="btn btn-secundario btn-mini" id="ajLimpiarCache">🗑️ Limpiar caché</button></div></div>' +

      '<div class="tarjeta"><h3>📄 Paginación</h3>' +
      '<p class="desc">Cuántas estaciones se muestran por página en la lista.</p>' +
      '<div class="tarjeta-fila"><label>Resultados por página</label>' +
      '<select id="ajPageSize">' + opciones + '</select></div></div>' +

      '<div class="tarjeta"><h3>📋 Registro de actividad</h3>' +
      '<div class="subtabs"><button type="button" class="subtab' + (ESTADO.logTab === 'api' ? ' activo' : '') + '" data-sub="api">API</button>' +
      '<button type="button" class="subtab' + (ESTADO.logTab === 'push' ? ' activo' : '') + '" data-sub="push">Push</button></div>' +
      '<div class="registro">' + registro + '</div>' +
      '<button type="button" class="btn btn-secundario btn-mini" style="margin-top:0.5rem" id="ajLimpiarLog">🗑️ Borrar registro</button></div>' +

      '<div class="tarjeta"><h3>🔔 Notificaciones push</h3>' +
      '<p class="desc">Aviso cuando el precio baja (o sube) en tus favoritas.</p>' +
      '<div class="tarjeta-fila"><label><input type="checkbox" id="ajPush"' + (ESTADO.push.activo ? ' checked' : '') + '> Bajada de precio</label>' +
      '<label><input type="checkbox" id="ajPushSube"' + (ESTADO.push.subida ? ' checked' : '') + '> Subida</label>' +
      '<button type="button" class="btn btn-secundario btn-mini" id="ajPushProbar">Probar</button></div>' +
      '<div class="tarjeta-fila"><label>Chequeo cada</label><input type="number" id="ajPushIntervalo" min="1" max="24" value="' + ESTADO.push.intervalo + '"> <span>horas</span></div>' +
      '<div class="tarjeta-fila"><label>Caída en los últimos</label><input type="number" id="ajPushDias" min="0" max="90" value="' + ESTADO.push.dias + '"> <span>días</span></div>' +
      '<p class="desc" id="ajPushEstado" style="margin:0.4rem 0 0">' + (ESTADO.push.activo ? '✓ Suscripción activa' : '✗ Sin suscripción') + '</p></div>' +

      '<div class="tarjeta"><h3>🤖 Claves API - IA</h3>' +
      '<p class="desc">En el prototipo no se guardan: sirven para ver el flujo de Config.</p>' +
      '<div class="tarjeta-fila"><input type="password" placeholder="Contraseña" aria-label="Contraseña de las claves" style="flex:1">' +
      '<button type="button" class="btn btn-secundario btn-mini" id="ajCargarClaves">Cargar claves</button></div>' +
      '<div class="visibilidad">' +
      ['Google Gemini', 'Groq', 'Mistral', 'OpenRouter', 'LLM7.io (opcional)'].map(function (n) {
        return '<label style="flex-direction:column;align-items:stretch"><span style="font-size:0.75rem">' + esc(n) + '</span>' +
          '<input type="password" placeholder="API Key" aria-label="Clave de ' + esc(n) + '"></label>';
      }).join('') +
      '</div>' +
      '<p class="desc" style="margin-top:0.5rem"><b>NVIDIA</b> va por proxy (<code>workers/nvidia-proxy.js</code>): el navegador solo guarda la URL del Worker, nunca la clave.</p></div>' +

      '<div class="tarjeta"><h3>🧩 Pestañas de IA</h3>' +
      '<p class="desc">Desmarca los proveedores que no uses; su chat se conserva. Siempre debe quedar uno visible.</p>' +
      '<div class="visibilidad">' + visibilidad + '</div>' +
      '<p class="desc" id="ajIaAviso" style="margin:0.5rem 0 0"></p></div>' +

      '<div class="tarjeta"><h3>⚡ Prompts rápidos</h3>' +
      '<p class="desc">Aparecen como botones numerados en la pestaña General.</p>' + prompts + '</div>' +

      '<div class="tarjeta"><h3>🔄 Actualización de la app</h3>' +
      '<p class="desc">Versión instalada: <b>' + esc(v.texto) + '</b></p>' +
      '<div class="tarjeta-fila"><button type="button" class="btn btn-secundario btn-mini" id="ajBuscarAct">Buscar actualizaciones</button>' +
      '<span class="ia-estado" id="ajActEstado"></span></div></div>' +

      '</div>';
  }

  /* ========================= 10. NAVEGACIÓN Y EVENTOS ========================= */

  function setDestino(d) {
    if (d === 'favoritas') { ESTADO.filtros.soloFavoritas = true; }
    else if (d === 'lista') { ESTADO.filtros.soloFavoritas = false; }
    else if (d === 'mapa' && ESTADO.destino === 'favoritas') { ESTADO.filtros.soloFavoritas = false; }
    ESTADO.destino = d;
    /* Los destinos de lista ocultan el mapa por CSS: volvemos al reparto normal
       para que no quede ningún `display:none` en línea de un preset anterior. */
    if (d === 'lista' || d === 'favoritas') ESTADO.preset = 'split';
    cerrarDetalle();
    ocultarPopupMapa();
    if (d === 'ia') renderIA();
    if (d === 'ajustes') renderAjustes();
    aplicarSeparacion();
    render();
    var nav = $('.nav-btn[data-destino="' + d + '"]');
    if (nav) nav.setAttribute('aria-current', 'page');
    $$('.nav-btn').forEach(function (b) { if (b !== nav) b.removeAttribute('aria-current'); });
  }

  function filtrosPorDefecto() {
    ESTADO.filtros.loc = '';
    ESTADO.filtros.marcas = [];
    ESTADO.filtros.distancia = null;
    ESTADO.filtros.soloFavoritas = false;
    ESTADO.filtros.q = '';
    ESTADO.pagina = 1;
    $('#buscar').value = '';
    $('#fDistancia').value = '';
    $('#fMarcas').innerHTML = 'Todas <span class="caret" aria-hidden="true">▾</span>';
    /* El combo de localidades vuelve al de la provincia actual (no se vacía) */
    $('#fLocalidad').innerHTML = '<option value="">Todas</option>' +
      F.localidadesDe(ESTADO.filtros.prov).map(function (l) {
        return '<option value="' + esc(l) + '">' + esc(l) + '</option>';
      }).join('');
  }

  function cargarProvincia(id, conCarga) {
    ESTADO.filtros.prov = id;
    $('#fProvincia').value = id;
    filtrosPorDefecto();
    /* Localidades de la nueva provincia */
    $('#fLocalidad').innerHTML = '<option value="">Todas</option>' +
      F.localidadesDe(id).map(function (l) { return '<option value="' + esc(l) + '">' + esc(l) + '</option>'; }).join('');
    if (!conCarga) { render(); return; }
    var overlay = $('#cargandoLista');
    overlay.hidden = false;
    render();
    setTimeout(function () { overlay.hidden = true; render(); },
      movimientoReducido ? 0 : 420);
  }

  function pintarSelects() {
    $('#fProvincia').innerHTML = '<option value="">Todas las provincias</option>' +
      F.provincias.map(function (p) {
        return '<option value="' + p.id + '"' + (p.id === ESTADO.filtros.prov ? ' selected' : '') + '>' + esc(p.nombre) + '</option>';
      }).join('');
    $('#fLocalidad').innerHTML = '<option value="">Todas</option>' +
      F.localidadesDe(ESTADO.filtros.prov).map(function (l) {
        return '<option value="' + esc(l) + '">' + esc(l) + '</option>';
      }).join('');
    $('#fCombustible').innerHTML = '<option value="">Todos</option>' +
      F.combustiblesVisibles.map(function (f) {
        return '<option value="' + esc(f) + '"' + (f === ESTADO.filtros.fuel ? ' selected' : '') + '>' + esc(f) + '</option>';
      }).join('');
    $('#ordenSel').value = ESTADO.orden.col + ':' + ESTADO.orden.dir;
    $('#mapaEstilo').value = 'calles';
    mapaCaja.dataset.estilo = 'calles';
  }

  function iniciarEventos() {
    /* --- Filtros --- */
    $('#fProvincia').addEventListener('change', function () { cargarProvincia(this.value, true); });
    $('#fLocalidad').addEventListener('change', function () { ESTADO.filtros.loc = this.value; ESTADO.pagina = 1; render(); });
    $('#fCombustible').addEventListener('change', function () { ESTADO.filtros.fuel = this.value; ESTADO.pagina = 1; render(); });
    $('#fDistancia').addEventListener('input', function () {
      var v = parseFloat(this.value);
      ESTADO.filtros.distancia = isNaN(v) || v <= 0 ? null : v;
      ESTADO.pagina = 1; render();
    });
    $('#ordenSel').addEventListener('change', function () {
      var partes = this.value.split(':');
      ESTADO.orden.col = partes[0]; ESTADO.orden.dir = partes[1];
      ESTADO.pagina = 1; render();
    });
    $('#buscar').addEventListener('input', function () {
      ESTADO.filtros.q = this.value; ESTADO.pagina = 1; render();
    });
    $('#btnLimpiarBusqueda').addEventListener('click', function () {
      $('#buscar').value = ''; ESTADO.filtros.q = ''; ESTADO.pagina = 1; render(); $('#buscar').focus();
    });
    $('#btnLimpiar').addEventListener('click', function () {
      $('#fDistancia').value = '';
      filtrosPorDefecto();
      render(); mostrarAviso('Filtros restablecidos');
    });
    $('#evLimpiar').addEventListener('click', function () {
      $('#fDistancia').value = '';
      filtrosPorDefecto();
      render();
    });
    $('#btnFavoritos').addEventListener('click', function () {
      ESTADO.filtros.soloFavoritas = !ESTADO.filtros.soloFavoritas;
      if (ESTADO.filtros.soloFavoritas) ESTADO.destino = 'favoritas';
      else if (ESTADO.destino === 'favoritas') ESTADO.destino = 'lista';
      ESTADO.pagina = 1;
      if (ESTADO.destino === 'ajustes' || ESTADO.destino === 'ia') ESTADO.destino = 'lista';
      render();
    });
    $('#btnPush').addEventListener('click', function () {
      ESTADO.push.activo = !ESTADO.push.activo;
      this.setAttribute('aria-pressed', ESTADO.push.activo ? 'true' : 'false');
      mostrarAviso(ESTADO.push.activo ? 'Notificaciones activadas' : 'Notificaciones desactivadas');
      if (ESTADO.destino === 'ajustes') renderAjustes();
    });
    $('#btnAjustesRapido').addEventListener('click', function () { setDestino('ajustes'); });

    /* --- Chips: quitar filtros --- */
    chipsEl.addEventListener('click', function (ev) {
      var b = ev.target.closest('[data-quitar]');
      if (!b) return;
      var tipo = b.dataset.quitar;
      if (tipo === 'prov') { $('#fProvincia').value = ''; cargarProvincia('', true); return; }
      if (tipo === 'loc') { ESTADO.filtros.loc = ''; $('#fLocalidad').value = ''; }
      if (tipo === 'fuel') { ESTADO.filtros.fuel = ''; $('#fCombustible').value = ''; }
      if (tipo === 'distancia') { ESTADO.filtros.distancia = null; $('#fDistancia').value = ''; }
      if (tipo === 'favoritas') { ESTADO.filtros.soloFavoritas = false; if (ESTADO.destino === 'favoritas') ESTADO.destino = 'lista'; }
      if (tipo === 'q') { ESTADO.filtros.q = ''; $('#buscar').value = ''; }
      if (tipo.indexOf('marca:') === 0) ESTADO.filtros.marcas.splice(parseInt(tipo.split(':')[1], 10), 1);
      ESTADO.pagina = 1; render();
    });

    /* --- Popover de marcas --- */
    $('#fMarcas').addEventListener('click', function () {
      if ($('#popoverMarcas').hidden) mostrarPopoverMarcas(); else cerrarPopoverMarcas();
    });
    $('#popoverBuscar').addEventListener('input', pintarPopoverMarcas);
    $('#popoverListaMarcas').addEventListener('change', function (ev) {
      var m = ev.target.value;
      var i = ESTADO.marcasPendientes.indexOf(m);
      if (ev.target.checked && i < 0) ESTADO.marcasPendientes.push(m);
      if (!ev.target.checked && i >= 0) ESTADO.marcasPendientes.splice(i, 1);
    });
    $('#popoverTodas').addEventListener('click', function () {
      ESTADO.marcasPendientes = $$('#popoverListaMarcas input').map(function (i) { return i.value; });
      $$('#popoverListaMarcas input').forEach(function (i) { i.checked = true; });
    });
    $('#popoverNinguna').addEventListener('click', function () {
      ESTADO.marcasPendientes = [];
      $$('#popoverListaMarcas input').forEach(function (i) { i.checked = false; });
    });
    $('#popoverAplicar').addEventListener('click', function () {
      ESTADO.filtros.marcas = ESTADO.marcasPendientes.slice();
      $('#fMarcas').innerHTML = (ESTADO.filtros.marcas.length ? ESTADO.filtros.marcas.length + ' marcas' : 'Todas') +
        ' <span class="caret" aria-hidden="true">▾</span>';
      cerrarPopoverMarcas();
      ESTADO.pagina = 1; render();
    });
    document.addEventListener('pointerdown', function (ev) {
      if ($('#popoverMarcas').hidden) return;
      if (ev.target.closest('#popoverMarcas') || ev.target.closest('#fMarcas')) return;
      cerrarPopoverMarcas();
    });

    /* --- Cabecera de la tabla: ordenar --- */
    $('#tabla thead').addEventListener('click', function (ev) {
      var b = ev.target.closest('.th-btn');
      if (!b) return;
      var partes = b.dataset.orden.split(':');
      if (partes[0] === ESTADO.orden.col && partes[1] === ESTADO.orden.dir) {
        ESTADO.orden.dir = ESTADO.orden.dir === 'asc' ? 'desc' : 'asc';
      } else {
        ESTADO.orden.col = partes[0];
        ESTADO.orden.dir = partes[0] === 'precio' || partes[0] === 'dist' ? 'asc' : 'asc';
      }
      $('#ordenSel').value = ESTADO.orden.col + ':' + ESTADO.orden.dir;
      ESTADO.pagina = 1; render();
    });

    /* --- Tabla: delegación de clics, hover y foco (sincronía) --- */
    cuerpoTabla.addEventListener('click', function (ev) {
      var chk = ev.target.closest('.check-comparar');
      if (chk) { alternarComparar(chk.dataset.comparar, chk.checked); return; }
      var fav = ev.target.closest('[data-fav]');
      if (fav) { alternarFavorito(fav.dataset.fav); return; }
      var abrir = ev.target.closest('[data-abrir]');
      var fila = ev.target.closest('tr');
      if (!fila) return;
      irAEstacion(fila.dataset.id, false);
      abrirDetalle(abrir ? abrir.dataset.abrir : fila.dataset.id);
    });
    cuerpoTabla.addEventListener('mouseover', function (ev) {
      var fila = ev.target.closest('tr');
      if (fila) resaltar(fila.dataset.id);
    });
    cuerpoTabla.addEventListener('focusin', function (ev) {
      var fila = ev.target.closest('tr');
      if (fila) resaltar(fila.dataset.id);
    });
    cuerpoTabla.addEventListener('mouseleave', quitarResaltado);
    cuerpoTabla.addEventListener('keydown', function (ev) {
      var fila = ev.target.closest('tr');
      if (!fila) return;
      if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); abrirDetalle(fila.dataset.id); }
      if (ev.key === ' ') { ev.preventDefault(); alternarComparar(fila.dataset.id); }
    });

    /* --- Marcadores del mapa --- */
    mapaCapa.addEventListener('mouseover', function (ev) {
      var m = ev.target.closest('.marcador');
      if (m) resaltar(m.dataset.id);
    });
    mapaCapa.addEventListener('mouseleave', quitarResaltado);
    mapaCapa.addEventListener('focusin', function (ev) {
      var m = ev.target.closest('.marcador');
      if (m) resaltar(m.dataset.id, true);
    });
    mapaCapa.addEventListener('click', function (ev) {
      var m = ev.target.closest('.marcador');
      if (!m) return;
      irAEstacion(m.dataset.id, false);
      var e = estacion(m.dataset.id);
      if (e) { centrarEn(e, true); mostrarPopupMapa(e); }
    });
    $('#mapaPopup').addEventListener('click', function (ev) {
      var abrir = ev.target.closest('[data-pop-abrir]');
      var comp = ev.target.closest('[data-pop-comparar]');
      if (abrir) { abrirDetalle(abrir.dataset.popAbrir); ocultarPopupMapa(); }
      if (comp) { alternarComparar(comp.dataset.popComparar, true); ocultarPopupMapa(); }
    });
    document.addEventListener('pointerdown', function (ev) {
      if ($('#mapaPopup').hidden) return;
      if (ev.target.closest('.mapa-popup') || ev.target.closest('.marcador')) return;
      ocultarPopupMapa();
    });

    /* --- Controles del mapa --- */
    $('#mapaEstilo').addEventListener('change', function () { mapaCaja.dataset.estilo = this.value; });
    $('#btnSeguirHover').addEventListener('click', function () {
      ESTADO.seguirHover = !ESTADO.seguirHover;
      this.setAttribute('aria-pressed', ESTADO.seguirHover ? 'true' : 'false');
      mostrarAviso(ESTADO.seguirHover ? 'El mapa seguirá el hover' : 'Hover sin centrado');
    });
    $('#btnZoomMas').addEventListener('click', function () { cambiarZoom(1.4); });
    $('#btnZoomMenos').addEventListener('click', function () { cambiarZoom(1 / 1.4); });
    $('#btnZoomReset').addEventListener('click', reiniciarVista);
    $('#btnVerMapa').addEventListener('click', function () {
      if (window.innerWidth < 768) { setPeek(ESTADO.peek === 'abierto' ? 'cerrado' : 'abierto'); }
      else { setPreset(ESTADO.preset === 'mapa' ? 'split' : 'mapa'); }
    });

    /* --- Presets --- */
    $$('.preset').forEach(function (b) {
      b.addEventListener('click', function () { setPreset(b.dataset.preset); });
    });

    /* --- Paginación --- */
    $('#paginacion').addEventListener('click', function (ev) {
      var b = ev.target.closest('[data-pag]');
      if (!b) return;
      var pag = paginaActual();
      if (b.dataset.pag === 'primera') ESTADO.pagina = 1;
      if (b.dataset.pag === 'anterior') ESTADO.pagina--;
      if (b.dataset.pag === 'siguiente') ESTADO.pagina++;
      if (b.dataset.pag === 'ultima') ESTADO.pagina = pag.paginas;
      render();
      listaScroll.scrollTop = 0;
    });
    $('#paginacion').addEventListener('change', function (ev) {
      if (ev.target.id !== 'pageSizeSel') return;
      ESTADO.pageSize = parseInt(ev.target.value, 10);
      ESTADO.pagina = 1;
      render();
    });

    /* --- Detalle --- */
    $('#detCerrar').addEventListener('click', cerrarDetalle);
    $$('.det-tab').forEach(function (t) {
      t.addEventListener('click', function () {
        ESTADO.detalleTab = t.dataset.dtab;
        $$('.det-tab').forEach(function (o) {
          var on = o === t;
          o.classList.toggle('activo', on);
          o.setAttribute('aria-selected', on ? 'true' : 'false');
        });
        $('#detPanelInfo').hidden = ESTADO.detalleTab !== 'info';
        $('#detPanelHist').hidden = ESTADO.detalleTab !== 'hist';
        if (ESTADO.detalleTab === 'hist') dibujarHistorico();
      });
    });
    $('#detFuel').addEventListener('change', dibujarHistorico);
    $('#detDias').addEventListener('change', dibujarHistorico);
    $('#detPanelInfo').addEventListener('click', function (ev) {
      var rep = ev.target.closest('[data-det-repostar]');
      var cmp = ev.target.closest('[data-det-comparar]');
      var fav = ev.target.closest('[data-det-fav]');
      if (rep) mostrarAviso('Ruta simulada hacia ' + estacion(rep.dataset.detRepostar).marca);
      if (cmp) { alternarComparar(cmp.dataset.detComparar, true); mostrarAviso('Añadida al comparador'); }
      if (fav) alternarFavorito(fav.dataset.detFav);
    });

    /* --- Comparador --- */
    $('#bcQuitar').addEventListener('click', function () {
      ESTADO.comparar = [];
      renderLista(); renderBarraComparar();
    });
    $('#bcComparar').addEventListener('click', abrirComparador);
    $('#bcMiniaturas').addEventListener('click', function (ev) {
      var b = ev.target.closest('[data-bc-quitar]');
      if (b) alternarComparar(b.dataset.bcQuitar, false);
    });

    /* --- Hoja --- */
    $('#hojaCerrar').addEventListener('click', cerrarHoja);
    hojaFondo.addEventListener('click', cerrarHoja);
    $('#hojaCuerpo').addEventListener('click', function (ev) {
      var rep = ev.target.closest('[data-comp-repostar]');
      if (rep) {
        cerrarHoja();
        setDestino('mapa');
        abrirDetalle(rep.dataset.compRepostar);
        mostrarAviso('Ruta simulada hacia ' + estacion(rep.dataset.compRepostar).marca);
      }
    });

    /* --- IA --- */
    $('#zonaIA').addEventListener('click', function (ev) {
      var tab = ev.target.closest('[data-ia]');
      if (tab) {
        ESTADO.iaProvider = tab.dataset.ia;
        $$('#zonaIA .ia-tab').forEach(function (b) {
          b.classList.toggle('activo', b.dataset.ia === ESTADO.iaProvider);
          b.setAttribute('aria-selected', b.dataset.ia === ESTADO.iaProvider ? 'true' : 'false');
        });
        $$('#zonaIA .ia-panel').forEach(function (p) {
          p.classList.toggle('activo', p.dataset.iapanel === ESTADO.iaProvider);
        });
        return;
      }
      var enviar = ev.target.closest('[data-iaenviar]');
      if (enviar) {
        var id = enviar.dataset.iaenviar;
        var input = $('[data-iaentrada="' + id + '"]');
        enviarIA(id, input.value);
        input.value = '';
        return;
      }
      var prompt = ev.target.closest('[data-prompt]');
      if (prompt) { enviarIA('general', prompt.dataset.prompt); return; }
      var refrescar = ev.target.closest('[data-refrescar]');
      if (refrescar) { refrescarModelos(refrescar.dataset.refrescar); return; }
    });
    $('#zonaIA').addEventListener('keydown', function (ev) {
      if (ev.key !== 'Enter') return;
      var input = ev.target.closest('[data-iaentrada]');
      if (!input) return;
      enviarIA(input.dataset.iaentrada, input.value);
      input.value = '';
    });
    $('#zonaIA').addEventListener('change', function (ev) {
      var sel = ev.target.closest('[data-modelo]');
      if (sel) { ESTADO.iaModelos[sel.dataset.modelo] = sel.value; mostrarAviso('Modelo: ' + sel.value); }
    });

    /* --- Ajustes --- */
    $('#zonaAjustes').addEventListener('click', function (ev) {
      var sub = ev.target.closest('[data-sub]');
      if (sub) {
        var clave = sub.dataset.sub;
        if (clave === 'indexeddb' || clave === 'localstorage') ESTADO.cacheTab = clave;
        else ESTADO.logTab = clave;
        renderAjustes();
        return;
      }
      if (ev.target.closest('#ajLimpiarCache')) { mostrarAviso('Caché vaciada (simulado)'); return; }
      if (ev.target.closest('#ajLimpiarLog')) { mostrarAviso('Registro borrado (simulado)'); return; }
      if (ev.target.closest('#ajPushProbar')) {
        mostrarAviso(ESTADO.push.activo ? 'Notificación de prueba enviada' : 'Activa el push primero');
        return;
      }
      if (ev.target.closest('#ajCargarClaves')) { mostrarAviso('Claves cargadas (simulado)'); return; }
      if (ev.target.closest('#ajBuscarAct')) {
        $('#ajActEstado').textContent = '⏳ Comprobando…';
        setTimeout(function () {
          var el = $('#ajActEstado');
          if (el) el.textContent = '✓ Estás en la última versión (' + F.versionApp.version + ')';
        }, movimientoResolucion());
        return;
      }
      if (ev.target.closest('#ajAddDesc')) {
        var usadas = Object.keys(ESTADO.descuentos);
        var libre = F.marcas.filter(function (m) { return usadas.indexOf(m) < 0; })[0];
        if (!libre) { mostrarAviso('Todas las marcas ya tienen descuento'); return; }
        ESTADO.descuentos[libre] = 0.02;
        renderAjustes(); render();
        return;
      }
      var borrar = ev.target.closest('[data-desc-borrar]');
      if (borrar) { delete ESTADO.descuentos[borrar.dataset.descBorrar]; renderAjustes(); render(); return; }
    });
    $('#zonaAjustes').addEventListener('input', function (ev) {
      var d = ev.target.closest('[data-desc]');
      if (d) {
        var v = parseFloat(d.value);
        ESTADO.descuentos[d.dataset.desc] = isNaN(v) ? 0 : acotar(v, 0, 1);
        renderLista(); renderBarraComparar();
        return;
      }
      var p = ev.target.closest('[data-prompt]');
      if (p) { ESTADO.prompts[parseInt(p.dataset.prompt, 10)] = p.value; return; }
      if (ev.target.id === 'ajCacheTtl') { ESTADO.cacheTtl = parseInt(ev.target.value, 10) || 0; return; }
      if (ev.target.id === 'ajPushIntervalo') { ESTADO.push.intervalo = parseInt(ev.target.value, 10) || 1; return; }
      if (ev.target.id === 'ajPushDias') { ESTADO.push.dias = parseInt(ev.target.value, 10) || 0; return; }
    });
    $('#zonaAjustes').addEventListener('change', function (ev) {
      if (ev.target.id === 'ajPageSize') {
        ESTADO.pageSize = parseInt(ev.target.value, 10);
        ESTADO.pagina = 1;
        render();
        return;
      }
      if (ev.target.id === 'ajPush') {
        ESTADO.push.activo = ev.target.checked;
        $('#ajPushEstado').textContent = ESTADO.push.activo ? '✓ Suscripción activa' : '✗ Sin suscripción';
        $('#btnPush').setAttribute('aria-pressed', ESTADO.push.activo ? 'true' : 'false');
        return;
      }
      if (ev.target.id === 'ajPushSube') { ESTADO.push.subida = ev.target.checked; return; }
      var vis = ev.target.closest('[data-iavis]');
      if (vis) {
        var idp = vis.dataset.iavis;
        var i = ESTADO.iaOcultos.indexOf(idp);
        if (vis.checked && i >= 0) ESTADO.iaOcultos.splice(i, 1);
        if (!vis.checked) {
          if (i < 0) ESTADO.iaOcultos.push(idp);
          if (proveedoresVisibles().length === 0) {
            ESTADO.iaOcultos.splice(ESTADO.iaOcultos.indexOf(idp), 1);
            vis.checked = true;
            $('#ajIaAviso').textContent = '⚠️ Debe quedar al menos un proveedor visible.';
          } else {
            $('#ajIaAviso').textContent = '';
          }
        }
        if (ESTADO.iaProvider !== 'general' && ESTADO.iaOcultos.indexOf(ESTADO.iaProvider) >= 0) {
          ESTADO.iaProvider = 'general';
        }
        $('#ajIaAviso').textContent = ESTADO.iaOcultos.length ? 'Proveedores ocultos: ' + ESTADO.iaOcultos.length : '';
        renderIA();
      }
    });

    /* --- Navegación inferior --- */
    $('#navInferior').addEventListener('click', function (ev) {
      var b = ev.target.closest('[data-destino]');
      if (b) setDestino(b.dataset.destino);
    });

    /* --- Gráfica: hover con tooltip --- */
    iniciarHoverGrafica();

    /* --- Teclado global --- */
    document.addEventListener('keydown', function (ev) {
      var t = ev.target;
      var escribiendo = t && (t.tagName === 'INPUT' || t.tagName === 'SELECT' || t.tagName === 'TEXTAREA' || t.isContentEditable);

      if (ev.key === 'Escape') {
        if (!hoja.hidden) { cerrarHoja(); return; }
        if (!$('#popoverMarcas').hidden) { cerrarPopoverMarcas(); return; }
        if (!$('#mapaPopup').hidden) { ocultarPopupMapa(); return; }
        if (ESTADO.destino === 'mapa' && ESTADO.peek === 'abierto') { setPeek('cerrado'); return; }
        cerrarDetalle();
        return;
      }
      if (escribiendo) return;
      if (ESTADO.destino === 'ia' || ESTADO.destino === 'ajustes') return;

      if (ev.key === '/') { ev.preventDefault(); $('#buscar').focus(); return; }
      if (ev.key === 'f') { $('#btnFavoritos').click(); return; }
      if (ev.key === 'c') {
        var tr = $('#cuerpoTabla tr.activo') || $('#cuerpoTabla tr');
        if (tr) alternarComparar(tr.dataset.id);
        return;
      }
      if (ev.key === 'j' || ev.key === 'k' || ev.key === 'ArrowDown' || ev.key === 'ArrowUp') {
        var lista = listaOrdenada();
        if (!lista.length) return;
        ev.preventDefault();
        var idx = indiceDe(lista, ESTADO.activoId);
        var delta = (ev.key === 'j' || ev.key === 'ArrowDown') ? 1 : -1;
        if (idx < 0) idx = delta > 0 ? -1 : lista.length;
        var nuevo = acotar(idx + delta, 0, lista.length - 1);
        ESTADO.activoId = lista[nuevo].id;
        irAEstacion(ESTADO.activoId, false);
        return;
      }
      if (ev.key === 'Enter') {
        if (ESTADO.activoId) abrirDetalle(ESTADO.activoId);
      }
    });

    /* --- Cambio de tamaño: el peek solo existe en móvil --- */
    var tmr;
    window.addEventListener('resize', function () {
      clearTimeout(tmr);
      tmr = setTimeout(function () {
        if (window.innerWidth >= 768 && ESTADO.peek === 'abierto') setPeek('cerrado');
        aplicarSeparacion();
        acotarVista();
        aplicarVista(false);
      }, 160);
    });
  }

  function movimientoResolucion() { return movimientoReducido ? 0 : 700; }

  function alternarFavorito(id) {
    ESTADO.favoritos[id] = !ESTADO.favoritos[id];
    if (!ESTADO.favoritos[id]) delete ESTADO.favoritos[id];
    renderLista();
    if (ESTADO.detalleId === id) renderDetalle();
  }

  /* ========================= ARRANQUE ========================= */

  function init() {
    pintarMapaBase();
    pintarSelects();
    renderAtajos();
    renderIA();
    renderAjustes();
    iniciarDivisor();
    iniciarPeek();
    iniciarPanMapa();
    iniciarEventos();
    aplicarSeparacion();
    aplicarVista(false);
    setDestino('mapa');

    /* Arranque con el patrón de carga ("Cargando precios…") */
    var overlay = $('#cargandoLista');
    overlay.hidden = false;
    setTimeout(function () {
      overlay.hidden = true;
      render();
      ESTADO.activoId = null;
      aplicarVista(false);
    }, movimientoReducido ? 0 : 420);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
