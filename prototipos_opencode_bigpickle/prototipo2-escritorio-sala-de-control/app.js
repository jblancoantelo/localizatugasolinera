/* =============================================================================
 * Sala de control — lógica del prototipo (Big_pickle)
 * =============================================================================
 * Script clásico (sin módulos) para que funcione por file://. Todos los datos
 * salen de window.FAKE (../shared/datos-fake.js); aquí no se inventa ningún
 * precio ni estación: solo se filtran, ordenan y pintan.
 *
 * Índice de secciones:
 *   1. Utilidades
 *   2. Estado del prototipo
 *   3. Cálculo (filtro, orden, paginación)
 *   4. Cabecera
 *   5. Mapa (SVG generado desde FAKE.mapa)
 *   6. Tarjeta de resumen flotante
 *   7. Panel derecho: tarjetas con sparkline
 *   8. Tabla densa + barra de estado
 *   9. Detalle (tercera columna) y gráfica
 *  10. Vista IA (markdown propio)
 *  11. Vista Config
 *  12. Desplegables, avisos y eventos
 *  13. Arranque
 * ========================================================================== */
(function () {
  'use strict';

  var F = window.FAKE;
  if (!F) {
    document.body.innerHTML = '<p style="padding:24px;font:16px system-ui">' +
      'No se han cargado los datos compartidos. Abre el prototipo desde la carpeta ' +
      '<code>prototipos_opencode_bigpickle</code> para que <code>../shared/datos-fake.js</code> resuelva.</p>';
    return;
  }

  /* ======================================================================
   * 1. Utilidades
   * ==================================================================== */

  function $(sel, ctx) { return (ctx || document).querySelector(sel); }
  function $$(sel, ctx) { return Array.prototype.slice.call((ctx || document).querySelectorAll(sel)); }

  /** Escapa texto para poder interpolarlo en innerHTML sin sustos. */
  function esc(t) {
    return String(t == null ? '' : t)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  /** Normaliza para comparar: sin acentos, sin mayúsculas y con eñes/ç resueltas. */
  function norm(t) {
    return String(t == null ? '' : t).toLowerCase()
      .replace(/[ñÑ]/g, 'n').replace(/[çÇ]/g, 'c')
      .normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  }

  /** Precio con 3 decimales y coma (como en la app real). */
  function p3(v) { return v == null ? '—' : v.toFixed(3).replace('.', ','); }
  /** Precio de pastilla/etiqueta corta: "1,469 €". */
  function eur(v) { return v == null ? '—' : p3(v) + ' €'; }
  /** Porcentaje con signo y coma: "−0,4 %". */
  function pct(v) { return (v > 0 ? '+' : v < 0 ? '−' : '') + Math.abs(v).toFixed(1).replace('.', ',') + ' %'; }
  /** Distancia "12,1 km" (helper del contrato). */
  function km(v) { return F.kmh(v); }

  /** Hora local hh:mm para el "Actualizado a las…". */
  function horaActual() {
    var d = new Date();
    return ('0' + d.getHours()).slice(-2) + ':' + ('0' + d.getMinutes()).slice(-2);
  }

  /** Fecha 'dd-mm-aaaa' → 'dd/mm' para los ejes de la gráfica. */
  function fechaCorta(f) { return String(f || '').slice(0, 5).replace('-', '/'); }

  /** Clase CSS de color a partir del semáforo de precios del contrato. */
  function claseColor(p) { return 'p-' + F.colorPrecio(p); }
  function puntoColor(p) { return 'punto-' + F.colorPrecio(p); }

  function estacion(id) {
    for (var i = 0; i < F.estaciones.length; i++) if (F.estaciones[i].id === id) return F.estaciones[i];
    return null;
  }

  /** Variación % entre el primer y el último punto de una serie. */
  function variacion(serie) {
    if (!serie || serie.length < 2) return 0;
    var a = serie[0].precio, b = serie[serie.length - 1].precio;
    if (!a) return 0;
    return (b - a) / a * 100;
  }

  /** Clase + texto de la tendencia (bajada en verde: es buena noticia). */
  function tendencia(serie) {
    var v = variacion(serie);
    var clase = v < -0.05 ? 't-verde' : v > 0.05 ? 't-rojo' : 't-gris';
    var icono = v < -0.05 ? '▼' : v > 0.05 ? '▲' : '＝';
    return { clase: clase, texto: icono + ' ' + pct(v), valor: v };
  }

  /* Caché de series históricas: FAKE.historico() es determinista, así que
     recalcularlo en cada render es innecesario (y con 180 puntos, caro). */
  var cacheSerie = {};
  function serie(id, combustible, dias) {
    var k = id + '|' + (combustible || '') + '|' + dias;
    if (!cacheSerie[k]) cacheSerie[k] = F.historico(id, combustible || 'Gasolina 95 E5', dias);
    return cacheSerie[k];
  }

  /* ======================================================================
   * 2. Estado del prototipo
   * ==================================================================== */

  /* Proveedores de IA: mismos ids, nombres y modelos que la app real
     (AGENTS.md → "Modelos por proveedor"). 'nota' explica el acceso de cada
     uno para que la cabecera del chat sea informativa. */
  var PROVEEDORES = [
    { id: 'general', nombre: 'General', todos: true, nota: 'Misma pregunta a todos, en paralelo' },
    { id: 'groq', nombre: 'Groq', defecto: 'qwen/qwen3.8-27b',
      modelos: ['allam-2-7b', 'openai/gpt-oss-120b', 'openai/gpt-oss-20b', 'qwen/qwen3.8-27b'],
      nota: 'Clave gsk_…' },
    { id: 'mistral', nombre: 'Mistral', defecto: 'open-mistral-nemo',
      modelos: ['codestral-latest', 'ministral-8b-latest', 'mistral-medium-latest', 'mistral-small-latest', 'open-mistral-nemo'],
      nota: 'Clave cMHt…' },
    { id: 'openrouter', nombre: 'OpenRouter', defecto: 'nvidia/nemotron-3-ultra-550b-a55b:free',
      modelos: ['nvidia/nemotron-3-super-120b-a12b:free', 'nvidia/nemotron-3-ultra-550b-a55b:free'],
      nota: 'Clave sk-or-v1-…' },
    { id: 'llm7', nombre: 'LLM7.io', defecto: 'codestral-latest',
      modelos: ['GLM-5.3-Flash', 'codestral-latest', 'minimax-m2.7', 'mistral-Nemo-Instruct-2407'],
      nota: 'Funciona sin clave (500k tokens/día)' },
    { id: 'nvidia', nombre: 'NVIDIA', defecto: 'nvidia/nemotron-3-ultra-550b-a55b',
      modelos: ['moonshotai/kimi-k3', 'nvidia/nemotron-3-super-120b-a12b',
        'nvidia/nemotron-3-ultra-550b-a55b', 'nvidia/nemotron-3.5-lightning-30b-a3b',
        'openai/gpt-oss-20b', 'z-ai/glm-5.3', 'z-ai/glm-5.3-flash'],
      nota: 'Vía proxy de Cloudflare (Config → IA)' },
    { id: 'google', nombre: 'Google Gemini', defecto: 'gemini-3.8-flash',
      modelos: ['gemini-3.5-flash', 'gemini-3.5-flash-lite', 'gemini-3.7-flash', 'gemini-3.8-flash'],
      nota: 'Clave AIza…' },
    { id: 'chrome-nano', nombre: 'Chrome IA', defecto: 'gemini-nano',
      modelos: ['gemini-nano'], nota: 'IA nativa del navegador' }
  ];
  var PROV_CON_CLAVE = { groq: 1, mistral: 1, openrouter: 1, google: 1 };

  var estado = {
    vista: 'mapa',
    /* --- filtros --- */
    provincia: '28',                 // arrancamos en Madrid para que se vea algo
    localidad: '',
    combustible: 'Gasolina 95 E5',
    marcas: {},                      // marca -> true (multiselección)
    distanciaMax: 0,                 // 0 = sin límite
    soloFavoritos: false,
    busqueda: '',
    /* --- listado --- */
    orden: { campo: 'precio', dir: 'asc' },
    pagina: 1,
    pageSize: F.config.pageSize,     // 30, el valor del contrato
    favoritos: {},                   // id -> true (en memoria, no persiste)
    sel: null,                       // estación seleccionada
    detalleAbierto: false,
    detalleTab: 'info',
    histCombustible: null,
    histDias: 14,
    /* --- interfaz --- */
    cargando: true,
    listaAmpliada: false,
    mapaEstilo: 'satelite',
    zoom: 1, panX: 0, panY: 0,
    indiceFoco: -1,                  // cursor de teclado en la tabla
    descuentosActivos: true,
    descuentos: {},                  // marca -> € de descuento
    descuentosBorrados: [],          // marcas añadidas desde Config
    /* --- push (valores del contrato) --- */
    push: {
      activo: true, subida: F.config.pushOnPriceRise, intervalo: F.config.checkInterval,
      dias: F.config.priceFallDays, modo: F.config.priceCheckMode, permiso: 'concedido'
    },
    /* --- IA --- */
    iaTab: 'general',
    iaModelos: {},
    iaChats: {},
    iaPendientes: {},
    iaConClaves: true,               // el prototipo simula claves ya cargadas
    iaVisibles: {},
    prompts: [],
    /* --- config --- */
    cache: {
      provincias: F.cacheInfo.provincias, gasolineras: F.cacheInfo.gasolineras,
      historicoDias: F.cacheInfo.historicoDias, tamano: F.cacheInfo.idb,
      ultima: F.cacheInfo.ultimaActualizacion, ttl: F.config.cacheTtl,
      ls: [
        { k: 'gasolineras_estado', v: '0,4 KB' },
        { k: 'gasolineras_prov_filters_28', v: '0,3 KB' },
        { k: 'gasolineras_prov_filters_08', v: '0,3 KB' },
        { k: 'gasolineras_ai_chat_general', v: '2,1 KB' },
        { k: 'gasolineras_ai_chat_groq', v: '1,4 KB' },
        { k: 'gasolineras_ai_last_models', v: '0,2 KB' },
        { k: 'gasolineras_ai_hidden_providers', v: '0,1 KB' },
        { k: 'gasolineras_ai_nvidia_proxy', v: '0,1 KB' },
        { k: 'gasolineras_api_log', v: '2,8 KB' },
        { k: 'gasolineras_push_log', v: '1,1 KB' },
        { k: 'gasolineras_cache_ttl', v: '0,1 KB' },
        { k: 'gasolineras_page_size', v: '0,1 KB' }
      ]
    },
    logApi: F.logApi.slice(),
    logPush: F.logPush.slice(),
    logTab: 'api',
    cacheTab: 'indexeddb',
    actualizado: F.cacheInfo.ultimaActualizacion,
    version: F.versionApp
  };

  /* Favoritos de partida: los del contrato (est.fav) */
  F.estaciones.forEach(function (e) { if (e.fav) estado.favoritos[e.id] = true; });
  /* Descuentos de partida: los del contrato */
  Object.keys(F.descuentos).forEach(function (m) { estado.descuentos[m] = F.descuentos[m]; });
  /* Prompts rápidos del contrato (hasta 5 huecos) */
  estado.prompts = (F.prompts || []).slice(0, 5);
  while (estado.prompts.length < 5) estado.prompts.push('');
  /* Proveedores visibles, modelo por defecto y chats de ejemplo */
  PROVEEDORES.forEach(function (p) {
    estado.iaVisibles[p.id] = true;
    estado.iaModelos[p.id] = p.defecto;
    estado.iaChats[p.id] = [];
  });
  /* Conversaciones de ejemplo venidas del contrato (así el chat se ve vivo). */
  Object.keys(F.chatsIA).forEach(function (prov) {
    estado.iaChats[prov] = F.chatsIA[prov].map(function (m) {
      return { rol: m.role === 'user' ? 'user' : 'assistant', texto: m.content, ms: null, modelo: null };
    });
  });

  /* ======================================================================
   * 3. Cálculo: filtro, orden y paginación
   * ==================================================================== */

  /** Precio de la estación para el combustible activo (null si no lo vende). */
  function precioBase(e) { return F.precioDe(e, estado.combustible); }

  /** Precio con descuento de marca aplicado si está activo en Config. */
  function precioFinal(e) {
    var p = precioBase(e);
    if (p == null || !estado.descuentosActivos) return p;
    var dto = estado.descuentos[e.marca] || 0;
    return Math.round((p - dto) * 1000) / 1000;
  }

  /** ¿Cuántos filtros "secundarios" hay puestos? (badge del chip Filtros) */
  function filtrosActivos() {
    var n = 0;
    if (estado.localidad) n++;
    if (estado.distanciaMax > 0) n++;
    if (marcasElegidas().length) n++;
    if (estado.soloFavoritos) n++;
    return n;
  }
  function marcasElegidas() { return Object.keys(estado.marcas).filter(function (m) { return estado.marcas[m]; }); }

  /** Filtrado real sobre FAKE.estaciones. */
  function listaFiltrada() {
    var q = norm(estado.busqueda).trim();
    var marcas = estado.marcas;
    var hayMarcas = marcasElegidas().length > 0;
    return F.estacionesDe(estado.provincia).filter(function (e) {
      if (estado.localidad && e.localidad !== estado.localidad) return false;
      if (estado.combustible && precioBase(e) == null) return false;
      if (hayMarcas && !marcas[e.marca]) return false;
      if (estado.distanciaMax > 0 && e.dist > estado.distanciaMax) return false;
      if (estado.soloFavoritos && !estado.favoritos[e.id]) return false;
      if (q) {
        var pajar = norm(e.nombre + ' ' + e.marca + ' ' + e.localidad + ' ' + e.direccion);
        if (pajar.indexOf(q) === -1) return false;
      }
      return true;
    });
  }

  /** Ordenación (el precio ordena por el valor mostrado, con descuento). */
  function ordenarLista(lista) {
    var campo = estado.orden.campo, signo = estado.orden.dir === 'asc' ? 1 : -1;
    lista.sort(function (a, b) {
      var r = 0;
      switch (campo) {
        case 'precio': r = (precioFinal(a) || 99) - (precioFinal(b) || 99); break;
        case 'dist': r = a.dist - b.dist; break;
        case 'localidad': r = a.localidad.localeCompare(b.localidad, 'es'); break;
        case 'marca': r = a.marca.localeCompare(b.marca, 'es'); break;
        default: r = 0;
      }
      if (r === 0) r = a.marca.localeCompare(b.marca, 'es');
      return r * signo;
    });
    return lista;
  }

  function paginadas(lista) {
    var total = estado.pageSize === 0 ? 1 : Math.max(1, Math.ceil(lista.length / estado.pageSize));
    if (estado.pagina > total) estado.pagina = total;
    if (estado.pagina < 1) estado.pagina = 1;
    if (estado.pageSize === 0) return lista.slice();
    var ini = (estado.pagina - 1) * estado.pageSize;
    return lista.slice(ini, ini + estado.pageSize);
  }

  /** Media de los precios de la lista filtrada (la del pie de página). */
  function mediaFiltro(lista) {
    var vals = lista.map(precioFinal).filter(function (v) { return v != null; });
    if (!vals.length) return null;
    return vals.reduce(function (a, b) { return a + b; }, 0) / vals.length;
  }

  /** La más barata de la lista ordenada por precio. */
  function masBarata(lista) {
    var mejor = null;
    lista.forEach(function (e) {
      var p = precioFinal(e);
      if (p == null) return;
      if (!mejor || p < mejor.p) mejor = { e: e, p: p };
    });
    return mejor;
  }

  /* ======================================================================
   * 4. Cabecera
   * ==================================================================== */

  /** Repinta chips, badges y el "Actualizado". */
  function pintarCabecera(lista) {
    var nombreProv = estado.provincia ? F.provinciaNombre(estado.provincia) : 'Todas';
    var nProv = F.estacionesDe(estado.provincia).length;
    $('#chipProvinciaVal').textContent = nombreProv + ' · ' + nProv;
    $('#chipCombVal').textContent = estado.combustible || 'El más barato';
    var nf = filtrosActivos();
    var badge = $('#filtrosNum');
    badge.hidden = nf === 0;
    badge.textContent = String(nf);
    $('#chipFiltros').classList.toggle('activo', nf > 0);

    var nFav = Object.keys(estado.favoritos).filter(function (k) { return estado.favoritos[k]; }).length;
    var fv = $('#favNum');
    fv.textContent = String(nFav);
    fv.dataset.cero = nFav === 0 ? '1' : '0';
    $('#btnFavoritos').setAttribute('aria-pressed', estado.soloFavoritos ? 'true' : 'false');
    $('#btnPush').setAttribute('aria-pressed', estado.push.activo ? 'true' : 'false');
    $('#pushPunto').hidden = !estado.push.activo;
    $('#actualizado').textContent = (estado.cargando ? 'Actualizando…' : 'Actualizado ' + estado.actualizado);
    var limpiar = $('.buscador-limpiar');
    if (limpiar) limpiar.hidden = !estado.busqueda;
    if ($('#buscador').value !== estado.busqueda) $('#buscador').value = estado.busqueda;
  }

  /** Oculta y vacía la lista de sugerencias del buscador global. */
  function ocultarSugerencias() {
    var caja = $('#sugerencias');
    var inp = $('#buscador');
    if (!caja) return;
    caja.hidden = true;
    caja.innerHTML = '';
    if (inp) inp.setAttribute('aria-expanded', 'false');
  }

  /** Sugerencias de estaciones para lo que se está escribiendo en el buscador. */
  function pintarSugerencias() {
    var caja = $('#sugerencias');
    var inp = $('#buscador');
    if (!caja || !inp) return;
    var q = norm(estado.busqueda).trim();
    if (q.length < 2) { ocultarSugerencias(); return; }

    var encontradas = F.estaciones.filter(function (e) {
      return norm(e.nombre + ' ' + e.marca + ' ' + e.localidad + ' ' + e.direccion).indexOf(q) !== -1;
    }).slice(0, 7);

    if (!encontradas.length) {
      caja.innerHTML = '<div class="sug-vacio">Ninguna estación coincide con “' +
        esc(estado.busqueda) + '”.</div>';
    } else {
      caja.innerHTML = '<div class="sug-cab">Estaciones</div>' + encontradas.map(function (e) {
        var p = F.precioDe(e, estado.combustible);
        return '<button type="button" class="sug-item" data-accion="sugerencia" data-id="' + e.id + '">' +
          '<span class="crece"><b>' + esc(e.marca) + '</b> ' + esc(e.nombre) +
          '<br><span class="sug-sub">' + esc(e.localidad) + ' · ' + esc(F.provinciaNombre(e.prov)) + '</span></span>' +
          (p == null ? '' : '<span class="sug-precio ' + claseColor(p) + '">' + p3(p) + ' €</span>') +
          '</button>';
      }).join('');
    }
    caja.hidden = false;
    inp.setAttribute('aria-expanded', 'true');
  }

  /* ======================================================================
   * 5. Mapa (SVG generado desde FAKE.mapa; sin Leaflet ni tiles)
   * ==================================================================== */

  /** Dibuja viales, manchas de zona y agua a partir de FAKE.mapa. */
  function pintarMapaSVG() {
    var m = F.mapa, svg = [], i;
    /* Masas de edificios/zonas: solo decoración para que el mapa "lea" como ciudad */
    m.manchas.forEach(function (z) {
      svg.push('<rect class="mancha" x="' + z.x + '" y="' + z.y + '" width="' + z.w +
        '" height="' + z.h + '" rx="1.6"/>');
    });
    /* agua primero y luego los viales, para que las calles queden por encima */
    svg.push('<path class="agua" d="' + m.agua.d + '"/>');
    /* Cada vial se pinta dos veces: borde claro + relleno blanco (efecto calle) */
    m.viales.forEach(function (v) {
      svg.push('<path class="vial-borde" d="' + v.d + '" stroke-width="' + (v.w + 1.4) + '"/>');
    });
    m.viales.forEach(function (v) {
      svg.push('<path class="vial" d="' + v.d + '" stroke-width="' + v.w + '"/>');
    });
    for (i = 0; i < 6; i++) {
      /* Trama fina de calles secundarias derivada de los viales existentes */
      svg.push('<path class="vial-borde" d="M0,' + (88 + i * 0.5) + ' L100,' + (84 + i * 0.5) + '" stroke-width="0.8" opacity="0.6"/>');
    }
    $('#mapaSvg').innerHTML = svg.join('');
  }

  /** Marcadores "pastilla" con el precio y el punto de "tu ubicación". */
  function pintarMarcadores(lista) {
    var html = [];
    lista.forEach(function (e) {
      var p = precioFinal(e);
      if (p == null) return;
      var sel = estado.sel === e.id ? ' sel' : '';
      var fav = estado.favoritos[e.id]
        ? '<span class="marcador-fav"><svg class="icono"><use href="#i-estrella"/></svg></span>' : '';
      html.push('<button type="button" class="marcador m-' + F.colorPrecio(p) + sel + '"' +
        ' style="left:' + e.mx + '%;top:' + e.my + '%"' +
        ' data-accion="marcador" data-id="' + e.id + '"' +
        ' aria-label="' + esc(e.marca + ' ' + e.localidad + ', ' + eur(p)) + '">' +
        '<span class="marcador-pastilla">' + p3(p) + '</span>' +
        '<span class="marcador-pata"></span>' + fav +
        '</button>');
    });
    /* Tu posición (FAKE.mapa.tuPosicion) */
    html.push('<div class="marcador-yo" style="left:' + F.mapa.tuPosicion.mx + '%;top:' +
      F.mapa.tuPosicion.my + '%" title="' + esc(F.mapa.tuPosicion.label) + '"></div>');
    $('#mapaMarcadores').innerHTML = html.join('');
  }

  /** Aplica zoom/pan al "mundo" del mapa. */
  function aplicarZoom() {
    var mundo = $('#mapaMundo');
    mundo.style.transform = 'translate(' + estado.panX + 'px,' + estado.panY + 'px) scale(' + estado.zoom + ')';
    $('#mapaCaja').style.cursor = estado.zoom > 1 ? 'grab' : 'default';
  }

  function pintarMapa(lista) {
    pintarMarcadores(lista);
    $('#mapaCargando').hidden = !estado.cargando;
    $('#mapaVacio').hidden = !(lista.length === 0 && !estado.cargando);
  }

  /* ======================================================================
   * 6. Tarjeta flotante de resumen (nº estaciones, media, más barata)
   * ==================================================================== */
  function pintarResumen(lista) {
    var mediaProv = F.mediaProvincia(estado.provincia, estado.combustible);
    var barata = masBarata(lista);
    var out = [];
    out.push('<div class="resumen-cab">' + esc(F.provinciaNombre(estado.provincia)) +
      ' · ' + esc(estado.combustible) + '</div>');
    out.push('<div class="resumen-fila">' +
      '<div class="resumen-dato"><b>' + lista.length + '</b><span>estaciones filtradas</span></div>' +
      '<div class="resumen-dato"><b>' + p3(mediaProv) + ' €</b><span>media provincial</span></div>' +
      '</div>');
    if (barata) {
      out.push('<div class="resumen-barra"><button type="button" class="resumen-barata"' +
        ' data-accion="abrir-detalle" data-id="' + barata.e.id + '"' +
        ' aria-label="Abrir la estación más barata: ' + esc(barata.e.nombre) + '">' +
        '<i class="punto ' + puntoColor(barata.p) + '"></i>' +
        '<span class="crece"><b>' + esc(barata.e.marca) + '</b><br>' +
        '<small>' + esc(barata.e.localidad) + ' · ' + km(barata.e.dist) + ' · ' + esc(barata.e.horario) + '</small></span>' +
        '<span class="precio-mini">' + p3(barata.p) + ' €</span></button></div>');
    } else {
      out.push('<div class="resumen-barra"><span>Sin resultados para estos filtros</span></div>');
    }
    out.push('<div class="resumen-leyenda">' +
      '<span><i class="punto punto-verde"></i>&lt; 1,50</span>' +
      '<span><i class="punto punto-naranja"></i>1,50–1,70</span>' +
      '<span><i class="punto punto-rojo"></i>&gt; 1,70</span></div>');
    $('#resumenMapa').innerHTML = out.join('');
  }

  /* ======================================================================
   * 7. Panel derecho: tarjetas con mini-sparkline de 7 días
   * ==================================================================== */

  /** Sparkline SVG 74×26 de una serie (el trazo no necesita ejes: es una pista). */
  function sparkline(serieDatos, color) {
    var w = 74, h = 26, pad = 3, n = serieDatos.length;
    if (n < 2) return '';
    var vals = serieDatos.map(function (p) { return p.precio; });
    var min = Math.min.apply(null, vals), max = Math.max.apply(null, vals);
    var rango = (max - min) || 0.01;
    var pts = vals.map(function (v, i) {
      var x = pad + i * (w - pad * 2) / (n - 1);
      var y = h - pad - ((v - min) / rango) * (h - pad * 2);
      return x.toFixed(1) + ',' + y.toFixed(1);
    });
    var ultimo = pts[pts.length - 1].split(',');
    var relleno = '0,' + h + ' ' + pts.join(' ') + ' ' + w + ',' + h;
    return '<svg class="spark" width="' + w + '" height="' + h + '" viewBox="0 0 ' + w + ' ' + h + '" aria-hidden="true">' +
      '<polygon points="' + relleno + '" fill="' + color + '" opacity="0.10"/>' +
      '<polyline points="' + pts.join(' ') + '" fill="none" stroke="' + color + '" stroke-width="1.6" ' +
      'stroke-linejoin="round" stroke-linecap="round"/>' +
      '<circle cx="' + ultimo[0] + '" cy="' + ultimo[1] + '" r="2.4" fill="' + color + '"/></svg>';
  }

  /** Color de la sparkline: verde si baja, rojo si sube, gris si plano. */
  function colorTendencia(v) { return v < -0.05 ? '#1e8e3e' : v > 0.05 ? '#d93025' : '#8a97a4'; }

  function tarjetaHTML(e, i) {
    var p = precioFinal(e);
    var base = precioBase(e);
    var serieDatos = serie(e.id, estado.combustible, 7);
    var t = tendencia(serieDatos);
    var sel = estado.sel === e.id ? ' sel' : '';
    var fav = !!estado.favoritos[e.id];
    var dto = (base != null && p != null && base - p > 0.0005)
      ? '<span class="precio-dto">con descuento ' + p3(p) + ' €</span>' : '';
    return '<article class="tarjeta' + sel + '" data-fila="' + e.id + '" data-accion="abrir-detalle"' +
      ' data-id="' + e.id + '"' + (i === 0 ? ' data-shot="detalle"' : '') + ' tabindex="0" role="button"' +
      ' aria-label="' + esc(e.nombre + ', ' + eur(p) + ', ' + km(e.dist)) + '">' +
      '<div class="tarjeta-precio">' +
      '<b class="' + claseColor(p) + '">' + p3(p) + ' €</b>' +
      '<span>€/L · ' + esc(siglaCombustible(estado.combustible)) + '</span>' + dto +
      '</div>' +
      '<div class="tarjeta-cuerpo">' +
      '<div class="tarjeta-titulo">' + esc(e.marca) +
      '<button type="button" class="fav-btn' + (fav ? ' on' : '') + '" data-accion="favorito" data-id="' + e.id + '"' +
      ' aria-pressed="' + fav + '" aria-label="' + (fav ? 'Quitar de favoritas' : 'Marcar como favorita') + '">' +
      '<svg class="icono"><use href="#i-estrella"/></svg></button></div>' +
      '<div class="tarjeta-meta"><span>' + esc(e.localidad) + '</span><span class="sep">·</span>' +
      '<span>' + km(e.dist) + '</span><span class="sep">·</span><span>' + esc(e.horario) + '</span></div>' +
      '</div>' +
      '<div class="tarjeta-spark">' + sparkline(serieDatos, colorTendencia(t.valor)) +
      '<span class="spark-tend ' + t.clase + '">' + t.texto + '</span></div>' +
      '</article>';
  }

  /** Sigla corta del combustible para las cabeceras estrechas: G95, G98, GA… */
  function siglaCombustible(c) {
    return String(c || '').replace('Gasolina', 'G').replace('Gasóleo', 'GA')
      .replace('Premium', 'Prem.').replace(' E5', '').replace(' E10', '');
  }

  function pintarLista(lista) {
    $('#listaCuenta').textContent = String(lista.length);
    $('#asaTexto').textContent = lista.length + (lista.length === 1 ? ' estación' : ' estaciones');
    var cuerpo = $('#listaCuerpo');
    if (estado.cargando) {
      cuerpo.innerHTML = cargandoHTML('Cargando precios…');
      return;
    }
    if (!lista.length) {
      cuerpo.innerHTML = vacioHTML('Sin resultados para estos filtros',
        'Prueba a quitar alguna marca, subir la distancia máxima o tocar el buscador.');
      return;
    }
    cuerpo.innerHTML = lista.map(tarjetaHTML).join('');
  }

  function cargandoHTML(texto) {
    return '<div class="vacio"><div class="vacio-icono">⏳</div><strong>' + esc(texto) +
      '</strong><p>Consultando la API del Ministerio…</p></div>';
  }
  function vacioHTML(titulo, texto) {
    return '<div class="vacio"><div class="vacio-icono"><svg class="icono icono-20">' +
      '<use href="#i-lupa"/></svg></div><strong>' + esc(titulo) + '</strong><p>' + esc(texto) + '</p></div>';
  }

  /* ======================================================================
   * 8. Tabla densa y barra de estado
   * ==================================================================== */

  var COLUMNAS = [
    { id: 'fav', et: '', clase: 'col-fav' },
    { id: 'marca', et: 'Marca', orden: true },
    { id: 'precio', et: 'Precio', orden: true, clase: 'col-num' },
    { id: 'tend', et: '7 días', clase: 'col-spark' },
    { id: 'dist', et: 'Distancia', orden: true, clase: 'col-num' },
    { id: 'localidad', et: 'Localidad', orden: true },
    { id: 'direccion', et: 'Dirección' },
    { id: 'accion', et: '', clase: 'col-accion' }
  ];

  function pintarTabla(lista) {
    $('#tablaCuenta').textContent = String(lista.length);
    var scroll = $('#tablaScroll');
    if (estado.cargando) { scroll.innerHTML = cargandoHTML('Cargando precios…'); return; }
    if (!lista.length) {
      scroll.innerHTML = vacioHTML('Sin resultados para estos filtros',
        'La tabla se vacía cuando ningún registro cumple los filtros activos.');
      return;
    }
    var pag = paginadas(lista);
    var barataId = masBarata(lista);
    barataId = barataId ? barataId.e.id : null;

    var th = COLUMNAS.map(function (c) {
      var cls = c.clase || '';
      if (!c.orden) return '<th class="' + cls + '">' + esc(c.et) + '</th>';
      var activo = estado.orden.campo === c.id;
      var flecha = activo ? (estado.orden.dir === 'asc' ? '▲' : '▼') : '▲';
      var aria = activo ? ' aria-sort="' + (estado.orden.dir === 'asc' ? 'ascending' : 'descending') + '"' : '';
      return '<th class="ordenable ' + cls + '" data-accion="ordenar" data-campo="' + c.id + '"' + aria +
        ' title="Ordenar por ' + esc(c.et) + '">' + esc(c.et) +
        '<span class="flecha">' + flecha + '</span></th>';
    }).join('');

    var filas = pag.map(function (e, i) {
      var p = precioFinal(e);
      var serieDatos = serie(e.id, estado.combustible, 7);
      var t = tendencia(serieDatos);
      var fav = !!estado.favoritos[e.id];
      var clases = [];
      if (estado.sel === e.id) clases.push('sel');
      if (e.id === barataId) clases.push('barata');
      if (i === estado.indiceFoco) clases.push('foco-fila');
      return '<tr class="' + clases.join(' ') + '" data-fila="' + e.id + '" data-indice="' + i +
        '" data-accion="abrir-detalle" data-id="' + e.id + '">' +
        '<td class="col-fav"><button type="button" class="fav-btn' + (fav ? ' on' : '') +
        '" data-accion="favorito" data-id="' + e.id + '" aria-pressed="' + fav +
        '" aria-label="' + (fav ? 'Quitar de favoritas' : 'Marcar como favorita') + '">' +
        '<svg class="icono"><use href="#i-estrella"/></svg></button></td>' +
        '<td>' + esc(e.marca) + (e.id === barataId ? '<span class="insignia-barata">más barata</span>' : '') + '</td>' +
        '<td class="col-num col-precio ' + claseColor(p) + '">' + p3(p) + ' €</td>' +
        '<td class="col-spark">' + sparkline(serieDatos, colorTendencia(t.valor)) + '</td>' +
        '<td class="col-num">' + km(e.dist) + '</td>' +
        '<td>' + esc(e.localidad) + '</td>' +
        '<td>' + esc(e.direccion) + '</td>' +
        '<td class="col-accion"><span class="fav-btn" aria-hidden="true">' +
        '<svg class="icono"><use href="#i-info"/></svg></span></td>' +
        '</tr>';
    }).join('');

    scroll.innerHTML = '<table><thead><tr>' + th + '</tr></thead><tbody>' + filas + '</tbody></table>';
  }

  function pintarBarra(lista) {
    var media = mediaFiltro(lista);
    var mediaProv = F.mediaProvincia(estado.provincia, estado.combustible);
    var barata = masBarata(lista);
    $('#infoEstaciones').innerHTML = '<b>' + lista.length + '</b> estaciones de ' +
      F.estacionesDe(estado.provincia).length + ' en ' + esc(F.provinciaNombre(estado.provincia));
    var dif = (media != null && mediaProv != null) ? media - mediaProv : null;
    $('#infoMedia').innerHTML = '<span>Media del filtro</span> <b>' + p3(media) + ' €</b>' +
      (dif == null ? '' : ' <span>(' + (dif <= 0 ? '' : '+') + p3(Math.abs(dif)) + ' € vs provincia)</span>');
    $('#infoBarata').innerHTML = barata
      ? '<i class="punto ' + puntoColor(barata.p) + '"></i><span>Más barata</span>' +
        '<span class="precio">' + p3(barata.p) + ' €</span><span>' + esc(barata.e.marca) + '</span>'
      : '<span>Sin resultados</span>';
    $('#infoBarata').disabled = !barata;

    var total = estado.pageSize === 0 ? 1 : Math.max(1, Math.ceil(lista.length / estado.pageSize));
    $('#pageInfo').textContent = estado.pagina + ' / ' + total +
      (estado.pageSize === 0 ? '' : '  ·  ' + estado.pageSize + ' por pág.');
    $('#prevPage').disabled = estado.pagina <= 1;
    $('#nextPage').disabled = estado.pagina >= total;
  }

  /* ======================================================================
   * 9. Detalle (tercera columna plegable) y gráfica histórica
   * ==================================================================== */

  var DIAS_HIST = [7, 14, 21, 30, 60, 90, 180];

  function abrirDetalle(id) {
    var e = estacion(id);
    if (!e) return;
    estado.sel = id;
    estado.detalleAbierto = true;
    estado.histCombustible = (estado.combustible && precioBase(e) != null)
      ? estado.combustible : primerCombustible(e);
    pintarDetalle();
    pintarEscenario();
    sincronizarSeleccion(true);
  }

  function cerrarDetalle() {
    estado.detalleAbierto = false;
    pintarEscenario();
  }

  function primerCombustible(e) {
    var k = Object.keys(e.precios).filter(function (c) { return e.precios[c] != null; });
    return k.length ? k[0] : null;
  }

  function pintarDetalle() {
    var caja = $('#panelDetalle');
    var e = estacion(estado.sel);
    if (!e) { caja.hidden = true; return; }
    caja.hidden = false;

    var p = precioFinal(e);
    var fav = !!estado.favoritos[e.id];
    $('#detalleNombre').textContent = e.nombre;
    $('#detalleDir').textContent = e.direccion + ' · ' + e.localidad;

    /* El precio, en grande: es el protagonista absoluto del detalle */
    $('#detallePrecio').innerHTML =
      '<div><span class="dp-grande ' + claseColor(p) + '">' + p3(p) +
      '</span><span class="dp-unidad">€/L</span></div>' +
      '<span class="dp-nota">' + esc(estado.combustible || 'el más barato') + ' · ' +
      (estado.descuentosActivos && estado.descuentos[e.marca]
        ? 'con descuento ' + esc(e.marca) + ' de −' + p3(estado.descuentos[e.marca]) + ' €'
        : 'sin descuento aplicado') + '</span>';

    $('#detalleAcciones').innerHTML =
      '<button type="button" class="btn-suave" data-accion="favorito" data-id="' + e.id + '"' +
      ' aria-pressed="' + fav + '">' + (fav ? '★ Favorita' : '☆ Añadir a favoritas') + '</button>' +
      '<button type="button" class="btn-suave" data-accion="ruta" data-id="' + e.id + '">' +
      '<svg class="icono icono-14" style="margin-right:5px;vertical-align:-2px"><use href="#i-ruta"/></svg>Ruta</button>' +
      '<button type="button" class="btn-suave" data-accion="compartir" data-id="' + e.id + '"' +
      ' aria-label="Copiar los datos de la estación">' +
      '<svg class="icono icono-14" style="margin-right:5px;vertical-align:-2px"><use href="#i-compartir"/></svg>Compartir</button>';

    var filas = [
      ['Marca', esc(e.marca)],
      ['Dirección', esc(e.direccion)],
      ['Localidad', esc(e.localidad)],
      ['Provincia', esc(F.provinciaNombre(e.prov))],
      ['Horario', esc(e.horario)],
      ['Distancia', '<b>' + km(e.dist) + '</b> de tu ubicación'],
      ['id IDEESS', esc(e.id)],
      ['Coordenadas mapa', e.mx + ' / ' + e.my + ' (fake)']
    ];
    var combustibles = Object.keys(e.precios).map(function (c) {
      var v = e.precios[c];
      var actual = c === estado.histCombustible;
      return '<div class="combustible-fila' + (actual ? ' actual' : '') + '">' +
        '<span class="combustible-nombre">' + esc(c) + (actual ? ' <b>· en la gráfica</b>' : '') + '</span>' +
        '<span class="combustible-precio ' + (v == null ? 'p-gris' : claseColor(v)) + '">' +
        (v == null ? 'no se vende' : p3(v) + ' €') + '</span></div>';
    }).join('');

    $('#detallePanelInfo').innerHTML =
      '<dl>' + filas.map(function (f) {
        return '<div class="ficha-fila"><dt>' + f[0] + '</dt><dd>' + f[1] + '</dd></div>';
      }).join('') + '</dl>' +
      '<div class="combustibles-lista"><p class="config-etiqueta" style="margin:6px 0 8px">' +
      'Precios por combustible</p>' + combustibles + '</div>';

    pintarDetalleHistorico();
  }

  /** Pestaña Histórico: selectores + gráfica + resumen del periodo. */
  function pintarDetalleHistorico() {
    var e = estacion(estado.sel);
    if (!e) return;
    var combustible = estado.histCombustible || primerCombustible(e);
    var opciones = Object.keys(e.precios).map(function (c) {
      return '<option value="' + esc(c) + '"' + (c === combustible ? ' selected' : '') + '>' +
        esc(c) + (e.precios[c] == null ? ' (sin precio)' : '') + '</option>';
    }).join('');
    var dias = DIAS_HIST.map(function (d) {
      return '<option value="' + d + '"' + (d === estado.histDias ? ' selected' : '') + '>' + d + ' días</option>';
    }).join('');
    var serieDatos = serie(e.id, combustible, estado.histDias);
    var t = tendencia(serieDatos);
    var vals = serieDatos.map(function (x) { return x.precio; });
    var min = Math.min.apply(null, vals), max = Math.max.apply(null, vals);
    var minPunto = serieDatos[vals.indexOf(min)], maxPunto = serieDatos[vals.indexOf(max)];
    var actual = vals[vals.length - 1];
    var media = vals.reduce(function (a, b) { return a + b; }, 0) / vals.length;

    $('#detallePanelHist').innerHTML =
      '<div class="hist-cab">' +
      '<label class="sr-solo" for="histCombustible">Combustible de la gráfica</label>' +
      '<select class="select-mini" id="histCombustible" data-rol="histCombustible">' + opciones + '</select>' +
      '<label class="sr-solo" for="histDias">Días representados</label>' +
      '<select class="select-mini" id="histDias" data-rol="histDias">' + dias + '</select>' +
      '<span class="pista-teclado">' + esc(serieDatos[0].fecha) + ' → ' + esc(serieDatos[serieDatos.length - 1].fecha) + '</span>' +
      '</div>' +
      /* La caja se inserta vacía y la gráfica se dibuja después, ya en el DOM,
         para poder medir su ancho real y no deformar los textos. */
      '<div class="grafica-caja" id="graficaCaja" data-grafica>' +
      '<div class="gr-tooltip" id="grTooltip"></div></div>' +
      '<div class="hist-resumen">' +
      '<div class="hist-dato"><span>Actual</span><b class="' + claseColor(actual) + '">' + p3(actual) + ' €</b></div>' +
      '<div class="hist-dato"><span>Mínimo</span><b>' + p3(min) + ' €</b><small>' + fechaCorta(minPunto.fecha) + '</small></div>' +
      '<div class="hist-dato"><span>Máximo</span><b>' + p3(max) + ' €</b><small>' + fechaCorta(maxPunto.fecha) + '</small></div>' +
      '<div class="hist-dato"><span>Media</span><b>' + p3(media) + ' €</b></div>' +
      '<div class="hist-dato"><span>Variación</span><b class="' + t.clase + '">' + pct(t.valor) + '</b>' +
      '<small>' + estado.histDias + ' días</small></div>' +
      '</div>';
    redibujarGrafica();
  }

  /** Vuelve a dibujar la gráfica del detalle midiendo su contenedor. */
  function redibujarGrafica() {
    var caja = $('#graficaCaja');
    if (!caja) return;
    var e = estacion(estado.sel);
    if (!e) return;
    var combustible = estado.histCombustible || primerCombustible(e);
    var serieDatos = serie(e.id, combustible, estado.histDias);
    /* -12 para no comerse el padding de la caja; 260 es el mínimo razonable. */
    var W = Math.max(260, caja.clientWidth - 12);
    var H = 210;
    var svg = graficaSVG(serieDatos, combustible, W, H, caja);
    var anterior = $('svg', caja);
    if (anterior) caja.removeChild(anterior);
    caja.insertAdjacentHTML('afterbegin', svg);
  }

  /**
   * Gráfica de líneas en SVG con rejilla, área degradada y extremos marcados.
   * El viewBox se ajusta al ancho real (y al alto fijo) con
   * preserveAspectRatio="none" para que el trazo ocupe todo el hueco: como el
   * viewBox ya tiene la proporción de la caja, no hay deformación visible.
   */
  function graficaSVG(serieDatos, combustible, W, H, caja) {
    var padL = 46, padR = 12, padT = 14, padB = 26, i;
    var n = serieDatos.length;
    var vals = serieDatos.map(function (p) { return p.precio; });
    var min = Math.min.apply(null, vals), max = Math.max.apply(null, vals);
    var rango = (max - min) || 0.01;
    min -= rango * 0.12; max += rango * 0.12; rango = max - min;

    function px(idx) { return padL + idx * (W - padL - padR) / (n - 1); }
    function py(v) { return padT + (1 - (v - min) / rango) * (H - padT - padB); }

    var puntos = serieDatos.map(function (p, idx) { return [px(idx), py(p.precio), p]; });
    var linea = puntos.map(function (p, idx) { return (idx ? 'L' : 'M') + p[0].toFixed(1) + ',' + p[1].toFixed(1); }).join(' ');
    var area = 'M' + puntos[0][0].toFixed(1) + ',' + (H - padB) + puntos.map(function (p) {
      return ' L' + p[0].toFixed(1) + ',' + p[1].toFixed(1);
    }).join('') + ' L' + puntos[n - 1][0].toFixed(1) + ',' + (H - padB) + ' Z';

    var svg = ['<svg viewBox="0 0 ' + W + ' ' + H + '" width="' + W + '" height="' + H + '"' +
      ' preserveAspectRatio="none" role="img" aria-label="Evolución del precio de ' + esc(combustible) +
      ' en los últimos ' + estado.histDias + ' días">'];
    svg.push('<defs><linearGradient id="degradadoGrafica" x1="0" y1="0" x2="0" y2="1">' +
      '<stop offset="0%" stop-color="#1a73e8" stop-opacity="0.28"/>' +
      '<stop offset="100%" stop-color="#1a73e8" stop-opacity="0.02"/></linearGradient></defs>');

    for (i = 0; i <= 4; i++) {
      var v = max - (rango * i / 4);
      var y = py(v);
      svg.push('<line class="gr-rejilla" x1="' + padL + '" y1="' + y.toFixed(1) + '" x2="' + (W - padR) +
        '" y2="' + y.toFixed(1) + '"/>');
      svg.push('<text class="gr-eje-txt" x="' + (padL - 6) + '" y="' + (y + 3.5).toFixed(1) +
        '" text-anchor="end">' + v.toFixed(3).replace('.', ',') + '</text>');
    }
    var paso = Math.max(1, Math.ceil(n / 6));
    for (i = 0; i < n; i += paso) {
      svg.push('<text class="gr-eje-txt" x="' + px(i).toFixed(1) + '" y="' + (H - 8) +
        '" text-anchor="middle">' + fechaCorta(serieDatos[i].fecha) + '</text>');
    }
    svg.push('<path class="gr-area" d="' + area + '"/>');
    svg.push('<path class="gr-linea" d="' + linea + '"/>');
    var vMin = Math.min.apply(null, vals), vMax = Math.max.apply(null, vals);
    [vals.indexOf(vMin), vals.indexOf(vMax)].forEach(function (idx) {
      svg.push('<circle class="gr-punto-extremo" cx="' + puntos[idx][0].toFixed(1) + '" cy="' +
        puntos[idx][1].toFixed(1) + '" r="3.4"/>');
    });
    svg.push('<circle class="gr-punto-extremo" cx="' + puntos[n - 1][0].toFixed(1) + '" cy="' +
      puntos[n - 1][1].toFixed(1) + '" r="4"/>');
    svg.push('<line class="gr-cursor" id="grCursor" x1="0" y1="' + padT + '" x2="0" y2="' + (H - padB) +
      '" style="display:none"/>');
    svg.push('<circle class="gr-punto" id="grPunto" r="4.5" style="display:none"/>');
    svg.push('</svg>');

    caja._gr = { W: W, H: H, padL: padL, padR: padR, padT: padT, padB: padB, n: n, puntos: puntos };
    return svg.join('');
  }

  /** Hover de la gráfica: resalta el punto más cercano y muestra el tooltip. */
  function hoverGrafica(caja, ev) {
    var gr = caja._gr;
    var svg = $('svg', caja);
    if (!gr || !svg) return;
    var r = svg.getBoundingClientRect();
    var x = (ev.clientX - r.left) * (gr.W / r.width);
    var idx = Math.round((x - gr.padL) / ((gr.W - gr.padL - gr.padR) / (gr.n - 1)));
    idx = Math.max(0, Math.min(gr.n - 1, idx));
    var p = gr.puntos[idx];
    var cursor = $('#grCursor', caja), punto = $('#grPunto', caja), tip = $('#grTooltip', caja);
    if (!cursor || !punto || !tip) return;
    cursor.setAttribute('x1', p[0].toFixed(1)); cursor.setAttribute('x2', p[0].toFixed(1));
    cursor.style.display = '';
    punto.setAttribute('cx', p[0].toFixed(1)); punto.setAttribute('cy', p[1].toFixed(1));
    punto.style.display = '';
    tip.innerHTML = '<b>' + p3(p[2].precio) + ' €</b><br>' + p[2].fecha;
    tip.style.left = (p[0] * (r.width / gr.W)) + 'px';
    tip.style.top = (p[1] * (r.height / gr.H)) + 'px';
    tip.classList.add('viendo');
  }

  function ocultarHoverGrafica() {
    var cursor = $('#grCursor'), punto = $('#grPunto'), tip = $('#grTooltip');
    if (cursor) cursor.style.display = 'none';
    if (punto) punto.style.display = 'none';
    if (tip) tip.classList.remove('viendo');
  }

  /* ======================================================================
   * 10. Vista IA (renderizador de Markdown propio, sin librerías)
   * ==================================================================== */

  /**
   * Markdown mínimo pero suficiente para lo que devuelven los modelos:
   * títulos #–####, negrita, cursiva, `código`, bloques ```, listas -/1.,
   * tablas |…|, citas >, separadores ---, enlaces y autolinks.
   * Se escapa SIEMPRE primero: el modelo (o el usuario) no puede inyectar HTML.
   */
  function mdHTML(txt) {
    var lineas = String(txt == null ? '' : txt).replace(/\r\n?/g, '\n').split('\n');
    var out = [], i = 0;

    function inline(t) {
      var guardados = [];
      t = esc(t);
      t = t.replace(/\[([^\]]+)\]\((https?:[^)\s]+)\)/g, function (_, txt2, url) {
        guardados.push('<a href="' + url + '" target="_blank" rel="noopener">' + txt2 + '</a>');
        return '\u0000' + (guardados.length - 1) + '\u0001';
      });
      t = t.replace(/`([^`]+)`/g, '<code>$1</code>');
      t = t.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
      t = t.replace(/__([^_]+)__/g, '<strong>$1</strong>');
      t = t.replace(/(^|[\s(])\*([^*\n]+)\*/g, '$1<em>$2</em>');
      t = t.replace(/(^|[\s(])_([^_\n]+)_/g, '$1<em>$2</em>');
      t = t.replace(/(https?:\/\/[^\s<]+)/g, '<a href="$1" target="_blank" rel="noopener">$1</a>');
      t = t.replace(/\u0000(\d+)\u0001/g, function (_, n) { return guardados[+n]; });
      return t;
    }
    function esTabla(l) { return /^\s*\|/.test(l); }
    function esSepTabla(l) { return /^\s*\|?[\s:|-]+\|?\s*$/.test(l) && l.indexOf('-') !== -1; }
    function celdas(l) {
      var c = l.replace(/^\s*\|/, '').replace(/\|\s*$/, '').split('|');
      return c.map(function (x) { return x.trim(); });
    }

    while (i < lineas.length) {
      var l = lineas[i];

      /* Bloque de código (también sin cerrar, si la respuesta se cortó) */
      if (/^\s*```/.test(l)) {
        var buf = [];
        i++;
        while (i < lineas.length && !/^\s*```/.test(lineas[i])) { buf.push(lineas[i]); i++; }
        i++;
        out.push('<pre><code>' + esc(buf.join('\n')) + '</code></pre>');
        continue;
      }
      /* Títulos */
      var h = l.match(/^(#{1,4})\s+(.*)$/);
      if (h) { out.push('<h' + h[1].length + '>' + inline(h[2]) + '</h' + h[1].length + '>'); i++; continue; }
      /* Separador */
      if (/^\s*(-{3,}|\*{3,}|_{3,})\s*$/.test(l)) { out.push('<hr>'); i++; continue; }
      /* Tabla */
      if (esTabla(l) && i + 1 < lineas.length && esSepTabla(lineas[i + 1])) {
        var cab = celdas(l), filasT = [];
        i += 2;
        while (i < lineas.length && esTabla(lineas[i])) { filasT.push(celdas(lineas[i])); i++; }
        out.push('<table><thead><tr>' + cab.map(function (c) { return '<th>' + inline(c) + '</th>'; }).join('') +
          '</tr></thead><tbody>' + filasT.map(function (f) {
            return '<tr>' + f.map(function (c) { return '<td>' + inline(c) + '</td>'; }).join('') + '</tr>';
          }).join('') + '</tbody></table>');
        continue;
      }
      /* Listas (ul y ol, sin anidar: el histórico de la app no las usa) */
      if (/^\s*[-*]\s+/.test(l) || /^\s*\d+[.)]\s+/.test(l)) {
        var tipo = /^\s*\d/.test(l) ? 'ol' : 'ul';
        var items = [];
        while (i < lineas.length && (/^\s*[-*]\s+/.test(lineas[i]) || /^\s*\d+[.)]\s+/.test(lineas[i]))) {
          items.push('<li>' + inline(lineas[i].replace(/^\s*(?:[-*]|\d+[.)])\s+/, '')) + '</li>');
          i++;
        }
        out.push('<' + tipo + '>' + items.join('') + '</' + tipo + '>');
        continue;
      }
      /* Cita */
      if (/^\s*>\s?/.test(l)) {
        var citas = [];
        while (i < lineas.length && /^\s*>\s?/.test(lineas[i])) { citas.push(lineas[i].replace(/^\s*>\s?/, '')); i++; }
        out.push('<blockquote>' + citas.map(inline).join('<br>') + '</blockquote>');
        continue;
      }
      /* Línea en blanco */
      if (!l.trim()) { i++; continue; }
      /* Párrafo: junta líneas consecutivas hasta un bloque o línea vacía */
      var parr = [];
      while (i < lineas.length && lineas[i].trim() &&
        !/^\s*```/.test(lineas[i]) && !/^(#{1,4})\s+/.test(lineas[i]) && !esTabla(lineas[i]) &&
        !/^\s*[-*]\s+/.test(lineas[i]) && !/^\s*\d+[.)]\s+/.test(lineas[i]) &&
        !/^\s*>\s?/.test(lineas[i]) && !/^\s*(-{3,}|\*{3,}|_{3,})\s*$/.test(lineas[i])) {
        parr.push(lineas[i]); i++;
      }
      if (parr.length) out.push('<p>' + parr.map(inline).join('<br>') + '</p>');
    }
    return out.join('');
  }

  function provInfo(id) {
    for (var i = 0; i < PROVEEDORES.length; i++) if (PROVEEDORES[i].id === id) return PROVEEDORES[i];
    return null;
  }
  function provVisibles() {
    return PROVEEDORES.filter(function (p) { return !p.todos && estado.iaVisibles[p.id]; });
  }
  function provListo(id) {
    if (id === 'general') return true;
    if (PROV_CON_CLAVE[id]) return estado.iaConClaves;
    return true;   /* llm7 (anónimo), nvidia (proxy) y chrome-nano no necesitan clave */
  }

  /** Tiempo simulado de respuesta (ms) y su formato "1,2 s". */
  function msSimulado() { return Math.round(700 + Math.random() * 1100); }
  function fmtMs(ms) { return ms < 1000 ? ms + ' ms' : (ms / 1000).toFixed(1).replace('.', ',') + ' s'; }

  /** Respuesta de ejemplo del contrato para un proveedor (rota entre las suyas). */
  function respuestaEjemplo(prov) {
    var conv = F.chatsIA[prov] || F.chatsIA.general;
    var asistentes = conv.filter(function (m) { return m.role === 'assistant'; });
    if (!asistentes.length) return 'Sin datos de ejemplo.';
    var usadas = (estado.iaChats[prov] || []).filter(function (m) { return m.rol === 'assistant'; }).length;
    return asistentes[usadas % asistentes.length].content;
  }

  function pintarIA() {
    /* --- Pestañas: General + proveedores visibles en Config → IA --- */
    var tabs = ['<button type="button" class="ia-tab ia-tab-general' + (estado.iaTab === 'general' ? ' activo' : '') +
      '" role="tab" aria-selected="' + (estado.iaTab === 'general') + '" data-accion="ia-tab" data-prov="general">' +
      'General</button>'];
    provVisibles().forEach(function (p) {
      tabs.push('<button type="button" class="ia-tab' + (estado.iaTab === p.id ? ' activo' : '') +
        '" role="tab" aria-selected="' + (estado.iaTab === p.id) + '" data-accion="ia-tab" data-prov="' + p.id + '">' +
        esc(p.nombre) + (provListo(p.id) ? '' : ' ⚠️') + '</button>');
    });
    $('#iaTabs').innerHTML = tabs.join('');
    if (estado.iaTab !== 'general' && (!estado.iaVisibles[estado.iaTab] || !provInfo(estado.iaTab))) {
      estado.iaTab = 'general';
    }

    /* --- Barra de configuración del chat --- */
    var info = provInfo(estado.iaTab);
    var barra = [];
    if (estado.iaTab === 'general') {
      var listos = provVisibles().filter(function (p) { return provListo(p.id); }).length;
      barra.push('<span class="ia-estado"><i class="punto ' + (listos ? 'punto-verde' : 'punto-rojo') + '"></i>' +
        listos + '/' + provVisibles().length + ' proveedores listos · la misma pregunta a todos en paralelo</span>');
      barra.push('<button type="button" class="ia-msg-borra" data-accion="ia-borrar" aria-label="Borrar el historial">' +
        '<svg class="icono icono-14"><use href="#i-papelera"/></svg></button>');
      var prompts = estado.prompts.map(function (p, idx) {
        return p ? '<button type="button" class="ia-prompt" data-accion="ia-prompt" data-i="' + idx +
          '" title="' + esc(p) + '">' + (idx + 1) + '. ' + esc(p.length > 28 ? p.slice(0, 27) + '…' : p) + '</button>' : '';
      }).join('');
      barra.push('<span class="ia-prompts">' + prompts + '</span>');
    } else if (info) {
      var modelos = info.modelos.map(function (m) {
        return '<option value="' + esc(m) + '"' + (estado.iaModelos[info.id] === m ? ' selected' : '') + '>' + esc(m) + '</option>';
      }).join('');
      barra.push('<label class="sr-solo" for="iaModelo">Modelo</label>' +
        '<select class="select-mini" id="iaModelo" data-rol="iaModelo">' + modelos + '</select>');
      barra.push('<button type="button" class="ia-msg-borra" data-accion="ia-refrescar" data-prov="' + info.id +
        '" aria-label="Actualizar el catálogo de modelos" title="Actualizar modelos">' +
        '<svg class="icono icono-14"><use href="#i-refrescar"/></svg></button>');
      barra.push('<span class="ia-estado"><i class="punto ' + (provListo(info.id) ? 'punto-verde' : 'punto-naranja') +
        '"></i>' + (provListo(info.id) ? 'Listo · ' : 'Sin clave · ') + esc(info.nota) + '</span>');
      barra.push('<button type="button" class="ia-msg-borra" data-accion="ia-borrar" aria-label="Borrar el historial">' +
        '<svg class="icono icono-14"><use href="#i-papelera"/></svg></button>');
    }
    $('#iaBarra').innerHTML = barra.join('');

    /* --- Mensajes --- */
    var msgs = estado.iaChats[estado.iaTab] || [];
    var html = msgs.map(function (m) {
      if (m.rol === 'user') {
        return '<div class="ia-msg user">' + mdHTML(m.texto) + '</div>';
      }
      return '<div class="ia-msg assistant">' + (m.prov ? '<span class="ia-quien">' + esc(m.prov) + '</span>' : '') +
        mdHTML(m.texto) + (m.ms ? '<span class="ia-msg-meta">⏱ ' + esc(m.modelo || '') + ' · ' + fmtMs(m.ms) + '</span>' : '') +
        '</div>';
    }).join('');
    var pendientes = Object.keys(estado.iaPendientes);
    pendientes.forEach(function (id) {
      var nombre = id === 'general' ? 'Modelo' : (provInfo(id) || { nombre: id }).nombre;
      html += '<div class="ia-msg pensando"><span class="ia-quien">' + esc(nombre) +
        '</span>Pensando<span class="puntos-pensando"></span></div>';
    });
    if (!msgs.length && !pendientes.length) {
      html = '<div class="vacio"><div class="vacio-icono"><svg class="icono icono-20"><use href="#i-ia"/></svg></div>' +
        '<strong>Pregunta lo que quieras</strong><p>La IA recibe la provincia, el top 30 de estaciones y tus ' +
        'favoritas como contexto. Prueba con un prompt rápido.</p></div>';
    }
    var cont = $('#iaMensajes');
    cont.innerHTML = html;
    cont.scrollTop = cont.scrollHeight;
  }

  /** Envía la consulta: a un proveedor o a todos los visibles (pestaña General). */
  function enviarIA(texto) {
    texto = String(texto || '').trim();
    if (!texto) return;
    var tab = estado.iaTab;
    if (tab === 'general') {
      var visibles = provVisibles();
      if (!visibles.length) { avisar('No hay proveedores visibles: actívalos en Config → Pestañas de IA', 'error'); return; }
      estado.iaChats.general = estado.iaChats.general || [];
      estado.iaChats.general.push({ rol: 'user', texto: texto });
      /* El placeholder aparece a la vez para todos: es una llamada en paralelo */
      visibles.forEach(function (p) { estado.iaPendientes[p.id] = true; });
      pintarIA();
      visibles.forEach(function (p) {
        var ms = msSimulado();
        setTimeout(function () {
          delete estado.iaPendientes[p.id];
          if (!provListo(p.id)) {
            estado.iaChats.general.push({ rol: 'aviso', prov: p.nombre, modelo: null, ms: null,
              texto: '❌ **' + p.nombre + '**: no hay clave de API cargada. Añádela en Config → Claves API - IA.' });
          } else {
            estado.iaChats.general.push({ rol: 'assistant', prov: p.nombre,
              modelo: p.nombre + ' · ' + estado.iaModelos[p.id], ms: ms, texto: respuestaEjemplo(p.id) });
          }
          if (estado.iaTab === 'general') pintarIA();
        }, 400 + ms);
      });
      return;
    }
    /* Proveedor concreto */
    var info = provInfo(tab);
    estado.iaChats[tab] = estado.iaChats[tab] || [];
    estado.iaChats[tab].push({ rol: 'user', texto: texto });
    estado.iaPendientes[tab] = true;
    pintarIA();
    var ms2 = msSimulado();
    setTimeout(function () {
      delete estado.iaPendientes[tab];
      if (!provListo(tab)) {
        estado.iaChats[tab].push({ rol: 'aviso', modelo: null, ms: null, texto:
          '❌ **' + info.nombre + '**: sin clave de API. Config → "Claves API - IA" para cargarla.' });
      } else {
        estado.iaChats[tab].push({ rol: 'assistant', modelo: estado.iaModelos[tab], ms: ms2,
          texto: respuestaEjemplo(tab) });
      }
      if (estado.iaTab === tab) pintarIA();
    }, 400 + ms2);
  }

  /* ======================================================================
   * 11. Vista Config (todo lo del panel real, con los valores del contrato)
   * ==================================================================== */

  function tarjetaConfig(icono, titulo, cuerpo) {
    return '<article class="tarjeta-config"><h3><svg class="icono icono-20"><use href="#' + icono +
      '"/></svg>' + titulo + '</h3>' + cuerpo + '</article>';
  }

  function pintarConfig() {
    var html = [];

    /* --- 1. Descuentos por marca --- */
    var marcasDto = Object.keys(estado.descuentos);
    var filasDto = marcasDto.map(function (m) {
      return '<div class="fila-lista"><span class="crece">' + esc(m) + '</span>' +
        '<input type="number" class="campo campo-num" min="0" max="0.5" step="0.01" value="' +
        estado.descuentos[m].toFixed(2) + '" data-rol="descValor" data-marca="' + esc(m) + '"' +
        ' aria-label="Descuento de ' + esc(m) + ' en euros por litro"> €/L ' +
        '<button type="button" class="fav-btn" data-accion="descQuitar" data-marca="' + esc(m) +
        '" aria-label="Quitar el descuento de ' + esc(m) + '"><svg class="icono icono-14"><use href="#i-cerrar"/></svg></button></div>';
    }).join('') || '<p class="config-desc">Sin descuentos de marca.</p>';
    html.push(tarjetaConfig('i-filtro', 'Descuentos por marca',
      '<p class="config-desc">Resta céntimos al precio mostrado. Los descuentos del contrato ' +
      '(Repsol, Ballenoil, E.Leclerc) ya vienen aplicados.</p>' +
      '<label class="interruptor"><input type="checkbox" data-rol="descActivos"' +
      (estado.descuentosActivos ? ' checked' : '') + '> Aplicar descuentos al precio</label>' +
      filasDto +
      '<div class="config-fila"><label class="sr-solo" for="nuevaMarca">Marca</label>' +
      '<select class="select-mini" id="nuevaMarca">' + F.marcas.filter(function (m) {
        return !estado.descuentos[m];
      }).map(function (m) { return '<option>' + esc(m) + '</option>'; }).join('') + '</select>' +
      '<button type="button" class="btn-suave" data-accion="descAnadir">+ Añadir marca</button></div>'));

    /* --- 2. Caché de datos --- */
    var idb = '<div class="config-caja">' +
      '<div class="fila-lista"><span class="crece">Provincias cacheadas</span><b>' + estado.cache.provincias + '</b></div>' +
      '<div class="fila-lista"><span class="crece">Gasolineras en caché</span><b>' + estado.cache.gasolineras.toLocaleString('es-ES') + '</b></div>' +
      '<div class="fila-lista"><span class="crece">Días de histórico</span><b>' + estado.cache.historicoDias + '</b></div>' +
      '<div class="fila-lista"><span class="crece">Base IndexedDB</span><code>' + esc(estado.cache.tamano) + '</code></div>' +
      '<div class="fila-lista"><span class="crece">Última actualización</span><code>' + esc(estado.cache.ultima) + '</code></div>' +
      '</div>' +
      '<div class="config-fila"><label class="config-etiqueta" for="cacheTtl">Horas de caché</label>' +
      '<input type="number" class="campo campo-num" id="cacheTtl" min="0" max="168" value="' + estado.cache.ttl +
      '" data-rol="cacheTtl"></div>' +
      '<button type="button" class="btn-suave btn-peligro" data-accion="cacheLimpiar">' +
      '<svg class="icono icono-14" style="margin-right:5px;vertical-align:-2px"><use href="#i-papelera"/></svg>' +
      'Limpiar caché de datos</button>';
    var ls = estado.cache.ls.length
      ? estado.cache.ls.map(function (k) {
        return '<div class="fila-lista"><code class="crece">' + esc(k.k) + '</code><span class="mini">' + esc(k.v) + '</span>' +
          '<button type="button" class="fav-btn" data-accion="lsBorrar" data-clave="' + esc(k.k) +
          '" aria-label="Borrar ' + esc(k.k) + '"><svg class="icono icono-14"><use href="#i-cerrar"/></svg></button></div>';
      }).join('')
      : '<p class="config-desc">No queda ninguna clave <code>gasolineras_</code> en localStorage.</p>';
    html.push(tarjetaConfig('i-papelera', 'Caché de datos',
      '<div class="config-tabs">' +
      '<button type="button" class="config-tab' + (estado.cacheTab === 'indexeddb' ? ' activo' : '') +
      '" data-accion="cacheTab" data-tab="indexeddb">IndexedDB</button>' +
      '<button type="button" class="config-tab' + (estado.cacheTab === 'localstorage' ? ' activo' : '') +
      '" data-accion="cacheTab" data-tab="localstorage">localStorage</button></div>' +
      '<div class="config-panel' + (estado.cacheTab === 'indexeddb' ? ' activo' : '') + '">' + idb + '</div>' +
      '<div class="config-panel' + (estado.cacheTab === 'localstorage' ? ' activo' : '') + '">' +
      '<div class="config-caja mono" style="max-height:220px;overflow:auto">' + ls + '</div>' +
      '<p class="config-desc">' + estado.cache.ls.length + ' claves · solo se muestran las que empiezan por ' +
      '<code>gasolineras_</code>.</p></div>'));

    /* --- 3. Paginación --- */
    html.push(tarjetaConfig('i-tabla', 'Paginación',
      '<p class="config-desc">Afecta a la tabla de la vista Datos y al pie de página.</p>' +
      '<div class="config-fila"><label class="config-etiqueta" for="pageSize">Resultados por página</label>' +
      '<select class="select-mini" id="pageSize" data-rol="pageSize">' +
      F.config.paginas.map(function (n) {
        var et = n === 0 ? 'Todos' : String(n);
        return '<option value="' + n + '"' + (estado.pageSize === n ? ' selected' : '') + '>' + et + '</option>';
      }).join('') + '</select>' +
      '<span class="config-desc">Ahora: ' + (estado.pageSize === 0 ? 'todos' : estado.pageSize) + ' por página</span></div>'));

    /* --- 4. Registro de actividad --- */
    function filasLog(lista) {
      return lista.map(function (r) {
        var clase = r.estado === 200 || r.estado === 'ok' ? 'ok' : (r.estado === 429 ? 'warn' : 'err');
        return '<div class="fila-lista"><code>' + esc(r.t) + '</code>' +
          '<span class="crece" title="' + esc(r.url) + '">' + esc(r.url) + '</span>' +
          '<span class="chip-estado ' + clase + '">' + esc(r.estado) + '</span>' +
          '<span class="mini">' + r.ms + ' ms</span></div>';
      }).join('') || '<p class="config-desc">Registro vacío.</p>';
    }
    html.push(tarjetaConfig('i-info', 'Registro de actividad',
      '<div class="config-tabs">' +
      '<button type="button" class="config-tab' + (estado.logTab === 'api' ? ' activo' : '') +
      '" data-accion="logTab" data-tab="api">API</button>' +
      '<button type="button" class="config-tab' + (estado.logTab === 'push' ? ' activo' : '') +
      '" data-accion="logTab" data-tab="push">Push</button></div>' +
      '<div class="config-caja mono" style="max-height:250px;overflow:auto">' +
      filasLog(estado.logTab === 'api' ? estado.logApi : estado.logPush) + '</div>' +
      '<button type="button" class="btn-suave" data-accion="logLimpiar">Borrar registro ' +
      (estado.logTab === 'api' ? 'API' : 'push') + '</button>'));

    /* --- 5. Notificaciones push --- */
    html.push(tarjetaConfig('i-campana', 'Notificaciones push',
      '<p class="config-desc">El Service Worker comprueba tus favoritas cada pocas horas y avisa si el ' +
      'precio cae (o sube). Permiso del navegador: <span class="chip-estado ok">' + esc(estado.push.permiso) + '</span></p>' +
      '<label class="interruptor"><input type="checkbox" data-rol="pushActivo"' + (estado.push.activo ? ' checked' : '') +
      '> Avisar cuando baja el precio</label>' +
      '<label class="interruptor"><input type="checkbox" data-rol="pushSubida"' + (estado.push.subida ? ' checked' : '') +
      '> Avisar también cuando sube</label>' +
      '<div class="config-fila"><label class="config-etiqueta" for="checkInterval">Intervalo de chequeo (h)</label>' +
      '<input type="number" class="campo campo-num" id="checkInterval" min="1" max="24" value="' + estado.push.intervalo +
      '" data-rol="pushIntervalo">' +
      '<label class="config-etiqueta" for="priceFallDays">Caída en los últimos (días)</label>' +
      '<input type="number" class="campo campo-num" id="priceFallDays" min="0" max="90" value="' + estado.push.dias +
      '" data-rol="pushDias"></div>' +
      '<div class="config-fila"><span class="config-etiqueta">Detección</span>' +
      '<label class="interruptor"><input type="radio" name="modoPush" value="average"' +
      (estado.push.modo === 'average' ? ' checked' : '') + ' data-rol="pushModo"> Promedio del periodo</label>' +
      '<label class="interruptor"><input type="radio" name="modoPush" value="consecutive"' +
      (estado.push.modo === 'consecutive' ? ' checked' : '') + ' data-rol="pushModo"> Días consecutivos</label></div>' +
      '<div class="config-fila"><button type="button" class="btn-suave" data-accion="pushProbar">🔔 Probar notificación</button>' +
      '<button type="button" class="btn-suave" data-accion="pushChequear">Comprobar favoritas ahora</button></div>'));

    /* --- 6. Claves API - IA --- */
    var camposClave = ['google', 'groq', 'mistral', 'openrouter', 'llm7'].map(function (id) {
      var info = provInfo(id);
      return '<label class="config-etiqueta" style="display:flex;flex-direction:column;gap:4px">' +
        esc(info.nombre) + (id === 'llm7' ? ' (opcional)' : '') +
        '<input type="password" class="campo" data-rol="iaClave" data-prov="' + id + '"' +
        ' placeholder="' + (estado.iaConClaves ? '••••••••••••  (cargada)' : (id === 'llm7' ? 'vacío = acceso anónimo' : 'API key')) + '"' +
        ' aria-label="Clave de ' + esc(info.nombre) + '"></label>';
    }).join('');
    html.push(tarjetaConfig('i-ia', 'Claves API - IA',
      '<p class="config-desc">Las claves se cifran en el código con XOR + base64 y se descargan al ' +
      'introducir la contraseña. El prototipo simula que ya están cargadas.</p>' +
      '<div class="config-fila"><label class="sr-solo" for="iaPassphrase">Contraseña</label>' +
      '<input type="password" class="campo" id="iaPassphrase" placeholder="Contraseña de 6 caracteres">' +
      '<button type="button" class="btn-primario" data-accion="clavesCargar">Cargar claves</button>' +
      '<button type="button" class="btn-suave btn-peligro" data-accion="clavesBorrar">Quitar claves</button></div>' +
      (estado.iaConClaves
        ? '<p class="config-desc"><span class="chip-estado ok">4/4 cargadas</span> Google, Groq, Mistral y ' +
          'OpenRouter listos. LLM7 funciona sin clave.</p>'
        : '<p class="config-desc"><span class="chip-estado err">sin claves</span> Los proveedores que necesitan ' +
          'clave aparecerán como no disponibles en el chat (así se ve el estado de error).</p>') +
      '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(190px,1fr));gap:10px">' + camposClave + '</div>' +
      '<p class="config-desc">NVIDIA va por el Worker de Cloudflare (su API solo permite el origen ' +
      '<code>build.nvidia.com</code>): la clave vive en el secreto <code>NVIDIA_API_KEY</code> y aquí solo se guarda la URL del proxy.</p>'));

    /* --- 7. Pestañas de IA --- */
    var casillas = PROVEEDORES.filter(function (p) { return !p.todos; }).map(function (p) {
      var visibles = provVisibles().length;
      var inhabilitar = estado.iaVisibles[p.id] && visibles <= 1;
      return '<label class="interruptor" style="' + (inhabilitar ? 'opacity:.55' : '') + '">' +
        '<input type="checkbox" data-rol="iaVisible" data-prov="' + p.id + '"' +
        (estado.iaVisibles[p.id] ? ' checked' : '') + '> ' + esc(p.nombre) + '</label>';
    }).join('');
    html.push(tarjetaConfig('i-ia', 'Pestañas de IA',
      '<p class="config-desc">Elige qué proveedores aparecen en la pestaña IA. Siempre tiene que quedar ' +
      'al menos uno: la pestaña General no se puede ocultar.</p>' +
      '<div class="cuadricula-check">' + casillas + '</div>'));

    /* --- 8. Prompts rápidos --- */
    var prompts = estado.prompts.map(function (p, idx) {
      return '<div class="prompt-fila"><span class="prompt-num">' + (idx + 1) + '</span>' +
        '<input type="text" class="campo" value="' + esc(p) + '" data-rol="prompt" data-i="' + idx + '"' +
        ' placeholder="Prompt rápido ' + (idx + 1) + '" aria-label="Prompt rápido ' + (idx + 1) + '"></div>';
    }).join('');
    html.push(tarjetaConfig('i-rayo', 'Prompts rápidos',
      '<p class="config-desc">Son los botones que aparecen en la cabecera de la pestaña General. ' +
      'Deja un campo vacío para no mostrar ese botón.</p>' + prompts));

    /* --- 9. Actualización de la app --- */
    html.push(tarjetaConfig('i-refrescar', 'Actualización de la app',
      '<p class="config-desc">Versión instalada: <b>' + esc(estado.version.texto) + '</b><br>' +
      'Build <code>' + esc(estado.version.build) + '</code> · Service Worker con precaché generado.</p>' +
      '<div class="config-fila"><button type="button" class="btn-suave" data-accion="buscarUpdate">Buscar actualizaciones</button>' +
      '<span class="config-desc" id="updateStatus">No verificado</span></div>'));

    $('#configGrid').innerHTML = html.join('');
  }

  /* ======================================================================
   * 12. Desplegables, avisos y eventos
   * ==================================================================== */

  /* --- 12.1 Desplegable flotante reutilizable ---------------------------- */

  var despTipo = null;      /* 'provincia' | 'combustible' | 'filtros' | 'push' */
  var despAncla = null;     /* botón que lo abrió (para recolocarlo) */
  var despTexto = '';       /* texto del buscador de provincias */

  function estaDesplegado() { return despTipo !== null; }

  /** Coloca la caja bajo el ancla, sin salirse de la ventana. */
  function colocarDesplegable(ancla, ancho) {
    var caja = $('#desplegable');
    if (!ancla) return;
    var r = ancla.getBoundingClientRect();
    var margen = 12;
    var real = Math.max(240, Math.min(ancho, window.innerWidth - margen * 2));
    var izq = r.left + r.width / 2 - real / 2;
    izq = Math.max(margen, Math.min(izq, window.innerWidth - real - margen));
    var arriba = Math.round(r.bottom + 8);
    /* Si no cabe abajo, se abre hacia arriba */
    if (arriba + 260 > window.innerHeight) arriba = Math.max(margen, Math.round(r.top - 268));
    caja.style.setProperty('--desp-ancho', real + 'px');
    caja.style.setProperty('--desp-top', arriba + 'px');
    caja.style.setProperty('--desp-left', Math.round(izq) + 'px');
  }

  function abrirDesplegable(tipo, ancla) {
    var caja = $('#desplegable');
    despTipo = tipo;
    despAncla = ancla;
    despTexto = '';
    caja.innerHTML = contenidoDesplegable(tipo);
    caja.hidden = false;
    colocarDesplegable(ancla, tipo === 'filtros' ? 350 : 330);
    $$('[data-desplegable]').forEach(function (b) {
      b.setAttribute('aria-expanded', b === ancla ? 'true' : 'false');
    });
    var buscador = $('#despBuscar');
    if (buscador) buscador.focus();
  }

  function alternarDesplegable(tipo, ancla) {
    if (despTipo === tipo && despAncla === ancla) cerrarDesplegable();
    else abrirDesplegable(tipo, ancla);
  }

  function cerrarDesplegable() {
    if (!estaDesplegado()) return;
    despTipo = null;
    despAncla = null;
    despTexto = '';
    var caja = $('#desplegable');
    caja.hidden = true;
    caja.innerHTML = '';
    $$('[data-desplegable]').forEach(function (b) { b.setAttribute('aria-expanded', 'false'); });
  }

  /** Avisos efímeros (abajo, sobre la barra de estado). */
  function avisar(texto, tipo, opciones) {
    opciones = opciones || {};
    var div = document.createElement('div');
    div.className = 'aviso' + (tipo ? ' ' + tipo : '');
    if (tipo === 'push') {
      div.innerHTML = '<span class="aviso-icono" aria-hidden="true">🔔</span>' +
        '<span><b class="aviso-titulo">' + esc(opciones.titulo || 'Notificación') + '</b>' +
        '<span class="aviso-texto">' + esc(texto) + '</span></span>';
    } else {
      div.textContent = texto;
    }
    div.setAttribute('role', 'status');
    $('#avisos').appendChild(div);
    var vida = opciones.ms || 2600;
    setTimeout(function () {
      div.style.transition = 'opacity 200ms linear';
      div.style.opacity = '0';
      setTimeout(function () { div.parentNode.removeChild(div); }, 220);
    }, vida);
  }

  function horaLog() {
    var d = new Date();
    function dos(n) { return ('0' + n).slice(-2); }
    return dos(d.getDate()) + '/' + dos(d.getMonth() + 1) + '/' + String(d.getFullYear()).slice(2) +
      ' ' + dos(d.getHours()) + ':' + dos(d.getMinutes()) + ':' + dos(d.getSeconds());
  }

  /* --- 12.2 Pintado global: escenario, selección y refresco -------------- */

  /** Vistas, detalle abierto, rail activo y estilo del mapa. */
  function pintarEscenario() {
    var esc = $('#escenario');
    esc.dataset.vista = estado.vista;
    var abierto = !!estado.detalleAbierto && !!estado.sel &&
      estado.vista !== 'ia' && estado.vista !== 'config';
    esc.classList.toggle('detalle-abierto', abierto);
    $('#panelDetalle').hidden = !abierto;
    $('#panelLista').classList.toggle('ampliada', estado.listaAmpliada);
    $('#mapaCaja').dataset.estilo = estado.mapaEstilo;
    var est = $('#mapaEstilo');
    if (est && est.value !== estado.mapaEstilo) est.value = estado.mapaEstilo;
    $$('#rail .rail-btn').forEach(function (b) {
      var act = b.dataset.vista === estado.vista;
      b.classList.toggle('activo', act);
      if (act) b.setAttribute('aria-current', 'page');
      else b.removeAttribute('aria-current');
    });
  }

  /** Marca la estación seleccionada en lista, tabla y mapa. */
  function sincronizarSeleccion(desdeMapa) {
    var id = estado.detalleAbierto ? estado.sel : null;
    $$('.tarjeta, #tablaScroll tbody tr').forEach(function (n) {
      n.classList.toggle('sel', !!id && n.dataset.fila === id);
    });
    $$('.marcador').forEach(function (n) {
      n.classList.toggle('sel', !!id && n.dataset.id === id);
    });
    var ordenSel = $('#ordenLista');
    if (ordenSel) {
      var valor = estado.orden.campo === 'precio' ? 'precio-' + estado.orden.dir : estado.orden.campo;
      var existe = $$('option', ordenSel).some(function (o) { return o.value === valor; });
      if (existe) ordenSel.value = valor;
    }
    if (desdeMapa && id) {
      var fila = $('[data-fila="' + id + '"]');
      if (fila && fila.scrollIntoView) fila.scrollIntoView({ block: 'nearest' });
    }
  }

  /**
   * Repinta todo lo que depende de los filtros. Guarda y devuelve el scroll
   * de lista y tabla para que filtrar no dé un salto brusco.
   */
  function renderDatos() {
    var sc = $('#listaCuerpo');
    var ts = $('#tablaScroll');
    var scrollLista = sc ? sc.scrollTop : 0;
    var scrollTabla = ts ? ts.scrollTop : 0;

    var lista = ordenarLista(listaFiltrada());
    pintarCabecera(lista);
    pintarEscenario();
    pintarMapa(lista);
    pintarResumen(lista);
    pintarLista(lista);
    pintarTabla(lista);
    pintarBarra(lista);

    if (sc) sc.scrollTop = scrollLista;
    if (ts) ts.scrollTop = scrollTabla;
    sincronizarSeleccion(false);
  }

  /** Cambio de vista principal (rail / bottom-nav). */
  function cambiarVista(vista) {
    if (!vista) return;
    estado.vista = vista;
    if (vista === 'ia' || vista === 'config') estado.detalleAbierto = false;
    if (vista === 'ia') estado.iaTab = estado.iaTab || 'general';
    cerrarDesplegable();
    ocultarSugerencias();
    renderDatos();
    if (vista === 'ia') pintarIA();
    if (vista === 'config') pintarConfig();
  }

  /* --- 12.3 Contenido de cada desplegable -------------------------------- */

  function despCab(titulo) {
    return '<div class="desp-cab"><span>' + esc(titulo) + '</span>' +
      '<button type="button" class="fav-btn" data-accion="cerrar-desplegable" aria-label="Cerrar el panel">' +
      '<svg class="icono icono-14"><use href="#i-cerrar"/></svg></button></div>';
  }

  function contenidoDesplegable(tipo) {
    if (tipo === 'provincia') {
      return despCab('Provincia') +
        '<input type="search" class="campo desp-buscar" id="despBuscar" data-rol="despBuscar" value="' +
        esc(despTexto) + '" placeholder="Buscar provincia…" aria-label="Buscar provincia">' +
        '<div id="despLista">' + listaProvinciasHTML() + '</div>';
    }
    if (tipo === 'combustible') return contenidoCombustible();
    if (tipo === 'filtros') return contenidoFiltros();
    if (tipo === 'push') return contenidoPush();
    return '';
  }

  function listaProvinciasHTML() {
    var q = norm(despTexto).trim();
    var html = [];
    if (!q) {
      var todas = F.estaciones.length;
      html.push('<button type="button" class="desp-opcion' + (!estado.provincia ? ' elegida' : '') +
        '" data-accion="elegir-provincia" data-id=""><span class="crece">Todas las provincias</span>' +
        '<span class="mini">' + todas + '</span></button>');
    }
    var provs = F.provincias.filter(function (p) { return !q || norm(p.nombre).indexOf(q) !== -1; })
      .map(function (p) { return { p: p, n: F.estacionesDe(p.id).length }; })
      .sort(function (a, b) {
        if (q) return b.n - a.n;
        return a.p.nombre.localeCompare(b.p.nombre, 'es');
      });
    if (!provs.length) html.push('<div class="sug-vacio">Ninguna provincia coincide.</div>');
    provs.forEach(function (x) {
      var elegida = estado.provincia === x.p.id;
      html.push('<button type="button" class="desp-opcion' + (elegida ? ' elegida' : '') +
        '" data-accion="elegir-provincia" data-id="' + x.p.id + '"' + (elegida ? ' aria-current="true"' : '') + '>' +
        '<span class="crece">' + esc(x.p.nombre) + '</span><span class="mini">' + x.n + ' est.</span></button>');
    });
    return html.join('');
  }

  function refrescarListaProvincias() {
    var cont = $('#despLista');
    if (cont) cont.innerHTML = listaProvinciasHTML();
  }

  function opcionCombustible(c, n) {
    var elegida = estado.combustible === c;
    return '<button type="button" class="desp-opcion' + (elegida ? ' elegida' : '') +
      '" data-accion="elegir-combustible" data-comb="' + esc(c) + '"' + (elegida ? ' aria-current="true"' : '') + '>' +
      '<span class="crece">' + esc(c) + '</span><span class="mini">' + n + ' est.</span></button>';
  }

  function contenidoCombustible() {
    var ests = F.estacionesDe(estado.provincia);
    function venden(c) { return ests.filter(function (e) { return e.precios[c] != null; }).length; }
    var html = [despCab('Combustible')];
    html.push('<button type="button" class="desp-opcion' + (!estado.combustible ? ' elegida' : '') +
      '" data-accion="elegir-combustible" data-comb=""><span class="crece">El más barato de cada estación</span></button>');
    var usados = {};
    Object.keys(F.grupos).forEach(function (g) {
      html.push('<div class="desp-grupo">' + esc(g) + '</div>');
      F.grupos[g].forEach(function (c) { usados[c] = 1; html.push(opcionCombustible(c, venden(c))); });
    });
    var otros = F.combustibles.filter(function (c) { return !usados[c]; });
    if (otros.length) {
      html.push('<div class="desp-grupo">Otros</div>');
      otros.forEach(function (c) { html.push(opcionCombustible(c, venden(c))); });
    }
    return html.join('');
  }

  function contenidoFiltros() {
    var prov = estado.provincia;
    var ests = F.estacionesDe(prov);
    var html = [despCab('Filtros')];

    html.push('<div class="desp-grupo">Localidad</div>');
    html.push('<button type="button" class="desp-opcion' + (!estado.localidad ? ' elegida' : '') +
      '" data-accion="elegir-localidad" data-loc=""><span class="crece">Todas las localidades</span>' +
      '<span class="mini">' + ests.length + ' est.</span></button>');
    F.localidadesDe(prov).forEach(function (l) {
      var n = ests.filter(function (e) { return e.localidad === l; }).length;
      var elegida = estado.localidad === l;
      html.push('<button type="button" class="desp-opcion' + (elegida ? ' elegida' : '') +
        '" data-accion="elegir-localidad" data-loc="' + esc(l) + '"' + (elegida ? ' aria-current="true"' : '') + '>' +
        '<span class="crece">' + esc(l) + '</span><span class="mini">' + n + ' est.</span></button>');
    });

    html.push('<div class="desp-sep"></div>');
    html.push('<div class="desp-grupo">Distancia máxima desde tu ubicación</div>');
    html.push('<div class="rango-fila"><input type="range" min="0" max="40" step="1" value="' +
      estado.distanciaMax + '" data-rol="distanciaMax" aria-label="Distancia máxima en kilómetros">' +
      '<span class="rango-valor" id="distanciaVal">' +
      (estado.distanciaMax ? estado.distanciaMax + ' km' : 'Sin límite') + '</span></div>');

    html.push('<div class="desp-sep"></div>');
    html.push('<div class="desp-grupo">Marca (varias a la vez)</div>');
    var marcas = F.marcasDe(prov);
    if (!marcas.length) html.push('<div class="sug-vacio">No hay marcas en esta provincia.</div>');
    else html.push(marcas.map(function (m) {
      return '<label class="desp-opcion"><input type="checkbox" class="desp-check" data-rol="marca" ' +
        'data-marca="' + esc(m) + '" data-tap-exenta' + (estado.marcas[m] ? ' checked' : '') + '>' +
        '<span class="crece">' + esc(m) + '</span>' +
        '<span class="mini">' + ests.filter(function (e) { return e.marca === m; }).length + '</span></label>';
    }).join(''));

    html.push('<div class="desp-sep"></div>');
    html.push('<label class="desp-opcion"><input type="checkbox" class="desp-check" data-rol="soloFavoritos" ' +
      'data-tap-exenta' + (estado.soloFavoritos ? ' checked' : '') + '>' +
      '<span class="crece">Solo mis favoritas</span></label>');

    html.push('<div class="desp-acciones">' +
      '<button type="button" class="btn-suave" data-accion="limpiar-filtros">Quitar filtros</button>' +
      '<button type="button" class="btn-primario" data-accion="cerrar-desplegable">Listo</button></div>');
    return html.join('');
  }

  function filaPush(etiqueta, campo, activo) {
    return '<button type="button" class="desp-opcion" data-accion="push-cambiar" data-campo="' + campo +
      '" aria-pressed="' + !!activo + '"><span class="crece">' + esc(etiqueta) + '</span>' +
      '<span class="chip-estado ' + (activo ? 'ok' : 'neutro') + '">' +
      (activo ? 'activado' : 'desactivado') + '</span></button>';
  }

  function contenidoPush() {
    var p = estado.push;
    var nFav = Object.keys(estado.favoritos).filter(function (k) { return estado.favoritos[k]; }).length;
    var html = [despCab('Notificaciones push')];
    html.push('<p class="config-desc">El Service Worker revisa tus favoritas y avisa si el precio cae. ' +
      'Permiso del navegador: <span class="chip-estado ok">' + esc(p.permiso) + '</span></p>');
    html.push(filaPush('Avisar cuando baja el precio', 'activo', p.activo));
    html.push(filaPush('Avisar también cuando sube', 'subida', p.subida));
    html.push('<div class="config-fila"><label class="config-etiqueta" for="despPushIntervalo">Cada cuántas horas</label>' +
      '<input type="number" class="campo campo-num" id="despPushIntervalo" min="1" max="24" value="' + p.intervalo +
      '" data-rol="pushIntervalo">' +
      '<label class="config-etiqueta" for="despPushDias">Caída en los últimos (días)</label>' +
      '<input type="number" class="campo campo-num" id="despPushDias" min="0" max="90" value="' + p.dias +
      '" data-rol="pushDias"></div>');
    html.push('<div class="config-fila"><button type="button" class="btn-suave" data-accion="pushProbar">🔔 Probar</button>' +
      '<button type="button" class="btn-suave" data-accion="pushChequear">Comprobar ahora</button></div>');
    html.push('<p class="config-desc">Favoritas guardadas: <b>' + nFav + '</b> · intervalo actual ' +
      p.intervalo + ' h</p>');
    return html.join('');
  }

  /** Vuelve a pintar el desplegable abierto (tras cambiar algo dentro). */
  function refrescarDesplegable() {
    if (!estaDesplegado()) return;
    $('#desplegable').innerHTML = contenidoDesplegable(despTipo);
    colocarDesplegable(despAncla, despTipo === 'filtros' ? 350 : 330);
  }

  /* ======================================================================
   * 12B. Eventos (delegación + teclado)
   * ==================================================================== */
  var lastFocus = null;

  function guardarFoco() {
    lastFocus = document.activeElement;
  }

  function restaurarFoco() {
    if (lastFocus && lastFocus.focus) {
      try { lastFocus.focus(); } catch (e) {}
    }
  }

  function detenerProp(e) {
    e.preventDefault();
    e.stopPropagation();
  }

  /* Delegación de clics */
  document.addEventListener('click', function (e) {
    var t = e.target;
    while (t && t !== document.body) {
      var accion = t.getAttribute('data-accion');
      if (accion) {
        switch (accion) {
          case 'vista':
            cambiarVista(t.getAttribute('data-vista'));
            break;
          case 'desplegable':
            alternarDesplegable(t.getAttribute('data-desplegable'), t);
            break;
          case 'cerrar-desplegable':
            cerrarDesplegable();
            break;
          case 'elegir-provincia':
            estado.provincia = t.getAttribute('data-id') || '';
            estado.localidad = '';
            estado.pagina = 1;
            cacheSerie = {};
            cerrarDesplegable();
            renderDatos();
            break;
          case 'elegir-combustible':
            var comb = t.getAttribute('data-comb');
            estado.combustible = comb || '';
            estado.pagina = 1;
            cacheSerie = {};
            cerrarDesplegable();
            renderDatos();
            break;
          case 'elegir-localidad':
            var loc = t.getAttribute('data-loc') || '';
            estado.localidad = loc;
            estado.pagina = 1;
            cerrarDesplegable();
            renderDatos();
            break;
          case 'marca':
            // manejado por change, pero por si acaso
            break;
          case 'solo-favoritos':
            estado.soloFavoritos = !estado.soloFavoritos;
            renderDatos();
            break;
          case 'limpiar-filtros':
            estado.localidad = '';
            estado.distanciaMax = 0;
            estado.marcas = {};
            estado.soloFavoritos = false;
            estado.busqueda = '';
            $('#buscador').value = '';
            estado.pagina = 1;
            cerrarDesplegable();
            renderDatos();
            break;
          case 'abrir-detalle':
          case 'marcador':
            guardarFoco();
            var disparador = t.closest ? t.closest('[data-fila], .marcador, .resumen-barata') : null;
            if (disparador) lastFocus = disparador;
            abrirDetalle(t.getAttribute('data-id'));
            break;
          case 'favorito':
            var fid = t.getAttribute('data-id');
            if (fid) {
              estado.favoritos[fid] = !estado.favoritos[fid];
              renderDatos();
              if (estado.detalleAbierto) pintarDetalle();
            }
            break;
          case 'ruta':
            avisar('Ruta copiada (prototipo)', 'ok');
            break;
          case 'compartir':
            avisar('Datos copiados al portapapeles (prototipo)', 'ok');
            break;
          case 'detalle-tab':
            var dtab = t.getAttribute('data-tab');
            estado.detalleTab = dtab || 'info';
            $('.detalle-tab.activo').classList.remove('activo');
            $('.detalle-panel.activo').classList.remove('activo');
            t.classList.add('activo');
            var panelInfo = $('#detallePanelInfo');
            var panelHist = $('#detallePanelHist');
            if (panelInfo) panelInfo.classList.toggle('activo', dtab === 'info');
            if (panelHist) panelHist.classList.toggle('activo', dtab === 'historico');
            if (dtab === 'historico') { pintarDetalleHistorico(); }
            break;
          case 'alternar-lista':
            estado.listaAmpliada = !estado.listaAmpliada;
            pintarEscenario();
            break;
          case 'cerrar-detalle':
            cerrarDetalle();
            restaurarFoco();
            break;
          case 'zoom':
            var paso = parseInt(t.getAttribute('data-paso') || '0');
            if (paso === 0) { estado.zoom = 1; estado.panX = 0; estado.panY = 0; }
            else { estado.zoom = Math.max(0.8, Math.min(2.5, estado.zoom + paso * 0.1)); }
            aplicarZoom();
            break;
          case 'geolocalizar':
            avisar('Ubicación simulada (prototipo)', 'ok');
            break;
          case 'refrescar':
            estado.cargando = true;
            cacheSerie = {};
            setTimeout(function () { estado.cargando = false; renderDatos(); avisar('Datos actualizados', 'ok'); }, 300);
            break;
          case 'pagina':
            var ppaso = parseInt(t.getAttribute('data-paso') || '0');
            var listaP = ordenarLista(listaFiltrada());
            var totalP = estado.pageSize === 0 ? 1 : Math.max(1, Math.ceil(listaP.length / estado.pageSize));
            estado.pagina = Math.max(1, Math.min(totalP, estado.pagina + ppaso));
            renderDatos();
            break;
          case 'ordenar':
            var campo = t.getAttribute('data-campo');
            if (campo) {
              if (estado.orden.campo === campo) {
                estado.orden.dir = estado.orden.dir === 'asc' ? 'desc' : 'asc';
              } else {
                estado.orden.campo = campo;
                estado.orden.dir = campo === 'precio' ? 'asc' : 'asc';
              }
              estado.pagina = 1;
              renderDatos();
            }
            break;
          case 'ia-tab':
            var iprov = t.getAttribute('data-prov');
            if (iprov) { estado.iaTab = iprov; pintarIA(); }
            break;
          case 'ia-borrar':
            var btab = estado.iaTab;
            estado.iaChats[btab] = [];
            delete estado.iaPendientes[btab];
            pintarIA();
            break;
          case 'ia-prompt':
            var idxp = parseInt(t.getAttribute('data-i') || '0');
            if (estado.prompts[idxp]) {
              $('#iaInput').value = estado.prompts[idxp];
              $('#iaInput').focus();
            }
            break;
          case 'ia-refrescar':
            avisar('Catálogo de modelos simulado (prototipo)', 'ok');
            break;
          case 'limpiar-busqueda':
            estado.busqueda = '';
            $('#buscador').value = '';
            estado.pagina = 1;
            ocultarSugerencias();
            renderDatos();
            if ($('#buscador')) $('#buscador').focus();
            break;
          case 'sugerencia':
            var sug = estacion(t.getAttribute('data-id'));
            if (sug) {
              estado.provincia = sug.prov;
              estado.localidad = '';
              estado.busqueda = sug.nombre;
              estado.pagina = 1;
              $('#buscador').value = estado.busqueda;
              ocultarSugerencias();
              cacheSerie = {};
              renderDatos();
              guardarFoco();
              lastFocus = $('#buscador');
              abrirDetalle(sug.id);
            }
            break;
          case 'push-cambiar':
            var pcam = t.getAttribute('data-campo');
            if (pcam === 'activo') estado.push.activo = !estado.push.activo;
            if (pcam === 'subida') estado.push.subida = !estado.push.subida;
            refrescarDesplegable();
            pintarCabecera(listaFiltrada());
            break;
          case 'pushProbar':
            avisar('Notificación de prueba (prototipo)', 'push', { titulo: 'Gasolineras', ms: 2800 });
            refrescarDesplegable();
            break;
          case 'pushChequear':
            avisar('Comprobación de favoritas simulada', 'ok');
            refrescarDesplegable();
            break;
          case 'cacheTab':
            estado.cacheTab = t.getAttribute('data-tab') || 'indexeddb';
            pintarConfig();
            break;
          case 'logTab':
            estado.logTab = t.getAttribute('data-tab') || 'api';
            pintarConfig();
            break;
          case 'logLimpiar':
            if (estado.logTab === 'api') estado.logApi = [];
            else estado.logPush = [];
            pintarConfig();
            break;
          case 'cacheLimpiar':
            avisar('Caché borrado (prototipo)', 'ok');
            break;
          case 'lsBorrar':
            var lsc = t.getAttribute('data-clave');
            estado.cache.ls = estado.cache.ls.filter(function (x) { return x.k !== lsc; });
            pintarConfig();
            break;
          case 'descAnadir':
            var nm = $('#nuevaMarca');
            if (nm && nm.value && !estado.descuentos[nm.value]) {
              estado.descuentos[nm.value] = 0.03;
              nm.value = '';
              pintarConfig();
              renderDatos();
            }
            break;
          case 'descQuitar':
            var dm = t.getAttribute('data-marca');
            if (dm) { delete estado.descuentos[dm]; pintarConfig(); renderDatos(); }
            break;
          case 'buscarUpdate':
            var us = $('#updateStatus');
            if (us) us.textContent = 'Sin actualizaciones disponibles';
            break;
        }
        break; // solo primer accion
      }
      t = t.parentNode;
    }
  }, false);

  /* Change events (inputs/checkboxes/selects con data-rol) */
  document.addEventListener('change', function (e) {
    var t = e.target;

    /* Controles con id propio que no llevan data-rol */
    if (t.id === 'mapaEstilo') {
      estado.mapaEstilo = t.value || 'satelite';
      pintarEscenario();
      return;
    }
    if (t.id === 'ordenLista') {
      var ov = String(t.value || 'precio-asc');
      var partes = ov.split('-');
      estado.orden.campo = partes[0];
      estado.orden.dir = partes[1] === 'desc' ? 'desc' : 'asc';
      estado.pagina = 1;
      estado.indiceFoco = -1;
      renderDatos();
      return;
    }

    var rol = t.getAttribute('data-rol');
    if (!rol) return;
    switch (rol) {
      case 'despBuscar':
        despTexto = t.value || '';
        refrescarListaProvincias();
        break;
      case 'distanciaMax':
        estado.distanciaMax = parseInt(t.value || '0');
        var dv = $('#distanciaVal');
        if (dv) dv.textContent = estado.distanciaMax ? estado.distanciaMax + ' km' : 'Sin límite';
        renderDatos();
        break;
      case 'marca':
        var m = t.getAttribute('data-marca');
        if (m) { estado.marcas[m] = !!t.checked; estado.pagina = 1; renderDatos(); }
        break;
      case 'soloFavoritos':
        estado.soloFavoritos = !!t.checked;
        renderDatos();
        break;
      case 'descActivos':
        estado.descuentosActivos = !!t.checked;
        pintarConfig();
        renderDatos();
        break;
      case 'descValor':
        var mdv = t.getAttribute('data-marca');
        if (mdv) { estado.descuentos[mdv] = Math.max(0, parseFloat(t.value) || 0); renderDatos(); }
        break;
      case 'histCombustible':
        estado.histCombustible = t.value;
        pintarDetalleHistorico();
        break;
      case 'histDias':
        estado.histDias = parseInt(t.value || '14');
        pintarDetalleHistorico();
        break;
      case 'iaModelo':
        if (estado.iaTab !== 'general') estado.iaModelos[estado.iaTab] = t.value;
        break;
      case 'iaVisible':
        var ipv = t.getAttribute('data-prov');
        if (ipv) {
          var visiblesAct = provVisibles().length;
          if (!t.checked && estado.iaVisibles[ipv] && visiblesAct <= 1) {
            t.checked = true;
            avisar('Debe quedar al menos un proveedor visible', 'warn');
          } else {
            estado.iaVisibles[ipv] = !!t.checked;
          }
          pintarIA();
          pintarConfig();
        }
        break;
      case 'prompt':
        var ipm = parseInt(t.getAttribute('data-i') || '0');
        if (ipm >= 0 && ipm < estado.prompts.length) estado.prompts[ipm] = t.value || '';
        break;
      case 'pageSize':
        estado.pageSize = parseInt(t.value || F.config.pageSize);
        estado.pagina = 1;
        renderDatos();
        pintarConfig();
        break;
      case 'cacheTtl':
        estado.cache.ttl = Math.max(0, parseInt(t.value || estado.cache.ttl));
        break;
      case 'pushIntervalo':
        estado.push.intervalo = Math.max(1, Math.min(24, parseInt(t.value || estado.push.intervalo)));
        pintarCabecera(listaFiltrada());
        refrescarDesplegable();
        pintarConfig();
        break;
      case 'pushDias':
        estado.push.dias = Math.max(0, Math.min(90, parseInt(t.value || estado.push.dias)));
        refrescarDesplegable();
        pintarConfig();
        break;
      case 'pushModo':
        if (t.checked) estado.push.modo = t.value;
        pintarConfig();
        break;
      case 'iaClave':
        // prototipo: simula carga; no guarda
        break;
    }
  }, false);

  /* Input (buscador, slider de distancia y buscador de provincias) */
  var buscadorEl = $('#buscador');
  if (buscadorEl) {
    buscadorEl.addEventListener('input', function () {
      estado.busqueda = buscadorEl.value || '';
      estado.pagina = 1;
      var limpiar = $('.buscador-limpiar');
      if (limpiar) limpiar.hidden = !estado.busqueda;
      renderDatos();
      pintarSugerencias();
    });
    buscadorEl.addEventListener('focus', function () {
      $('#buscadorCaja').classList.add('focus');
      pintarSugerencias();
    });
    buscadorEl.addEventListener('blur', function () {
      $('#buscadorCaja').classList.remove('focus');
      setTimeout(ocultarSugerencias, 150);
    });
  }

  /* Los desplegables se repintan mientras se escribe (no hay que esperar al change) */
  document.addEventListener('input', function (e) {
    var t = e.target;
    if (!t || !t.getAttribute) return;
    var rol = t.getAttribute('data-rol');
    if (rol === 'despBuscar') {
      despTexto = t.value || '';
      refrescarListaProvincias();
    } else if (rol === 'distanciaMax') {
      estado.distanciaMax = parseInt(t.value || '0', 10) || 0;
      var dv = $('#distanciaVal');
      if (dv) dv.textContent = estado.distanciaMax ? estado.distanciaMax + ' km' : 'Sin límite';
      renderDatos();
    }
  }, false);

  /* Teclado */
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') {
      if (estaDesplegado()) { cerrarDesplegable(); return; }
      if (estado.detalleAbierto) { cerrarDetalle(); restaurarFoco(); return; }
    }
    if (e.key === '/' && e.target.tagName !== 'INPUT' && e.target.tagName !== 'TEXTAREA') {
      e.preventDefault();
      if (buscadorEl) { buscadorEl.focus(); }
      return;
    }
    if (e.target && e.target.classList && e.target.classList.contains('panel-asa') && (e.key === 'Enter' || e.key === ' ')) {
      detenerProp(e);
      estado.listaAmpliada = !estado.listaAmpliada;
      pintarEscenario();
      return;
    }
    if (e.key === 'Enter' || e.key === ' ') {
      if (e.target.getAttribute && e.target.getAttribute('role') === 'button') {
        detenerProp(e);
        e.target.click();
        return;
      }
    }
  }, false);

  /* Gráfica: hover */
  document.addEventListener('mousemove', function (e) {
    var caja = $('#graficaCaja');
    if (caja && caja.contains(e.target)) { hoverGrafica(caja, e); }
    else { ocultarHoverGrafica(); }
  }, false);
  document.addEventListener('mouseleave', function () { ocultarHoverGrafica(); }, false);

  /* Resize: recalcular gráfica */
  window.addEventListener('resize', function () {
    if (estado.detalleTab === 'historico' && estado.detalleAbierto) {
      redibujarGrafica();
    }
    if (estaDesplegado() && despAncla) {
      colocarDesplegable(despAncla, despTipo === 'filtros' ? 350 : 330);
    }
  }, false);

  /* Cerrar desplegables al clicar fuera */
  document.addEventListener('mousedown', function (e) {
    var caja = $('#desplegable');
    if (!caja || caja.hidden) return;
    if (caja.contains(e.target)) return;
    if (e.target.closest && e.target.closest('[data-accion="desplegable"]')) return;
    cerrarDesplegable();
  }, true);

  /* Chat IA */
  var iaForm = $('#iaForm');
  if (iaForm) {
    iaForm.addEventListener('submit', function (e) {
      e.preventDefault();
      var inp = $('#iaInput');
      var txt = inp ? inp.value : '';
      if (txt.trim()) {
        enviarIA(txt);
        inp.value = '';
      }
    });
  }

  /* ======================================================================
   * 13. Arranque
   * ==================================================================== */
  (function inicializar() {
    cacheSerie = {};
    // Estado inicial de navegación
    pintarEscenario();
    // Primer render
    renderDatos();
    // Simular carga final
    setTimeout(function () {
      estado.cargando = false;
      renderDatos();
    }, 200);
    // Vista inicial mapa
    cambiarVista(estado.vista || 'mapa');
    // Foco inicial opcional
    if (buscadorEl) buscadorEl.blur();
  })();

})();
