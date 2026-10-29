/* ============================================================================
 * Prototipo 4 · «Modo noche / carretera» — lógica
 * ============================================================================
 * Script clásico (sin módulos) para poder abrir index.html por file://.
 * TODOS los datos salen de window.FAKE (../shared/datos-fake.js).
 *
 * Ideas de diseño que se reflejan en el código:
 *  - Todo se lee en tres niveles: precio (lo más grande), estación, contexto.
 *  - El "delta del día" se calcula con FAKE.historico(id, fuel, 2): la propia
 *    API del histórico da dos jornadas y la diferencia es la subida/bajada.
 *  - El carrusel del HUD toma las 12 estaciones MÁS CERCANAS y las ordena por
 *    precio: así "deslizar" avanza por lo cercano empezando por lo barato.
 *  - Modo conducción: no oculta el mapa, solo deja mapa + precio gigante + 3
 *    acciones (Ir / Favorito / Salir). Nada de filtros ni resumen.
 * ========================================================================== */
(function () {
  'use strict';

  var FAKE = window.FAKE;
  if (!FAKE) {
    document.body.innerHTML = '<p style="padding:24px;font:16px system-ui;color:#e8eef5;background:#0b0f14">' +
      'No se han podido cargar los datos de ejemplo (shared/datos-fake.js).</p>';
    return;
  }

  /* ─────────────────────────── Constantes ─────────────────────────── */

  var COMBUSTIBLES = FAKE.combustiblesVisibles.slice();   // 6 habituales
  var DIAS_OPCIONES = [7, 14, 21, 30, 60, 90, 180];

  var PROVEEDORES = [
    { id: 'general',      label: 'General',        modelo: 'todos los proveedores', listo: true },
    { id: 'groq',         label: 'Groq',           modelo: 'qwen/qwen3.8-27b',       listo: true },
    { id: 'mistral',      label: 'Mistral',        modelo: 'open-mistral-nemo',      listo: true },
    { id: 'openrouter',   label: 'OpenRouter',     modelo: 'nemotron-3-ultra:free',  listo: true },
    { id: 'llm7',         label: 'LLM7.io',        modelo: 'codestral-latest',       listo: true },
    { id: 'nvidia',       label: 'NVIDIA',         modelo: 'nemotron-3-ultra-550b',  listo: false },
    { id: 'google',       label: 'Google Gemini',  modelo: 'gemini-3.8-flash',       listo: true },
    { id: 'chrome-nano',  label: 'Chrome IA',      modelo: 'Gemini Nano',            listo: false }
  ];

  var ICONO_ESTRELLA =
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round">' +
    '<path d="M12 3.6 14.6 9l6 .9-4.3 4.2 1 6-5.3-2.8L6.7 20l1-6L3.4 9.9l6-.9z"/></svg>';
  var ICONO_LUNA =
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round">' +
    '<path d="M20 14.5A8 8 0 0 1 9.5 4 8 8 0 1 0 20 14.5z"/></svg>';
  var ICONO_SOL =
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round">' +
    '<circle cx="12" cy="12" r="4"/><path d="M12 2.5v2.5M12 19v2.5M2.5 12H5M19 12h2.5M5.3 5.3l1.8 1.8M16.9 16.9l1.8 1.8M18.7 5.3l-1.8 1.8M7.1 16.9l-1.8 1.8"/></svg>';

  /* ─────────────────────────── Estado ─────────────────────────── */

  var ESTADO = {
    vista: 'mapa',
    provincia: '28',
    localidad: '',
    combustible: 'Gasolina 95 E5',
    marcas: [],
    distMax: 0,
    soloFavoritos: false,
    busqueda: '',
    orden: 'precio',
    aplicarDescuentos: false,
    favoritos: {},
    tema: 'oscuro',
    conduccion: false,
    hudIdx: 0,
    pageSize: FAKE.config.pageSize,
    visibles: FAKE.config.pageSize,
    detalleId: null,
    detalleComb: null,
    detalleDias: 30,
    iaProv: 'general',
    iaHilo: {},
    descuentos: {},
    prompts: FAKE.prompts.slice(),
    provVisibles: {},
    claves: {}
  };

  /* Favoritas iniciales: las que trae el dato compartido (fav: true) */
  FAKE.estaciones.forEach(function (e) { if (e.fav) ESTADO.favoritos[e.id] = true; });

  /* Descuentos y visibilidad de proveedores como copias editables */
  Object.keys(FAKE.descuentos).forEach(function (m) { ESTADO.descuentos[m] = FAKE.descuentos[m]; });
  PROVEEDORES.forEach(function (p) { if (p.id !== 'general') ESTADO.provVisibles[p.id] = true; });

  /* Cachés de trabajo (se recalculan en cada filtrado) */
  var CACHE = { lista: [], hud: [] };

  /* Vista del mapa fake (pan/zoom) */
  var MAPA = { z: 1, x: 0, y: 0 };

  /* ─────────────────────────── Utilidades ─────────────────────────── */

  function $(sel, raiz) { return (raiz || document).querySelector(sel); }
  function $$(sel, raiz) { return Array.prototype.slice.call((raiz || document).querySelectorAll(sel)); }

  function escapa(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }
  function normaliza(s) {
    return String(s == null ? '' : s).toLowerCase()
      .normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  }
  function num3(p) { return p == null ? '—' : p.toFixed(3).replace('.', ','); }
  function eur(p) { return p == null ? '—' : p.toFixed(3).replace('.', ',') + ' €'; }
  function km(d) { return d.toFixed(1).replace('.', ',') + ' km'; }
  function pct(v) { return (v > 0 ? '+' : '') + v.toFixed(1).replace('.', ',') + ' %'; }

  function leerLS(k) { try { return window.localStorage.getItem(k); } catch (e) { return null; } }
  function escribirLS(k, v) { try { window.localStorage.setItem(k, v); } catch (e) { /* file:// sin storage */ } }

  var AVISO_TIMER = null;
  function mostrarAviso(txt, tipo) {
    var caja = $('#avisos');
    if (!caja) return;
    var d = document.createElement('div');
    d.className = 'aviso' + (tipo === 'ok' ? ' aviso-alto ok' : '');
    if (tipo === 'ok') d.classList.add('ok');
    d.textContent = txt;
    caja.appendChild(d);
    window.clearTimeout(AVISO_TIMER);
    AVISO_TIMER = window.setTimeout(function () {
      if (d.parentNode) d.parentNode.removeChild(d);
    }, 2600);
  }
  function mostrarCarga(on) { var c = $('#cargando'); if (c) c.hidden = !on; }

  /* ─────────────────────────── Consultas sobre FAKE ─────────────────────────── */

  function buscarEstacion(id) {
    return FAKE.estaciones.find(function (e) { return e.id === id; }) || null;
  }
  function esFavorita(id) { return !!ESTADO.favoritos[id]; }

  function precioMostrado(est, comb) {
    return ESTADO.aplicarDescuentos
      ? FAKE.precioConDescuento(est, comb)
      : FAKE.precioDe(est, comb);
  }
  function colorDe(p) { return 'var(--cv-' + FAKE.colorPrecio(p) + ')'; }

  /** Delta del día a partir de las dos últimas jornadas del histórico */
  function deltaDia(est, comb) {
    var s = FAKE.historico(est.id, comb, 2);
    if (!s || s.length < 2) return 0;
    return Math.round((s[1].precio - s[0].precio) * 1000) / 1000;
  }
  function claseDelta(d) { return d > 0.0004 ? 'sube' : (d < -0.0004 ? 'baja' : 'igual'); }
  function textoDelta(d) {
    if (Math.abs(d) < 0.0004) return '= sin cambios';
    return (d > 0 ? '▲ ' : '▼ ') + Math.abs(d).toFixed(3).replace('.', ',') + ' €';
  }

  /** Combustibles que vende de verdad una estación, en orden canónico */
  function combustiblesDe(est) {
    return COMBUSTIBLES.filter(function (c) { return est.precios[c] != null; });
  }

  /* ─────────────────────────── Filtrado y orden ─────────────────────────── */

  function soloFavoritosActivo() { return ESTADO.soloFavoritos || ESTADO.vista === 'favoritas'; }

  function estacionesFiltradas() {
    var q = ESTADO.busqueda ? normaliza(ESTADO.busqueda) : '';
    return FAKE.estacionesDe(ESTADO.provincia).filter(function (e) {
      if (ESTADO.localidad && e.localidad !== ESTADO.localidad) return false;
      if (FAKE.precioDe(e, ESTADO.combustible) == null) return false;
      if (ESTADO.marcas.length && ESTADO.marcas.indexOf(e.marca) < 0) return false;
      if (ESTADO.distMax > 0 && e.dist > ESTADO.distMax) return false;
      if (soloFavoritosActivo() && !esFavorita(e.id)) return false;
      if (q && normaliza(e.marca + ' ' + e.nombre + ' ' + e.localidad + ' ' + e.direccion).indexOf(q) < 0) return false;
      return true;
    });
  }

  function ordenarLista(lista) {
    var copia = lista.slice();
    var dir = ESTADO.orden === 'precio' ? 1 : 1;
    copia.sort(function (a, b) {
      var r = 0;
      if (ESTADO.orden === 'precio') {
        r = (precioMostrado(a, ESTADO.combustible) || 0) - (precioMostrado(b, ESTADO.combustible) || 0);
      } else if (ESTADO.orden === 'distancia') {
        r = a.dist - b.dist;
      } else {
        r = a.marca.localeCompare(b.marca, 'es');
      }
      if (r === 0) r = a.dist - b.dist;   // desempate estable por cercanía
      return r * dir;
    });
    return copia;
  }

  /** Recalcula lista filtrada + carrusel del HUD */
  function refiltrar() {
    CACHE.lista = ordenarLista(estacionesFiltradas());
    var cercanas = CACHE.lista.slice().sort(function (a, b) { return a.dist - b.dist; }).slice(0, 12);
    CACHE.hud = cercanas.sort(function (a, b) {
      return (precioMostrado(a, ESTADO.combustible) || 0) - (precioMostrado(b, ESTADO.combustible) || 0);
    });
    if (ESTADO.hudIdx >= CACHE.hud.length) ESTADO.hudIdx = 0;
    if (ESTADO.pageSize && ESTADO.visibles < ESTADO.pageSize) ESTADO.visibles = ESTADO.pageSize;
  }

  /* ─────────────────────────── Referencias DOM ─────────────────────────── */

  var el = {};
  function cachearElementos() {
    [
      'app', 'cabProvincia', 'cabResumen', 'btnFiltros', 'filtrosBadge', 'btnTema', 'iconoTema',
      'btnConduccion', 'panelFiltros', 'pfCerrar', 'selProv', 'selLocalidad', 'selCombustible',
      'marcasCount', 'btnMarcas', 'marcasLista', 'marcasTodas', 'marcasNinguna', 'marcasChecks',
      'rngDist', 'distValor', 'chkFavoritos', 'inpBusqueda', 'selOrden', 'btnLimpiar',
      'btnAplicarFiltros', 'rsNum', 'rsMedia', 'rsBarata', 'lista', 'listaPie', 'mapa', 'mapaCapa',
      'mapaSvg', 'marcadores', 'mapaMas', 'mapaMenos', 'mapaCentrar', 'hud', 'cdHud', 'iaPills',
      'iaHilo', 'iaPrompts', 'iaForm', 'iaInput', 'swTema', 'swConduccion', 'swDescuentos',
      'selPagina', 'selOrdenDef', 'discList', 'discMarca', 'discValor', 'discAdd', 'cacheIdb',
      'cacheLs', 'cacheTtl', 'btnLimpiarCache', 'logApi', 'logPush', 'swPushBajada', 'swPushSubida',
      'pushIntervalo', 'pushDias', 'pushProbar', 'iaPass', 'iaCargar', 'iaPassEstado', 'iaClaves',
      'provVisibles', 'listaPrompts', 'versionApp', 'btnBuscarAct', 'estadoAct', 'velo', 'detalle',
      'detCerrar', 'detMarca', 'detDir', 'detFav', 'detCombLbl', 'detPrecio', 'detDelta', 'detMin',
      'detMax', 'detDist', 'detHorario', 'detCombSel', 'detDiasSel', 'detGrafica', 'detTabla',
      'detIr', 'detFav2', 'conduccionAcciones', 'cdIr', 'cdFav', 'cdSalir', 'btnIaFlotante'
    ].forEach(function (id) { el[id] = document.getElementById(id); });
  }

  /* ─────────────────────────── Cabecera y resumen ─────────────────────────── */

  function renderCabecera() {
    el.cabProvincia.textContent = FAKE.provinciaNombre(ESTADO.provincia) || 'España';
    var media = FAKE.mediaProvincia(ESTADO.provincia, ESTADO.combustible);
    var total = CACHE.lista.length;
    el.cabResumen.textContent = total + ' estaciones · ' + ESTADO.combustible +
      (media != null ? ' · media ' + eur(media) : '');

    var n = 0;
    if (ESTADO.localidad) n++;
    if (ESTADO.marcas.length) n++;
    if (ESTADO.distMax > 0) n++;
    if (ESTADO.soloFavoritos) n++;
    if (ESTADO.busqueda) n++;
    if (ESTADO.combustible !== 'Gasolina 95 E5') n++;
    el.filtrosBadge.hidden = n === 0;
    el.filtrosBadge.textContent = String(n);
  }

  function renderResumen() {
    var lista = CACHE.lista;
    el.rsNum.textContent = String(lista.length);
    var precios = lista.map(function (e) { return precioMostrado(e, ESTADO.combustible); })
      .filter(function (v) { return v != null; });
    if (!precios.length) {
      el.rsMedia.textContent = '—';
      el.rsBarata.textContent = '—';
      return;
    }
    var media = precios.reduce(function (a, b) { return a + b; }, 0) / precios.length;
    var min = Math.min.apply(null, precios);
    el.rsMedia.textContent = num3(media);
    el.rsBarata.textContent = num3(min);
    el.rsBarata.style.color = colorDe(min);
  }

  /* ─────────────────────────── Vista lista ─────────────────────────── */

  function filaHTML(est) {
    var p = precioMostrado(est, ESTADO.combustible);
    var d = deltaDia(est, ESTADO.combustible);
    var fav = esFavorita(est.id);
    return '<div class="fila" data-id="' + est.id + '" role="button" tabindex="0">' +
      '<div class="fila-izq">' +
        '<span class="fila-marca">' + escapa(est.marca) + (fav ? ' <span class="ambar">★</span>' : '') + '</span>' +
        '<span class="fila-sub">' + km(est.dist) + ' · ' + escapa(est.localidad) + ' · ' + escapa(est.horario) + '</span>' +
        '<span class="fila-delta ' + claseDelta(d) + '">' + textoDelta(d) + '</span>' +
      '</div>' +
      '<div class="fila-der">' +
        '<span class="fila-precio" style="color:' + colorDe(p) + '">' + num3(p) + '</span>' +
        '<span class="fila-unidad">€/L</span>' +
      '</div>' +
      '<button class="fila-fav' + (fav ? ' activa' : '') + '" data-fav="' + est.id + '" ' +
        'aria-label="' + (fav ? 'Quitar de favoritas' : 'Añadir a favoritas') + '">' + ICONO_ESTRELLA + '</button>' +
    '</div>';
  }

  function renderLista() {
    var lista = CACHE.lista;
    if (!lista.length) {
      el.lista.innerHTML = '<div class="vacio">' +
        '<h3>Ninguna estación coincide</h3>' +
        '<p>Prueba a ampliar la distancia, quitar marcas del filtro o desactivar «solo favoritas».</p>' +
        '<button class="btn-prim" id="btnVacioLimpiar" style="max-width:260px">Limpiar filtros</button>' +
      '</div>';
      el.listaPie.innerHTML = '';
      return;
    }
    var visibles = ESTADO.pageSize ? lista.slice(0, ESTADO.visibles) : lista;
    el.lista.innerHTML = visibles.map(filaHTML).join('');

    if (ESTADO.pageSize && lista.length > visibles.length) {
      el.listaPie.innerHTML = '<button class="btn-sec" id="btnMas" style="max-width:280px">' +
        'Ver más (' + (lista.length - visibles.length) + ' restantes)</button>';
    } else {
      el.listaPie.innerHTML = '';
    }
  }

  /* ─────────────────────────── Mapa ─────────────────────────── */

  function svgMapa() {
    var m = FAKE.mapa, s = '';
    (m.manchas || []).forEach(function (r) {
      s += '<rect class="mancha" x="' + r.x + '" y="' + r.y + '" width="' + r.w + '" height="' + r.h + '" rx="1.6"></rect>';
    });
    if (m.agua) s += '<path class="agua" d="' + m.agua.d + '"></path>';
    (m.viales || []).forEach(function (v) {
      s += '<path class="vial" d="' + v.d + '" stroke-width="' + v.w + '"></path>';
    });
    return s;
  }

  function marcadorHTML(est) {
    var p = precioMostrado(est, ESTADO.combustible);
    var fav = esFavorita(est.id);
    return '<button class="marcador" data-id="' + est.id + '" ' +
      'style="left:' + est.mx + '%;top:' + est.my + '%;--col:' + colorDe(p) + '" ' +
      'title="' + escapa(est.nombre) + ' · ' + num3(p) + ' €/L">' +
      '<span>' + num3(p) + '</span>' +
      (fav ? '<svg class="m-estrella" viewBox="0 0 24 24"><path d="M12 3.6 14.6 9l6 .9-4.3 4.2 1 6-5.3-2.8L6.7 20l1-6L3.4 9.9l6-.9z"/></svg>' : '') +
    '</button>';
  }

  function tuPosHTML() {
    var t = FAKE.mapa.tuPosicion;
    return '<div class="tu-pos" style="left:' + t.mx + '%;top:' + t.my + '%" title="' + escapa(t.label) + '">' +
      '<span class="tp-punto"></span></div>';
  }

  function renderMapa() {
    el.mapaSvg.innerHTML = svgMapa();
    el.marcadores.innerHTML = CACHE.lista.map(marcadorHTML).join('') + tuPosHTML();
    marcarEstacionActiva();
  }

  /** Resalta en el mapa la estación que muestra el HUD */
  function marcarEstacionActiva() {
    var est = CACHE.hud[ESTADO.hudIdx];
    var id = est ? est.id : null;
    $$('.marcador', el.marcadores).forEach(function (m) {
      m.classList.toggle('activa', id != null && m.getAttribute('data-id') === id);
    });
  }

  /* ─────────────────────────── HUD (carrusel) ─────────────────────────── */

  function hudHTML(est, puntos) {
    var p = precioMostrado(est, ESTADO.combustible);
    var d = deltaDia(est, ESTADO.combustible);
    var fav = esFavorita(est.id);
    return '<div class="hud-carrusel">' +
      '<button class="hud-card" data-shot="detalle" data-id="' + est.id + '" ' +
        'aria-label="Ver detalle de ' + escapa(est.nombre) + '">' +
        '<div class="hud-info">' +
          '<span class="hud-marca">' + escapa(est.marca) + (fav ? ' <span class="ambar">★</span>' : '') +
            '<span class="hud-dist">' + km(est.dist) + '</span></span>' +
          '<span class="hud-nombre">' + escapa(est.nombre) + '</span>' +
          '<span class="hud-localidad">' + escapa(est.localidad) + ' · ' + escapa(est.horario) + '</span>' +
        '</div>' +
        '<div class="hud-precio-bloque">' +
          '<span class="hud-precio" style="color:' + colorDe(p) + '">' + num3(p) + '</span>' +
          '<span class="hud-delta ' + claseDelta(d) + '">' + textoDelta(d) + '</span>' +
        '</div>' +
      '</button>' +
      '<button class="hud-ir" data-ir="' + est.id + '">' +
        '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linejoin="round"><path d="M3 11 21 3l-8 18-2-8z"/></svg>' +
        'Ir</button>' +
    '</div>' + puntos;
  }

  function renderHUD() {
    var est = CACHE.hud[ESTADO.hudIdx];
    if (!est) {
      el.hud.innerHTML = '<div class="hud-carrusel"><div class="hud-info">' +
        '<span class="hud-marca">Sin estaciones</span>' +
        '<span class="hud-nombre">Ajusta los filtros para ver resultados</span></div></div>';
      el.cdHud.innerHTML = '';
      return;
    }
    /* Puntos del carrusel: ventana de 6 como máximo para que cada punto tenga
       un área táctil de 48 px sin desbordar en pantallas estrechas. */
    var maxPuntos = 6, nHud = CACHE.hud.length;
    var ini = nHud > maxPuntos
      ? Math.min(Math.max(0, ESTADO.hudIdx - Math.floor(maxPuntos / 2)), nHud - maxPuntos)
      : 0;
    var idxsPuntos = [];
    for (var kp = ini; kp < ini + Math.min(maxPuntos, nHud); kp++) idxsPuntos.push(kp);
    var puntos = '<div class="hud-puntos">' + idxsPuntos.map(function (i) {
      return '<button class="hud-punto' + (i === ESTADO.hudIdx ? ' on' : '') + '" data-punto="' + i + '" ' +
        'aria-label="Estación ' + (i + 1) + '"></button>';
    }).join('') + '</div>';

    el.hud.innerHTML = hudHTML(est, puntos);

    /* HUD gigante del modo conducción (mismo dato, otra escala) */
    var p = precioMostrado(est, ESTADO.combustible);
    var d = deltaDia(est, ESTADO.combustible);
    el.cdHud.innerHTML =
      '<div class="cd-marca">' + escapa(est.marca) + (esFavorita(est.id) ? ' ★' : '') + '</div>' +
      '<div class="cd-nombre">' + escapa(est.nombre) + '</div>' +
      '<div class="cd-linea">' +
        '<span class="cd-precio" style="color:' + colorDe(p) + '">' + num3(p) + '<small style="font-size:20px"> €/L</small></span>' +
        '<span class="cd-dist">' + km(est.dist) + '</span>' +
      '</div>' +
      '<div class="hud-delta ' + claseDelta(d) + '">' + textoDelta(d) + '</div>';

    enlazarHUD();
    marcarEstacionActiva();
  }

  function moverHUD(paso) {
    if (!CACHE.hud.length) return;
    ESTADO.hudIdx = (ESTADO.hudIdx + paso + CACHE.hud.length) % CACHE.hud.length;
    renderHUD();
  }
  function irAEstacionHUD(id) {
    var idx = CACHE.hud.map(function (e) { return e.id; }).indexOf(id);
    if (idx >= 0) { ESTADO.hudIdx = idx; renderHUD(); }
  }

  /** Deslizar el HUD (swipe) + puntos + botón Ir */
  function enlazarHUD() {
    var carrusel = $('.hud-carrusel', el.hud);
    if (carrusel) {
      var ini = null;
      carrusel.addEventListener('pointerdown', function (ev) {
        if (ev.target.closest('.hud-ir')) return;
        ini = { x: ev.clientX, y: ev.clientY };
      });
      carrusel.addEventListener('pointerup', function (ev) {
        if (!ini) return;
        var dx = ev.clientX - ini.x, dy = ev.clientY - ini.y;
        ini = null;
        if (Math.abs(dx) > 42 && Math.abs(dx) > Math.abs(dy)) moverHUD(dx < 0 ? 1 : -1);
      });
      carrusel.addEventListener('pointercancel', function () { ini = null; });
    }
  }

  /* ─────────────────────────── Gráfica SVG ─────────────────────────── */

  function formateaFecha(ddmmaaaa) { return String(ddmmaaaa).slice(0, 5); } // dd-mm

  /**
   * Dibuja una mini-gráfica SVG con rejilla, área, línea, min/máx y hover.
   * El viewBox es fijo (340×150) y el SVG escala al ancho del contenedor.
   */
  function pintarGrafica(cont, serie) {
    if (!serie || serie.length < 2) {
      cont.innerHTML = '<p class="aj-nota">Sin datos históricos para esta combinación.</p>';
      return;
    }
    var W = 340, H = 150, padX = 14, padT = 16, padB = 24;
    var n = serie.length;
    var vals = serie.map(function (s) { return s.precio; });
    var min = Math.min.apply(null, vals), max = Math.max.apply(null, vals);
    var span = (max - min) || 0.02;
    var y0 = min - span * 0.3, y1 = max + span * 0.3;

    function X(i) { return padX + (W - 2 * padX) * (n > 1 ? i / (n - 1) : 0); }
    function Y(v) { return H - padB - (H - padB - padT) * ((v - y0) / (y1 - y0)); }

    var pts = serie.map(function (s, i) { return X(i).toFixed(1) + ',' + Y(s.precio).toFixed(1); });
    var area = 'M' + X(0).toFixed(1) + ',' + (H - padB) + ' L' + pts.join(' L') +
      ' L' + X(n - 1).toFixed(1) + ',' + (H - padB) + ' Z';

    var iMin = vals.indexOf(min), iMax = vals.indexOf(max);

    var s = '<svg class="graf" viewBox="0 0 ' + W + ' ' + H + '" role="img" ' +
      'aria-label="Evolución del precio en ' + n + ' días">';

    /* Rejilla horizontal con etiquetas de precio (3 niveles) */
    [0, 0.5, 1].forEach(function (t) {
      var v = min + (max - min) * t;
      var y = Y(v);
      s += '<line class="g-rejilla" x1="' + padX + '" y1="' + y.toFixed(1) + '" x2="' + (W - padX) + '" y2="' + y.toFixed(1) + '"></line>';
      s += '<text class="g-txt" x="' + padX + '" y="' + (y - 3).toFixed(1) + '">' + num3(v) + '</text>';
    });

    s += '<path class="g-area" d="' + area + '"></path>';
    s += '<polyline class="g-linea" points="' + pts.join(' ') + '"></polyline>';

    /* Etiquetas de fecha: primera, media y última sin solaparse */
    var idxs = n > 2 ? [0, Math.floor((n - 1) / 2), n - 1] : [0, n - 1];
    idxs.forEach(function (i) {
      var anclaje = i === 0 ? 'start' : (i === n - 1 ? 'end' : 'middle');
      s += '<text class="g-txt" text-anchor="' + anclaje + '" x="' + X(i).toFixed(1) + '" y="' + (H - 7) + '">' +
        formateaFecha(serie[i].fecha) + '</text>';
    });

    /* Extremos y último punto: lectura inmediata de mín/máx */
    s += '<circle class="g-min" cx="' + X(iMin).toFixed(1) + '" cy="' + Y(min).toFixed(1) + '" r="3.4"></circle>';
    s += '<circle class="g-max" cx="' + X(iMax).toFixed(1) + '" cy="' + Y(max).toFixed(1) + '" r="3.4"></circle>';
    s += '<circle class="g-fin" cx="' + X(n - 1).toFixed(1) + '" cy="' + Y(serie[n - 1].precio).toFixed(1) + '" r="3"></circle>';
    s += '<line class="g-guia" x1="0" y1="0" x2="0" y2="0" style="display:none"></line>';
    s += '</svg>';
    s += '<div class="graf-tip"></div>';
    cont.innerHTML = s;

    /* Hover: guía vertical + recuadro con precio y fecha */
    var svg = $('.graf', cont), tip = $('.graf-tip', cont), guia = $('.g-guia', cont);
    var meta = { W: W, H: H, padX: padX, n: n };

    svg.addEventListener('pointermove', function (ev) {
      var r = svg.getBoundingClientRect();
      var rel = (ev.clientX - r.left) / r.width;
      var i = Math.round((rel * W - meta.padX) / (W - 2 * meta.padX) * (meta.n - 1));
      i = Math.max(0, Math.min(meta.n - 1, i));
      var px = X(i), py = Y(serie[i].precio);
      guia.setAttribute('x1', px); guia.setAttribute('x2', px);
      guia.setAttribute('y1', padT); guia.setAttribute('y2', H - padB);
      guia.style.display = '';
      tip.innerHTML = '<b>' + eur(serie[i].precio) + '</b> · ' + serie[i].fecha;
      tip.style.left = (px / W * r.width) + 'px';
      tip.style.top = (py / H * r.height) + 'px';
      tip.classList.add('on');
    });
    svg.addEventListener('pointerleave', function () {
      tip.classList.remove('on');
      guia.style.display = 'none';
    });
  }

  /* ─────────────────────────── Detalle ─────────────────────────── */

  function abrirDetalle(id) {
    var est = buscarEstacion(id);
    if (!est) return;
    ESTADO.detalleId = id;
    var combs = combustiblesDe(est);
    ESTADO.detalleComb = combs.indexOf(ESTADO.combustible) >= 0 ? ESTADO.combustible : combs[0];
    ESTADO.detalleDias = 30;
    renderDetalle();
    el.detalle.hidden = false;
    irAEstacionHUD(id);
  }
  function cerrarDetalle() { el.detalle.hidden = true; ESTADO.detalleId = null; }

  function renderDetalle() {
    var est = buscarEstacion(ESTADO.detalleId);
    if (!est) return;
    var comb = ESTADO.detalleComb;

    el.detMarca.textContent = est.marca;
    el.detDir.textContent = est.direccion + ' · ' + est.localidad + ' · ' + FAKE.provinciaNombre(est.prov);
    el.detCombLbl.textContent = comb;
    el.detDist.textContent = km(est.dist);
    el.detHorario.textContent = est.horario;

    var p = precioMostrado(est, comb);
    el.detPrecio.textContent = num3(p);
    el.detPrecio.style.color = colorDe(p);

    var d = deltaDia(est, comb);
    el.detDelta.textContent = textoDelta(d) + ' desde ayer';
    el.detDelta.className = 'det-delta ' + claseDelta(d);

    var serie30 = FAKE.historico(est.id, comb, 30);
    var v30 = serie30.map(function (s) { return s.precio; });
    el.detMin.textContent = num3(Math.min.apply(null, v30));
    el.detMax.textContent = num3(Math.max.apply(null, v30));

    /* Selector de combustible (solo los que vende) */
    el.detCombSel.innerHTML = combustiblesDe(est).map(function (c) {
      return '<option value="' + escapa(c) + '"' + (c === comb ? ' selected' : '') + '>' + escapa(c) + '</option>';
    }).join('');

    /* Selector de días */
    el.detDiasSel.innerHTML = DIAS_OPCIONES.map(function (dd) {
      return '<option value="' + dd + '"' + (dd === ESTADO.detalleDias ? ' selected' : '') + '>' + dd + ' días</option>';
    }).join('');

    pintarGrafica(el.detGrafica, FAKE.historico(est.id, comb, ESTADO.detalleDias));

    /* Tabla de todos los combustibles de la estación */
    el.detTabla.innerHTML = COMBUSTIBLES.map(function (c) {
      var pc = est.precios[c];
      if (pc == null) {
        return '<tr class="sin-precio"><td><span class="dt-comb"><span class="dt-punto" style="background:var(--cv-gris)"></span>' +
          escapa(c) + '</span></td><td class="dt-precio">—</td><td class="dt-delta">no disponible</td></tr>';
      }
      var pm = precioMostrado(est, c);
      var dc = deltaDia(est, c);
      return '<tr data-comb="' + escapa(c) + '"' + (c === comb ? ' class="on"' : '') + '>' +
        '<td><span class="dt-comb"><span class="dt-punto" style="background:' + colorDe(pm) + '"></span>' + escapa(c) + '</span></td>' +
        '<td class="dt-precio" style="color:' + colorDe(pm) + '">' + num3(pm) + '</td>' +
        '<td class="dt-delta ' + claseDelta(dc) + '">' + textoDelta(dc) + '</td></tr>';
    }).join('');

    actualizarFavoritoUI();
  }

  function actualizarFavoritoUI() {
    var fav = esFavorita(ESTADO.detalleId);
    el.detFav.classList.toggle('activa', fav);
    el.detFav.setAttribute('aria-pressed', fav ? 'true' : 'false');
    el.detFav2.classList.toggle('activo', fav);
    el.detFav2.innerHTML = ICONO_ESTRELLA + (fav ? 'Quitar de favoritas' : 'Añadir a favoritas');
  }

  /* ─────────────────────────── Favoritos ─────────────────────────── */

  function toggleFavorito(id) {
    if (ESTADO.favoritos[id]) delete ESTADO.favoritos[id];
    else ESTADO.favoritos[id] = true;
    var est = buscarEstacion(id);
    mostrarAviso((esFavorita(id) ? '★ Añadida: ' : '☆ Quitada: ') + (est ? est.nombre : id), 'ok');
    refiltrar();
    renderLista();
    renderMapa();
    renderHUD();
    if (ESTADO.detalleId === id) actualizarFavoritoUI();
  }

  /* ─────────────────────────── Panel de filtros ─────────────────────────── */

  function rellenarProveedorSelect() {
    el.selProv.innerHTML = FAKE.provincias.map(function (p) {
      return '<option value="' + p.id + '"' + (p.id === ESTADO.provincia ? ' selected' : '') + '>' +
        escapa(p.nombre) + '</option>';
    }).join('');
  }
  function rellenarLocalidades() {
    var locs = FAKE.localidadesDe(ESTADO.provincia);
    el.selLocalidad.innerHTML = '<option value="">Todas las localidades</option>' + locs.map(function (l) {
      return '<option value="' + escapa(l) + '"' + (l === ESTADO.localidad ? ' selected' : '') + '>' + escapa(l) + '</option>';
    }).join('');
  }
  function rellenarCombustibles() {
    el.selCombustible.innerHTML = COMBUSTIBLES.map(function (c) {
      return '<option value="' + escapa(c) + '"' + (c === ESTADO.combustible ? ' selected' : '') + '>' + escapa(c) + '</option>';
    }).join('');
  }
  function rellenarMarcas() {
    var marcas = FAKE.marcasDe(ESTADO.provincia);
    el.marcasChecks.innerHTML = marcas.map(function (m) {
      var on = ESTADO.marcas.indexOf(m) >= 0;
      return '<label class="chip-marca' + (on ? ' on' : '') + '">' +
        '<input type="checkbox" data-marca="' + escapa(m) + '"' + (on ? ' checked' : '') + '>' + escapa(m) + '</label>';
    }).join('');
    actualizarTextoMarcas();
  }
  function actualizarTextoMarcas() {
    el.marcasCount.textContent = ESTADO.marcas.length ? (ESTADO.marcas.length + ' marcadas') : 'todas';
    el.btnMarcas.firstChild.textContent = ESTADO.marcas.length ? 'Marcas (' + ESTADO.marcas.length + ') ' : 'Elegir marcas ';
  }
  function rellenarDistancia() {
    var max = FAKE.estacionesDe(ESTADO.provincia).reduce(function (a, e) { return Math.max(a, e.dist); }, 10);
    el.rngDist.max = String(Math.ceil(max));
    el.rngDist.value = String(ESTADO.distMax);
    actualizarTextoDistancia();
  }
  function actualizarTextoDistancia() {
    el.distValor.textContent = ESTADO.distMax > 0 ? ('≤ ' + ESTADO.distMax + ' km') : 'sin límite';
  }

  function aplicarFiltros(resetPagina) {
    if (resetPagina !== false) ESTADO.visibles = ESTADO.pageSize;
    refiltrar();
    renderCabecera();
    renderResumen();
    renderLista();
    renderMapa();
    renderHUD();
  }

  function limpiarFiltros() {
    ESTADO.localidad = '';
    ESTADO.marcas = [];
    ESTADO.distMax = 0;
    ESTADO.soloFavoritos = false;
    ESTADO.busqueda = '';
    ESTADO.orden = 'precio';
    el.selLocalidad.value = '';
    el.selOrden.value = 'precio';
    el.chkFavoritos.checked = false;
    el.inpBusqueda.value = '';
    el.rngDist.value = '0';
    rellenarMarcas();
    rellenarDistancia();
    aplicarFiltros();
    mostrarAviso('Filtros restablecidos');
  }

  function abrirFiltros(on) {
    document.body.classList.toggle('filtros-abiertos', on);
    el.btnFiltros.setAttribute('aria-expanded', on ? 'true' : 'false');
    el.velo.hidden = !on;
  }

  /* ─────────────────────────── Vistas ─────────────────────────── */

  function setVista(v) {
    ESTADO.vista = v;
    document.body.setAttribute('data-vista', v);
    $$('.dock-btn').forEach(function (b) { b.classList.toggle('activa', b.getAttribute('data-vista') === v); });
    abrirFiltros(false);
    if (v === 'ia') renderIA();
    if (v === 'ajustes') renderAjustes();
    if (v === 'mapa' || v === 'lista' || v === 'favoritas') aplicarFiltros();
    if (v === 'mapa') MAPA0();
  }
  function MAPA0() { /* placeholder para forzar reflow del mapa en móvil */ }

  /* ─────────────────────────── Tema y modo conducción ─────────────────────────── */

  function aplicarTema() {
    var claro = ESTADO.tema === 'claro';
    document.body.classList.toggle('tema-claro', claro);
    document.body.classList.toggle('tema-oscuro', !claro);
    el.iconoTema.innerHTML = claro ? ICONO_SOL : ICONO_LUNA;
    el.swTema.checked = claro;
    var meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute('content', claro ? '#eef2f6' : '#0b0f14');
    escribirLS('gp4_tema', ESTADO.tema);
  }
  function setTema(t) { ESTADO.tema = t; aplicarTema(); renderMapa(); }

  function setConduccion(on) {
    ESTADO.conduccion = !!on;
    document.body.classList.toggle('modo-conduccion', ESTADO.conduccion);
    el.conduccionAcciones.hidden = !ESTADO.conduccion;
    el.swConduccion.checked = ESTADO.conduccion;
    if (ESTADO.conduccion) setVista('mapa');
    renderHUD();
    if (ESTADO.conduccion) mostrarAviso('Modo conducción: toca «Salir» para volver');
  }

  /* ─────────────────────────── IA ─────────────────────────── */

  function hiloDe(id) {
    if (!ESTADO.iaHilo[id]) {
      ESTADO.iaHilo[id] = (FAKE.chatsIA[id] || []).map(function (m) {
        return { role: m.role, content: m.content };
      });
    }
    return ESTADO.iaHilo[id];
  }

  function proveedoresVisibles() {
    return PROVEEDORES.filter(function (p) { return p.id === 'general' || ESTADO.provVisibles[p.id]; });
  }

  function renderIA() {
    el.iaPills.innerHTML = proveedoresVisibles().map(function (p) {
      return '<button class="pill' + (p.id === ESTADO.iaProv ? ' on' : '') + '" data-prov="' + p.id + '" role="tab" ' +
        'aria-selected="' + (p.id === ESTADO.iaProv ? 'true' : 'false') + '">' +
        '<span class="punto-estado' + (p.listo ? '' : ' no') + '"></span>' + escapa(p.label) + '</button>';
    }).join('');

    if (!proveedoresVisibles().some(function (p) { return p.id === ESTADO.iaProv; })) ESTADO.iaProv = 'general';
    renderHilo();
    renderPromptsRapidos();
  }

  function modeloDe(id) {
    var p = PROVEEDORES.filter(function (x) { return x.id === id; })[0];
    return p ? p.modelo : 'modelo';
  }

  function burbuja(role, contenido, meta) {
    var d = document.createElement('div');
    d.className = 'msg ' + role;
    if (role === 'assistant') {
      d.innerHTML = '<div class="mark">' + mdAI(contenido) + '</div>' +
        (meta ? '<div class="ia-meta">' + escapa(meta) + '</div>' : '');
    } else {
      d.textContent = contenido;
    }
    return d;
  }

  function renderHilo() {
    var hilo = hiloDe(ESTADO.iaProv);
    el.iaHilo.innerHTML = '';
    if (!hilo.length) {
      var v = document.createElement('div');
      v.className = 'vacio';
      v.innerHTML = '<h3>Pregunta lo que quieras</h3><p>El asistente conoce tus filtros activos, la media provincial y el histórico de precios.</p>';
      el.iaHilo.appendChild(v);
      return;
    }
    hilo.forEach(function (m) {
      el.iaHilo.appendChild(burbuja(m.role, m.content,
        m.role === 'assistant' ? ('⏱ ' + (m.modelo || modeloDe(ESTADO.iaProv)) + ' · ' + (m.tiempo || '1,2 s')) : ''));
    });
    el.iaHilo.scrollTop = el.iaHilo.scrollHeight;
  }

  function renderPromptsRapidos() {
    var visibles = ESTADO.prompts.filter(function (p) { return p && p.trim(); });
    el.iaPrompts.innerHTML = visibles.map(function (p) {
      return '<button class="prompt-btn" data-prompt="' + escapa(p) + '">' + escapa(p) + '</button>';
    }).join('');
  }

  /** Respuesta simulada construida con los datos reales de FAKE */
  function respuestaSimulada() {
    var listo = CACHE.lista;
    var prov = FAKE.provinciaNombre(ESTADO.provincia);
    var media = FAKE.mediaProvincia(ESTADO.provincia, ESTADO.combustible);
    var top = listo.slice(0, 3);
    var out = '### ' + escapa(ESTADO.combustible) + ' en ' + escapa(prov) + '\n\n';
    out += 'Con los filtros activos hay **' + listo.length + ' estaciones**. ';
    if (media != null) out += 'La media provincial está en **' + eur(media) + '**.\n\n';
    if (top.length) {
      out += '| Estación | Precio | Distancia |\n|---|---|---|\n';
      top.forEach(function (e) {
        var pm = precioMostrado(e, ESTADO.combustible);
        out += '| ' + e.marca + ' ' + e.localidad + ' | ' + eur(pm) + ' | ' + km(e.dist) + ' |\n';
      });
      out += '\n';
      var primera = top[0];
      var d = deltaDia(primera, ESTADO.combustible);
      out += '- Más barata: **' + escapa(primera.nombre) + '** (' + eur(precioMostrado(primera, ESTADO.combustible)) + ')\n';
      out += '- Su delta de hoy: **' + textoDelta(d) + '**\n';
      out += '- Favoritas entre los resultados: **' + listo.filter(function (e) { return esFavorita(e.id); }).length + '**\n';
    } else {
      out += '_No hay estaciones con estos filtros; prueba a ampliar la distancia._\n';
    }
    return out;
  }

  function enviarIA(texto) {
    var t = String(texto || '').trim();
    if (!t) return;
    var hilo = hiloDe(ESTADO.iaProv);
    hilo.push({ role: 'user', content: t });
    el.iaHilo.appendChild(burbuja('user', t));
    el.iaInput.value = '';
    el.iaHilo.scrollTop = el.iaHilo.scrollHeight;

    var carga = document.createElement('div');
    carga.className = 'msg assistant cargando-msg';
    carga.innerHTML = '<span class="puntito"></span><span class="puntito"></span><span class="puntito"></span>';
    el.iaHilo.appendChild(carga);
    el.iaHilo.scrollTop = el.iaHilo.scrollHeight;

    var reducido = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    window.setTimeout(function () {
      if (carga.parentNode) carga.parentNode.removeChild(carga);
      var respuesta = respuestaSimulada();
      var tiempo = (0.8 + Math.random() * 1.4).toFixed(1).replace('.', ',') + ' s';
      hilo.push({ role: 'assistant', content: respuesta, modelo: modeloDe(ESTADO.iaProv), tiempo: tiempo });
      el.iaHilo.appendChild(burbuja('assistant', respuesta, '⏱ ' + modeloDe(ESTADO.iaProv) + ' · ' + tiempo));
      el.iaHilo.scrollTop = el.iaHilo.scrollHeight;
    }, reducido ? 60 : 520);
  }

  /* --- Markdown mínimo (mismo espíritu que renderAiMarkdown de la app) --- */
  function celdasTabla(l) {
    var s = l.trim();
    if (s.charAt(0) === '|') s = s.slice(1);
    if (s.charAt(s.length - 1) === '|') s = s.slice(0, -1);
    return s.split('|').map(function (c) { return c.trim(); });
  }
  function mdAI(texto) {
    var lineas = String(texto == null ? '' : texto).replace(/\r\n?/g, '\n').split('\n');
    var out = [], parr = [], i = 0;

    function cerrarParr() {
      if (parr.length) { out.push('<p>' + parr.join('<br>') + '</p>'); parr = []; }
    }
    function enLinea(s) {
      s = escapa(s);
      s = s.replace(/`([^`]+)`/g, '<code>$1</code>');
      s = s.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
      s = s.replace(/__([^_]+)__/g, '<strong>$1</strong>');
      s = s.replace(/(^|[\s(])\*([^*\s][^*]*?)\*(?=[\s).,;:!?]|$)/g, '$1<em>$2</em>');
      s = s.replace(/(^|[\s(])_([^_\s][^_]*?)_(?=[\s).,;:!?]|$)/g, '$1<em>$2</em>');
      s = s.replace(/\[([^\]]+)\]\((https?:[^)\s]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>');
      s = s.replace(/(^|[\s>])(https?:\/\/[^\s<"]+)/g, '$1<a href="$2" target="_blank" rel="noopener">$2</a>');
      return s;
    }

    while (i < lineas.length) {
      var l = lineas[i], t = l.trim();

      if (t === '') { cerrarParr(); i++; continue; }

      if (/^```/.test(t)) {
        cerrarParr();
        var buf = []; i++;
        while (i < lineas.length && !/^```/.test(lineas[i].trim())) { buf.push(lineas[i]); i++; }
        if (i < lineas.length) i++;
        out.push('<pre class="md-pre"><code>' + escapa(buf.join('\n')) + '</code></pre>');
        continue;
      }

      if (l.indexOf('|') >= 0 && i + 1 < lineas.length &&
          /\|/.test(lineas[i + 1]) && /-/.test(lineas[i + 1]) &&
          /^\s*\|?[\s:|-]*\|[\s:|-]*$/.test(lineas[i + 1])) {
        cerrarParr();
        var cab = celdasTabla(l), filas = [];
        i += 2;
        while (i < lineas.length && lineas[i].indexOf('|') >= 0 && lineas[i].trim() !== '') {
          filas.push(celdasTabla(lineas[i])); i++;
        }
        out.push('<table class="md-tabla"><thead><tr>' +
          cab.map(function (c) { return '<th>' + enLinea(c) + '</th>'; }).join('') + '</tr></thead><tbody>' +
          filas.map(function (f) {
            return '<tr>' + f.map(function (c) { return '<td>' + enLinea(c) + '</td>'; }).join('') + '</tr>';
          }).join('') + '</tbody></table>');
        continue;
      }

      var h = /^(#{1,4})\s+(.*)$/.exec(t);
      if (h) { cerrarParr(); out.push('<div class="md-h md-h' + h[1].length + '">' + enLinea(h[2]) + '</div>'); i++; continue; }

      if (/^-{3,}$/.test(t)) { cerrarParr(); out.push('<hr class="md-hr">'); i++; continue; }

      if (/^\s*>\s?/.test(l)) { cerrarParr(); out.push('<div class="md-cita">' + enLinea(l.replace(/^\s*>\s?/, '')) + '</div>'); i++; continue; }

      if (/^\s*[-*]\s+/.test(l)) {
        cerrarParr();
        var items = [];
        while (i < lineas.length && /^\s*[-*]\s+/.test(lineas[i])) {
          items.push('<li>' + enLinea(lineas[i].replace(/^\s*[-*]\s+/, '')) + '</li>'); i++;
        }
        out.push('<ul>' + items.join('') + '</ul>');
        continue;
      }

      if (/^\s*\d+[.)]\s+/.test(l)) {
        cerrarParr();
        var its = [];
        while (i < lineas.length && /^\s*\d+[.)]\s+/.test(lineas[i])) {
          its.push('<li>' + enLinea(lineas[i].replace(/^\s*\d+[.)]\s+/, '')) + '</li>'); i++;
        }
        out.push('<ol>' + its.join('') + '</ol>');
        continue;
      }

      parr.push(enLinea(l));
      i++;
    }
    cerrarParr();
    return out.join('');
  }

  /* ─────────────────────────── Ajustes ─────────────────────────── */

  function renderAjustes() {
    el.swTema.checked = ESTADO.tema === 'claro';
    el.swConduccion.checked = ESTADO.conduccion;
    el.swDescuentos.checked = ESTADO.aplicarDescuentos;
    el.selPagina.innerHTML = FAKE.config.paginas.map(function (n) {
      var lbl = n === 0 ? 'Todos' : String(n);
      return '<option value="' + n + '"' + (n === ESTADO.pageSize ? ' selected' : '') + '>' + lbl + '</option>';
    }).join('');
    el.selOrdenDef.value = ESTADO.orden;
    renderDescuentos();
    renderCache();
    renderLogs();
    renderProvVisibles();
    renderPromptsConfig();
    renderClaves();
    el.versionApp.textContent = FAKE.versionApp.texto;
    el.cacheTtl.value = String(FAKE.config.cacheTtl);
    el.pushIntervalo.value = String(FAKE.config.checkInterval);
    el.pushDias.value = String(FAKE.config.priceFallDays);
  }

  function renderDescuentos() {
    var marcas = Object.keys(ESTADO.descuentos);
    el.discList.innerHTML = marcas.length ? marcas.map(function (m) {
      return '<div class="disc-fila">' +
        '<span class="df-marca">' + escapa(m) + '</span>' +
        '<input type="number" step="0.005" min="0" max="1" value="' + ESTADO.descuentos[m].toFixed(3) +
          '" data-disc="' + escapa(m) + '" aria-label="Descuento de ' + escapa(m) + '">' +
        '<button data-quitar-disc="' + escapa(m) + '" aria-label="Quitar ' + escapa(m) + '">✕</button>' +
      '</div>';
    }).join('') : '<p class="aj-nota">Sin descuentos configurados.</p>';
    el.discMarca.innerHTML = FAKE.marcas.filter(function (m) { return !ESTADO.descuentos[m]; }).map(function (m) {
      return '<option value="' + escapa(m) + '">' + escapa(m) + '</option>';
    }).join('');
  }

  function renderCache() {
    var c = FAKE.cacheInfo;
    el.cacheIdb.innerHTML =
      '<div class="cache-lista">' +
      filaCache('Base de datos', c.idb) +
      filaCache('Provincias guardadas', String(c.provincias)) +
      filaCache('Gasolineras cacheadas', String(c.gasolineras)) +
      filaCache('Días de histórico', String(c.historicoDias)) +
      filaCache('Última actualización', c.ultimaActualizacion) +
      '</div>';
    /* Claves de localStorage de ejemplo (en la app real son las gasolineras_*) */
    var claves = [
      'gasolineras_prov_filters_28', 'gasolineras_api_log', 'gasolineras_push_log',
      'gasolineras_ai_last_models', 'gasolineras_ai_chat_general', 'gasolineras_ai_chat_groq',
      'gasolineras_ai_hidden_providers', 'gasolineras_descuentos', 'gasolineras_page_size',
      'gasolineras_push_config', 'gasolineras_cache_ttl', 'gasolineras_last_prov',
      'gasolineras_theme', 'gasolineras_ai_key_google', 'gasolineras_ai_key_groq',
      'gasolineras_ai_key_mistral', 'gasolineras_ai_key_openrouter', 'gasolineras_ai_nvidia_proxy'
    ];
    el.cacheLs.innerHTML = '<div class="cache-lista"><div class="cache-fila"><span>Claves</span><span>' +
      c.lsClaves + '</span></div></div><div>' + claves.map(function (k) {
        return '<div class="ls-clave"><span>' + escapa(k) + '</span>' +
          '<button data-quitar-ls="' + escapa(k) + '" aria-label="Borrar ' + escapa(k) + '">✕</button></div>';
      }).join('') + '</div>';
  }
  function filaCache(a, b) {
    return '<div class="cache-fila"><span>' + escapa(a) + '</span><span>' + escapa(b) + '</span></div>';
  }

  function renderLogs() {
    el.logApi.innerHTML = FAKE.logApi.map(function (r) {
      var ok = r.estado === 200;
      return '<div class="log-fila"><span class="lg-t">' + escapa(r.t) + '</span>' +
        '<span class="lg-u">' + escapa(r.url) + '</span>' +
        '<span class="lg-e ' + (ok ? 'ok' : 'err') + '">' + r.estado + '</span>' +
        '<span class="lg-m">' + r.ms + ' ms</span></div>';
    }).join('');
    el.logPush.innerHTML = FAKE.logPush.map(function (r) {
      return '<div class="log-fila"><span class="lg-t">' + escapa(r.t) + '</span>' +
        '<span class="lg-u">' + escapa(r.url) + '</span>' +
        '<span class="lg-e ok">' + escapa(r.estado) + '</span>' +
        '<span class="lg-m">' + r.ms + ' ms</span></div>';
    }).join('');
  }

  function renderProvVisibles() {
    el.provVisibles.innerHTML = PROVEEDORES.filter(function (p) { return p.id !== 'general'; }).map(function (p) {
      var on = !!ESTADO.provVisibles[p.id];
      return '<label class="switch-linea" style="min-height:48px">' +
        '<input type="checkbox" data-prov-vis="' + p.id + '"' + (on ? ' checked' : '') + '>' +
        '<span class="switch-ui" style="width:44px;height:26px"></span>' +
        '<span class="switch-txt" style="font-size:14px">' + escapa(p.label) + '</span></label>';
    }).join('');
  }

  function renderPromptsConfig() {
    var filas = [];
    for (var k = 0; k < 5; k++) {
      filas.push('<input type="text" data-prompt-idx="' + k + '" value="' + escapa(ESTADO.prompts[k] || '') +
        '" placeholder="Prompt ' + (k + 1) + '" style="min-height:48px;font-size:14px">');
    }
    el.listaPrompts.innerHTML = filas.join('');
  }

  function renderClaves() {
    var campos = [
      ['google', 'Google Gemini'], ['groq', 'Groq'], ['mistral', 'Mistral'],
      ['openrouter', 'OpenRouter'], ['llm7', 'LLM7.io (opcional)']
    ];
    el.iaClaves.innerHTML = campos.map(function (c) {
      var tiene = !!ESTADO.claves[c[0]];
      return '<label>' + escapa(c[1]) + (tiene ? ' <span class="ok">✓ cargada</span>' : '') +
        '<input type="password" data-clave="' + c[0] + '" placeholder="API Key" value=""></label>';
    }).join('');
  }

  /* ─────────────────────────── Eventos ─────────────────────────── */

  function enlazarEventos() {
    /* Cabecera */
    el.btnFiltros.addEventListener('click', function () {
      abrirFiltros(!document.body.classList.contains('filtros-abiertos'));
    });
    el.pfCerrar.addEventListener('click', function () { abrirFiltros(false); });
    el.velo.addEventListener('click', function () { abrirFiltros(false); });
    el.btnTema.addEventListener('click', function () { setTema(ESTADO.tema === 'claro' ? 'oscuro' : 'claro'); });
    el.btnConduccion.addEventListener('click', function () { setConduccion(!ESTADO.conduccion); });

    /* Navegación
     * OJO: el <body> también lleva data-vista (para los estilos por vista), así
     * que hay que excluirlo o cualquier clic burbujearía hasta él y volvería a
     * llamar a setVista() (que cierra el panel de filtros). */
    $$('[data-vista]:not(body)').forEach(function (b) {
      b.addEventListener('click', function () { setVista(b.getAttribute('data-vista')); });
    });

    /* Filtros */
    el.selProv.addEventListener('change', function () {
      ESTADO.provincia = el.selProv.value;
      ESTADO.localidad = '';
      ESTADO.marcas = [];
      ESTADO.distMax = 0;
      mostrarCarga(true);
      window.setTimeout(function () {
        mostrarCarga(false);
        rellenarLocalidades();
        rellenarMarcas();
        rellenarDistancia();
        aplicarFiltros();
      }, 320);
    });
    el.selLocalidad.addEventListener('change', function () { ESTADO.localidad = el.selLocalidad.value; aplicarFiltros(); });
    el.selCombustible.addEventListener('change', function () { ESTADO.combustible = el.selCombustible.value; aplicarFiltros(); });
    el.selOrden.addEventListener('change', function () { ESTADO.orden = el.selOrden.value; aplicarFiltros(); });
    el.chkFavoritos.addEventListener('change', function () { ESTADO.soloFavoritos = el.chkFavoritos.checked; aplicarFiltros(); });
    el.rngDist.addEventListener('input', function () {
      ESTADO.distMax = Number(el.rngDist.value) || 0;
      actualizarTextoDistancia();
    });
    el.rngDist.addEventListener('change', function () { aplicarFiltros(); });

    var tBusca = null;
    el.inpBusqueda.addEventListener('input', function () {
      window.clearTimeout(tBusca);
      tBusca = window.setTimeout(function () { ESTADO.busqueda = el.inpBusqueda.value.trim(); aplicarFiltros(); }, 200);
    });

    el.btnMarcas.addEventListener('click', function () {
      var abierto = !el.marcasLista.hidden;
      el.marcasLista.hidden = abierto;
      el.btnMarcas.setAttribute('aria-expanded', abierto ? 'false' : 'true');
    });
    el.marcasChecks.addEventListener('change', function (ev) {
      var m = ev.target.getAttribute('data-marca');
      if (!m) return;
      var pos = ESTADO.marcas.indexOf(m);
      if (ev.target.checked && pos < 0) ESTADO.marcas.push(m);
      else if (!ev.target.checked && pos >= 0) ESTADO.marcas.splice(pos, 1);
      ev.target.closest('.chip-marca').classList.toggle('on', ev.target.checked);
      actualizarTextoMarcas();
      aplicarFiltros();
    });
    el.marcasTodas.addEventListener('click', function () { ESTADO.marcas = FAKE.marcasDe(ESTADO.provincia).slice(); rellenarMarcas(); aplicarFiltros(); });
    el.marcasNinguna.addEventListener('click', function () { ESTADO.marcas = []; rellenarMarcas(); aplicarFiltros(); });
    el.btnLimpiar.addEventListener('click', limpiarFiltros);
    el.btnAplicarFiltros.addEventListener('click', function () { aplicarFiltros(); abrirFiltros(false); mostrarAviso('Resultados actualizados'); });

    /* Lista (delegación) */
    el.lista.addEventListener('click', function (ev) {
      var fav = ev.target.closest('[data-fav]');
      if (fav) { toggleFavorito(fav.getAttribute('data-fav')); return; }
      var fila = ev.target.closest('.fila');
      if (fila) abrirDetalle(fila.getAttribute('data-id'));
    });
    el.lista.addEventListener('keydown', function (ev) {
      if (ev.key !== 'Enter' && ev.key !== ' ') return;
      var fila = ev.target.closest('.fila');
      if (fila) { ev.preventDefault(); abrirDetalle(fila.getAttribute('data-id')); }
    });
    el.lista.addEventListener('click', function (ev) {
      if (ev.target.id === 'btnVacioLimpiar') limpiarFiltros();
    });

    /* Ver más */
    el.listaPie.addEventListener('click', function (ev) {
      if (ev.target.id === 'btnMas') {
        ESTADO.visibles += ESTADO.pageSize;
        renderLista();
      }
    });

    /* Mapa */
    el.marcadores.addEventListener('click', function (ev) {
      var m = ev.target.closest('.marcador');
      if (m) abrirDetalle(m.getAttribute('data-id'));
    });
    el.hud.addEventListener('click', function (ev) {
      var p = ev.target.closest('[data-punto]');
      if (p) { ESTADO.hudIdx = Number(p.getAttribute('data-punto')); renderHUD(); return; }
      var ir = ev.target.closest('[data-ir]');
      if (ir) { irAEstacionHUD(ir.getAttribute('data-ir')); mostrarAviso('Iniciando ruta a ' + buscarEstacion(ir.getAttribute('data-ir')).nombre.replace(/^[^ ]+ /, ''), 'ok'); return; }
      var card = ev.target.closest('[data-id]');
      if (card) abrirDetalle(card.getAttribute('data-id'));
    });
    el.mapaMas.addEventListener('click', function () { zoomMapa(1.2); });
    el.mapaMenos.addEventListener('click', function () { zoomMapa(1 / 1.2); });
    el.mapaCentrar.addEventListener('click', function () { MAPA.z = 1; MAPA.x = 0; MAPA.y = 0; aplicarVistaMapa(); });
    el.mapa.addEventListener('wheel', function (ev) {
      ev.preventDefault();
      zoomMapa(ev.deltaY < 0 ? 1.15 : 1 / 1.15);
    }, { passive: false });
    enlazarArrastreMapa();

    /* Conducción */
    el.cdIr.addEventListener('click', function () {
      var est = CACHE.hud[ESTADO.hudIdx];
      if (est) mostrarAviso('Ruta iniciada hacia ' + est.nombre, 'ok');
    });
    el.cdFav.addEventListener('click', function () {
      var est = CACHE.hud[ESTADO.hudIdx];
      if (est) toggleFavorito(est.id);
    });
    el.cdSalir.addEventListener('click', function () { setConduccion(false); });

    /* Detalle */
    el.detCerrar.addEventListener('click', cerrarDetalle);
    el.detFav.addEventListener('click', function () { toggleFavorito(ESTADO.detalleId); });
    el.detFav2.addEventListener('click', function () { toggleFavorito(ESTADO.detalleId); });
    el.detIr.addEventListener('click', function () {
      var est = buscarEstacion(ESTADO.detalleId);
      if (est) mostrarAviso('Ruta iniciada hacia ' + est.nombre, 'ok');
    });
    el.detCombSel.addEventListener('change', function () { ESTADO.detalleComb = el.detCombSel.value; renderDetalle(); });
    el.detDiasSel.addEventListener('change', function () { ESTADO.detalleDias = Number(el.detDiasSel.value); renderDetalle(); });
    el.detTabla.addEventListener('click', function (ev) {
      var tr = ev.target.closest('tr[data-comb]');
      if (!tr) return;
      ESTADO.detalleComb = tr.getAttribute('data-comb');
      renderDetalle();
    });

    /* IA */
    el.iaPills.addEventListener('click', function (ev) {
      var p = ev.target.closest('[data-prov]');
      if (!p) return;
      ESTADO.iaProv = p.getAttribute('data-prov');
      renderIA();
    });
    el.iaPrompts.addEventListener('click', function (ev) {
      var b = ev.target.closest('[data-prompt]');
      if (b) enviarIA(b.getAttribute('data-prompt'));
    });
    el.iaForm.addEventListener('submit', function (ev) { ev.preventDefault(); enviarIA(el.iaInput.value); });

    /* Ajustes: pantalla */
    el.swTema.addEventListener('change', function () { setTema(el.swTema.checked ? 'claro' : 'oscuro'); });
    el.swConduccion.addEventListener('change', function () { setConduccion(el.swConduccion.checked); });
    el.swDescuentos.addEventListener('change', function () {
      ESTADO.aplicarDescuentos = el.swDescuentos.checked;
      aplicarFiltros();
      if (ESTADO.detalleId) renderDetalle();
      mostrarAviso(ESTADO.aplicarDescuentos ? 'Descuentos aplicados al precio' : 'Precios sin descuento');
    });
    el.selPagina.addEventListener('change', function () {
      ESTADO.pageSize = Number(el.selPagina.value);
      ESTADO.visibles = ESTADO.pageSize || CACHE.lista.length;
      renderLista();
    });
    el.selOrdenDef.addEventListener('change', function () {
      ESTADO.orden = el.selOrdenDef.value;
      el.selOrden.value = ESTADO.orden;
      aplicarFiltros();
    });

    /* Descuentos */
    el.discList.addEventListener('input', function (ev) {
      var m = ev.target.getAttribute('data-disc');
      if (!m) return;
      ESTADO.descuentos[m] = Math.max(0, Number(ev.target.value) || 0);
      if (ESTADO.aplicarDescuentos) aplicarFiltros();
    });
    el.discList.addEventListener('click', function (ev) {
      var q = ev.target.getAttribute('data-quitar-disc');
      if (!q) return;
      delete ESTADO.descuentos[q];
      renderDescuentos();
      if (ESTADO.aplicarDescuentos) aplicarFiltros();
    });
    el.discAdd.addEventListener('click', function () {
      var m = el.discMarca.value;
      if (!m) return;
      ESTADO.descuentos[m] = Math.max(0, Number(el.discValor.value) || 0);
      renderDescuentos();
      if (ESTADO.aplicarDescuentos) aplicarFiltros();
    });

    /* Caché: pestañas internas + vaciar */
    document.addEventListener('click', function (ev) {
      var t = ev.target.closest('.tab-int');
      if (!t) return;
      var grupo = t.closest('.tabs-internas');
      var clave = t.getAttribute('data-cachetab') || t.getAttribute('data-logtab');
      $$('.tab-int', grupo).forEach(function (b) { b.classList.toggle('activa', b === t); });
      var ambito = t.getAttribute('data-cachetab') ? 'cachepanel' : 'logpanel';
      $$('[data-' + ambito + ']').forEach(function (p) { p.hidden = p.getAttribute('data-' + ambito) !== clave; });
    });
    el.btnLimpiarCache.addEventListener('click', function () {
      FAKE.cacheInfo.provincias = 0;
      FAKE.cacheInfo.gasolineras = 0;
      FAKE.cacheInfo.historicoDias = 0;
      renderCache();
      mostrarAviso('Caché vaciada (simulado)', 'ok');
    });
    el.cacheLs.addEventListener('click', function (ev) {
      var b = ev.target.closest('[data-quitar-ls]');
      if (!b) return;
      var fila = b.closest('.ls-clave');
      if (fila) fila.remove();
      mostrarAviso('Clave borrada');
    });

    /* Push */
    el.pushProbar.addEventListener('click', function () {
      mostrarAviso('🔔 Bajada detectada: Ballenoil Villaverde −0,020 €', 'ok');
    });
    el.swPushBajada.addEventListener('change', function () {
      if (!el.swPushBajada.checked && !el.swPushSubida.checked) el.swPushBajada.checked = true;
    });

    /* Claves IA */
    el.iaCargar.addEventListener('click', function () {
      var pass = (el.iaPass.value || '').trim();
      if (pass.length < 6) { el.iaPassEstado.textContent = '❌ La contraseña tiene 6 caracteres.'; return; }
      ESTADO.claves = { google: true, groq: true, mistral: true, openrouter: true, llm7: true };
      renderClaves();
      el.iaPassEstado.textContent = '✅ 5 claves cargadas y guardadas en este dispositivo.';
      mostrarAviso('Claves de IA cargadas', 'ok');
    });

    /* Proveedores de IA visibles (siempre queda al menos uno) */
    el.provVisibles.addEventListener('change', function (ev) {
      var p = ev.target.getAttribute('data-prov-vis');
      if (!p) return;
      ESTADO.provVisibles[p] = ev.target.checked;
      var activos = PROVEEDORES.filter(function (x) { return x.id !== 'general' && ESTADO.provVisibles[x.id]; });
      if (!activos.length) {
        ev.target.checked = true;
        ESTADO.provVisibles[p] = true;
        mostrarAviso('Debe quedar al menos un proveedor visible');
        return;
      }
      renderIA();
    });

    /* Prompts */
    el.listaPrompts.addEventListener('input', function (ev) {
      var i = ev.target.getAttribute('data-prompt-idx');
      if (i == null) return;
      ESTADO.prompts[Number(i)] = ev.target.value;
      renderPromptsRapidos();
    });

    /* Actualización */
    el.btnBuscarAct.addEventListener('click', function () {
      el.estadoAct.textContent = 'Buscando…';
      window.setTimeout(function () {
        el.estadoAct.textContent = '✅ ' + FAKE.versionApp.texto + ' es la última versión.';
      }, 700);
    });

    /* Teclado (escritorio y móvil con teclado físico) */
    document.addEventListener('keydown', function (ev) {
      var tag = (ev.target.tagName || '').toLowerCase();
      if (tag === 'input' || tag === 'select' || tag === 'textarea') {
        if (ev.key === 'Escape') ev.target.blur();
        return;
      }
      if (ev.key === 'Escape') {
        if (!el.detalle.hidden) { cerrarDetalle(); return; }
        if (ESTADO.conduccion) { setConduccion(false); return; }
        abrirFiltros(false);
        return;
      }
      if (ev.key === 'ArrowRight') { if (ESTADO.vista === 'mapa') moverHUD(1); return; }
      if (ev.key === 'ArrowLeft') { if (ESTADO.vista === 'mapa') moverHUD(-1); return; }
      if (ev.key === '/') {
        ev.preventDefault();
        abrirFiltros(true);
        window.setTimeout(function () { el.inpBusqueda.focus(); }, 60);
        return;
      }
      var k = ev.key.toLowerCase();
      if (k >= '1' && k <= '5') { setVista(['mapa', 'lista', 'ia', 'favoritas', 'ajustes'][Number(k) - 1]); return; }
      if (k === 'm') setVista('mapa');
      else if (k === 'l') setVista('lista');
      else if (k === 'f') setVista('favoritas');
      else if (k === 'a') setVista('ajustes');
      else if (k === 'i') setVista('ia');
      else if (k === 'c') setConduccion(!ESTADO.conduccion);
      else if (k === 't') setTema(ESTADO.tema === 'claro' ? 'oscuro' : 'claro');
    });

    /* Al cambiar el tamaño, si pasamos a escritorio cerramos la hoja de filtros */
    window.addEventListener('resize', function () {
      if (window.innerWidth >= 1024) abrirFiltros(false);
    });
  }

  /* --- Pan/zoom del mapa fake ------------------------------------------- */
  function aplicarVistaMapa() {
    el.mapaCapa.style.transform = 'translate(' + MAPA.x + 'px,' + MAPA.y + 'px) scale(' + MAPA.z + ')';
  }
  function zoomMapa(f) {
    MAPA.z = Math.max(0.8, Math.min(4, MAPA.z * f));
    aplicarVistaMapa();
  }
  function enlazarArrastreMapa() {
    var arr = null;
    el.mapa.addEventListener('pointerdown', function (ev) {
      if (ev.target.closest('.mapa-controles') || ev.target.closest('.hud') ||
          ev.target.closest('.cd-hud') || ev.target.closest('.marcador')) return;
      arr = { x: ev.clientX, y: ev.clientY, ox: MAPA.x, oy: MAPA.y };
      try { el.mapa.setPointerCapture(ev.pointerId); } catch (e) { /* sin captura */ }
    });
    el.mapa.addEventListener('pointermove', function (ev) {
      if (!arr) return;
      MAPA.x = arr.ox + (ev.clientX - arr.x);
      MAPA.y = arr.oy + (ev.clientY - arr.y);
      aplicarVistaMapa();
    });
    function soltar() { arr = null; }
    el.mapa.addEventListener('pointerup', soltar);
    el.mapa.addEventListener('pointercancel', soltar);
    el.mapa.addEventListener('pointerleave', soltar);
  }

  /* ─────────────────────────── Arranque ─────────────────────────── */

  function init() {
    cachearElementos();

    /* Tema guardado (con try/catch: file:// puede no tener storage) */
    var t = leerLS('gp4_tema');
    if (t === 'claro' || t === 'oscuro') ESTADO.tema = t;

    rellenarProveedorSelect();
    rellenarLocalidades();
    rellenarCombustibles();
    rellenarMarcas();
    rellenarDistancia();

    aplicarTema();
    enlazarEventos();
    aplicarVistaMapa();
    setVista('mapa');       // pinta mapa + lista + HUD + cabecera
    renderAjustes();
    renderIA();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();

})();
