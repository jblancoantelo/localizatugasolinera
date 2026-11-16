/* =============================================================================
 * PROTOTIPO 3 — "Lista primero" · lógica
 * -----------------------------------------------------------------------------
 * Script clásico (sin módulos) para que funcione abriendo el HTML por file://.
 * Todos los datos salen de window.FAKE (../shared/datos-fake.js). No se inventa
 * ningún precio ni estación nueva.
 *
 * Índice:
 *   1. Utilidades y formato
 *   2. Estado de la app
 *   3. Filtrado y ordenación (funcional de verdad sobre FAKE.estaciones)
 *   4. Render de la lista (grupos pegajosos, tarjetas, paginación)
 *   5. Mapa fake (SVG + marcadores-precio)
 *   6. Chips de filtros
 *   7. Sheets: abrir/cerrar + arrastre con pointer events
 *   8. Hoja de filtros
 *   9. Detalle de estación (precios + histórico)
 *  10. Gráfica SVG del histórico
 *  11. Chat IA (markdown básico + marca de agua)
 *  12. Ajustes (acordeón operativo)
 *  13. Navegación, avisos y arranque
 * ========================================================================== */

(function () {
  'use strict';

  /* Alias corto del contrato de datos compartido */
  var F = window.FAKE;

  /* ======================================================================
   * 1. Utilidades y formato
   * ==================================================================== */

  function $(sel, raiz) { return (raiz || document).querySelector(sel); }
  function $$(sel, raiz) { return Array.prototype.slice.call((raiz || document).querySelectorAll(sel)); }

  /* Escapamos SIEMPRE el texto que viene de datos antes de meterlo en HTML:
     el chat IA devuelve markdown "de fuera", así que la única defensa es esta */
  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  /* Precio a 3 decimales con coma y sin separador de miles (€/L) */
  function fmt3(p) { return p == null ? '—' : p.toFixed(3).replace('.', ','); }
  function fmtEur(p) { return p == null ? '—' : fmt3(p) + ' €'; }
  function fmtKm(km) { return km.toFixed(1).replace('.', ',') + ' km'; }
  /* Tiempo del chat: ms si es menos de 1 s, segundos con coma decimal si no */
  function fmtTiempo(ms) {
    if (ms < 1000) return Math.round(ms) + ' ms';
    return (ms / 1000).toFixed(1).replace('.', ',') + ' s';
  }
  function plural(n, sing, plur) { return n === 1 ? n + ' ' + sing : n + ' ' + (plur || sing + 's'); }

  var DIAS_SEMANA = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
  var MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];

  function fechaComoTexto() {
    var partes = F.hoy.split('-');                  /* dd-mm-aaaa */
    var d = new Date(Number(partes[2]), Number(partes[1]) - 1, Number(partes[0]));
    return DIAS_SEMANA[d.getDay()] + ' ' + d.getDate() + ' ' + MESES[d.getMonth()];
  }

  /* Teléfono de ejemplo, derivado del id para que sea estable entre pasadas */
  var PREFIJOS_PROV = { '28': '91', '08': '93', '46': '96', '41': '95', '03': '96', '29': '95', '48': '94', '20': '943', '33': '98', '50': '976', '30': '968', '11': '956', '36': '986', '18': '958', '47': '983', '15': '981' };
  function telefonoDe(est) {
    var n = Number(est.id) || 0;
    var pre = PREFIJOS_PROV[est.prov] || '91';
    return '+34 ' + pre + ' ' + (100 + (n % 900)) + ' ' + (10 + (n * 7 % 90)) + ' ' + (10 + (n * 13 % 90));
  }

  /* Iconos SVG inline reutilizados (nada de fuentes de iconos externas) */
  var SVG_ESTRELLA = '<svg viewBox="0 0 24 24" width="22" height="22"><path d="m12 3.5 2.6 5.4 5.9.8-4.3 4.1 1 5.9-5.2-2.8-5.2 2.8 1-5.9L3.5 9.7l5.9-.8L12 3.5Z" fill="currentColor"/></svg>';
  var SVG_ESTRELLA_LINEA = '<svg viewBox="0 0 24 24" width="22" height="22"><path d="m12 3.5 2.6 5.4 5.9.8-4.3 4.1 1 5.9-5.2-2.8-5.2 2.8 1-5.9L3.5 9.7l5.9-.8L12 3.5Zm0 3.3-1.5 3.1-3.4.5 2.5 2.4-.6 3.4 3-1.6 3 1.6-.6-3.4 2.5-2.4-3.4-.5L12 6.8Z" fill="currentColor"/></svg>';

  /* ======================================================================
   * 2. Estado de la app
   * ==================================================================== */

  var DIAS_HISTORICO = [7, 14, 21, 30, 60, 90, 180];
  var FUEL_DEFECTO = 'Gasolina 95 E5';

  /* Proveedores del chat: mismos que la app real, con su modelo por defecto */
  var PROVEEDORES = [
    { id: 'general', label: 'General', modelo: 'General · 7 proveedores' },
    { id: 'groq', label: 'Groq', modelo: 'qwen/qwen3.8-27b' },
    { id: 'mistral', label: 'Mistral', modelo: 'open-mistral-nemo' },
    { id: 'openrouter', label: 'OpenRouter', modelo: 'nemotron-3-ultra:free' },
    { id: 'llm7', label: 'LLM7.io', modelo: 'codestral-latest' },
    { id: 'nvidia', label: 'NVIDIA', modelo: 'nemotron-3-ultra-550b' },
    { id: 'google', label: 'Google Gemini', modelo: 'gemini-3.8-flash' },
    { id: 'chrome-nano', label: 'Chrome', modelo: 'Built-in AI' }
  ];

  var APP = {
    /* Filtros */
    prov: '28',
    localidad: '',
    combustible: FUEL_DEFECTO,
    marcas: [],
    distMax: 50,                 /* 50 = sin límite (tope del slider) */
    soloFav: false,
    solo24h: false,
    busqueda: '',
    orden: 'precio-asc',

    /* Datos derivados */
    resultados: [],
    visibles: 0,
    pageSize: F.config.pageSize,

    /* Lista de favoritos en memoria (arranca con las fav del contrato) */
    favoritos: {},

    /* Descuentos por marca activos (afectan a precios y chips) */
    descuentosActivos: {},

    /* Vista y hojas */
    vista: 'lista',
    detalle: null,
    detalleTab: 'precios',
    histFuel: null,
    histDias: 14,

    /* Chat IA: una conversación por proveedor */
    chatProvider: 'general',
    chats: {},
    provVisible: {},
    rotacion: {},

    /* Ajustes */
    ajustes: {
      cacheTtl: F.config.cacheTtl,
      checkInterval: F.config.checkInterval,
      priceFallDays: F.config.priceFallDays,
      priceCheckMode: F.config.priceCheckMode,
      pushActivo: true,
      pushOnPriceRise: F.config.pushOnPriceRise,
      clavesCargadas: false
    },
    logTab: 'api',

    /* Contadores internos */
    contadorChat: 0
  };

  /* Inicialización de estructuras derivadas del contrato */
  F.estaciones.forEach(function (e) { if (e.fav) APP.favoritos[e.id] = true; });
  Object.keys(F.descuentos).forEach(function (m) { APP.descuentosActivos[m] = true; });
  PROVEEDORES.forEach(function (p) { APP.provVisible[p.id] = true; });
  PROVEEDORES.forEach(function (p) {
    var muestra = F.chatsIA[p.id === 'general' ? 'general' : p.id] || [];
    APP.chats[p.id] = muestra.map(function (m) {
      return {
        role: m.role,
        content: m.content,
        modelo: p.modelo,
        ms: m.role === 'assistant' ? msSimulado(m.content) : 0
      };
    });
  });

  function estacionPorId(id) {
    for (var i = 0; i < F.estaciones.length; i++) if (F.estaciones[i].id === id) return F.estaciones[i];
    return null;
  }

  /* ======================================================================
   * 3. Filtrado y ordenación — todo real sobre FAKE.estaciones
   * ==================================================================== */

  /* Precio que aplica a la estación con el combustible elegido */
  function precio(est, comb) { return F.precioDe(est, comb || APP.combustible); }

  /* Descuento de la marca si el usuario lo tiene activo en Ajustes */
  function descuentoDe(est) {
    var d = F.descuentos[est.marca];
    return (d && APP.descuentosActivos[est.marca]) ? d : 0;
  }

  function coincideBusqueda(est, texto) {
    var t = normaliza(texto);
    if (!t) return true;
    return normaliza(est.marca).indexOf(t) !== -1 ||
      normaliza(est.nombre).indexOf(t) !== -1 ||
      normaliza(est.localidad).indexOf(t) !== -1 ||
      normaliza(est.direccion).indexOf(t) !== -1;
  }

  function normaliza(s) {
    return String(s == null ? '' : s).toLowerCase()
      .normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  }

  function filtrar() {
    return F.estaciones.filter(function (e) {
      if (APP.prov && e.prov !== APP.prov) return false;
      if (APP.localidad && e.localidad !== APP.localidad) return false;
      if (APP.marcas.length && APP.marcas.indexOf(e.marca) === -1) return false;
      if (APP.distMax < 50 && e.dist > APP.distMax) return false;
      if (APP.soloFav && !APP.favoritos[e.id]) return false;
      if (APP.solo24h && e.horario !== '24 h') return false;
      if (precio(e) == null) return false;                 /* no vende ese combustible */
      if (!coincideBusqueda(e, APP.busqueda)) return false;
      return true;
    });
  }

  function ordenar(lista) {
    var c = APP.combustible;
    var porPrecio = function (a, b) {
      var pa = precio(a, c), pb = precio(b, c);
      if (pa == null) pa = 9e9;
      if (pb == null) pb = 9e9;
      return pa - pb;
    };
    if (APP.orden === 'precio-desc') lista.sort(function (a, b) { return porPrecio(b, a); });
    else if (APP.orden === 'distancia') lista.sort(function (a, b) { return a.dist - b.dist; });
    else lista.sort(porPrecio);
    return lista;
  }

  /* Cuántos filtros de la hoja están activos (para el chip "Filtros (N)") */
  function filtrosActivos() {
    var n = 0;
    if (APP.localidad) n++;
    if (APP.marcas.length) n++;
    if (APP.distMax < 50) n++;
    if (APP.soloFav) n++;
    if (APP.solo24h) n++;
    return n;
  }

  /* ======================================================================
   * 4. Render de la lista
   * ==================================================================== */

  function colorDe(p) { return F.colorPrecio(p); }

  function etiquetasTarjeta(est, esMasBarata) {
    var html = '';
    if (esMasBarata) html += '<span class="etiqueta-chip barata">Más barata</span>';
    if (APP.favoritos[est.id]) html += '<span class="etiqueta-chip favorita">Favorita</span>';
    var d = descuentoDe(est);
    if (d) html += '<span class="etiqueta-chip descuento">Con descuento −' + fmt3(d) + ' €</span>';
    return html;
  }

  function htmlTarjeta(est, esMasBarata, primero) {
    var p = precio(est);
    var col = colorDe(p);
    var d = descuentoDe(est);
    var pDto = d ? Math.round((p - d) * 1000) / 1000 : null;

    return '' +
      '<article class="tarjeta' + (APP.favoritos[est.id] ? ' favorita' : '') + '" data-id="' + esc(est.id) + '">' +
        '<div class="tarjeta-cuerpo">' +
          '<div class="tarjeta-cabecera"><span class="tarjeta-marca">' + esc(est.marca) + '</span></div>' +
          '<h3 class="tarjeta-nombre">' + esc(est.nombre) + '</h3>' +
          '<div class="tarjeta-meta">' +
            '<span>' + esc(est.localidad) + '</span><span class="punto">·</span>' +
            '<span>a ' + fmtKm(est.dist) + '</span>' +
          '</div>' +
          '<div class="tarjeta-horario">' + (est.horario === '24 h' ? 'Abierta 24 h' : 'Horario ' + esc(est.horario)) + '</div>' +
          '<div class="tarjeta-chips">' + etiquetasTarjeta(est, esMasBarata) + '</div>' +
        '</div>' +
        '<div class="tarjeta-precio-caja">' +
          '<div class="precio-bloque">' +
            '<div class="precio ' + col + '">' + fmt3(p) + '<span class="unidad">€/L</span></div>' +
            '<div class="precio-etiqueta-fuel">' + esc(APP.combustible) + '</div>' +
            (pDto != null ? '<div class="precio-descuento">con dto. ' + fmtEur(pDto) + '</div>' : '') +
          '</div>' +
          '<div class="tarjeta-acciones">' +
            '<button type="button" class="boton-estrella' + (APP.favoritos[est.id] ? ' on' : '') + '" ' +
              'data-fav="' + esc(est.id) + '" aria-pressed="' + (APP.favoritos[est.id] ? 'true' : 'false') + '" ' +
              'aria-label="Marcar como favorita">' + (APP.favoritos[est.id] ? SVG_ESTRELLA : SVG_ESTRELLA_LINEA) + '</button>' +
            '<button type="button" class="boton-detalle" data-detalle="' + esc(est.id) + '"' +
              (primero ? ' data-shot="detalle"' : '') + '>detalle</button>' +
          '</div>' +
        '</div>' +
      '</article>';
  }

  /* Agrupamos por bandas de distancia cuando se ordena por distancia; en el
     resto de casos un único grupo con la fecha de hoy (patrón de la app) */
  function construirGrupos(lista) {
    if (APP.orden !== 'distancia') {
      return [{ titulo: 'Hoy · ' + fechaComoTexto(), items: lista }];
    }
    var bandas = [
      { titulo: 'Hasta 5 km', min: 0, max: 5 },
      { titulo: 'Entre 5 y 20 km', min: 5, max: 20 },
      { titulo: 'Más de 20 km', min: 20, max: Infinity }
    ];
    var grupos = bandas.map(function (b) { return { titulo: b.titulo, items: [] }; });
    lista.forEach(function (e) {
      for (var i = 0; i < bandas.length; i++) {
        if (e.dist <= bandas[i].max) { grupos[i].items.push(e); return; }
      }
    });
    return grupos.filter(function (g) { return g.items.length; });
  }

  function render() {
    var lista = ordenar(filtrar());
    APP.resultados = lista;

    /* Paginación: 0 en Ajustes significa "todas". APP.visibles es el cursor de
       "mostrar más", no lo recortamos aquí para no perder lo ya cargado. */
    var limite = APP.pageSize === 0 ? lista.length : APP.visibles;
    var mostradas = Math.min(limite, lista.length);
    var visibles = lista.slice(0, mostradas);

    var grupos = construirGrupos(visibles);
    var masBarataId = lista.length ? lista.reduce(function (mejor, e) {
      return (precio(e) < precio(mejor)) ? e : mejor;
    }, lista[0]).id : null;

    var html = '';
    var primero = true;
    grupos.forEach(function (g) {
      html += '<div class="grupo">';
      html += '<div class="grupo-cabecera"><span>' + esc(g.titulo) + '</span>' +
        '<span class="grupo-contador">' + plural(g.items.length, 'estación', 'estaciones') + '</span></div>';
      g.items.forEach(function (e) {
        html += htmlTarjeta(e, e.id === masBarataId, primero);
        primero = false;
      });
      html += '</div>';
    });

    $('#listaTarjetas').innerHTML = html;

    /* Estado vacío / botón "mostrar más" */
    $('#estadoVacio').hidden = lista.length > 0;
    var hayMas = APP.pageSize !== 0 && lista.length > mostradas;
    $('#btnMas').hidden = !hayMas;
    if (hayMas) $('#btnMas').textContent = 'Mostrar más (' + (lista.length - mostradas) + ' restantes)';

    /* Cuenta de resultados + aviso de paginación en el pie */
    var media = F.mediaProvincia(APP.prov, APP.combustible);
    $('#cuentaResultados').textContent = lista.length === 0
      ? 'Sin resultados'
      : (hayMas ? 'Mostrando ' + mostradas + ' de ' + lista.length : plural(lista.length, 'estación', 'estaciones'))
        + ' · media ' + fmtEur(media);
    $('#pieLista').textContent = lista.length
      ? 'Precios de ' + APP.combustible + ' · Provincia de ' + (F.provinciaNombre(APP.prov) || 'todas') +
        ' · actualizado 16/10/26 09:12 (demo)'
      : '';

    dibujarChips();
    pintarMapa();
    actualizarBadge();
  }

  /* ======================================================================
   * 5. Mapa fake (SVG + marcadores con el precio)
   * ==================================================================== */

  var mapaMontado = false;

  function montarMapa() {
    if (mapaMontado) return;
    mapaMontado = true;

    $('#mapaManchas').innerHTML = F.mapa.manchas.map(function (m) {
      return '<rect x="' + m.x + '" y="' + m.y + '" width="' + m.w + '" height="' + m.h + '" rx="1.5"></rect>';
    }).join('');

    /* Los trazos llevan vector-effect para que el ancho no se deforme con el
       escalado no uniforme del viewBox */
    $('#mapaViales').innerHTML = F.mapa.viales.map(function (v) {
      var w = v.w >= 3 ? 5 : v.w >= 2 ? 3 : 1.6;
      return '<path d="' + v.d + '" stroke-width="' + w + '" vector-effect="non-scaling-stroke" ' +
        'class="' + (v.w >= 3 ? 'via-principal' : '') + '"></path>';
    }).join('');

    $('#mapaAgua').setAttribute('d', F.mapa.agua.d);
    var yo = F.mapa.tuPosicion;
    var elYo = $('#mapaYo');
    elYo.style.left = yo.mx + '%';
    elYo.style.top = yo.my + '%';
  }

  function pintarMapa() {
    montarMapa();
    var idSel = APP.detalle ? APP.detalle.id : null;
    $('#mapaMarcadores').innerHTML = APP.resultados.map(function (e) {
      var p = precio(e);
      /* La caja pulsable mide >=44 px; la pastilla visible va dentro */
      return '<button type="button" class="marcador ' + colorDe(p) +
        (APP.favoritos[e.id] ? ' favorito' : '') +
        (e.id === idSel ? ' seleccionado' : '') + '" ' +
        'style="left:' + e.mx + '%;top:' + e.my + '%" data-marcador="' + esc(e.id) + '" ' +
        'title="' + esc(e.marca + ' · ' + e.nombre) + '">' +
        '<span class="marcador-pastilla">' + fmt3(p) + '</span></button>';
    }).join('');
    $('#mapaContador').textContent = plural(APP.resultados.length, 'estación', 'estaciones') + ' en el mapa';
  }

  /* ======================================================================
   * 6. Chips de filtros activos (scroll horizontal)
   * ==================================================================== */

  function chip(accion, texto, activo, conX, cuenta) {
    return '<button type="button" class="chip' + (activo ? ' activo' : '') + '" data-accion="' + accion + '"' +
      (activo ? ' aria-pressed="true"' : ' aria-pressed="false"') + ' >' +
      esc(texto) +
      (cuenta ? '<span class="chip-cuenta">' + cuenta + '</span>' : '') +
      (activo && conX ? '<span class="chip-x" data-quitar="' + accion + '" aria-hidden="true">✕</span>' : '') +
      '</button>';
  }

  function dibujarChips() {
    var n = filtrosActivos();
    var html = '';
    html += chip('combustible', APP.combustible, true, false, 0);
    html += chip('marcas', APP.marcas.length ? plural(APP.marcas.length, 'marca') : 'Todas las marcas', APP.marcas.length > 0, true, 0);
    html += chip('distancia', APP.distMax < 50 ? 'Menos de ' + APP.distMax + ' km' : 'Menos de 5 km', APP.distMax < 50, true, 0);
    html += chip('favoritas', 'Favoritas', APP.soloFav, false, 0);
    html += chip('24h', 'Abiertas 24 h', APP.solo24h, false, 0);
    html += chip('filtros', 'Filtros', n > 0, false, n);
    $('#chips').innerHTML = html;
  }

  function actualizarBadge() {
    var n = filtrosActivos();
    var badge = $('#fabFiltrosBadge');
    badge.hidden = n === 0;
    badge.textContent = n;
  }

  /* ======================================================================
   * 7. Sheets: abrir, cerrar y arrastre con pointer events
   * ==================================================================== */

  var SHEETS = {
    filtros: { capa: 'capaFiltros', sheet: 'sheetFiltros', alturas: [0.45, 0.72, 0.96], indice: 1 },
    detalle: { capa: 'capaDetalle', sheet: 'sheetDetalle', alturas: [1], indice: 0 },
    chat: { capa: 'capaChat', sheet: 'sheetChat', alturas: [1], indice: 0 },
    ajustes: { capa: 'capaAjustes', sheet: 'sheetAjustes', alturas: [1], indice: 0 }
  };
  var abiertas = {};

  function esEscritorio() {
    return window.matchMedia('(min-width: 1024px)').matches;
  }

  /* Altura máxima real de una hoja en móvil (96dvh ≈ 96 % del viewport) */
  function altoMaxPx() { return window.innerHeight * 0.96; }

  /* Hojas con varias alturas (filtros): la hoja está anclada al borde inferior,
     así que "crecer" = aumentar la altura. El pie (botón grande) nunca se
     escapa de la pantalla porque el borde de abajo no se mueve. */
  function aplicarFraccion(sheet, fraccion) {
    sheet.style.height = (fraccion * 96) + 'vh';
  }

  /* Hojas de una sola altura (detalle, chat, ajustes): se trasladan para
     entrar y salir de pantalla */
  function aplicarTraslacion(sheet, fraccion) {
    sheet.style.transform = 'translateY(' + ((1 - fraccion) * 100) + '%)';
  }

  var focoPrevio = null;

  function abrirSheet(nombre) {
    var s = SHEETS[nombre];
    if (!s) return;
    var capa = document.getElementById(s.capa);
    var sheet = document.getElementById(s.sheet);
    if (!focoPrevio) focoPrevio = document.activeElement;

    capa.hidden = false;
    document.body.classList.add('con-modal');
    abiertas[nombre] = true;

    if (!esEscritorio()) {
      /* Quitamos restos del arrastre anterior antes de dejar que el CSS anime */
      sheet.style.transform = '';
      if (s.alturas.length > 1) aplicarFraccion(sheet, s.alturas[s.indice]);
    }
    window.requestAnimationFrame(function () { capa.classList.add('abierta'); });
  }

  function cerrarSheet(nombre) {
    var s = SHEETS[nombre];
    if (!s) return;
    var capa = document.getElementById(s.capa);
    var sheet = document.getElementById(s.sheet);
    capa.classList.remove('abierta');
    delete abiertas[nombre];
    if (!esEscritorio()) aplicarTraslacion(sheet, 0);
    window.setTimeout(function () {
      if (!capa.classList.contains('abierta')) capa.hidden = true;
    }, 240);
    if (!Object.keys(abiertas).length) {
      document.body.classList.remove('con-modal');
      if (!document.body.classList.contains('vista-mapa')) marcarNav('lista');
      if (focoPrevio && focoPrevio.focus) { try { focoPrevio.focus(); } catch (e) { /* ignorar */ } }
      focoPrevio = null;
    }
  }

  function cerrarTodas() {
    Object.keys(abiertas).forEach(function (n) { cerrarSheet(n); });
  }

  /* Arrastre con pointer events y física simple. Dos modos:
     - Varias alturas (filtros): el dedo cambia la ALTURA, y al soltar se ancla
       a la más cercana de las tres.
     - Una altura (detalle/chat/ajustes): traslada la hoja y, si la arrastras
       hacia abajo con decisión (velocidad o más de 1/3 de la pantalla), cierra. */
  function iniciarArrastre(nombre, ev) {
    if (esEscritorio()) return;
    var s = SHEETS[nombre];
    var capa = document.getElementById(s.capa);
    var sheet = document.getElementById(s.sheet);
    if (!capa.classList.contains('abierta')) return;

    var porAltura = s.alturas.length > 1;
    var referencia = porAltura ? altoMaxPx() : (sheet.getBoundingClientRect().height || 1);
    var y0 = ev.clientY;
    var ultimoY = y0;
    var t0 = (window.performance && performance.now) ? performance.now() : Date.now();
    var fracIni = s.alturas[s.indice];

    sheet.classList.add('arrastrando');

    function calcularFrac(clientY) {
      var dy = clientY - y0;
      var frac = fracIni - dy / referencia;
      if (frac > 1) frac = 1 + (frac - 1) * 0.3;      /* resistencia al estirar */
      if (frac < 0) frac = 0;
      return frac;
    }

    function mover(e) {
      var frac = calcularFrac(e.clientY);
      ultimoY = e.clientY;
      if (porAltura) aplicarFraccion(sheet, frac);
      else aplicarTraslacion(sheet, frac);
    }

    function soltar() {
      document.removeEventListener('pointermove', mover);
      document.removeEventListener('pointerup', soltar);
      document.removeEventListener('pointercancel', soltar);
      sheet.classList.remove('arrastrando');

      var t1 = (window.performance && performance.now) ? performance.now() : Date.now();
      var velocidad = (ultimoY - y0) / Math.max(t1 - t0, 1);   /* px/ms, + hacia abajo */
      var frac = calcularFrac(ultimoY);

      if (porAltura) {
        if (velocidad > 1.2 || frac < 0.35) { cerrarSheet(nombre); return; }
      } else if (velocidad > 0.6 || frac < 0.65) {
        cerrarSheet(nombre); return;
      }

      var mejor = 0, dist = Infinity;
      for (var i = 0; i < s.alturas.length; i++) {
        var d = Math.abs(s.alturas[i] - frac);
        if (d < dist) { dist = d; mejor = i; }
      }
      s.indice = mejor;
      if (porAltura) aplicarFraccion(sheet, s.alturas[mejor]);
      else aplicarTraslacion(sheet, s.alturas[mejor]);
    }

    document.addEventListener('pointermove', mover);
    document.addEventListener('pointerup', soltar);
    document.addEventListener('pointercancel', soltar);
  }

  function conectarSheets() {
    /* Cualquier elemento con data-cerrar cierra su hoja */
    document.addEventListener('click', function (ev) {
      var cerrar = ev.target.closest ? ev.target.closest('[data-cerrar]') : null;
      if (cerrar) cerrarSheet(cerrar.getAttribute('data-cerrar'));
    });

    /* Tiradores para arrastrar */
    $$('[data-arrastre]').forEach(function (t) {
      var nombre = t.getAttribute('data-arrastre');
      t.addEventListener('pointerdown', function (ev) { iniciarArrastre(nombre, ev); });
    });

    /* Escape cierra la hoja de más arriba */
    document.addEventListener('keydown', function (ev) {
      if (ev.key !== 'Escape') return;
      var nombres = Object.keys(abiertas);
      if (nombres.length) cerrarSheet(nombres[nombres.length - 1]);
    });

    /* Al cruzar el umbral móvil/escritorio (o rotar el móvil) limpiamos las
       medidas en línea para que valgan las reglas CSS de cada tamaño */
    window.addEventListener('resize', function () {
      Object.keys(SHEETS).forEach(function (n) {
        var s = SHEETS[n];
        var sheet = document.getElementById(s.sheet);
        if (!abiertas[n] || esEscritorio()) {
          sheet.style.height = '';
          sheet.style.transform = '';
          return;
        }
        if (s.alturas.length > 1) aplicarFraccion(sheet, s.alturas[s.indice]);
        else sheet.style.transform = '';
      });
    });
  }

  /* ======================================================================
   * 8. Hoja de filtros
   * ==================================================================== */

  function rellenarFiltros() {
    $('#fProvincia').innerHTML = F.provincias.map(function (p) {
      return '<option value="' + esc(p.id) + '"' + (p.id === APP.prov ? ' selected' : '') + '>' + esc(p.nombre) + '</option>';
    }).join('');

    $('#fCombustible').innerHTML = F.combustiblesVisibles.map(function (c) {
      return '<option value="' + esc(c) + '"' + (c === APP.combustible ? ' selected' : '') + '>' + esc(c) + '</option>';
    }).join('');

    rellenarLocalidades();
    rellenarMarcas();
  }

  function rellenarLocalidades() {
    var locs = F.localidadesDe(APP.prov);
    $('#fLocalidad').innerHTML = '<option value="">Todas las localidades</option>' +
      locs.map(function (l) {
        return '<option value="' + esc(l) + '"' + (l === APP.localidad ? ' selected' : '') + '>' + esc(l) + '</option>';
      }).join('');
  }

  function rellenarMarcas() {
    var marcas = F.marcasDe(APP.prov);
    var html = '<label class="marca-check todas' + (APP.marcas.length === 0 ? ' on' : '') + '">' +
      '<input type="checkbox" data-marca-todas' + (APP.marcas.length === 0 ? ' checked' : '') + '>Todas</label>';
    html += marcas.map(function (m) {
      var on = APP.marcas.indexOf(m) !== -1;
      return '<label class="marca-check' + (on ? ' on' : '') + '">' +
        '<input type="checkbox" data-marca="' + esc(m) + '"' + (on ? ' checked' : '') + '>' + esc(m) + '</label>';
    }).join('');
    $('#fMarcas').innerHTML = html;
  }

  function sincronizarControlesFiltros() {
    $('#fProvincia').value = APP.prov;
    $('#fLocalidad').value = APP.localidad;
    $('#fCombustible').value = APP.combustible;
    $('#fDistancia').value = APP.distMax;
    $('#fDistanciaValor').textContent = APP.distMax >= 50 ? 'Sin límite' : APP.distMax + ' km';
    $('#fSoloFav').checked = APP.soloFav;
    rellenarMarcas();
    actualizarCuentaAplicar();
  }

  function actualizarCuentaAplicar() {
    var n = filtrar().length;
    $('#fAplicar').textContent = n === 1 ? 'Ver 1 estación' : 'Ver ' + n + ' estaciones';
  }

  function limpiarFiltros() {
    APP.combustible = FUEL_DEFECTO;
    APP.localidad = '';
    APP.marcas = [];
    APP.distMax = 50;
    APP.soloFav = false;
    APP.solo24h = false;
    APP.busqueda = '';
    APP.visibles = APP.pageSize === 0 ? 0 : APP.pageSize;
    $('#buscador').value = '';
    $('#buscadorLimpiar').hidden = true;
    sincronizarControlesFiltros();
    render();
  }

  /* Reinicia el cursor de paginación al cambiar cualquier filtro */
  function reiniciarPagina(cargando) {
    APP.visibles = APP.pageSize === 0 ? 0 : APP.pageSize;
    if (cargando) mostrarCargaYRender();
    else render();
  }

  function conectarFiltros() {
    /* Cada control aplica al instante: en un móvil, cerrar la hoja y esperar a
       que "algo" aplique es peor que ver el resultado en el momento. El botón
       grande solo confirma y cierra (y enseña cuántas quedan). */
    $('#fProvincia').addEventListener('change', function () {
      APP.prov = this.value;
      /* Al cambiar de provincia, localidad y marcas dejan de tener sentido */
      APP.localidad = '';
      APP.marcas = [];
      $('#ubicacionTexto').textContent = F.provinciaNombre(APP.prov) || 'España';
      rellenarLocalidades();
      rellenarMarcas();
      actualizarCuentaAplicar();
      reiniciarPagina(true);
    });

    $('#fLocalidad').addEventListener('change', function () {
      APP.localidad = this.value;
      actualizarCuentaAplicar();
      reiniciarPagina();
    });

    $('#fCombustible').addEventListener('change', function () {
      APP.combustible = this.value;
      actualizarCuentaAplicar();
      reiniciarPagina();
    });

    /* Marcas: multiselección con chip "Todas" que limpia la selección */
    $('#fMarcas').addEventListener('change', function (ev) {
      var el = ev.target;
      if (el.hasAttribute('data-marca-todas')) {
        APP.marcas = [];
      } else if (el.hasAttribute('data-marca')) {
        var m = el.getAttribute('data-marca');
        var i = APP.marcas.indexOf(m);
        if (el.checked) { if (i === -1) APP.marcas.push(m); }
        else if (i !== -1) APP.marcas.splice(i, 1);
      }
      rellenarMarcas();
      actualizarCuentaAplicar();
      reiniciarPagina();
    });

    $('#fDistancia').addEventListener('input', function () {
      APP.distMax = Number(this.value);
      $('#fDistanciaValor').textContent = APP.distMax >= 50 ? 'Sin límite' : APP.distMax + ' km';
      actualizarCuentaAplicar();
      reiniciarPagina();
    });

    $('#fSoloFav').addEventListener('change', function () {
      APP.soloFav = this.checked;
      actualizarCuentaAplicar();
      reiniciarPagina();
    });

    $('#fAplicar').addEventListener('click', function () { cerrarSheet('filtros'); });

    $('#fLimpiar').addEventListener('click', function () {
      limpiarFiltros();
      mostrarAviso('Filtros limpiados');
    });

    $('#vacioLimpiar').addEventListener('click', function () {
      limpiarFiltros();
      render();
    });

    $('#btnMas').addEventListener('click', function () {
      APP.visibles += (APP.pageSize || 30);
      render();
    });

    /* Chips: el ✕ quita el filtro; el cuerpo del chip abre la hoja o
       conmuta los filtros de un toque (distancia, favoritas, 24 h) */
    $('#chips').addEventListener('click', function (ev) {
      var boton = ev.target.closest ? ev.target.closest('[data-accion]') : null;
      if (!boton) return;
      var accion = boton.getAttribute('data-accion');
      var quitar = ev.target.closest('[data-quitar]');

      if (quitar) {
        if (accion === 'marcas') APP.marcas = [];
        if (accion === 'distancia') APP.distMax = 50;
        sincronizarControlesFiltros();
        reiniciarPagina();
        return;
      }

      if (accion === 'distancia') { APP.distMax = 5; sincronizarControlesFiltros(); reiniciarPagina(); return; }
      if (accion === 'favoritas') { APP.soloFav = !APP.soloFav; sincronizarControlesFiltros(); reiniciarPagina(); return; }
      if (accion === '24h') { APP.solo24h = !APP.solo24h; sincronizarControlesFiltros(); reiniciarPagina(); return; }

      /* Combustible, marcas y "Filtros (N)" abren la hoja */
      sincronizarControlesFiltros();
      abrirSheet('filtros');
    });

    /* Buscador con debounce corto para no repintar en cada tecla */
    var temporizador = null;
    $('#buscador').addEventListener('input', function () {
      var valor = this.value;
      $('#buscadorLimpiar').hidden = !valor;
      window.clearTimeout(temporizador);
      temporizador = window.setTimeout(function () {
        APP.busqueda = valor;
        reiniciarPagina();
      }, 160);
    });
    $('#buscadorLimpiar').addEventListener('click', function () {
      $('#buscador').value = '';
      APP.busqueda = '';
      this.hidden = true;
      reiniciarPagina();
      $('#buscador').focus();
    });

    /* Ordenación */
    $$('#barraOrden [data-orden]').forEach(function (b) {
      b.addEventListener('click', function () {
        APP.orden = b.getAttribute('data-orden');
        $$('#barraOrden [data-orden]').forEach(function (o) { o.classList.toggle('activo', o === b); });
        $('#scrollLista').scrollTop = 0;
        render();
      });
    });
  }

  /* Estado de carga honesto: skeletons breves antes de repintar la lista */
  function mostrarCargaYRender() {
    $('#listaTarjetas').innerHTML = '';
    $('#cargandoLista').hidden = false;
    window.setTimeout(function () {
      $('#cargandoLista').hidden = true;
      render();
    }, 320);
  }

  /* ======================================================================
   * 9. Detalle de estación
   * ==================================================================== */

  function primerCombustible(est) {
    for (var i = 0; i < F.combustibles.length; i++) {
      if (est.precios[F.combustibles[i]] != null) return F.combustibles[i];
    }
    return 'Gasolina 95 E5';
  }

  function abrirDetalle(id, desde) {
    var est = estacionPorId(id);
    if (!est) return;
    APP.detalle = est;
    APP.detalleTab = 'precios';
    APP.histFuel = precio(est, APP.combustible) != null ? APP.combustible : primerCombustible(est);
    pintarDetalle();
    /* data-shot="detalle" siempre apunta al primer disparador de la lista */
    if (!desde) pintarMapa();
    abrirSheet('detalle');
  }

  function pintarDetalle() {
    var est = APP.detalle;
    if (!est) return;
    var p = precio(est);
    var col = colorDe(p);
    var d = descuentoDe(est);

    var cabecera = $('#detalleCabecera');
    cabecera.className = 'detalle-cabecera ' + col;

    $('#detalleMarca').textContent = est.marca;
    $('#detalleNombre').textContent = est.nombre;
    $('#detallePrecio').textContent = fmtEur(p);
    $('#detalleCombustible').textContent = APP.combustible + (d ? ' · con descuento ' + fmtEur(Math.round((p - d) * 1000) / 1000) : '');

    /* Delta del día: comparamos los dos últimos puntos del histórico del
       combustible que se está mostrando en el detalle */
    var serie = F.historico(est.id, APP.combustible, 2);
    var delta = serie.length >= 2 ? Math.round((serie[1].precio - serie[0].precio) * 1000) / 1000 : null;
    var elDelta = $('#detalleDelta');
    if (delta == null) elDelta.textContent = 'sin datos de hoy';
    else if (delta === 0) elDelta.textContent = '± sin cambios hoy';
    else elDelta.textContent = (delta > 0 ? '▲ +' : '▼ −') + Math.abs(delta).toFixed(3).replace('.', ',') + ' € hoy';

    $('#detalleDireccion').textContent = est.direccion;
    $('#detalleLocalidad').textContent = est.localidad + ' · ' + (F.provinciaNombre(est.prov) || '');
    $('#detalleHorario').textContent = est.horario === '24 h' ? 'Abierta 24 horas' : 'Horario: ' + est.horario;
    $('#detalleTelefono').textContent = telefonoDe(est);

    actualizarAccionesDetalle();
    pintarTablaPrecios();
    rellenarHistControles();
    cambiarTabDetalle('precios');
  }

  function actualizarAccionesDetalle() {
    var est = APP.detalle;
    var fav = !!APP.favoritos[est.id];
    var b = $('#accionFavorito');
    b.classList.toggle('on', fav);
    b.querySelector('span').textContent = fav ? 'En favoritos' : 'Favorito';
    b.setAttribute('aria-pressed', fav ? 'true' : 'false');
  }

  function pintarTablaPrecios() {
    var est = APP.detalle;
    var d = descuentoDe(est);

    /* El más barato de los que vende se resalta */
    var vendidos = F.combustibles.filter(function (c) { return est.precios[c] != null; });
    var masBarato = vendidos.reduce(function (mejor, c) {
      return (est.precios[c] < est.precios[mejor]) ? c : mejor;
    }, vendidos[0]);
    var noVendidos = F.combustibles.filter(function (c) { return est.precios[c] == null; });

    var filas = vendidos.map(function (c) {
      var esBarato = c === masBarato;
      var conDto = d ? Math.round((est.precios[c] - d) * 1000) / 1000 : null;
      return '<tr class="' + (esBarato ? 'mas-barata' : '') + '">' +
        '<td>' + esc(c) + (esBarato ? '<span class="marca-barata">más barato</span>' : '') + '</td>' +
        '<td class="col-precio">' + fmtEur(est.precios[c]) + '</td>' +
        '<td class="col-precio">' + (conDto != null ? fmtEur(conDto) : '—') + '</td>' +
        '</tr>';
    }).concat(noVendidos.map(function (c) {
      return '<tr class="sin-precio"><td>' + esc(c) + '</td><td class="col-precio">—</td><td class="col-precio">—</td></tr>';
    })).join('');

    $('#detalleTablaPrecios').innerHTML = filas;
    $('#notaDescuentos').textContent = d
      ? 'Descuento de ' + fmt3(d) + ' €/L aplicado a la marca ' + est.marca +
        ' (se configura en Ajustes → Descuentos por marca).' +
        (APP.combustible === masBarato ? '' : ' El precio más barato de la estación es ' + masBarato + '.')
      : 'Sin descuento activo para ' + est.marca + '. Los descuentos se configuran en Ajustes → Descuentos por marca.' +
        (APP.combustible === masBarato ? '' : ' El precio más barato de la estación es ' + masBarato + '.');
  }

  function rellenarHistControles() {
    var est = APP.detalle;
    var vendidos = F.combustibles.filter(function (c) { return est.precios[c] != null; });
    $('#histCombustible').innerHTML = vendidos.map(function (c) {
      return '<option value="' + esc(c) + '"' + (c === APP.histFuel ? ' selected' : '') + '>' + esc(c) + '</option>';
    }).join('');

    $('#histDias').innerHTML = DIAS_HISTORICO.map(function (n) {
      return '<button type="button" class="dia-btn' + (n === APP.histDias ? ' activo' : '') +
        '" data-dias="' + n + '">' + n + ' d</button>';
    }).join('');
  }

  function cambiarTabDetalle(tab) {
    APP.detalleTab = tab;
    $$('.detalle-tab').forEach(function (b) {
      var on = b.getAttribute('data-dtab') === tab;
      b.classList.toggle('activo', on);
      b.setAttribute('aria-selected', on ? 'true' : 'false');
    });
    $('#dpanelPrecios').hidden = tab !== 'precios';
    $('#dpanelHistorico').hidden = tab !== 'historico';
    if (tab === 'historico') dibujarHistorico();
  }

  function conectarDetalle() {
    $$('.detalle-tab').forEach(function (b) {
      b.addEventListener('click', function () { cambiarTabDetalle(b.getAttribute('data-dtab')); });
    });

    $('#histCombustible').addEventListener('change', function () {
      APP.histFuel = this.value;
      dibujarHistorico();
    });

    $('#histDias').addEventListener('click', function (ev) {
      var b = ev.target.closest ? ev.target.closest('[data-dias]') : null;
      if (!b) return;
      APP.histDias = Number(b.getAttribute('data-dias'));
      $$('#histDias .dia-btn').forEach(function (x) { x.classList.toggle('activo', x === b); });
      dibujarHistorico();
    });

    $('#accionFavorito').addEventListener('click', function () {
      var id = APP.detalle.id;
      APP.favoritos[id] = !APP.favoritos[id];
      actualizarAccionesDetalle();
      render();
      mostrarAviso(APP.favoritos[id] ? 'Añadida a favoritas' : 'Quitada de favoritas');
    });

    $('#accionIr').addEventListener('click', function () {
      mostrarAviso('Abriendo ruta hacia ' + APP.detalle.nombre + ' (demo)');
    });

    $('#accionCompartir').addEventListener('click', function () {
      var est = APP.detalle;
      var texto = est.nombre + ' — ' + APP.combustible + ' ' + fmtEur(precio(est)) + ' (' + fmtKm(est.dist) + ')';
      if (navigator.share) {
        navigator.share({ title: est.nombre, text: texto }).catch(function () { /* cancelado */ });
      } else {
        mostrarAviso('Copiado: ' + texto);
        try { if (navigator.clipboard) navigator.clipboard.writeText(texto); } catch (e) { /* file:// sin permiso */ }
      }
    });

    $('#accionLlamar').addEventListener('click', function () {
      mostrarAviso('Llamando a ' + telefonoDe(APP.detalle) + ' (demo)');
    });
  }

  /* ======================================================================
   * 10. Gráfica SVG del histórico
   * ==================================================================== */

  var ULTIMA_SERIE = [];

  function dibujarHistorico() {
    var svg = $('#graficaHistorico');
    var serie = F.historico(APP.detalle.id, APP.histFuel, APP.histDias);
    ULTIMA_SERIE = serie;
    var tooltip = $('#graficaTooltip');
    tooltip.hidden = true;

    if (serie.length < 2) { svg.innerHTML = ''; return; }

    var W = 340, H = 170;
    var izq = 48, der = 12, arriba = 14, abajo = 26;
    var precios = serie.map(function (p) { return p.precio; });
    var min = Math.min.apply(null, precios);
    var max = Math.max.apply(null, precios);
    if (max - min < 0.01) { min -= 0.005; max += 0.005; }
    var rango = max - min;

    function x(i) { return izq + (W - izq - der) * (i / (serie.length - 1)); }
    function y(v) { return arriba + (H - arriba - abajo) * (1 - (v - min) / rango); }

    var partes = [];

    /* Rejilla + etiquetas de precio (3 líneas) */
    for (var g = 0; g <= 3; g++) {
      var valor = min + rango * (g / 3);
      var yy = y(valor);
      partes.push('<line x1="' + izq + '" y1="' + yy.toFixed(1) + '" x2="' + (W - der) + '" y2="' + yy.toFixed(1) +
        '" stroke="#e6e9ee" stroke-width="1" vector-effect="non-scaling-stroke"></line>');
      partes.push('<text x="' + (izq - 6) + '" y="' + (yy + 4).toFixed(1) + '" text-anchor="end" font-size="10" fill="#98a1ad">' +
        fmt3(valor) + '</text>');
    }

    /* Área + línea */
    var puntos = serie.map(function (p, i) { return x(i).toFixed(1) + ',' + y(p.precio).toFixed(1); });
    partes.push('<path d="M' + puntos.join(' L') + ' L' + x(serie.length - 1).toFixed(1) + ',' + (H - abajo) +
      ' L' + izq + ',' + (H - abajo) + ' Z" fill="rgba(26,115,232,.10)"></path>');
    partes.push('<path d="M' + puntos.join(' L') + '" fill="none" stroke="#1a73e8" stroke-width="2.5" ' +
      'stroke-linejoin="round" stroke-linecap="round" vector-effect="non-scaling-stroke"></path>');

    /* Puntos si la serie no es muy densa */
    if (serie.length <= 30) {
      serie.forEach(function (p, i) {
        partes.push('<circle cx="' + x(i).toFixed(1) + '" cy="' + y(p.precio).toFixed(1) + '" r="2.6" fill="#fff" stroke="#1a73e8" stroke-width="1.8" vector-effect="non-scaling-stroke"></circle>');
      });
    }

    /* Mínimo y máximo marcados con su fecha */
    var iMin = precios.indexOf(min), iMax = precios.indexOf(max);
    partes.push('<circle cx="' + x(iMin).toFixed(1) + '" cy="' + y(min).toFixed(1) + '" r="4" fill="#0f7b3d"></circle>');
    partes.push('<circle cx="' + x(iMax).toFixed(1) + '" cy="' + y(max).toFixed(1) + '" r="4" fill="#c0392b"></circle>');
    partes.push('<text x="' + x(iMin).toFixed(1) + '" y="' + (y(min) + 15).toFixed(1) + '" text-anchor="middle" font-size="10" font-weight="700" fill="#0f7b3d">mín ' + fmt3(min) + '</text>');
    partes.push('<text x="' + x(iMax).toFixed(1) + '" y="' + (y(max) - 8).toFixed(1) + '" text-anchor="middle" font-size="10" font-weight="700" fill="#c0392b">máx ' + fmt3(max) + '</text>');

    /* Etiquetas de fecha: primera, central y última (dd-mm) */
    [0, Math.floor(serie.length / 2), serie.length - 1].forEach(function (i, k) {
      var ancla = k === 0 ? 'start' : k === 2 ? 'end' : 'middle';
      var xx = k === 0 ? izq : k === 2 ? W - der : x(i);
      partes.push('<text x="' + xx.toFixed(1) + '" y="' + (H - 8) + '" text-anchor="' + ancla + '" font-size="10" fill="#98a1ad">' +
        serie[i].fecha.slice(0, 5) + '</text>');
    });

    svg.innerHTML = partes.join('');

    /* Resumen en texto (lo que la gráfica no dice con números) */
    var primero = serie[0].precio, ultimo = serie[serie.length - 1].precio;
    var variacion = ultimo - primero;
    var pct = (variacion / primero) * 100;
    var clase = variacion > 0 ? 'rojo' : variacion < 0 ? 'verde' : '';
    $('#historicoResumen').innerHTML = 'Últimos ' + serie.length + ' días de <b>' + esc(APP.histFuel) + '</b>: ' +
      'de ' + fmtEur(primero) + ' (' + esc(serie[0].fecha) + ') a <b>' + fmtEur(ultimo) + '</b> (' + esc(serie[serie.length - 1].fecha) + '). ' +
      'Variación <b class="' + clase + '">' + (variacion >= 0 ? '+' : '−') + fmt3(Math.abs(variacion)) + ' € (' +
      (pct >= 0 ? '+' : '−') + Math.abs(pct).toFixed(1).replace('.', ',') + ' %)</b>. ' +
      'Mínimo ' + fmtEur(min) + ' el ' + esc(serie[iMin].fecha) + ', máximo ' + fmtEur(max) + ' el ' + esc(serie[iMax].fecha) + '. ' +
      'Un día sin precio no significa precio constante.';
  }

  /* Tooltip de la gráfica: buscamos el punto más cercano a la posición del dedo
     o del ratón. La gráfica escala de forma uniforme (viewBox → ancho del
     contenedor), así que la conversión a porcentajes es lineal. */
  function conectarGrafica() {
    var svg = $('#graficaHistorico');
    var caja = $('#graficaCaja');
    var tooltip = $('#graficaTooltip');

    function mover(ev) {
      if (ULTIMA_SERIE.length < 2 || $('#dpanelHistorico').hidden) return;
      var r = svg.getBoundingClientRect();
      if (!r.width) return;
      var rel = Math.min(Math.max((ev.clientX - r.left) / r.width, 0), 1);
      var i = Math.round(rel * (ULTIMA_SERIE.length - 1));
      var W = 340, H = 170, izq = 48, der = 12, arriba = 14, abajo = 26;
      var precios = ULTIMA_SERIE.map(function (p) { return p.precio; });
      var min = Math.min.apply(null, precios), max = Math.max.apply(null, precios);
      if (max - min < 0.01) { min -= 0.005; max += 0.005; }
      var x = izq + (W - izq - der) * (i / (ULTIMA_SERIE.length - 1));
      var y = arriba + (H - arriba - abajo) * (1 - (ULTIMA_SERIE[i].precio - min) / (max - min));
      tooltip.hidden = false;
      tooltip.innerHTML = '<b>' + fmtEur(ULTIMA_SERIE[i].precio) + '</b>' + esc(ULTIMA_SERIE[i].fecha);
      tooltip.style.left = (x / W * 100) + '%';
      tooltip.style.top = (y / H * 100) + '%';
    }

    function salir() { tooltip.hidden = true; }

    svg.addEventListener('pointermove', mover);
    svg.addEventListener('pointerdown', mover);
    svg.addEventListener('pointerleave', salir);
    caja.addEventListener('pointerleave', salir);
  }

  /* ======================================================================
   * 11. Chat IA — markdown básico + marca de agua por respuesta
   * ==================================================================== */

  /* Renderer de Markdown mínimo: lo justo para que las respuestas de la IA se
     lean (títulos, negrita, cursiva, código, listas, tablas, citas y enlaces).
     Escapa primero y luego da formato: nunca inyectamos HTML del modelo. */
  function mdInline(s) {
    s = s.replace(/`([^`]+)`/g, '<code>$1</code>');
    s = s.replace(/\*\*([^*]+)\*\*/g, '<b>$1</b>');
    s = s.replace(/__([^_]+)__/g, '<b>$1</b>');
    s = s.replace(/(^|[\s(])\*([^*\n]+)\*(?=[\s).,;:!?]|$)/g, '$1<i>$2</i>');
    s = s.replace(/(^|[\s(])_([^_\n]+)_(?=[\s).,;:!?]|$)/g, '$1<i>$2</i>');
    s = s.replace(/\[([^\]]+)\]\((https?:[^)\s]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>');
    s = s.replace(/(^|\s)(https?:\/\/[^\s<]+)/g, '$1<a href="$2" target="_blank" rel="noopener">$2</a>');
    return s;
  }

  function esBloque(linea) {
    return /^\s*```/.test(linea) || /^\s*#{1,4}\s/.test(linea) || /^\s*>/.test(linea) ||
      /^\s*[-*+]\s/.test(linea) || /^\s*\d+\.\s/.test(linea) || /^\s*\|/.test(linea) ||
      /^\s*(-{3,}|\*{3,})\s*$/.test(linea);
  }

  function mdAHtml(texto) {
    var lineas = esc(texto).split('\n');
    var salida = [];
    var i = 0;

    while (i < lineas.length) {
      var l = lineas[i];

      /* Bloque de código: ``` … ``` (también sin cerrar, respuesta cortada) */
      if (/^\s*```/.test(l)) {
        var codigo = [];
        i++;
        while (i < lineas.length && !/^\s*```/.test(lineas[i])) { codigo.push(lineas[i]); i++; }
        i++;
        salida.push('<pre><code>' + codigo.join('\n') + '</code></pre>');
        continue;
      }

      /* Tabla: línea de cabecera + separador |---|---| */
      if (/^\s*\|/.test(l) && i + 1 < lineas.length && /^\s*\|[\s:|-]+\|?\s*$/.test(lineas[i + 1])) {
        var celdas = function (t) {
          return t.replace(/^\s*\|/, '').replace(/\|\s*$/, '').split('|').map(function (c) { return c.trim(); });
        };
        var cab = celdas(l);
        i += 2;
        var cuerpo = [];
        while (i < lineas.length && /^\s*\|/.test(lineas[i])) { cuerpo.push(celdas(lineas[i])); i++; }
        var tabla = '<table><thead><tr>' + cab.map(function (c) { return '<th>' + mdInline(c) + '</th>'; }).join('') + '</tr></thead><tbody>';
        cuerpo.forEach(function (fila) {
          tabla += '<tr>' + fila.map(function (c) { return '<td>' + mdInline(c) + '</td>'; }).join('') + '</tr>';
        });
        salida.push(tabla + '</tbody></table>');
        continue;
      }

      /* Títulos: los limitamos a h4 para no romper la jerarquía del chat */
      var h = l.match(/^\s*(#{1,4})\s+(.*)$/);
      if (h) { salida.push('<h' + Math.min(h[1].length + 2, 4) + '>' + mdInline(h[2]) + '</h' + Math.min(h[1].length + 2, 4) + '>'); i++; continue; }

      if (/^\s*(-{3,}|\*{3,})\s*$/.test(l)) { salida.push('<hr>'); i++; continue; }

      if (/^\s*>/.test(l)) {
        var cita = [];
        while (i < lineas.length && /^\s*>/.test(lineas[i])) { cita.push(lineas[i].replace(/^\s*>\s?/, '')); i++; }
        salida.push('<blockquote>' + cita.map(mdInline).join('<br>') + '</blockquote>');
        continue;
      }

      if (/^\s*[-*+]\s/.test(l)) {
        var ul = [];
        while (i < lineas.length && /^\s*[-*+]\s/.test(lineas[i])) { ul.push(lineas[i].replace(/^\s*[-*+]\s/, '')); i++; }
        salida.push('<ul>' + ul.map(function (x) { return '<li>' + mdInline(x) + '</li>'; }).join('') + '</ul>');
        continue;
      }

      if (/^\s*\d+\.\s/.test(l)) {
        var ol = [];
        while (i < lineas.length && /^\s*\d+\.\s/.test(lineas[i])) { ol.push(lineas[i].replace(/^\s*\d+\.\s/, '')); i++; }
        salida.push('<ol>' + ol.map(function (x) { return '<li>' + mdInline(x) + '</li>'; }).join('') + '</ol>');
        continue;
      }

      if (!l.trim()) { i++; continue; }

      /* Párrafo: agrupamos líneas consecutivas y las unimos con <br> */
      var parr = [];
      while (i < lineas.length && lineas[i].trim() && !esBloque(lineas[i])) { parr.push(lineas[i]); i++; }
      salida.push('<p>' + parr.map(mdInline).join('<br>') + '</p>');
    }

    return salida.join('');
  }

  function msSimulado(texto) {
    /* Tiempo "creíble" y estable: proporcional a la longitud de la respuesta */
    var base = 700 + (String(texto).length * 6.5) % 1400;
    return Math.round(base);
  }

  function proveedorPorId(id) {
    for (var i = 0; i < PROVEEDORES.length; i++) if (PROVEEDORES[i].id === id) return PROVEEDORES[i];
    return PROVEEDORES[0];
  }

  function modeloProveedor(id) {
    if (id === 'general') {
      var n = PROVEEDORES.filter(function (p) { return p.id !== 'general' && APP.provVisible[p.id]; }).length;
      return 'General · ' + plural(n, 'proveedor', 'proveedores');
    }
    return proveedorPorId(id).modelo;
  }

  function pintarPills() {
    $('#pillsProveedor').innerHTML = PROVEEDORES.filter(function (p) {
      return p.id === 'general' || APP.provVisible[p.id];
    }).map(function (p) {
      return '<button type="button" class="pill' + (p.id === APP.chatProvider ? ' activo' : '') +
        '" role="tab" aria-selected="' + (p.id === APP.chatProvider ? 'true' : 'false') +
        '" data-pill="' + esc(p.id) + '">' + esc(p.label) + '</button>';
    }).join('');
  }

  function pintarChat() {
    var lista = APP.chats[APP.chatProvider] || [];
    var cont = $('#chatMensajes');
    if (!lista.length) {
      cont.innerHTML = '<div class="msg msg-info">Pregunta lo que quieras sobre los precios de tu zona. ' +
        'Se envía a <b>' + esc(proveedorPorId(APP.chatProvider).label) + '</b>.</div>';
      return;
    }
    cont.innerHTML = lista.map(function (m) {
      if (m.role === 'user') return '<div class="msg msg-user">' + mdAHtml(m.content) + '</div>';
      if (m.role === 'assistant') {
        return '<div class="msg msg-asistente">' + mdAHtml(m.content) +
          '<span class="msg-meta">⏱ ' + esc(m.modelo) + ' · ' + fmtTiempo(m.ms) + '</span></div>';
      }
      return '<div class="msg msg-info">' + esc(m.content) + '</div>';
    }).join('');
    cont.scrollTop = cont.scrollHeight;
  }

  /* Respuesta local: se calcula de verdad sobre los resultados filtrados */
  function respuestaLocal() {
    var lista = APP.resultados.length ? APP.resultados : ordenar(filtrar());
    var prov = F.provinciaNombre(APP.prov) || 'tu zona';
    if (!lista.length) {
      return 'No encuentro estaciones de **' + APP.combustible + '** en ' + prov +
        ' con los filtros actuales.\n\nPrueba a ampliar la distancia máxima o quitar alguna marca.';
    }
    var tres = lista.slice(0, 3);
    var filas = tres.map(function (e, i) {
      return (i + 1) + '. **' + e.nombre + '** — **' + fmtEur(precio(e)) + '** (' + fmtKm(e.dist) + ')';
    }).join('\n');
    var tabla = '| Estación | Precio | Distancia |\n|---|---|---|\n' + tres.map(function (e) {
      return '| ' + e.nombre + ' | ' + fmtEur(precio(e)) + ' | ' + fmtKm(e.dist) + ' |';
    }).join('\n');
    var media = F.mediaProvincia(APP.prov, APP.combustible);
    var barata = lista[0];
    return '### ' + APP.combustible + ' más barata (' + prov + ')\n\n' +
      filas + '\n\n' + tabla + '\n\n' +
      'La más barata es **' + barata.nombre + '** a **' + fmtEur(precio(barata)) + '**, ' +
      (media != null ? fmtEur(Math.round((media - precio(barata)) * 1000) / 1000) + ' por debajo de la media provincial (' + fmtEur(media) + ')' : 'sin media provincial disponible') +
      '. Hay ' + plural(lista.length, 'estación', 'estaciones') + ' con estos filtros.';
  }

  function respuestaMaqueta(id) {
    var muestra = (F.chatsIA[id] || []).filter(function (m) { return m.role === 'assistant'; });
    if (!muestra.length) return 'No tengo datos para **' + proveedorPorId(id).label + '** ahora mismo. Prueba con la pestaña General.';
    var i = (APP.rotacion[id] || 0) % muestra.length;
    APP.rotacion[id] = i + 1;
    return muestra[i].content;
  }

  function enviarChat(texto) {
    texto = String(texto || '').trim();
    if (!texto) return;
    var id = APP.chatProvider;
    var lista = APP.chats[id] || (APP.chats[id] = []);
    lista.push({ role: 'user', content: texto, modelo: modeloProveedor(id), ms: 0 });
    pintarChat();

    /* Mensaje de carga efímero mientras "piensa" el proveedor */
    var cont = $('#chatMensajes');
    var cargando = document.createElement('div');
    cargando.className = 'msg msg-info';
    cargando.textContent = 'Pensando… (' + modeloProveedor(id) + ')';
    cont.appendChild(cargando);
    cont.scrollTop = cont.scrollHeight;

    var modelo = modeloProveedor(id);
    window.setTimeout(function () {
      var respuesta = (id === 'general' || id === 'groq') ? respuestaLocal() : respuestaMaqueta(id);
      lista.push({ role: 'assistant', content: respuesta, modelo: modelo, ms: msSimulado(respuesta) });
      pintarChat();
    }, 480);
  }

  function conectarChat() {
    $('#pillsProveedor').addEventListener('click', function (ev) {
      var b = ev.target.closest ? ev.target.closest('[data-pill]') : null;
      if (!b) return;
      APP.chatProvider = b.getAttribute('data-pill');
      pintarPills();
      pintarChat();
    });

    $('#chatForm').addEventListener('submit', function (ev) {
      ev.preventDefault();
      var input = $('#chatInput');
      enviarChat(input.value);
      input.value = '';
      input.focus();
    });

    $('#chatLimpiar').addEventListener('click', function () {
      APP.chats[APP.chatProvider] = [];
      pintarChat();
      mostrarAviso('Conversación borrada');
    });

    $('#chatSugerencias').addEventListener('click', function (ev) {
      var b = ev.target.closest ? ev.target.closest('[data-prompt]') : null;
      if (!b) return;
      enviarChat(b.getAttribute('data-prompt'));
    });

    $('#chatSugerencias').innerHTML = F.prompts.slice(0, 3).map(function (p) {
      return '<button type="button" class="sugerencia" data-prompt="' + esc(p) + '">' + esc(p) + '</button>';
    }).join('');
  }

  /* ======================================================================
   * 12. Ajustes — acordeón con controles que cambian el estado real
   * ==================================================================== */

  var SECCIONES = [
    { id: 'descuentos', titulo: 'Descuentos por marca', icono: '−€' },
    { id: 'cache', titulo: 'Caché de datos', icono: '⛁' },
    { id: 'paginacion', titulo: 'Paginación', icono: '≣' },
    { id: 'log', titulo: 'Registro de actividad', icono: '⏱' },
    { id: 'push', titulo: 'Notificaciones push', icono: '🔔' },
    { id: 'claves', titulo: 'Claves API · IA', icono: '🔑' },
    { id: 'pestanas', titulo: 'Pestañas de IA', icono: '◫' },
    { id: 'prompts', titulo: 'Prompts rápidos', icono: '✦' },
    { id: 'version', titulo: 'Actualización de la app', icono: '↻' }
  ];

  function cuerpoAjuste(id) {
    if (id === 'descuentos') {
      return Object.keys(F.descuentos).map(function (m) {
        var on = !!APP.descuentosActivos[m];
        return '<label class="switch-fila" style="min-height:48px">' +
          '<span>' + esc(m) + '<span class="ayuda">−' + fmt3(F.descuentos[m]) + ' €/L en el precio mostrado</span></span>' +
          '<input type="checkbox" data-desc="' + esc(m) + '"' + (on ? ' checked' : '') + '><i class="switch"></i></label>';
      }).join('');
    }
    if (id === 'cache') {
      var c = F.cacheInfo;
      return '<div class="dato-cache"><span>Provincias en caché</span><span>' + c.provincias + '</span></div>' +
        '<div class="dato-cache"><span>Gasolineras</span><span>' + c.gasolineras + '</span></div>' +
        '<div class="dato-cache"><span>Días de histórico</span><span>' + c.historicoDias + '</span></div>' +
        '<div class="dato-cache"><span>IndexedDB</span><span>' + esc(c.idb) + '</span></div>' +
        '<div class="dato-cache"><span>Claves localStorage</span><span>' + c.lsClaves + '</span></div>' +
        '<div class="dato-cache"><span>Última actualización</span><span>' + esc(c.ultimaActualizacion) + '</span></div>' +
        '<label class="fila-ajuste"><span>Tiempo de vida (h)<span class="ayuda">se aplica tras cada refresco</span></span>' +
        '<input type="number" min="1" max="72" id="ajCacheTtl" value="' + APP.ajustes.cacheTtl + '"></label>' +
        '<button type="button" class="btn-fantasma" id="ajLimpiarCache" style="width:100%;margin-top:10px">Limpiar caché</button>';
    }
    if (id === 'paginacion') {
      return '<label class="fila-ajuste"><span>Estaciones por página<span class="ayuda">0 = mostrar todas</span></span>' +
        '<select id="ajPageSize">' + F.config.paginas.map(function (n) {
          return '<option value="' + n + '"' + (n === APP.pageSize ? ' selected' : '') + '>' + (n === 0 ? 'Todas' : n) + '</option>';
        }).join('') + '</select></label>';
    }
    if (id === 'log') {
      return '<div class="log-tabs">' +
        '<button type="button" class="log-tab' + (APP.logTab === 'api' ? ' activo' : '') + '" data-log="api">API</button>' +
        '<button type="button" class="log-tab' + (APP.logTab === 'push' ? ' activo' : '') + '" data-log="push">Push</button>' +
        '</div><div class="log-lista">' + htmlLog(APP.logTab) + '</div>';
    }
    if (id === 'push') {
      var a = APP.ajustes;
      return '<label class="switch-fila"><span>Activar notificaciones<span class="ayuda">avisos de bajada de precio</span></span>' +
        '<input type="checkbox" id="ajPushOn"' + (a.pushActivo ? ' checked' : '') + '><i class="switch"></i></label>' +
        '<label class="fila-ajuste"><span>Comprobar cada (h)</span><input type="number" min="1" max="24" id="ajIntervalo" value="' + a.checkInterval + '"></label>' +
        '<label class="fila-ajuste"><span>Días de bajada</span><input type="number" min="0" max="90" id="ajDiasBajada" value="' + a.priceFallDays + '"></label>' +
        '<label class="fila-ajuste"><span>Avisar también si sube</span><input type="checkbox" id="ajSubidas"' + (a.pushOnPriceRise ? ' checked' : '') + '></label>' +
        '<label class="fila-ajuste"><span>Modo de comparación</span><select id="ajModo">' +
        ['average', 'last', 'min'].map(function (m) {
          var etq = m === 'average' ? 'Media' : m === 'last' ? 'Último precio' : 'Mínimo del periodo';
          return '<option value="' + m + '"' + (m === a.priceCheckMode ? ' selected' : '') + '>' + etq + '</option>';
        }).join('') + '</select></label>' +
        '<button type="button" class="btn-fantasma" id="ajProbarPush" style="width:100%;margin-top:10px">Probar notificación</button>';
    }
    if (id === 'claves') {
      var cargadas = APP.ajustes.clavesCargadas;
      return '<p class="nota-descuentos" style="padding-top:0">Las claves se guardan cifradas en el código fuente y se descargan con una contraseña de 6 caracteres (demo: 123456).</p>' +
        (cargadas
          ? '<p style="font-size:13px;color:#0f7b3d;font-weight:700;margin-bottom:8px">✔ Claves cargadas para 5 de 7 proveedores</p>'
          : '<label class="fila-ajuste"><span>Contraseña</span><input type="password" id="ajPass" maxlength="6" placeholder="••••••" inputmode="numeric"></label>') +
        PROVEEDORES.filter(function (p) { return p.id !== 'general'; }).map(function (p) {
          var listo = cargadas;
          return '<div class="fila-ajuste"><span>' + esc(p.label) + '<span class="ayuda">' + esc(p.modelo) + '</span></span>' +
            '<span class="ayuda" style="font-weight:700;color:' + (listo ? '#0f7b3d' : '#c0392b') + '">' + (listo ? '✔ lista' : '✕ sin clave') + '</span></div>';
        }).join('') +
        (cargadas ? '' : '<button type="button" class="btn-primario-grande" id="ajCargarClaves" style="width:100%;margin-top:10px">Cargar claves</button>');
    }
    if (id === 'pestanas') {
      return '<p class="nota-descuentos" style="padding-top:0">Elige qué proveedores aparecen como pestaña en el chat. Siempre queda al menos uno.</p>' +
        '<div class="ia-check">' + PROVEEDORES.filter(function (p) { return p.id !== 'general'; }).map(function (p) {
          var on = APP.provVisible[p.id];
          return '<label class="' + (on ? 'on' : '') + '"><input type="checkbox" data-iaprov="' + esc(p.id) + '"' + (on ? ' checked' : '') + '>' + esc(p.label) + '</label>';
        }).join('') + '</div>';
    }
    if (id === 'prompts') {
      return '<div class="prompts-caja">' + F.prompts.map(function (p) {
        return '<button type="button" class="prompt-btn" data-prompt-config="' + esc(p) + '">' + esc(p) + '</button>';
      }).join('') + '</div><p class="nota-descuentos">Al pulsar uno se abre el chat con esa pregunta enviada.</p>';
    }
    if (id === 'version') {
      var v = F.versionApp;
      return '<div class="version-caja"><b>' + esc(v.texto) + '</b><span>build ' + esc(v.build) + '</span></div>' +
        '<button type="button" class="btn-fantasma" id="ajActualizar" style="width:100%;margin-top:12px">Comprobar actualizaciones</button>' +
        '<p class="nota-descuentos">En la app real se compara APP_VERSION de sw.js y se ofrece recargar.</p>';
    }
    return '';
  }

  function htmlLog(tipo) {
    var filas = tipo === 'api' ? F.logApi : F.logPush;
    return filas.slice().reverse().map(function (f) {
      var ok = String(f.estado) === '200' || f.estado === 'ok';
      var aviso = String(f.estado) === '429';
      return '<div class="log-fila">' +
        '<span class="log-estado ' + (ok ? 'ok' : aviso ? 'aviso' : '') + '">' + esc(f.estado) + '</span>' +
        '<span class="log-url" title="' + esc(f.url) + '">' + esc(f.url) + '</span>' +
        '<span>' + f.ms + ' ms</span>' +
        '<span style="grid-column:1 / -1;color:#98a1ad">' + esc(f.t) + '</span>' +
        '</div>';
    }).join('');
  }

  function pintarAjustes() {
    var abierta = $('#ajustesCuerpo').getAttribute('data-abierta');
    $('#ajustesCuerpo').innerHTML = SECCIONES.map(function (s) {
      return '<section class="acordeon' + (s.id === abierta ? ' abierto' : '') + '" data-sec="' + s.id + '">' +
        '<button type="button" class="acordeon-cabecera" data-toggle="' + s.id + '">' +
        '<span class="acordeon-icono">' + s.icono + '</span>' +
        '<span>' + esc(s.titulo) + '</span>' +
        '<span class="acordeon-flecha">⌄</span></button>' +
        '<div class="acordeon-cuerpo">' + cuerpoAjuste(s.id) + '</div>' +
        '</section>';
    }).join('');
  }

  function conectarAjustes() {
    var cuerpo = $('#ajustesCuerpo');

    /* Acordeón: una sección abierta a la vez */
    cuerpo.addEventListener('click', function (ev) {
      var b = ev.target.closest ? ev.target.closest('[data-toggle]') : null;
      if (b) {
        var id = b.getAttribute('data-toggle');
        var estaba = cuerpo.getAttribute('data-abierta') === id;
        cuerpo.setAttribute('data-abierta', estaba ? '' : id);
        $$('.acordeon', cuerpo).forEach(function (sec) {
          sec.classList.toggle('abierto', !estaba && sec.getAttribute('data-sec') === id);
        });
        return;
      }

      var log = ev.target.closest ? ev.target.closest('[data-log]') : null;
      if (log) {
        APP.logTab = log.getAttribute('data-log');
        cuerpo.setAttribute('data-abierta', 'log');
        pintarAjustes();
        return;
      }

      var prompt = ev.target.closest ? ev.target.closest('[data-prompt-config]') : null;
      if (prompt) {
        APP.chatProvider = 'general';
        pintarPills();
        pintarChat();
        abrirSheet('chat');
        enviarChat(prompt.getAttribute('data-prompt-config'));
        return;
      }

      if (ev.target.id === 'ajLimpiarCache') {
        F.cacheInfo.gasolineras = 0;
        F.cacheInfo.provincias = 0;
        F.cacheInfo.idb = 'gasolineras-db — 0,2 MB';
        F.cacheInfo.lsClaves = 0;
        pintarAjustes();
        mostrarAviso('Caché borrada (demo)');
        return;
      }

      if (ev.target.id === 'ajProbarPush') { mostrarAviso('Notificación de prueba enviada'); return; }

      if (ev.target.id === 'ajActualizar') { mostrarAviso('Estás en la última versión (' + F.versionApp.texto + ')'); return; }

      if (ev.target.id === 'ajCargarClaves') {
        var pass = $('#ajPass');
        if (pass && pass.value === '123456') {
          APP.ajustes.clavesCargadas = true;
          pintarAjustes();
          mostrarAviso('Claves cargadas para 5 de 7 proveedores');
        } else {
          mostrarAviso('Contraseña incorrecta (usa 123456 en la demo)');
        }
        return;
      }
    });

    /* Cambios que afectan al resto de la app */
    cuerpo.addEventListener('change', function (ev) {
      var el = ev.target;

      if (el.hasAttribute && el.hasAttribute('data-desc')) {
        APP.descuentosActivos[el.getAttribute('data-desc')] = el.checked;
        render();
        pintarAjustes();
        return;
      }

      if (el.hasAttribute && el.hasAttribute('data-iaprov')) {
        var id = el.getAttribute('data-iaprov');
        var visibles = PROVEEDORES.filter(function (p) { return p.id !== 'general' && APP.provVisible[p.id]; });
        if (!el.checked && visibles.length === 1 && visibles[0].id === id) {
          el.checked = true;
          mostrarAviso('Debe quedar al menos un proveedor visible');
          return;
        }
        APP.provVisible[id] = el.checked;
        if (APP.chatProvider === id && !el.checked) APP.chatProvider = 'general';
        pintarPills();
        pintarChat();
        pintarAjustes();
        return;
      }

      if (el.id === 'ajPageSize') {
        APP.pageSize = Number(el.value);
        APP.visibles = APP.pageSize === 0 ? 0 : APP.pageSize;
        $('#scrollLista').scrollTop = 0;
        render();
        mostrarAviso(APP.pageSize === 0 ? 'Mostrando todas las estaciones' : 'Página de ' + APP.pageSize + ' estaciones');
        return;
      }

      if (el.id === 'ajCacheTtl') { APP.ajustes.cacheTtl = Number(el.value); mostrarAviso('TTL de caché: ' + el.value + ' h'); return; }
      if (el.id === 'ajIntervalo') { APP.ajustes.checkInterval = Number(el.value); return; }
      if (el.id === 'ajDiasBajada') { APP.ajustes.priceFallDays = Number(el.value); return; }
      if (el.id === 'ajSubidas') { APP.ajustes.pushOnPriceRise = el.checked; return; }
      if (el.id === 'ajModo') { APP.ajustes.priceCheckMode = el.value; return; }
      if (el.id === 'ajPushOn') { APP.ajustes.pushActivo = el.checked; mostrarAviso(el.checked ? 'Notificaciones activadas' : 'Notificaciones desactivadas'); return; }
    });
  }

  /* ======================================================================
   * 13. Navegación, avisos y arranque
   * ==================================================================== */

  function marcarNav(destino) {
    $$('.nav-btn').forEach(function (b) {
      b.classList.toggle('activo', b.getAttribute('data-destino') === destino);
    });
    $$('#segLista, #segMapa').forEach(function (b) {
      var activo = b.id === 'segMapa' ? destino === 'mapa' : destino !== 'mapa';
      b.classList.toggle('activo', activo);
      b.setAttribute('aria-pressed', activo ? 'true' : 'false');
    });
    APP.vista = destino === 'mapa' ? 'mapa' : 'lista';
  }

  function irA(destino) {
    if (destino === 'mapa') {
      if (!esEscritorio()) document.body.classList.add('vista-mapa');
      marcarNav('mapa');
      pintarMapa();
      return;
    }

    document.body.classList.remove('vista-mapa');

    if (destino === 'ia') {
      pintarPills();
      pintarChat();
      abrirSheet('chat');
      marcarNav('ia');
      return;
    }
    if (destino === 'ajustes') {
      pintarAjustes();
      abrirSheet('ajustes');
      marcarNav('ajustes');
      return;
    }

    /* Lista y Favoritas son destinos de contenido: cambian el filtro */
    APP.soloFav = destino === 'favoritas';
    APP.visibles = APP.pageSize === 0 ? 0 : APP.pageSize;
    sincronizarControlesFiltros();
    if (destino === 'favoritas' && !Object.keys(APP.favoritos).length) mostrarAviso('Todavía no tienes favoritas');
    render();
    marcarNav(destino);
  }

  function conectarNav() {
    $('#navInferior').addEventListener('click', function (ev) {
      var b = ev.target.closest ? ev.target.closest('[data-destino]') : null;
      if (!b) return;
      cerrarTodas();
      irA(b.getAttribute('data-destino'));
    });

    $('#segMapa').addEventListener('click', function () { cerrarTodas(); irA('mapa'); });
    $('#segLista').addEventListener('click', function () { irA('lista'); });
    $('#mapaVolver').addEventListener('click', function () { irA('lista'); });
    $('#fabIa').addEventListener('click', function () { irA('ia'); });
    $('#fabFiltros').addEventListener('click', function () { sincronizarControlesFiltros(); abrirSheet('filtros'); });
  }

  function mostrarAviso(texto) {
    var el = $('#aviso');
    el.textContent = texto;
    el.hidden = false;
    window.requestAnimationFrame(function () { el.classList.add('visible'); });
    window.clearTimeout(el._t);
    el._t = window.setTimeout(function () {
      el.classList.remove('visible');
      window.setTimeout(function () { el.hidden = true; }, 200);
    }, 2400);
  }

  /* Delegación global: estrella de favorito y botón detalle desde las tarjetas
     y los marcadores del mapa. Es lo que hace que la lista sea interactiva sin
     volver a enganchar listeners en cada repintado. */
  function conectarListaYMapa() {
    document.addEventListener('click', function (ev) {
      var objetivo = ev.target;
      if (!objetivo.closest) return;

      var fav = objetivo.closest('[data-fav]');
      if (fav) {
        var idF = fav.getAttribute('data-fav');
        APP.favoritos[idF] = !APP.favoritos[idF];
        render();
        if (APP.detalle && APP.detalle.id === idF) actualizarAccionesDetalle();
        mostrarAviso(APP.favoritos[idF] ? 'Añadida a favoritas' : 'Quitada de favoritas');
        return;
      }

      var det = objetivo.closest('[data-detalle]');
      if (det) { abrirDetalle(det.getAttribute('data-detalle'), true); return; }

      var marc = objetivo.closest('[data-marcador]');
      if (marc) { abrirDetalle(marc.getAttribute('data-marcador')); return; }
    });
  }

  function arrancar() {
    /* Ubicación de cabecera con la provincia seleccionada y cursor de paginación */
    $('#ubicacionTexto').textContent = F.provinciaNombre(APP.prov) || 'Madrid';
    APP.visibles = APP.pageSize === 0 ? 0 : APP.pageSize;

    montarMapa();
    rellenarFiltros();
    sincronizarControlesFiltros();
    conectarSheets();
    conectarFiltros();
    conectarDetalle();
    conectarGrafica();
    conectarChat();
    conectarAjustes();
    conectarNav();
    conectarListaYMapa();
    pintarPills();
    pintarChat();
    pintarAjustes();
    marcarNav('lista');

    /* Arranque con carga honesta: primero los skeletons */
    $('#cargandoLista').hidden = false;
    window.setTimeout(function () {
      $('#cargandoLista').hidden = true;
      render();
    }, 420);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', arrancar);
  } else {
    arrancar();
  }

  /* Pequeña API para depurar desde la consola o desde Playwright */
  window.PROTO3 = {
    APP: APP,
    render: render,
    filtrar: filtrar,
    abrirDetalle: abrirDetalle,
    abrirSheet: abrirSheet,
    cerrarSheet: cerrarSheet,
    irA: irA,
    mostrarAviso: mostrarAviso
  };
})();
