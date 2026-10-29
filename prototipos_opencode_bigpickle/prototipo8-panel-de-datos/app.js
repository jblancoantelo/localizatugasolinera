/* =============================================================================
 * Prototipo 8 · «Panel de datos / analítica» — lógica de la maqueta
 * -----------------------------------------------------------------------------
 * Maqueta de rediseño (no toca la app real). Todo el estado vive en memoria y los
 * datos salen de window.FAKE (../shared/datos-fake.js). La tesis de este prototipo
 * es que el usuario quiere ENTENDER el mercado: agregar, comparar y visualizar.
 *
 *   · Controles globales: provincia · combustible · periodo (días)
 *   · Panel  → KPIs, evolución de la media provincial, marcas, localidades,
 *              tramos de precio, ¿cuándo repostar?, comparador y provincias
 *   · Mapa   → fondo SVG fake + marcadores-precio + leyenda
 *   · Estaciones → buscador, orden, tabla ordenable y comparador
 *   · IA     → proveedores, markdown, prompts
 *   · Config → paginación, caché, notificaciones, IA y versión
 *   · Ficha  → detalle de estación con gráfica canvas y tooltip
 * ========================================================================== */
(function () {
  'use strict';

  var F = window.FAKE;
  if (!F) return;

  var $ = function (sel, raiz) { return (raiz || document).querySelector(sel); };
  var $$ = function (sel, raiz) { return Array.prototype.slice.call((raiz || document).querySelectorAll(sel)); };

  /* =======================================================================
   * 1. Constantes y estado
   * ===================================================================== */
  var DIAS = [7, 14, 30, 60, 90, 180];
  var PROV_DEF = '28';
  var FUEL_DEF = 'Gasolina 95 E5';
  var DIAS_DEF = 30;
  var MAX_COMP = 4;
  var FILA_DIAS = 30;

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
    'chrome-nano': ['integrado']
  };
  var COLOR = { verde: '#146b3c', naranja: '#8a5200', rojo: '#a5281c', gris: '#55636f' };
  var COLOR_VIVO = { verde: '#1b8a4b', naranja: '#b26a00', rojo: '#c0392b', gris: '#8695a4' };

  var nombreProv = {};
  F.provincias.forEach(function (p) { nombreProv[p.id] = p.nombre; });

  var STATE = {
    vista: 'panel',
    prov: PROV_DEF,
    fuel: FUEL_DEF,
    dias: DIAS_DEF,
    texto: '',
    sortCol: 'precio',
    sortDir: 'asc',
    seleccion: [],
    favoritos: new Set(),
    descuentos: {},
    dirLoc: 'baratas',
    fichaId: null,
    fichaFuel: null,
    fichaDias: 14,
    ia: { prov: 'general', modelos: {}, mensajes: {}, enviando: false },
    cfg: {
      pagina: F.config.pageSize, ttl: F.config.cacheTtl, push: true, pushSubida: false,
      intervalo: F.config.checkInterval, diasFall: F.config.priceFallDays,
      modo: F.config.priceCheckMode, cacheTab: 'idb', logTab: 'api'
    }
  };
  F.estaciones.forEach(function (e) {
    if (e.fav) STATE.favoritos.add(e.id);
    if (F.descuentos[e.marca] != null) STATE.descuentos[e.marca] = F.descuentos[e.marca];
  });

  /* =======================================================================
   * 2. Utilidades de formato
   * ===================================================================== */
  function esc(s) {
    return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }
  function norm(s) {
    return String(s).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  }
  function num(v, dec) { return v == null ? '—' : v.toFixed(dec).replace('.', ','); }
  function eur(p) { return p == null ? '—' : p.toFixed(3).replace('.', ',') + ' €'; }
  function eur2(p) { return p == null ? '—' : p.toFixed(2).replace('.', ',') + ' €'; }
  function km(d) { return d.toFixed(1).replace('.', ',') + ' km'; }
  function pct(v) { return (v >= 0 ? '+' : '') + v.toFixed(1).replace('.', ',') + ' %'; }
  function pct1(v) { return (v >= 0 ? '+' : '−') + Math.abs(v).toFixed(1).replace('.', ',') + ' %'; }
  function iniciales(marca) {
    return marca.split(/[\s.]+/).filter(Boolean).slice(0, 2).map(function (w) { return w[0]; }).join('').toUpperCase();
  }
  function claseDe(p) { return F.colorPrecio(p); }
  function varClase(v) { return v < 0 ? 'ok' : v > 0 ? 'mal' : 'neutro'; }
  function varTxt(v) { return v < 0 ? 'txt-verde' : v > 0 ? 'txt-rojo' : ''; }
  function txtPrecio(p) { return { verde: 'txt-verde', naranja: 'txt-naranja', rojo: 'txt-rojo', gris: '' }[claseDe(p)] || ''; }

  /* =======================================================================
   * 3. Consultas sobre los datos
   * ===================================================================== */
  /** Precio mostrado = precio del Ministerio menos el descuento por marca. */
  function precioFinal(est, fuel) {
    var p = F.precioDe(est, fuel);
    if (p == null) return null;
    var d = STATE.descuentos[est.marca] || 0;
    return Math.round((p - d) * 1000) / 1000;
  }
  /** Estaciones de la provincia que venden el combustible elegido. */
  function conPrecio(fuel) {
    return F.estacionesDe(STATE.prov).filter(function (e) { return e.precios[fuel] != null; });
  }
  function porPrecio(lista, fuel) {
    var copia = lista.slice();
    copia.sort(function (a, b) {
      var pa = precioFinal(a, fuel), pb = precioFinal(b, fuel);
      return (pa == null ? Infinity : pa) - (pb == null ? Infinity : pb);
    });
    return copia;
  }
  function mediaDe(lista, fuel) {
    var vals = lista.map(function (e) { return precioFinal(e, fuel); }).filter(function (v) { return v != null; });
    if (!vals.length) return null;
    return Math.round(vals.reduce(function (a, b) { return a + b; }, 0) / vals.length * 1000) / 1000;
  }
  function minimo(lista, fuel) {
    var mejor = null;
    lista.forEach(function (e) {
      var p = precioFinal(e, fuel);
      if (p != null && (!mejor || p < mejor.p)) mejor = { e: e, p: p };
    });
    return mejor;
  }
  function maximo(lista, fuel) {
    var peor = null;
    lista.forEach(function (e) {
      var p = precioFinal(e, fuel);
      if (p != null && (!peor || p > peor.p)) peor = { e: e, p: p };
    });
    return peor;
  }
  function fechaADate(fecha) {
    var p = String(fecha).split('-');
    return new Date(Number(p[2]), Number(p[1]) - 1, Number(p[0]));
  }
  function firmaDescuentos() {
    var ks = Object.keys(STATE.descuentos).sort();
    return ks.map(function (k) { return k + '=' + STATE.descuentos[k]; }).join(';');
  }

  /* Serie agregada de la provincia: media, mínimo y máximo por día. */
  var cacheSerie = {};
  function serieProvincia(dias) {
    var key = STATE.prov + '|' + STATE.fuel + '|' + dias + '|' + firmaDescuentos();
    if (cacheSerie[key]) return cacheSerie[key];
    var est = conPrecio(STATE.fuel);
    var out = [];
    if (est.length) {
      var series = est.map(function (e) {
        var d = STATE.descuentos[e.marca] || 0;
        return F.historico(e.id, STATE.fuel, dias).map(function (p) {
          return { fecha: p.fecha, precio: Math.round((p.precio - d) * 1000) / 1000 };
        });
      });
      var n = series[0].length;
      for (var i = 0; i < n; i++) {
        var suma = 0, mn = Infinity, mx = -Infinity, f = '';
        for (var k = 0; k < series.length; k++) {
          var pt = series[k][i];
          if (!pt) continue;
          f = pt.fecha; suma += pt.precio;
          if (pt.precio < mn) mn = pt.precio;
          if (pt.precio > mx) mx = pt.precio;
        }
        out.push({ fecha: f, media: Math.round(suma / series.length * 1000) / 1000, min: mn, max: mx });
      }
    }
    cacheSerie[key] = out;
    return out;
  }

  /* =======================================================================
   * 4. Primitivas de canvas (dibujo a mano, sin librerías)
   * ===================================================================== */
  function prepararCanvas(cv, alto) {
    var caja = cv.parentElement;
    var W = Math.max(150, Math.round(caja.clientWidth || 320));
    var dpr = Math.min(window.devicePixelRatio || 1, 2);
    cv.width = Math.round(W * dpr);
    cv.height = Math.round(alto * dpr);
    cv.style.width = W + 'px';
    cv.style.height = alto + 'px';
    var ctx = cv.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, W, alto);
    return { ctx: ctx, W: W, H: alto };
  }

  function activarTooltip(cv, tip) {
    if (cv.dataset.tip) return;
    cv.dataset.tip = '1';
    function over(ev) {
      var pts = cv._puntos;
      if (!pts || !pts.length) return;
      var r = cv.getBoundingClientRect();
      var x = ev.clientX - r.left;
      var mejor = null;
      pts.forEach(function (p) { var d = Math.abs(p.x - x); if (!mejor || d < mejor.d) mejor = { d: d, p: p }; });
      if (!mejor || mejor.d > 34) { tip.hidden = true; return; }
      tip.hidden = false;
      tip.innerHTML = mejor.p.tip;
      var w = tip.offsetWidth || 96;
      var medioW = cv.clientWidth || 320;
      var left = Math.max(w / 2 + 4, Math.min(medioW - w / 2 - 4, mejor.p.x));
      tip.style.left = left + 'px';
      tip.style.top = mejor.p.y + 'px';
    }
    cv.addEventListener('mousemove', over);
    cv.addEventListener('mouseleave', function () { tip.hidden = true; });
    cv.addEventListener('touchmove', function (ev) {
      var t = ev.touches && ev.touches[0];
      if (t) over({ clientX: t.clientX, clientY: t.clientY });
    }, { passive: true });
  }

  /** Gráfica de líneas con banda mín–máx y tooltip. */
  function graficaEvolucion(cv, serie) {
    if (!serie || serie.length < 2) return;
    var c = prepararCanvas(cv, 220);
    var ctx = c.ctx, W = c.W, H = c.H;
    var P = { izq: 50, der: 12, arr: 12, aba: 26 };
    var ancho = W - P.izq - P.der, alto = H - P.arr - P.aba;
    var vals = [];
    serie.forEach(function (p) { vals.push(p.media, p.min, p.max); });
    var mn = Math.min.apply(null, vals), mx = Math.max.apply(null, vals);
    var pad = Math.max(0.004, (mx - mn) * 0.22); mn -= pad; mx += pad;
    var x = function (i) { return P.izq + i / (serie.length - 1) * ancho; };
    var y = function (v) { return P.arr + (1 - (v - mn) / (mx - mn)) * alto; };

    ctx.font = '10px ui-monospace, monospace';
    ctx.textAlign = 'right'; ctx.textBaseline = 'middle';
    for (var g = 0; g <= 4; g++) {
      var v = mn + (mx - mn) * g / 4;
      var yy = y(v);
      ctx.strokeStyle = g === 0 ? '#dbe3ea' : '#eef2f6'; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(P.izq, yy); ctx.lineTo(W - P.der, yy); ctx.stroke();
      ctx.fillStyle = '#6b7885';
      ctx.fillText(v.toFixed(3).replace('.', ','), P.izq - 6, yy);
    }

    ctx.beginPath();
    serie.forEach(function (p, i) { i ? ctx.lineTo(x(i), y(p.max)) : ctx.moveTo(x(i), y(p.max)); });
    for (var j = serie.length - 1; j >= 0; j--) ctx.lineTo(x(j), y(serie[j].min));
    ctx.closePath();
    ctx.fillStyle = 'rgba(26,115,232,.16)'; ctx.fill();

    ctx.beginPath();
    serie.forEach(function (p, i) { i ? ctx.lineTo(x(i), y(p.media)) : ctx.moveTo(x(i), y(p.media)); });
    ctx.strokeStyle = '#1a73e8'; ctx.lineWidth = 2.2; ctx.lineJoin = 'round'; ctx.stroke();

    var pts = [];
    serie.forEach(function (p, i) {
      var px = x(i), py = y(p.media);
      pts.push({ x: px, y: py, tip: '<b>' + eur(p.media) + '</b><br><span>' + p.fecha + ' · mín ' + eur2(p.min) + ' – máx ' + eur2(p.max) + '</span>' });
      if (serie.length <= 40) {
        ctx.beginPath(); ctx.arc(px, py, 2.3, 0, Math.PI * 2);
        ctx.fillStyle = '#fff'; ctx.fill(); ctx.strokeStyle = '#1a73e8'; ctx.lineWidth = 1.6; ctx.stroke();
      }
    });
    cv._puntos = pts;

    ctx.fillStyle = '#6b7885'; ctx.textAlign = 'center'; ctx.textBaseline = 'top';
    var paso = Math.max(1, Math.round((serie.length - 1) / 4));
    serie.forEach(function (p, i) {
      if (i % paso === 0 || i === serie.length - 1) {
        ctx.fillText(p.fecha.slice(0, 5), Math.min(W - P.der - 14, Math.max(P.izq + 14, x(i))), P.arr + alto + 8);
      }
    });

    var tip = cv.parentElement.querySelector('.gtip');
    if (tip) activarTooltip(cv, tip);
  }

  /** Histograma horizontal por tramos de precio. */
  function graficaTramos(cv, filas) {
    if (!filas || !filas.length) return;
    var filaAlto = 30;
    var c = prepararCanvas(cv, filas.length * filaAlto + 10);
    var ctx = c.ctx, W = c.W;
    var et = Math.min(118, Math.round(W * 0.42));
    var maxV = 1;
    filas.forEach(function (f) { if (f.valor > maxV) maxV = f.valor; });
    var x0 = et, disp = Math.max(20, W - et - 40);
    ctx.font = '11px ui-monospace, monospace'; ctx.textBaseline = 'middle';
    filas.forEach(function (f, i) {
      var y = 5 + i * filaAlto;
      var h = filaAlto - 12;
      ctx.fillStyle = '#45535f'; ctx.textAlign = 'right';
      ctx.fillText(f.etiqueta, et - 8, y + h / 2 + 1);
      var w = Math.max(2, Math.round(disp * (f.valor / maxV)));
      ctx.fillStyle = f.color;
      ctx.beginPath();
      if (ctx.roundRect) ctx.roundRect(x0, y, w, h, 4); else ctx.rect(x0, y, w, h);
      ctx.fill();
      ctx.fillStyle = '#101a24'; ctx.textAlign = 'left';
      ctx.fillText(String(f.valor), x0 + w + 6, y + h / 2 + 1);
    });
  }

  /* =======================================================================
   * 5. Cabecera y navegación
   * ===================================================================== */
  var ICO = {
    panel: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 19h16M6 16V9M11 16V5M16 16v-4"/></svg>',
    mapa: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"><path d="M9 3 3 5v16l6-2 6 2 6-2V3l-6 2-6-2Z"/><path d="M9 3v16M15 5v16"/></svg>',
    estaciones: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M8 6h13M8 12h13M8 18h13M3.5 6h.01M3.5 12h.01M3.5 18h.01"/></svg>',
    ia: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M12 3v3M12 18v3M3 12h3M18 12h3M5.6 5.6l2.1 2.1M16.3 16.3l2.1 2.1M18.4 5.6l-2.1 2.1M7.7 16.3l-2.1 2.1"/><circle cx="12" cy="12" r="3.4"/></svg>',
    config: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M4 7h10M18 7h2M4 17h4M12 17h8"/><circle cx="16" cy="7" r="2.2"/><circle cx="10" cy="17" r="2.2"/></svg>'
  };
  var VISTAS = [
    { id: 'panel', nombre: 'Panel', ico: ICO.panel },
    { id: 'mapa', nombre: 'Mapa', ico: ICO.mapa },
    { id: 'estaciones', nombre: 'Estaciones', ico: ICO.estaciones },
    { id: 'ia', nombre: 'IA', ico: ICO.ia },
    { id: 'config', nombre: 'Config', ico: ICO.config }
  ];

  function renderTopbar() {
    $('#topbarSub').textContent = nombreProv[STATE.prov] + ' · ' + STATE.fuel + ' · ' + F.hoyCorto;
    $('#selProv').value = STATE.prov;
    $('#selFuel').value = STATE.fuel;
    $('#selDias').value = String(STATE.dias);
  }

  function renderNav() {
    $('#nav').innerHTML = VISTAS.map(function (v) {
      return '<button type="button" data-vista="' + v.id + '" class="' + (STATE.vista === v.id ? 'activo' : '') +
        '" aria-label="' + v.nombre + '">' + v.ico + '<span>' + v.nombre + '</span></button>';
    }).join('');
    var marca = $('#nav [data-vista="estaciones"]');
    if (marca) marca.setAttribute('data-shot', 'vista');
  }

  function setVista(id) {
    STATE.vista = id;
    $$('.vista').forEach(function (s) { s.classList.toggle('activa', s.dataset.vista === id); });
    $$('#nav button').forEach(function (b) { b.classList.toggle('activo', b.dataset.vista === id); });
    if (id === 'ia') renderIA();
    if (id === 'config') renderConfig();
    if (id === 'panel') pintarGraficasPanel();
  }

  function toast(msg) {
    var a = $('#aviso');
    a.textContent = msg;
    a.hidden = false;
    a.classList.add('visible');
    clearTimeout(a._t);
    a._t = setTimeout(function () {
      a.classList.remove('visible');
      setTimeout(function () { a.hidden = true; }, 220);
    }, 2200);
  }

  /* =======================================================================
   * 6. Vista PANEL — tarjetas analíticas
   * ===================================================================== */
  function tarjeta(titulo, sub, cuerpo, span2) {
    return '<section class="tarjeta' + (span2 ? ' span2' : '') + '">' +
      '<div class="tarjeta-cab"><h2>' + esc(titulo) + '</h2><p>' + esc(sub) + '</p></div>' +
      '<div class="tarjeta-cuerpo">' + cuerpo + '</div></section>';
  }

  function kpiCard(lista, media, serieN) {
    var prov = nombreProv[STATE.prov];
    var barata = minimo(lista, STATE.fuel);
    var cara = maximo(lista, STATE.fuel);
    var dif = barata && cara ? Math.round((cara.p - barata.p) * 1000) / 1000 : null;
    var vari = serieN.length > 1 ? (serieN[serieN.length - 1].media - serieN[0].media) / serieN[0].media * 100 : 0;
    var extremo = null;
    serieN.forEach(function (p) { if (!extremo || p.media < extremo.media) extremo = p; });

    var items = '';
    items += '<div class="kpi"><span class="kpi-tit">Precio medio</span><span class="kpi-val">' + eur(media) + '</span>' +
      '<span class="kpi-delta ' + varClase(vari) + '">' + varTxtIcon(vari) + ' ' + pct(vari) + ' vs. periodo</span></div>';

    items += barata
      ? '<button type="button" class="kpi kpi-btn" data-estacion="' + barata.e.id + '" data-shot="detalle" aria-label="Abrir la estación más barata"><span class="kpi-tit">Más barata</span>' +
        '<span class="kpi-val txt-verde">' + eur(barata.p) + '</span>' +
        '<span class="kpi-sub">' + esc(barata.e.marca + ' ' + barata.e.localidad) + ' · ' + km(barata.e.dist) + '</span></button>'
      : '<div class="kpi"><span class="kpi-tit">Más barata</span><span class="kpi-val">—</span></div>';

    items += cara
      ? '<button type="button" class="kpi kpi-btn" data-estacion="' + cara.e.id + '" aria-label="Abrir la estación más cara"><span class="kpi-tit">Más cara</span>' +
        '<span class="kpi-val txt-rojo">' + eur(cara.p) + '</span>' +
        '<span class="kpi-sub">' + esc(cara.e.marca + ' ' + cara.e.localidad) + ' · ' + km(cara.e.dist) + '</span></button>'
      : '<div class="kpi"><span class="kpi-tit">Más cara</span><span class="kpi-val">—</span></div>';

    items += '<div class="kpi"><span class="kpi-tit">Estaciones</span><span class="kpi-val">' + lista.length + '</span>' +
      '<span class="kpi-sub">venden ' + esc(STATE.fuel) + '</span></div>';

    items += '<div class="kpi"><span class="kpi-tit">Diferencia</span><span class="kpi-val">' + eur(dif) + '</span>' +
      '<span class="kpi-sub">entre la más barata y la más cara</span></div>';

    items += '<div class="kpi"><span class="kpi-tit">Mínimo del periodo</span><span class="kpi-val">' +
      (extremo ? eur2(extremo.media) : '—') + '</span>' +
      '<span class="kpi-sub">' + (extremo ? extremo.fecha : 'sin datos') + '</span></div>';

    return tarjeta('Resumen de ' + prov, STATE.fuel + ' · últimos ' + STATE.dias + ' días',
      '<div class="kpis">' + items + '</div>', true);
  }
  function varTxtIcon(v) { return v < 0 ? '▼' : v > 0 ? '▲' : '=  '; }

  function cardEvolucion(serieN) {
    return tarjeta('Evolución del precio medio', 'Media diaria de la provincia · banda mín–máx',
      '<div class="grafica-caja"><canvas id="cvEvolucion" role="img" aria-label="Evolución del precio medio provincial"></canvas><div class="gtip" hidden></div></div>' +
      '<div class="grafica-leyenda">' +
        '<span class="lg-item"><i class="lg-linea"></i>Precio medio</span>' +
        '<span class="lg-item"><i class="lg-banda"></i>Rango mín–máx</span>' +
      '</div>', true);
  }

  function cardMarcas(lista) {
    var porMarca = {};
    lista.forEach(function (e) {
      var p = precioFinal(e, STATE.fuel);
      if (p == null) return;
      if (!porMarca[e.marca]) porMarca[e.marca] = { suma: 0, n: 0, min: Infinity };
      porMarca[e.marca].suma += p; porMarca[e.marca].n++;
      if (p < porMarca[e.marca].min) porMarca[e.marca].min = p;
    });
    var filas = Object.keys(porMarca).map(function (m) {
      return { marca: m, media: Math.round(porMarca[m].suma / porMarca[m].n * 1000) / 1000, n: porMarca[m].n, min: porMarca[m].min };
    }).sort(function (a, b) { return a.media - b.media; });
    if (!filas.length) return tarjeta('Marcas por precio medio', 'Sin datos', '<p class="pista">No hay estaciones con este combustible.</p>', false);

    var lo = filas[0].media, hi = filas[filas.length - 1].media;
    var cuerpo = filas.slice(0, 10).map(function (f) {
      var ratio = hi - lo < 0.0005 ? 1 : 1 - (f.media - lo) / (hi - lo);
      var ancho = Math.round(34 + ratio * 62);
      var col = COLOR_VIVO[claseDe(f.media)];
      return '<div class="rk-fila"><div class="rk-top"><b>' + esc(f.marca) + '</b>' +
        '<span class="rk-precio">' + eur2(f.media) + '</span></div>' +
        '<div class="rk-barra"><i style="width:' + ancho + '%;background:' + col + '"></i></div>' +
        '<div class="rk-sub">' + f.n + ' estación' + (f.n > 1 ? 'es' : '') + ' · desde ' + eur2(f.min) + '</div></div>';
    }).join('');
    return tarjeta('Marcas por precio medio', 'Más barata primero · ' + filas.length + ' marcas', cuerpo, false);
  }

  function cardLocalidades(lista) {
    var porLoc = {};
    lista.forEach(function (e) {
      var p = precioFinal(e, STATE.fuel);
      if (p == null) return;
      if (!porLoc[e.localidad]) porLoc[e.localidad] = { suma: 0, n: 0 };
      porLoc[e.localidad].suma += p; porLoc[e.localidad].n++;
    });
    var filas = Object.keys(porLoc).map(function (l) {
      return { loc: l, media: Math.round(porLoc[l].suma / porLoc[l].n * 1000) / 1000, n: porLoc[l].n };
    }).sort(function (a, b) { return STATE.dirLoc === 'baratas' ? a.media - b.media : b.media - a.media; });
    var base = filas.length
      ? filas.reduce(function (a, f) { return a + f.media; }, 0) / filas.length
      : 0;

    var cab = '<div class="mini-cabs">' +
      '<button type="button" data-dirloc="baratas" class="' + (STATE.dirLoc === 'baratas' ? 'activo' : '') + '">Más baratas</button>' +
      '<button type="button" data-dirloc="caras" class="' + (STATE.dirLoc === 'caras' ? 'activo' : '') + '">Más caras</button></div>';

    var cuerpo = filas.length
      ? cab + '<div class="prov-lista">' + filas.slice(0, 8).map(function (f) {
          return '<button type="button" class="prov-fila" data-loc="' + esc(f.loc) + '" aria-label="Ver estaciones de ' + esc(f.loc) + '">' +
            '<span class="pf-nombre">' + esc(f.loc) + '</span>' +
            '<span class="pf-media ' + varTxt(f.media - base) + '">' + eur2(f.media) + '</span>' +
            '<span class="pf-n">' + f.n + '</span></button>';
        }).join('') + '</div>'
      : '<p class="pista">No hay localidades con este combustible.</p>';
    return tarjeta('Localidades por precio', 'Toca una para filtrar la tabla', cuerpo, false);
  }

  function cardTramos(lista) {
    var precios = lista.map(function (e) { return precioFinal(e, STATE.fuel); }).filter(function (v) { return v != null; });
    if (precios.length < 2) {
      return tarjeta('Distribución por tramos', 'Sin datos suficientes', '<p class="pista">Hacen falta más estaciones.</p>', false);
    }
    return tarjeta('Distribución por tramos', 'Nº de estaciones por rango de €/L',
      '<div class="grafica-caja"><canvas id="cvTramos" role="img" aria-label="Histograma de estaciones por tramo de precio"></canvas></div>', false);
  }

  function mediaPorDiaSemana(serie) {
    var acc = [], cnt = [];
    for (var i = 0; i < 7; i++) { acc[i] = 0; cnt[i] = 0; }
    serie.forEach(function (p) {
      var w = fechaADate(p.fecha).getDay();
      acc[w] += p.media; cnt[w]++;
    });
    return acc.map(function (s, i) { return cnt[i] ? s / cnt[i] : null; });
  }

  function cardDias(serie) {
    if (serie.length < 14) return tarjeta('¿Cuándo repostar?', 'Sin datos suficientes', '<p class="pista">Hacen falta más días de histórico.</p>', false);
    var usada = serie.slice(-84);
    var medias = mediaPorDiaSemana(usada);
    var validos = medias.filter(function (v) { return v != null; });
    var mn = Math.min.apply(null, validos);
    var nombres = { 0: 'Dom', 1: 'Lun', 2: 'Mar', 3: 'Mié', 4: 'Jue', 5: 'Vie', 6: 'Sáb' };
    var orden = [1, 2, 3, 4, 5, 6, 0];
    var cuerpo = '<div class="dias-lista">' + orden.map(function (w) {
      var v = medias[w];
      var mejor = v != null && Math.abs(v - mn) < 1e-9;
      return '<div class="dia' + (mejor ? ' mejor' : '') + '"><span class="dia-nombre">' + nombres[w] + '</span>' +
        '<span class="dia-media">' + (v == null ? '—' : num(v, 2)) + '</span>' +
        '<span class="dia-marca">' + (mejor ? 'mejor' : '') + '</span></div>';
    }).join('') + '</div>';
    return tarjeta('¿Cuándo repostar?', 'Media por día de la semana (€/L, 84 días)', cuerpo, false);
  }

  function cardComparador(lista) {
    var top = porPrecio(lista, STATE.fuel).slice(0, 24);
    var ops = '<div class="comp-lista">' + top.map(function (e) {
      var on = STATE.seleccion.indexOf(e.id) !== -1;
      return '<button type="button" class="comp-op' + (on ? ' on' : '') + '" data-comp="' + e.id + '" aria-pressed="' + on + '">' +
        '<span class="co-marca">' + esc(e.marca) + '</span>' +
        '<span class="co-loc">' + esc(e.localidad) + ' · ' + km(e.dist) + '</span>' +
        '<span class="co-precio">' + eur2(precioFinal(e, STATE.fuel)) + '</span></button>';
    }).join('') + '</div>';

    var resumen = '';
    var sel = STATE.seleccion.map(function (id) { return F.estaciones.find(function (x) { return x.id === id; }); })
      .filter(Boolean);
    if (sel.length >= 2) {
      var ordenada = porPrecio(sel, STATE.fuel);
      var dif = Math.round((precioFinal(ordenada[ordenada.length - 1], STATE.fuel) - precioFinal(ordenada[0], STATE.fuel)) * 1000) / 1000;
      resumen = '<p class="pista">Diferencia entre la más barata y la más cara: <b>' + eur(dif) + '</b></p>' +
        ordenada.map(function (e) {
          var d = STATE.descuentos[e.marca] || 0;
          var extra = d ? 'descuento −' + num(d, 2) + ' € → ' + eur(precioFinal(e, STATE.fuel)) : 'sin descuento';
          return '<div class="rk-fila"><div class="rk-top"><b>' + esc(e.marca + ' · ' + e.localidad) + '</b>' +
            '<span class="rk-precio">' + eur(precioFinal(e, STATE.fuel)) + '</span></div>' +
            '<div class="rk-sub">' + esc(e.direccion) + ' · ' + km(e.dist) + ' · ' + extra + '</div></div>';
        }).join('') + '<button type="button" class="btn-sec" data-accion="limpiar-comp">Quitar todas</button>';
    } else if (sel.length === 1) {
      var uno = sel[0];
      resumen = '<div class="rk-fila"><div class="rk-top"><b>' + esc(uno.marca + ' · ' + uno.localidad) + '</b>' +
        '<span class="rk-precio">' + eur(precioFinal(uno, STATE.fuel)) + '</span></div>' +
        '<div class="rk-sub">' + esc(uno.direccion) + ' · ' + km(uno.dist) + '</div></div>' +
        '<p class="pista">Añade otra estación para comparar.</p>';
    } else {
      resumen = '<p class="pista">Toca «+ Comparar» en la tabla o en esta lista para empezar (hasta ' + MAX_COMP + ' estaciones).</p>';
    }
    return tarjeta('Comparador', 'Marca hasta ' + MAX_COMP + ' estaciones para enfrentarlas', ops + resumen, true);
  }

  function cardProvincias() {
    var filas = F.provincias.map(function (p) {
      var media = mediaDe(conPrecioProv(p.id, STATE.fuel), STATE.fuel);
      return { id: p.id, nombre: p.nombre, media: media, n: F.estacionesDe(p.id).length };
    }).filter(function (f) { return f.media != null; }).sort(function (a, b) { return a.media - b.media; });
    var cuerpo = '<div class="prov-lista">' + filas.map(function (f) {
      return '<button type="button" class="prov-fila' + (f.id === STATE.prov ? ' sel' : '') + '" data-provsel="' + f.id + '" aria-label="Ver ' + esc(f.nombre) + '">' +
        '<span class="pf-nombre">' + esc(f.nombre) + '</span>' +
        '<span class="pf-media ' + varTxt(f.media - filas[0].media) + '">' + eur2(f.media) + '</span>' +
        '<span class="pf-n">' + f.n + '</span></button>';
    }).join('') + '</div>';
    return tarjeta('Provincias por precio medio', 'Más barata primero · toca para cambiar', cuerpo, true);
  }
  function conPrecioProv(provId, fuel) {
    return F.estacionesDe(provId).filter(function (e) { return e.precios[fuel] != null; });
  }

  function pintarGraficasPanel() {
    var evol = $('#cvEvolucion');
    if (evol && evol.offsetParent) graficaEvolucion(evol, serieProvincia(Math.max(84, STATE.dias)).slice(-STATE.dias));
    var tram = $('#cvTramos');
    if (tram && tram.offsetParent) {
      var precios = conPrecio(STATE.fuel).map(function (e) { return precioFinal(e, STATE.fuel); }).filter(function (v) { return v != null; });
      graficaTramos(tram, tramosDe(precios));
    }
  }
  function tramosDe(precios) {
    if (precios.length < 2) return [];
    var mn = Math.min.apply(null, precios), mx = Math.max.apply(null, precios);
    if (mx - mn < 0.02) mx = mn + 0.02;
    var bins = 5, ancho = (mx - mn) / bins, out = [];
    for (var i = 0; i < bins; i++) {
      var desde = mn + i * ancho, hasta = desde + ancho;
      var n = precios.filter(function (v) {
        return i === bins - 1 ? (v >= desde && v <= hasta + 1e-9) : (v >= desde && v < hasta);
      }).length;
      out.push({ etiqueta: num(desde, 2) + '–' + num(hasta, 2), valor: n, color: COLOR_VIVO[claseDe((desde + hasta) / 2)] });
    }
    return out;
  }

  function renderPanel() {
    var lista = conPrecio(STATE.fuel);
    var media = mediaDe(lista, STATE.fuel);
    var serieN = serieProvincia(Math.max(84, STATE.dias)).slice(-STATE.dias);
    $('#panelRejilla').innerHTML =
      kpiCard(lista, media, serieN) +
      cardEvolucion(serieN) +
      cardMarcas(lista) +
      cardLocalidades(lista) +
      cardTramos(lista) +
      cardDias(serieN) +
      cardComparador(lista) +
      cardProvincias();
    pintarGraficasPanel();
  }

  /* =======================================================================
   * 7. Vista MAPA — fondo SVG fake + marcadores-precio
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
        '" stroke-width="' + (v.w * 2.4) + '" stroke-linecap="round" vector-effect="non-scaling-stroke"/>';
      svg += '<path d="' + v.d + '" fill="none" stroke="#e0c9a6" stroke-width="' + v.w +
        '" stroke-linecap="round" vector-effect="non-scaling-stroke"/>';
    });
    svg += '<circle cx="' + m.tuPosicion.mx + '" cy="' + m.tuPosicion.my + '" r="2" fill="#1a73e8" opacity=".25"/>';
    svg += '</svg>';
    cont.innerHTML = svg;
  }

  function renderMapa() {
    var lista = porPrecio(conPrecio(STATE.fuel), STATE.fuel);
    var media = mediaDe(lista, STATE.fuel);
    var barata = minimo(lista, STATE.fuel);
    $('#mapaSub').textContent = lista.length
      ? lista.length + ' estaciones · media ' + eur(media) + ' · más barata ' + eur2(barata.p) + ' (' + barata.e.marca + ')'
      : 'Sin estaciones con este combustible en ' + nombreProv[STATE.prov];

    pintarFondo($('#mapaFondo'));
    var html = '<div class="marcador-yo" style="left:' + F.mapa.tuPosicion.mx + '%;top:' + F.mapa.tuPosicion.my + '%" title="' + esc(F.mapa.tuPosicion.label) + '"></div>';
    lista.forEach(function (e) {
      var p = precioFinal(e, STATE.fuel);
      var c = COLOR[claseDe(p)];
      html += '<button type="button" class="marcador" style="left:' + e.mx + '%;top:' + e.my + '%;--c:' + c + ';min-height:34px" ' +
        'data-marcador="' + e.id + '" aria-label="' + esc(e.marca + ' ' + e.nombre + ', ' + eur(p)) + '">' +
        (p == null ? '—' : num(p, 2)) + '</button>';
    });
    $('#mapaMarcadores').innerHTML = html;

    var eb = 1.50, ea = 1.70;
    $('#mapaLeyenda').innerHTML =
      '<span><i style="background:' + COLOR.verde + '"></i>‹ ' + eur2(eb) + '</span>' +
      '<span><i style="background:' + COLOR.naranja + '"></i>' + eur2(eb) + '–' + eur2(ea) + '</span>' +
      '<span><i style="background:' + COLOR.rojo + '"></i>› ' + eur2(ea) + '</span>';
  }

  /* =======================================================================
   * 8. Vista ESTACIONES — buscador, orden y tabla
   * ===================================================================== */
  function listaTabla() {
    var lista = conPrecio(STATE.fuel);
    if (STATE.texto) {
      var q = norm(STATE.texto);
      lista = lista.filter(function (e) {
        return norm([e.marca, e.nombre, e.localidad, e.direccion].join(' ')).indexOf(q) !== -1;
      });
    }
    var col = STATE.sortCol, dir = STATE.sortDir === 'asc' ? 1 : -1;
    var copia = lista.slice();
    copia.sort(function (a, b) {
      var r;
      if (col === 'precio') {
        var pa = precioFinal(a, STATE.fuel), pb = precioFinal(b, STATE.fuel);
        r = (pa == null ? Infinity : pa) - (pb == null ? Infinity : pb);
      } else if (col === 'dist') r = a.dist - b.dist;
      else if (col === 'marca') r = a.marca.localeCompare(b.marca, 'es');
      else r = a.localidad.localeCompare(b.localidad, 'es');
      if (!r && col !== 'precio') {
        r = (precioFinal(a, STATE.fuel) || 0) - (precioFinal(b, STATE.fuel) || 0);
      }
      return r * dir;
    });
    return copia;
  }

  function renderEstaciones() {
    var lista = listaTabla();
    var media = mediaDe(lista, STATE.fuel);
    var barata = minimo(lista, STATE.fuel);
    $('#estSub').textContent = lista.length
      ? lista.length + ' estaciones · media ' + eur(media) + (barata ? ' · desde ' + eur2(barata.p) : '')
      : 'Ninguna estación coincide con la búsqueda';

    $('#tablaCuerpo').innerHTML = lista.length ? lista.map(function (e) {
      var p = precioFinal(e, STATE.fuel);
      var on = STATE.seleccion.indexOf(e.id) !== -1;
      var fav = STATE.favoritos.has(e.id);
      return '<tr class="fila-est" data-estacion="' + e.id + '">' +
        '<td class="td-marca"><span class="ini">' + iniciales(e.marca) + '</span>' + esc(e.marca) +
          (fav ? ' <span class="estrella" aria-label="Favorita">★</span>' : '') + '</td>' +
        '<td><span class="pildora ' + claseDe(p) + '">' + eur2(p) + '</span></td>' +
        '<td>' + km(e.dist) + '</td>' +
        '<td>' + esc(e.localidad) + '</td>' +
        '<td class="td-calle">' + esc(e.direccion) + '</td>' +
        '<td class="td-comp"><button type="button" class="btn-mini' + (on ? ' on' : '') + '" data-comp="' + e.id +
          '" aria-pressed="' + on + '" aria-label="Comparar ' + esc(e.nombre) + '">' + (on ? '✓ Comparando' : '+ Comparar') + '</button></td>' +
      '</tr>';
    }).join('') : '<tr><td class="td-vacio" colspan="6">Sin estaciones con estos filtros</td></tr>';

    $$('#tablaEst thead th[data-col]').forEach(function (th) {
      var f = th.querySelector('.flecha');
      if (!f) return;
      var act = th.dataset.col === STATE.sortCol;
      th.classList.toggle('ord', act);
      f.textContent = act ? (STATE.sortDir === 'asc' ? '▲' : '▼') : '';
    });
    $$('#ordenEst button').forEach(function (b) {
      var d = b.dataset.orden;
      var act = (d === 'precio-asc' && STATE.sortCol === 'precio' && STATE.sortDir === 'asc') ||
        (d === 'precio-desc' && STATE.sortCol === 'precio' && STATE.sortDir === 'desc') ||
        (d === 'dist' && STATE.sortCol === 'dist');
      b.classList.toggle('activo', act);
      b.setAttribute('aria-pressed', act ? 'true' : 'false');
    });
  }

  /* =======================================================================
   * 9. Vista IA — proveedores, markdown y prompts
   * ===================================================================== */
  function iaMensajes(prov) {
    if (!STATE.ia.mensajes[prov]) {
      STATE.ia.mensajes[prov] = (F.chatsIA[prov] || []).map(function (m) {
        return { rol: m.role === 'user' ? 'usuario' : 'ia', texto: m.content };
      });
    }
    return STATE.ia.mensajes[prov];
  }
  function modeloDe(prov) {
    return STATE.ia.modelos[prov] || (MODELOS[prov] || [])[0] || '';
  }
  function nombreProvIA(id) {
    var p = PROVEEDORES.find(function (x) { return x.id === id; });
    return p ? p.nombre : id;
  }

  function markdownIA(texto) {
    var lineas = esc(texto).split('\n');
    var salida = [], enLista = null, enTabla = false, enCodigo = false, filasTabla = 0;
    var formato = function (s) {
      return s
        .replace(/`([^`]+)`/g, '<code>$1</code>')
        .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
        .replace(/(^|[\s(])\*([^*\n]+)\*(?=[\s.,;:)]|$)/g, '$1<em>$2</em>')
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
        var esCab = filasTabla === 0;
        filasTabla++;
        salida.push('<tr>' + celdas.map(function (c) {
          return (esCab ? '<th>' : '<td>') + formato(c) + (esCab ? '</th>' : '</td>');
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

  function pintarMensajesIA() {
    var caja = $('#iaMensajes');
    var lista = iaMensajes(STATE.ia.prov);
    if (!lista.length) {
      caja.innerHTML = '<div class="burbuja ia">Pregúntame por precios, tendencias o por una estación concreta.</div>';
      return;
    }
    caja.innerHTML = lista.map(function (m) {
      if (m.rol === 'grupo') {
        return m.respuestas.map(function (r) {
          return '<div class="burbuja proveedor"><div class="proveedor-nombre">' + esc(r.prov) + '</div>' +
            markdownIA(r.texto) + '<div class="meta">⏱ ' + esc(r.modelo) + ' · ' + esc(r.ms) + ' s</div></div>';
        }).join('');
      }
      if (m.rol === 'cargando') {
        return '<div class="burbuja ia">Pensando…</div>';
      }
      var clase = m.rol === 'usuario' ? 'usuario' : m.rol === 'error' ? 'error' : 'ia';
      return '<div class="burbuja ' + clase + '">' + markdownIA(m.texto) +
        (m.ms ? '<div class="meta">⏱ ' + esc(m.modelo) + ' · ' + esc(m.ms) + ' s</div>' : '') + '</div>';
    }).join('');
    caja.scrollTop = caja.scrollHeight;
  }

  function renderIA() {
    var prov = STATE.ia.prov;
    var esGeneral = prov === 'general';
    $('#iaSub').textContent = esGeneral
      ? 'La misma pregunta a los proveedores visibles, en paralelo'
      : nombreProvIA(prov) + ' · modelo ' + (modeloDe(prov) || '—');

    $('#iaPills').innerHTML = PROVEEDORES.map(function (p) {
      return '<button type="button" class="pill' + (p.id === prov ? ' activo' : '') + '" role="tab" data-iaprov="' + p.id +
        '" aria-selected="' + (p.id === prov ? 'true' : 'false') + '">' + esc(p.nombre) + '</button>';
    }).join('');

    var listos = PROVEEDORES.length - 1;
    $('#iaCabecera').innerHTML = esGeneral
      ? '<span class="pista">Cada respuesta indica el proveedor, el modelo y el tiempo.</span>' +
        '<span class="ia-estado ok">✅ ' + listos + '/' + (PROVEEDORES.length - 1) + ' proveedores listos</span>'
      : '<label>Modelo<select id="iaModelo" aria-label="Modelo de IA">' +
          (MODELOS[prov] || ['integrado']).map(function (m) {
            return '<option value="' + esc(m) + '"' + (m === modeloDe(prov) ? ' selected' : '') + '>' + esc(m) + '</option>';
          }).join('') + '</select></label>' +
        '<button type="button" class="btn-mini" data-accion="refrescar-modelos">↻ Refrescar modelos</button>' +
        '<span class="ia-estado ' + (prov === 'chrome-nano' ? 'no' : 'ok') + '">' +
          (prov === 'chrome-nano' ? 'Nano en el navegador' : '✅ API Key cargada') + '</span>';

    pintarMensajesIA();

    $('#iaPrompts').innerHTML = F.prompts.map(function (p) {
      return '<button type="button" class="chip" data-prompt="' + esc(p) + '">' + esc(p) + '</button>';
    }).join('');
  }

  function respuestaSimulada(prov) {
    var ejs = (F.chatsIA[prov] || []).filter(function (m) { return m.role === 'assistant'; });
    if (ejs.length) return ejs[0].content;
    var barata = minimo(conPrecio(STATE.fuel), STATE.fuel);
    return barata
      ? 'La estación más barata de **' + nombreProv[STATE.prov] + '** para ' + STATE.fuel + ' es **' + barata.e.marca +
        ' · ' + barata.e.localidad + '** a **' + eur(barata.p) + '**.'
      : 'No hay estaciones con el combustible elegido en esta provincia.';
  }

  function enviarIA(texto) {
    if (!texto || !texto.trim() || STATE.ia.enviando) return;
    var prov = STATE.ia.prov;
    var lista = iaMensajes(prov);
    lista.push({ rol: 'usuario', texto: texto });
    lista.push({ rol: 'cargando' });
    STATE.ia.enviando = true;
    pintarMensajesIA();
    setTimeout(function () {
      lista.pop();
      var ms = (0.6 + Math.random() * 1.3).toFixed(1).replace('.', ',');
      if (prov === 'general') {
        lista.push({
          rol: 'grupo', respuestas: [
            { prov: 'Groq', modelo: modeloDe('groq') || 'qwen/qwen3.8-27b', ms: ms, texto: respuestaSimulada('groq') },
            { prov: 'Mistral', modelo: modeloDe('mistral') || 'open-mistral-nemo', ms: ms, texto: respuestaSimulada('mistral') },
            { prov: 'LLM7.io', modelo: modeloDe('llm7') || 'codestral-latest', ms: ms, texto: respuestaSimulada('llm7') }
          ]
        });
      } else {
        lista.push({ rol: 'ia', modelo: modeloDe(prov) || 'integrado', ms: ms, texto: respuestaSimulada(prov) });
      }
      STATE.ia.enviando = false;
      pintarMensajesIA();
    }, 1000);
  }

  /* =======================================================================
   * 10. Vista CONFIG
   * ===================================================================== */
  function tarjetaConfig(id, icono, titulo, abierta, cuerpo) {
    return '<details class="tarjeta-config"' + (abierta ? ' open' : '') + ' data-card="' + id + '">' +
      '<summary><span class="ic" aria-hidden="true">' + icono + '</span>' + esc(titulo) +
      '<span class="chev" aria-hidden="true">›</span></summary>' +
      '<div class="cuerpo">' + cuerpo + '</div></details>';
  }

  function renderConfig() {
    var c = STATE.cfg;
    var log = c.logTab === 'api' ? F.logApi : F.logPush;
    var consola = log.map(function (l) {
      var malo = l.estado !== 200 && l.estado !== 'ok';
      return '<div><b>' + esc(l.t) + '</b> ' + esc(l.url) + ' <span class="' + (malo ? 'ko' : 'ok') + '">' +
        esc(l.estado) + (l.ms != null ? ' · ' + l.ms + ' ms' : '') + '</span></div>';
    }).join('');

    $('#configLista').innerHTML =
      tarjetaConfig('paginacion', '📄', 'Paginación', false,
        '<label>Estaciones por página<select data-cfg="pagina">' + F.config.paginas.map(function (n) {
          return '<option value="' + n + '"' + (n === c.pagina ? ' selected' : '') + '>' + (n === 0 ? 'Todas' : n) + '</option>';
        }).join('') + '</select></label>' +
        '<p>Afecta solo a la vista Estaciones de esta maqueta.</p>') +
      tarjetaConfig('cache', '🗃️', 'Caché de datos', true,
        '<div class="mini-cabs">' +
          '<button type="button" data-cachetab="idb" class="' + (c.cacheTab === 'idb' ? 'activo' : '') + '">IndexedDB</button>' +
          '<button type="button" data-cachetab="ls" class="' + (c.cacheTab === 'ls' ? 'activo' : '') + '">localStorage</button>' +
        '</div>' +
        (c.cacheTab === 'idb'
          ? '<p>' + F.cacheInfo.provincias + ' provincias · ' + F.cacheInfo.gasolineras.toLocaleString('es-ES') + ' gasolineras · ' +
            F.cacheInfo.historicoDias + ' días de histórico.<br>' + esc(F.cacheInfo.idb) + ' · actualizado ' + esc(F.cacheInfo.ultimaActualizacion) + '</p>' +
            '<label>Horas de caché<input type="number" min="0" max="72" data-cfg="ttl" value="' + c.ttl + '"></label>'
          : '<p>' + F.cacheInfo.lsClaves + ' claves <code>gasolineras_*</code> (estado, filtros, logs y chats de IA).</p>') +
        '<div class="mini-cabs">' +
          '<button type="button" data-logtab="api" class="' + (c.logTab === 'api' ? 'activo' : '') + '">Registro API</button>' +
          '<button type="button" data-logtab="push" class="' + (c.logTab === 'push' ? 'activo' : '') + '">Registro Push</button>' +
        '</div>' +
        '<div class="consola">' + consola + '</div>' +
        '<button type="button" class="btn-sec btn-peligro" data-accion="limpiar-cache">🗑️ Limpiar caché (simulado)</button>') +
      tarjetaConfig('push', '🔔', 'Notificaciones push', false,
        '<button type="button" class="switch" role="switch" aria-checked="' + (c.push ? 'true' : 'false') + '" data-switch="push">' +
          '<span class="track" aria-hidden="true"></span>Avisar cuando baje el precio</button>' +
        '<button type="button" class="switch" role="switch" aria-checked="' + (c.pushSubida ? 'true' : 'false') + '" data-switch="pushSubida">' +
          '<span class="track" aria-hidden="true"></span>Avisar cuando suba el precio</button>' +
        '<div class="rejilla-2">' +
          '<label>Intervalo (horas)<input type="number" min="1" max="24" data-cfg="intervalo" value="' + c.intervalo + '"></label>' +
          '<label>Días de ventana<input type="number" min="2" max="90" data-cfg="diasFall" value="' + c.diasFall + '"></label>' +
        '</div>' +
        '<button type="button" class="btn-sec btn-primario" data-accion="probar-push">Enviar notificación de prueba</button>') +
      tarjetaConfig('ia', '💬', 'Claves de IA', false,
        '<p>Seis proveedores por API y una pestaña General que pregunta a todos en paralelo.</p>' +
        '<div class="rejilla-2">' +
          '<label>Google Gemini<input type="password" placeholder="AIza…"></label>' +
          '<label>Groq<input type="password" placeholder="gsk_…"></label>' +
          '<label>Mistral<input type="password" placeholder="cMHt…"></label>' +
          '<label>OpenRouter<input type="password" placeholder="sk-or-v1-…"></label>' +
          '<label>LLM7.io (opcional)<input type="password" placeholder="token"></label>' +
          '<label>NVIDIA (proxy)<input type="password" placeholder="URL del Worker"></label>' +
        '</div>' +
        '<button type="button" class="btn-sec btn-primario" data-accion="cargar-claves">Cargar claves</button>') +
      tarjetaConfig('version', '🔄', 'Actualización de la app', false,
        '<p>Versión actual <b>' + esc(F.versionApp.texto) + '</b> · build ' + esc(F.versionApp.build) + '</p>' +
        '<button type="button" class="btn-sec btn-primario" data-accion="buscar-actualizacion">Buscar actualizaciones</button>');
  }

  /* =======================================================================
   * 11. Ficha de estación (drawer / hoja)
   * ===================================================================== */
  function buscarEstacion(id) {
    return F.estaciones.find(function (e) { return e.id === id; }) || null;
  }

  function abrirFicha(id) {
    var e = buscarEstacion(id);
    if (!e) return;
    STATE.fichaId = id;
    var fuels = Object.keys(e.precios).filter(function (k) { return e.precios[k] != null; });
    if (fuels.indexOf(STATE.fichaFuel) === -1) STATE.fichaFuel = fuels[0] || STATE.fuel;
    pintarFicha();
    var ficha = $('#ficha'), velo = $('#velo');
    ficha.hidden = false; velo.hidden = false;
    /* .ficha { display:flex } gana al atributo hidden: sin esto la ficha
       invisible (opacity 0) seguiría tapando la nav en móvil. */
    ficha.style.display = '';
    requestAnimationFrame(function () {
      ficha.classList.add('abierta');
      velo.classList.add('visible');
    });
  }

  function pintarFicha() {
    var e = buscarEstacion(STATE.fichaId);
    if (!e) return;
    var p = precioFinal(e, STATE.fuel);
    $('#fichaMarca').textContent = e.marca;
    $('#fichaTitulo').textContent = e.nombre;
    $('#fichaPrecio').innerHTML = '<span class="' + txtPrecio(p) + '">' + eur(p) + '</span>' +
      '<small>/L · ' + esc(STATE.fuel) + ' (con descuento)</small>';
    $('#fichaMeta').textContent = e.direccion + ' · ' + e.localidad + ' (' + nombreProv[e.prov] + ') · ' + km(e.dist) + ' · ' + e.horario;

    var esFav = STATE.favoritos.has(e.id);
    var bFav = $('#fichaFav');
    bFav.textContent = (esFav ? '★' : '☆') + ' Favorita';
    bFav.classList.toggle('btn-primario', esFav);
    var enComp = STATE.seleccion.indexOf(e.id) !== -1;
    var bComp = $('#fichaComparar');
    bComp.textContent = enComp ? '✓ Comparando' : '+ Comparar';
    bComp.classList.toggle('btn-primario', enComp);

    var fuels = Object.keys(e.precios).filter(function (k) { return e.precios[k] != null; });
    $('#fichaFuel').innerHTML = fuels.map(function (k) {
      return '<option value="' + esc(k) + '"' + (k === STATE.fichaFuel ? ' selected' : '') + '>' + esc(k) + '</option>';
    }).join('');
    $('#fichaDias').innerHTML = DIAS.map(function (d) {
      return '<option value="' + d + '"' + (d === STATE.fichaDias ? ' selected' : '') + '>' + d + ' días</option>';
    }).join('');

    var mejor = fuels.slice().sort(function (a, b) { return e.precios[a] - e.precios[b]; })[0];
    $('#fichaPrecios').innerHTML = fuels.map(function (k) {
      var d = STATE.descuentos[e.marca] || 0;
      var fin = Math.round((e.precios[k] - d) * 1000) / 1000;
      return '<div class="fila-comb' + (k === mejor ? ' mejor' : '') + '">' +
        '<span class="nombre">' + esc(k) + '<small>' +
          (d ? 'Ministerio ' + eur(e.precios[k]) + ' · descuento −' + num(d, 2) + ' €' : 'Precio en el surtidor') +
        '</small></span><span class="importe">' + eur(fin) + '</span></div>';
    }).join('');

    dibujarFichaGrafica();
  }

  function dibujarFichaGrafica() {
    var cv = $('#fichaCanvas');
    var e = buscarEstacion(STATE.fichaId);
    if (!cv || !e || !e.precios[STATE.fichaFuel]) return;
    var serie = F.historico(e.id, STATE.fichaFuel, STATE.fichaDias).map(function (p) { return { fecha: p.fecha, media: p.precio, min: p.precio, max: p.precio }; });
    if (serie.length < 2) return;
    graficaEvolucion(cv, serie);

    var precios = serie.map(function (p) { return p.media; });
    var mn = Math.min.apply(null, precios), mx = Math.max.apply(null, precios);
    var media = precios.reduce(function (a, b) { return a + b; }, 0) / precios.length;
    var vari = (precios[precios.length - 1] - precios[0]) / precios[0] * 100;
    $('#fichaResumen').innerHTML =
      '<div><dt>Mínimo</dt><dd class="txt-verde">' + eur(mn) + '</dd></div>' +
      '<div><dt>Máximo</dt><dd class="txt-rojo">' + eur(mx) + '</dd></div>' +
      '<div><dt>Media</dt><dd>' + eur(media) + '</dd></div>' +
      '<div><dt>Tendencia</dt><dd class="' + varTxt(vari) + '">' + pct(vari) + '</dd></div>' +
      '<div><dt>Actual</dt><dd>' + eur(precios[precios.length - 1]) + '</dd></div>' +
      '<div><dt>Días</dt><dd>' + serie.length + '</dd></div>';
  }

  function cerrarFicha() {
    var ficha = $('#ficha'), velo = $('#velo');
    ficha.classList.remove('abierta');
    velo.classList.remove('visible');
    setTimeout(function () {
      if (!ficha.classList.contains('abierta')) { ficha.hidden = true; ficha.style.display = 'none'; }
      if (!velo.classList.contains('visible')) velo.hidden = true;
    }, 220);
  }

  function alternarComparar(id) {
    var i = STATE.seleccion.indexOf(id);
    if (i !== -1) STATE.seleccion.splice(i, 1);
    else if (STATE.seleccion.length >= MAX_COMP) { toast('Máximo ' + MAX_COMP + ' estaciones en el comparador'); return; }
    else STATE.seleccion.push(id);
    renderPanel();
    renderEstaciones();
    if (STATE.fichaId === id) pintarFicha();
  }

  function cambiarProvincia(id) {
    STATE.prov = id;
    STATE.texto = '';
    STATE.seleccion = [];
    var buscador = $('#buscar');
    if (buscador) buscador.value = '';
    render();
  }

  /* =======================================================================
   * 12. Render global y arranque
   * ===================================================================== */
  function render() {
    renderTopbar();
    renderPanel();
    renderMapa();
    renderEstaciones();
    if (STATE.vista === 'ia') renderIA();
    if (STATE.vista === 'config') renderConfig();
  }

  function rellenarControles() {
    $('#selProv').innerHTML = F.provincias.map(function (p) {
      return '<option value="' + p.id + '"' + (p.id === STATE.prov ? ' selected' : '') + '>' + esc(p.nombre) + '</option>';
    }).join('');
    $('#selFuel').innerHTML = F.combustiblesVisibles.map(function (f) {
      return '<option value="' + esc(f) + '"' + (f === STATE.fuel ? ' selected' : '') + '>' + esc(f) + '</option>';
    }).join('');
    $('#selDias').innerHTML = DIAS.map(function (d) {
      return '<option value="' + d + '"' + (d === STATE.dias ? ' selected' : '') + '>' + d + ' días</option>';
    }).join('');
  }

  function init() {
    rellenarControles();
    renderNav();
    render();
    setVista('panel');
    /* La ficha arranca cerrada: el CSS le da display:flex y eso anula el
       atributo hidden del HTML (quedaría invisible pero tapando la nav). */
    $('#ficha').style.display = 'none';
    /* El <th> de la columna Comparar contiene un .visualmente-oculto
       (position:absolute). Sin un ancestro posicionado su containing block es
       el documento y, al estar la tabla desplazada en horizontal, estiraba el
       scrollWidth de la página en la vista Estaciones. */
    var colComp = document.querySelector('#tablaEst .col-comp');
    if (colComp) colComp.style.position = 'relative';

    /* --- Clicks delegados --- */
    document.addEventListener('click', function (ev) {
      var nav = ev.target.closest('button[data-vista], a[data-vista]');
      if (nav && nav.tagName === 'BUTTON') { setVista(nav.dataset.vista); return; }

      var comp = ev.target.closest('[data-comp]');
      if (comp) { ev.stopPropagation(); alternarComparar(comp.dataset.comp); return; }

      var marcador = ev.target.closest('[data-marcador]');
      if (marcador) { abrirFicha(marcador.dataset.marcador); return; }

      var est = ev.target.closest('[data-estacion]');
      if (est) { abrirFicha(est.dataset.estacion); return; }

      var dir = ev.target.closest('[data-dirloc]');
      if (dir) { STATE.dirLoc = dir.dataset.dirloc; renderPanel(); return; }

      var loc = ev.target.closest('[data-loc]');
      if (loc) {
        var buscador = $('#buscar');
        buscador.value = loc.dataset.loc;
        STATE.texto = loc.dataset.loc;
        STATE.sortCol = 'precio'; STATE.sortDir = 'asc';
        setVista('estaciones');
        renderEstaciones();
        toast('Filtrando estaciones de ' + loc.dataset.loc);
        return;
      }

      var provSel = ev.target.closest('[data-provsel]');
      if (provSel) { cambiarProvincia(provSel.dataset.provsel); toast('Provincia: ' + nombreProv[provSel.dataset.provsel]); return; }

      var prov2 = ev.target.closest('[data-prov]');
      if (prov2) { cambiarProvincia(prov2.dataset.prov); return; }

      var ord = ev.target.closest('#ordenEst button');
      if (ord) {
        var d = ord.dataset.orden;
        STATE.sortCol = d === 'dist' ? 'dist' : 'precio';
        STATE.sortDir = d === 'precio-desc' ? 'desc' : 'asc';
        renderEstaciones();
        return;
      }

      var th = ev.target.closest('#tablaEst thead th[data-col]');
      if (th) {
        var col = th.dataset.col;
        if (col === STATE.sortCol) STATE.sortDir = STATE.sortDir === 'asc' ? 'desc' : 'asc';
        else { STATE.sortCol = col; STATE.sortDir = 'asc'; }
        renderEstaciones();
        return;
      }

      var pill = ev.target.closest('[data-iaprov]');
      if (pill) { STATE.ia.prov = pill.dataset.iaprov; renderIA(); return; }

      var prompt = ev.target.closest('[data-prompt]');
      if (prompt) { enviarIA(prompt.dataset.prompt); return; }

      var cachetab = ev.target.closest('[data-cachetab]');
      if (cachetab) { STATE.cfg.cacheTab = cachetab.dataset.cachetab; renderConfig(); return; }

      var logtab = ev.target.closest('[data-logtab]');
      if (logtab) { STATE.cfg.logTab = logtab.dataset.logtab; renderConfig(); return; }

      var sw = ev.target.closest('[data-switch]');
      if (sw) {
        var key = sw.dataset.switch;
        STATE.cfg[key] = !STATE.cfg[key];
        sw.setAttribute('aria-checked', STATE.cfg[key] ? 'true' : 'false');
        return;
      }

      var acc = ev.target.closest('[data-accion]');
      if (acc) { accion(acc); return; }

      if (ev.target.closest('#fichaCerrar')) { cerrarFicha(); return; }
      if (ev.target.closest('#velo')) { cerrarFicha(); return; }
      if (ev.target.closest('#fichaFav')) {
        var id = STATE.fichaId;
        if (STATE.favoritos.has(id)) { STATE.favoritos.delete(id); toast('Quitada de favoritas'); }
        else { STATE.favoritos.add(id); toast('Añadida a favoritas'); }
        pintarFicha(); renderEstaciones(); renderMapa();
        return;
      }
      if (ev.target.closest('#fichaComparar')) { alternarComparar(STATE.fichaId); return; }
    });

    function accion(el) {
      var a = el.dataset.accion;
      if (a === 'limpiar-comp') { STATE.seleccion = []; renderPanel(); renderEstaciones(); toast('Comparador vaciado'); return; }
      if (a === 'refrescar-modelos') { toast('Catálogo de modelos actualizado'); return; }
      if (a === 'limpiar-cache') { toast('Caché de la maqueta borrada (simulado)'); return; }
      if (a === 'probar-push') { toast('🔔 Prueba: Ballenoil Villaverde ha bajado 0,02 €'); return; }
      if (a === 'cargar-claves') { toast('Claves cargadas para 6 proveedores (simulado)'); return; }
      if (a === 'buscar-actualizacion') {
        el.disabled = true;
        var txt = el.textContent;
        el.textContent = 'Buscando…';
        setTimeout(function () {
          el.disabled = false;
          el.textContent = txt;
          toast('Ya tienes la última versión (' + F.versionApp.texto + ')');
        }, 800);
        return;
      }
    }

    /* --- Cambios --- */
    document.addEventListener('change', function (ev) {
      var t = ev.target;
      if (t.id === 'selProv') { cambiarProvincia(t.value); return; }
      if (t.id === 'selFuel') { STATE.fuel = t.value; render(); return; }
      if (t.id === 'selDias') { STATE.dias = Number(t.value); render(); return; }
      if (t.id === 'fichaFuel') { STATE.fichaFuel = t.value; dibujarFichaGrafica(); return; }
      if (t.id === 'fichaDias') { STATE.fichaDias = Number(t.value); dibujarFichaGrafica(); return; }
      if (t.id === 'iaModelo') { STATE.ia.modelos[STATE.ia.prov] = t.value; renderIA(); return; }
      if (t.matches('[data-cfg]')) {
        var clave = t.dataset.cfg;
        STATE.cfg[clave] = t.type === 'number' ? Number(t.value) : t.value;
        if (clave === 'ttl') toast('TTL de caché: ' + STATE.cfg.ttl + ' h');
        return;
      }
    });

    /* --- Buscador --- */
    $('#buscar').addEventListener('input', function (ev) {
      STATE.texto = ev.target.value;
      renderEstaciones();
    });

    /* --- IA: enviar --- */
    $('#iaForm').addEventListener('submit', function (ev) {
      ev.preventDefault();
      var input = $('#iaInput');
      var t = input.value;
      input.value = '';
      enviarIA(t);
    });

    /* --- Teclado --- */
    document.addEventListener('keydown', function (ev) {
      if (ev.key === 'Escape' && !$('#ficha').hidden) cerrarFicha();
    });

    /* --- Redimensionado --- */
    window.addEventListener('resize', function () {
      if (STATE.vista === 'panel') pintarGraficasPanel();
      if (!$('#ficha').hidden) dibujarFichaGrafica();
    });

    toast('Prototipo 8 · toca un marcador o una fila para abrir la ficha');
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();

