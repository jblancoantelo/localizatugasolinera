/* =============================================================================
 * GLM — datos fake + utilidades compartidas de prototipos_glm
 * =============================================================================
 * Script clásico (sin módulos) para que funcione abriendo los HTML por file://.
 * Todos los prototipos cargan esto con <script src="../_lib/mock.js"></script>.
 *
 * Determinista: todo sale de un PRNG con semilla, así que cualquier prototipo
 * muestra SIEMPRE los mismos datos → comparaciones de diseño honestas.
 *
 * API:
 *   GLM.hoy            '16-10-2026'   GLM.hoyCorto '16/10/26'
 *   GLM.PROVINCIAS     nombres con estaciones de ejemplo (la 1ª: Madrid)
 *   GLM.localidades(pro)
 *   GLM.COMBUSTIBLES / GLM.COMBUSTIBLES_CORTOS
 *   GLM.MARCAS         [{n, c}] marca + color del círculo logo
 *   GLM.de(prov, opts{loc, todasLasMarcas...})  estaciones [{id, marca, localidad,
 *     direccion, mx, my, dist, precios{comb:€}, fav, tend{comb:{d,pct}}}]
 *   GLM.precio(est, comb)        sin descuento
 *   GLM.descuento(marca)         céntimos guardados en Config de la app
 *   GLM.precioFinal(est, comb)   precio − descuento (como muestra la app)
 *   GLM.nivel(p)                 'baja'(<1.50 verde) | 'media'(1.50-1.70) | 'alta'(>1.70)
 *   GLM.fmt(p)                   '1.479' → '1,479'  ·  GLM.fmt2  ·  GLM.fechaDD(d)
 *   GLM.historico(est, comb, dias)  serie de la más antigua a la más nueva
 *     (cada serie termina EXACTAMENTE en el precio actual de la estación)
 *   GLM.historicoDiario(est, comb, dias) → {media, min, max, minFecha, maxFecha}
 *   GLM.spark(serie, w, h, color)  <svg> mini línea  ·  GLM.chart(serie, opts)
 *   GLM.miniMapa(el, {oscuro, etiquetas, onpin(est, i)})  pinta calles fake y
 *     coloca <button class="pin"> con el precio; devuelve el mapa para repintar
 *   GLM.chatRespuesta(txt, est)   IA fake por palabras clave + GLM.md(txt)
 *   GLM.logApi / GLM.logPush / GLM.alertasPush   registros de ejemplo
 *   GLM.descuentosDefault   pares [marca, céntimos]
 *   GLM.deposito(litros, pA, pB)   ahorro al llenar el tanque
 *   GLM.snack(msg)                aviso flotante
 *   GLM.prng(seed) / GLM.hash(str)
 *   GLM.integrable                true → el prototipo arrancó sin errores JS
 * ========================================================================== */
(function () {
  'use strict';

  var GLM = {};
  window.GLM = GLM;

  GLM.hoy = '16-10-2026';
  GLM.hoyCorto = '16/10/26';

  /* --- PRNG determinista -------------------------------------------------- */
  GLM.hash = function (s) {
    var h = 2166136261 >>> 0;
    for (var i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = (h * 16777619) >>> 0; }
    return h >>> 0;
  };
  GLM.prng = function (seed) {
    var a = seed >>> 0;
    return function () {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      var t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  };

  /* --- Vocabulario (igual que la app real) -------------------------------- */
  GLM.COMBUSTIBLES = [
    'Gasolina 95 E5', 'Gasolina 98 E5', 'Gasolina 95 E10', 'Gasolina 98 E10',
    'Gasóleo A', 'Gasóleo Premium', 'Gasóleo B', 'GLP', 'AdBlue', 'Hidrógeno'
  ];
  GLM.COMBUSTIBLES_CORTOS = {
    'Gasolina 95 E5': 'G.95', 'Gasolina 98 E5': 'G.98', 'Gasolina 95 E10': 'G.95 E10',
    'Gasolina 98 E10': 'G.98 E10', 'Gasóleo A': 'Gasóleo', 'Gasóleo Premium': 'G. Prem',
    'Gasóleo B': 'G.B', 'GLP': 'GLP', 'AdBlue': 'AdBlue', 'Hidrógeno': 'H₂'
  };
  GLM.MARCAS = [
    { n: 'Repsol', c: '#e03c31' }, { n: 'Cepsa', c: '#c8102e' },
    { n: 'Shell', c: '#f2c200' }, { n: 'BP', c: '#008248' },
    { n: 'Galp', c: '#f6a623' }, { n: 'Ballenoil', c: '#0e9fd8' },
    { n: 'Putalocasa', c: '#f96302' }, { n: 'Petroprix', c: '#5c2d91' },
    { n: 'Alcampo', c: '#d50032' }, { n: 'E.Leclerc', c: '#0057b8' },
    { n: 'Avia', c: '#005baa' }, { n: 'Petronor', c: '#1b3a6b' },
    { n: 'Nomo', c: '#eb5d1e' }, { n: 'Carrefour', c: '#004ea2' }
  ];
  GLM.colorMarca = function (m) {
    for (var i = 0; i < GLM.MARCAS.length; i++) if (GLM.MARCAS[i].n === m) return GLM.MARCAS[i].c;
    return '#7a8794';
  };

  GLM.PROVINCIAS = ['Madrid', 'Barcelona', 'Valencia', 'Sevilla', 'Zaragoza', 'Bizkaia'];
  GLM.LOCALIDADES = {
    'Madrid': ['Madrid', 'Getafe', 'Móstoles', 'Alcalá de Henares', 'Leganés',
      'Alcobendas', 'Fuenlabrada', 'Alcorcón', 'Coslada', 'Torrejón de Ardoz'],
    'Barcelona': ['Barcelona', 'L\'Hospitalet', 'Badalona', 'Terrassa', 'Sabadell', 'Cornellà'],
    'Valencia': ['Valencia', 'Torrent', 'Gandía', 'Sagunto', 'Burjassot'],
    'Sevilla': ['Sevilla', 'Dos Hermanas', 'Alcalá de Guadaíra', 'Utrera'],
    'Zaragoza': ['Zaragoza', 'Utebo', 'Calatayud'],
    'Bizkaia': ['Bilbao', 'Barakaldo', 'Gecho', 'Santurtzi']
  };
  GLM.localidades = function (pro) { return (GLM.LOCALIDADES[pro] || []).slice(); };

  var CALLES = [
    'Av. de la Constitución 128', 'C/ Mayor 41', 'Insurgentes Sur 1024', 'Av. Andrés Mellado 87',
    'C/ Alcalá 456', 'Ronda de Valencia 12', 'Ctra. de Irún km 8,4', 'C/ Serrano 210',
    'Av. de América 35', 'C/ Colón 19', 'Av. Europa 7', 'C/ Mayor del Barrio 4',
    'Plaza de los Sitios 2', 'Ctra. Nacional IV km 12,3', 'C/ Bravo Murillo 298',
    'Pol. Ind. La Solana s/n', 'Av.España 44', 'C/ Numancia 9', 'Carretera de Valencia km 6',
    'C/ Real de Aranjuez 88'
  ];

  /* --- Generador de estaciones -------------------------------------------
   * Precios de referencia 16-10-2026 (contexto: mercado a la baja).
   * mx/my: posición en el mapa fake (%), mx 6-94 / my 10-72 (dejan aire abajo).
   * dist: km respecto al área elegida, con dedo.
   * --------- */ // eslint-disable-line
  var PREFIJOS = ['ES-28', 'ES-08', 'ES-46', 'ES-41', 'ES-50', 'ES-48'];
  var REGISTRO = {};
  var N_DIS = 0;

  GLM.de = function (pro, opts) {
    opts = opts || {};
    if (!REGISTRO[pro]) {
      var localidades = GLM.localidades(pro);
      if (!localidades.length) return [];
      var filas = [];
      var posP = (GLM.PROVINCIAS.indexOf(pro) % GLM.PROVINCIAS.length) * 197; // deriva por provincia
      var n = { 'Madrid': 38, 'Barcelona': 26, 'Valencia': 22, 'Sevilla': 18, 'Zaragoza': 14, 'Bizkaia': 12 }[pro] || 12;
      for (var i = 0; i < n; i++) {
        var r = GLM.prng(GLM.hash('glm-' + pro + '-' + i) + posP);
        var marca = GLM.MARCAS[Math.floor(r() * GLM.MARCAS.length)].n;
        var loc = localidades[Math.min(localidades.length - 1, Math.floor(Math.pow(r(), 1.7) * localidades.length))];
        var esBarata = (marca === 'Ballenoil' || marca === 'Putalocasa' || marca === 'Petroprix' || marca === 'E.Leclerc' || marca === 'Alcampo');
        var base94 = 1.464 + r() * 0.14 - (esBarata ? 0.09 : 0) + 0.004 * (i % 3);
        var est = {
          id: PREFIJOS[GLM.PROVINCIAS.indexOf(pro) % PREFIJOS.length] + '-' + (100 + i),
          marca: marca, localidad: loc,
          direccion: CALLES[Math.floor(r() * CALLES.length)],
          mx: 6 + r() * 86, my: 10 + r() * 62,
          dist: +(0.4 + r() * (loc === localidades[0] ? 9 : 22)).toFixed(1),
          fav: r() < 0.16,
          precios: {}
        };
        var arr = {
          'Gasolina 95 E5': base94,
          'Gasolina 98 E5': base94 + (r() < 0.85 ? 0.13 + r() * 0.06 : null),
          'Gasóleo A': base94 - (r() < 0.92 ? 0.115 + r() * 0.05 : 0),
          'Gasóleo Premium': base94 - 0.115 + (r() < 0.35 ? 0.155 + r() * 0.05 : null),
          'GLP': r() < 0.4 ? 0.62 + r() * 0.1 : null,
          'AdBlue': r() < 0.55 ? 0.42 + r() * 0.12 : null
        };
        Object.keys(arr).forEach(function (k) {
          if (arr[k] !== null && arr[k] !== undefined && !(k === 'Gasóleo A' && arr[k] === 0)) {
            est.precios[k] = +arr[k].toFixed(3);
          }
        });
        filas.push(est);
        N_DIS += 1;
      }
      REGISTRO[pro] = filas;
    }
    var lista = REGISTRO[pro].slice();
    if (opts.loc && opts.loc !== 'Todas') lista = lista.filter(function (e) { return e.localidad === opts.loc; });
    if (opts.marcas && opts.marcas.length) lista = lista.filter(function (e) { return opts.marcas.indexOf(e.marca) >= 0; });
    return lista;
  };

  N_DIS = 0;

  /* --- Precios y tasas ----------------------------------------------------- */
  GLM.DESCUENTOS_DEFAULT = [['Ballenoil', 4], ['Putalocasa', 3], ['Petroprix', 2.5], ['Alcampo', 2], ['Carrefour', 2], ['E.Leclerc', 1.5]];
  GLM.descuentos = GLM.DESCUENTOS_DEFAULT.map(function (r) { return { marca: r[0], cent: r[1] }; });
  GLM.descuento = function (marca) {
    for (var i = 0; i < GLM.descuentos.length; i++) if (GLM.descuentos[i].marca === marca) return GLM.descuentos[i].cent;
    return 0;
  };
  GLM.precio = function (est, comb) { return est.precios[comb]; };
  GLM.precioFinal = function (est, comb, actualesDesc) {
    var p = est.precios[comb];
    if (p == null) return null;
    var d = 0, descs = actualesDesc || GLM.descuentos;
    for (var i = 0; i < descs.length; i++) if (descs[i].marca === est.marca) d = descs[i].cent / 100;
    return Math.max(0.001, p - d);
  };
  GLM.nivel = function (p) { return p < 1.5 ? 'baja' : (p < 1.7 ? 'media' : 'alta'); };
  GLM.fmt = function (p) { return p == null ? '—' : p.toFixed(3).replace('.', ','); };
  GLM.fmt2 = function (p) { return p == null ? '—' : p.toFixed(2).replace('.', ','); };
  GLM.cent = function (d) { return '−' + ('' + d).replace('.', ',') + ' ¢'; };

  /* --- Serie histórica -----------------------------------------------------
   * Cada serie acaba en el precio ACTUAL de la estación: la lista y la gráfica
   * nunca discrepan (quejas reales cuando no cuadran).
   * ------------------------------------------------------------------------ */
  var PENDIENTES = {};
  GLM.historico = function (est, comb, dias) {
    var dia = Math.min(180, Math.max(1, dias || 14));
    var p0 = est.precios[comb];
    if (p0 == null) return null;
    var clave = est.id + '|' + comb + '|' + dia;
    if (PENDIENTES[clave]) return PENDIENTES[clave].map(function (r) { return { f: r.f, p: r.p }; });
    var r = GLM.prng(GLM.hash(clave));
    var sube = r() < 0.42;             // ~42% de estaciones han subido
    var paso = (sube ? 0.0016 : -0.0018) + (r() - 0.5) * 0.0016; // €/día hacia atrás
    var serie = [];
    var f = parse(GLM.hoy);
    for (var d = 0; d < dia; d++) {
      var p = p0 + d * paso + (r() - 0.5) * 0.014;
      serie.unshift({ f: f.toString(), p: Math.max(0.5, +p.toFixed(3)) });
      f.rev();
    }
    // anclas: el último día es el precio exacto de hoy
    serie[serie.length - 1] = { f: GLM.hoy, p: p0 };
    PENDIENTES[clave] = serie;
    return serie.map(function (s) { return { f: s.f, p: s.p }; });
  };
  function parse(ddmmaaaa) {
    var a = ddmmaaaa.split('-');
    var d = +a[0], m = +a[1] - 1, y = +a[2];
    return {
      toString: function () { return GLM.fechaDD(new Date(y, m, d)); },
      rev: function () { d -= 1; if (d < 1) { m -= 1; if (m < 0) { m = 11; y -= 1; } d = 28; } }
    };
  }
  GLM.fechaDD = function (d) {
    var dd = ('0' + d.getDate()).slice(-2), mm = ('0' + (d.getMonth() + 1)).slice(-2);
    return dd + '-' + mm + '-' + d.getFullYear();
  };
  GLM.resumen = function (serie) {
    if (!serie || !serie.length) return null;
    var min = serie[0], max = serie[0], sum = 0, i;
    for (i = 0; i < serie.length; i++) {
      if (serie[i].p < min.p) min = serie[i];
      if (serie[i].p > max.p) max = serie[i];
      sum += serie[i].p;
    }
    var hoy = serie[serie.length - 1];
    var ayer = serie.length > 1 ? serie[serie.length - 2] : hoy;
    return { media: sum / serie.length, min: min.p, minFecha: min.f, max: max.p, maxFecha: max.f,
      delta: +(hoy.p - ayer.p).toFixed(3), pct: ayer.p ? Math.round((hoy.p - ayer.p) / ayer.p * 1000) / 10 : 0,
      hoy: hoy.p, ayer: ayer.p, dias: serie.length };
  };
  GLM.tendencia = function (est, comb) {
    var s = GLM.historico(est, comb, 7);
    var r = GLM.resumen(s);
    return r ? { d: r.delta, pct: r.pct } : { d: 0, pct: 0 };
  };

  /* --- Gráficas SVG -------------------------------------------------------- */
  GLM.spark = function (serie, w, h, color) {
    w = w || 64; h = h || 22; color = color || 'currentColor';
    if (!serie || serie.length < 2) return '';
    var lo = serie[0].p, hi = serie[0].p, i;
    for (i = 1; i < serie.length; i++) { lo = Math.min(lo, serie[i].p); hi = Math.max(hi, serie[i].p); }
    var span = Math.max(0.001, hi - lo), pts = '';
    for (i = 0; i < serie.length; i++) {
      pts += (i ? 'L' : 'M') + (i / (serie.length - 1) * (w - 2) + 1).toFixed(2) + ',' +
        (h - 2 - (serie[i].p - lo) / span * (h - 4)).toFixed(2);
    }
    return '<svg class="spark" width="' + w + '" height="' + h + '" viewBox="0 0 ' + w + ' ' + h + '" aria-hidden="true"><path d="' + pts + '" fill="none" stroke="' + color + '" stroke-width="2" stroke-linecap="round"/></svg>';
  };

  /* Gráfica con ejes, etiquetas dd-mm y área. Opts: w, h, color, fill, step */
  GLM.chart = function (serie, opts) {
    opts = opts || {};
    var w = opts.w || 340, h = opts.h || 150, c = opts.color || '#0b6ef0';
    var padL = 38, padR = 10, padT = 12, padB = 26;
    if (!serie || serie.length < 2) return '<p class="chart-vacio">Sin datos</p>';
    var lo = serie[0].p, hi = serie[0].p, i;
    for (i = 1; i < serie.length; i++) { lo = Math.min(lo, serie[i].p); hi = Math.max(hi, serie[i].p); }
    var span = Math.max(0.004, hi - lo), datos = [];
    for (i = 0; i < serie.length; i++) {
      datos.push([
        padL + i / (serie.length - 1) * (w - padL - padR),
        padT + (1 - (serie[i].p - lo) / span) * (h - padT - padB)
      ]);
    }
    var pts = '', area;
    for (i = 0; i < datos.length; i++) pts += (i ? 'L' : 'M') + round(datos[i]) ;
    area = pts + 'L' + (w - padR) + ',' + (h - padB) + 'L' + padL + ',' + (h - padB) + 'Z';
    var g3 = Math.max(2, Math.round((h - padT - padB) / 42)), gridy = [], j;
    for (j = 0; j <= g3; j++) {
      var v = hi - j / g3 * span, y = padT + j / g3 * (h - padT - padB);
      gridy.push('<line x1="' + padL + '" y1="' + y.toFixed(1) + '" x2="' + (w - padR) + '" y2="' + y.toFixed(1) + '" class="lm-line"/>' +
        '<text x="' + (padL - 5) + '" y="' + (y + 3).toFixed(1) + '" text-anchor="end" class="lm-num">' + v.toFixed(3).replace('.', ',') + '</text>');
    }
    var nlbl = opts.step || 3, lbls = [];
    var paso = Math.max(1, Math.floor(serie.length / nlbl));
    for (j = 0; j < serie.length; j += paso) {
      var x = datos[j][0];
      lbls.push('<text x="' + x.toFixed(1) + '" y="' + (h - 8) + '" text-anchor="middle" class="lm-num">' + serie[j].f.slice(0, -5) + '</text>');
    }
    return '<svg class="lm-chart" viewBox="0 0 ' + w + ' ' + h + '" width="100%" role="img" aria-label="Histórico de precios">' +
      gridy.join('') + '<path d="' + area + '" fill="' + c + '" opacity=".12"/><path d="' + pts + '" fill="none" stroke="' + c + '" stroke-width="2.2" stroke-linejoin="round"/>' +
      lbls.join('') + '</svg>';
  };
  function round(p) {
    return p[0].toFixed(1) + ',' + p[1].toFixed(1);
  }
  function esc(s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;'); }

  /* --- Mapa fake (SVG de calles + pines HTML clicables) -------------------- */
  GLM.miniMapa = function (el, opts) {
    opts = opts || {};
    var osc = opts.oscuro;
    var C = osc
      ? { fondo: '#101418', manzana: '#1b2129', parque: '#142a1d', agua: '#12293d', calle: '#3c4754', calleMayor: '#54637a', ring: '#5f6f86', texto: '#98a8bb' }
      : { fondo: '#eef0ee', manzana: '#e2e5e1', parque: '#cdeccb', agua: '#bcd9f2', calle: '#ffffff', calleMayor: '#ffe9a8', ring: '#ffdf8a', texto: '#7d8a80' };
    var calles = '';
    [[14, 'C'], [30, 'H'], [46, 'H'], [62, 'H'], [80, '']].forEach(function (f) {
      calles += '<rect x="0" y="' + f[0] + '" width="100" height="' + (f[2] === 'H' ? 2.4 : 1.4) + '" fill="' + C.calle + '"/>';
    });
    [[10], [26], [42], [66], [84]].forEach(function (f) {
      calles += '<rect x="' + f[0] + '" y="0" width="1.5" height="100" fill="' + C.calle + '"/>';
    });
    calles += '<path d="M0 88 C 26 70, 52 62, 100 30" stroke="' + C.calleMayor + '" stroke-width="3.2" fill="none"/>';
    calles += '<path d="M8 6 C 40 22, 62 44, 94 58" stroke="' + C.calle + '" stroke-width="2" fill="none"/>';
    calles += '<circle cx="50" cy="47" r="40" fill="none" stroke="' + C.ring + '" stroke-width="3.4" stroke-dasharray="9 4" opacity=".9"/>';
    var svg = '<svg viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">' +
      '<rect width="100" height="100" fill="' + C.fondo + '"/>' +
      '<rect x="4" y="66" width="20" height="30" fill="' + C.parque + '" rx="2"/>' +
      '<rect x="70" y="6" width="24" height="20" fill="' + C.parque + '" rx="2"/>' +
      '<rect x="56" y="52" width="14" height="10" fill="' + C.manzana + '" opacity=".5"/>' +
      '<rect x="26" y="60" width="16" height="12" fill="' + C.manzana + '" opacity=".5"/>' +
      '<path d="M0 22 C 22 26, 42 20, 58 30 C 76 40, 90 34, 100 40" stroke="' + C.agua + '" stroke-width="4.6" fill="none" opacity=".85"/>' +
      calles + '</svg>';
    el.innerHTML = svg;
    var capa = document.createElement('div');
    capa.className = 'minimap-pins';
    capa.style.cssText = 'position:absolute;inset:0;pointer-events:none';
    el.appendChild(capa);
    if (opts.etiquetas !== false) {
      var lb = document.createElement('div');
      lb.className = 'minimap-etiquetas';
      lb.style.cssText = 'position:absolute;inset:0;pointer-events:none;font-size:9px;color:' + C.texto + ';letter-spacing:.3px';
      lb.innerHTML = '<span style="position:absolute;left:6%;top:76%">' + (opts.parque || 'Casa de Campo') + '</span>' +
        '<span style="position:absolute;left:72%;top:12%">' + (opts.parque2 || 'Parque Norte') + '</span>' +
        '<span style="position:absolute;left:44%;top:4%">' + (opts.ring || 'M-40') + '</span>';
      el.appendChild(lb);
    }
    var api = {
      pines: function (lista, actual, ni) {
        capa.innerHTML = '';
        (lista || []).forEach(function (est, i) {
          var p = est.precios && est.precios[ni || GLM.COMBUSTIBLES[0]];
          var b = document.createElement('button');
          b.className = 'pin nivel-' + GLM.nivel(p == null ? 2 : p) + (est === actual ? ' pin-sel' : '') + (est.fav ? ' pin-fav' : '');
          b.style.left = est.mx.toFixed(1) + '%';
          b.style.top = est.my.toFixed(1) + '%';
          b.dataset.pid = est.id;
          b.textContent = p == null ? '•' : GLM.fmt(p).slice(0, 5);
          b.title = est.marca;
          b.style.pointerEvents = 'auto';
          if (opts.onpin) b.addEventListener('click', function () { opts.onpin(est, i); });
          capa.appendChild(b);
        });
      },
      el: capa
    };
    return api;
  };

  /* --- IA fake ------------------------------------------------------------- */
  GLM.chatRespuesta = function (txt, lista, comb) {
    var q = (txt || '').toLowerCase();
    var sin = lista.filter(function (e) { return e.precios[comb] != null; })
      .sort(function (a, b) { return GLM.precioFinal(a, comb) - GLM.precioFinal(b, comb); });
    var top3 = sin.slice(0, 3), peor = sin[sin.length - 1];
    if (/hist[óo]ric|evoluci|subid|bajad|minim/.test(q)) {
      var s = GLM.historico(top3[0], comb, 14), r = GLM.resumen(s);
      return '**Histórico de ' + comb + '**\n\nLa más barata de ahora (' + top3[0].marca + ', ' + top3[0].direccion + ') ha pasado de ' + GLM.fmt(s[0].p) + ' a **' + GLM.fmt(r.hoy) + ' €/L** en 14 días (' + (r.pct >= 0 ? '+' : '') + r.pct + '%).\n\n- Mínimo: ' + GLM.fmt(r.min) + ' (' + r.minFecha + ')\n- Máximo: ' + GLM.fmt(r.max) + ' (' + r.maxFecha + ')\n- Media: ' + GLM.fmt(r.media) + '\n\n> Un día sin precio publicado no significa precio constante; el Ministerio puede no publicar ese día.';
    }
    if (/barat|mejor|óptim/.test(q)) {
      var filas = top3.map(function (e, i) {
        return (i + 1) + '. **' + e.marca + '** · ' + GLM.fmt(GLM.precioFinal(e, comb)) + ' €/L · ' + e.localidad + ' — ' + e.direccion;
      });
      return 'Con los descuentos guardados, las **3 más baratas** en ' + comb + ':\n\n' + filas.join('\n') + '\n\nLa diferencia con la más cara (' + peor.marca + ', ' + GLM.fmt(GLM.precioFinal(peor, comb)) + ') es de **' + GLM.fmt2(GLM.precioFinal(peor, comb) - GLM.precioFinal(top3[0], comb)) + ' €/L**.';
    }
    return 'Ahora mismo hay **' + lista.length + ' estaciones con datos** en tu provincia. ' +
      'Puedo ayudarte con:\n\n- La lista de las **más baratas** con tu combustible\n- El **histórico** de una estación o de la media\n- Cuánto **ahorras al llenar el depósito** en la opción barata\n\n¿Qué quieres consultar?';
  };
  GLM.md = function (txt) {
    var h = esc(txt);
    h = h.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
    h = h.replace(/&lt;br&gt;/g, '');
    h = h.replace(/^- (.*)$/gm, '<li>$1</li>').replace(/(<li>[\s\S]*?<\/li>)/g, '<ul>$1</ul>');
    h = h.replace(/^&gt; (.*)$/gm, '<blockquote>$1</blockquote>');
    h = h.split(/\n{2,}/).map(function (p) { return /^<(ul|block)/.test(p.trim()) ? p : '<p>' + p + '</p>'; }).join('');
    return h;
  };
  GLM.PROMPTS = ['¿Cuál es la más barata?', 'Histórico de 14 días', '¿Han subido los precios?', 'Ahorro llenando 50 L'];

  /* ---registros de ejemplo (Config) --------------------------------------- */
  GLM.logApi = [
    { t: '16/10/26 09:12:04', d: '0,8 s', s: '200 OK', url: 'provinceList' },
    { t: '16/10/26 09:12:06', d: '1,2 s', s: '200 OK', url: 'gasolineras/prov/28' },
    { t: '16/10/26 09:13:31', d: '0,9 s', s: '200 OK', url: 'gasolineras/prov/28 (hist 14d)' },
    { t: '16/10/26 09:14:02', d: '—', s: '304 caché', url: 'gasolineras/prov/28' },
    { t: '16/10/26 09:21:58', d: '2,1 s', s: '503 ERROR', url: 'gasolineras/prov/46' }
  ];
  GLM.logPush = [
    { t: '16/10/26 08:00:02', s: 'checkPrices → 2 favoritas, 1 caída' },
    { t: '16/10/26 08:00:03', s: 'showNotification: Ballenoil bajó a 1,412' },
    { t: '15/10/26 16:00:01', s: 'periodicsync disparado por el SO' }
  ];
  GLM.alertasPush = [
    { est: 'Ballenoil', txt: 'bajó de 1,448 a 1,412 €/L', hora: 'hace 2 h', tipo: 'caida' },
    { est: 'Shell Av. España', txt: 'subió a 1,589 €/L (+2,1%)', hora: 'ayer', tipo: 'subida' },
    { est: 'Repsol M-40 km 6', txt: '3 jornadas seguidas bajando', hora: 'ayer', tipo: 'caida' }
  ];

  /* --- Avisos --------------------------------------------------------------- */
  GLM.snack = function (msg) {
    var s = document.querySelector('.snack');
    if (!s) {
      s = document.createElement('div');
      s.className = 'snack';
      document.body.appendChild(s);
    }
    s.textContent = msg;
    s.classList.add('snack-vis');
    clearTimeout(s._t);
    s._t = setTimeout(function () { s.classList.remove('snack-vis'); }, 2600);
  };

  GLM.DEPOSITO_LS = 'glm_dep';
  GLM.deposito = function (litros, pa, pb) { return (pa - pb) * litros; };

  GLM.integrable = false;
})();
