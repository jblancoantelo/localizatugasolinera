/* =============================================================================
 * Prototipo 7 · «Asistente por decisiones» — lógica de la maqueta
 * -----------------------------------------------------------------------------
 * Tesis: la app no arranca con una lista, sino con un ASISTENTE que hace 2-3
 * preguntas (combustible → provincia → prioridad) y termina recomendando una
 * estación con motivo, alternativas y acciones.
 *
 * Todo funciona abriendo el HTML por file:// (script clásico, sin módulos ES y
 * sin CDN). Los datos salen de window.FAKE (../shared/datos-fake.js) y el
 * estado vive en memoria. Este prototipo NO forma parte de la app real.
 * ========================================================================== */
(function () {
  'use strict';

  var F = window.FAKE;
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };

  /* =======================================================================
   * 1. Utilidades de formato
   * ===================================================================== */
  function exc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }
  function eur(p) { return p == null ? '—' : p.toFixed(3).replace('.', ',') + ' €'; }
  function num3(p) { return p == null ? '—' : p.toFixed(3).replace('.', ','); }
  function eur2(p) { return p == null ? '—' : p.toFixed(2).replace('.', ','); }
  function km(d) { return d == null ? '—' : d.toFixed(1).replace('.', ',') + ' km'; }
  function pct(v) { return (v >= 0 ? '+' : '−') + Math.abs(v).toFixed(1).replace('.', ',') + ' %'; }
  function norm(s) {
    return String(s).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  }
  function iniciales(marca) {
    return String(marca).split(/[\s.]+/).filter(Boolean).slice(0, 2)
      .map(function (w) { return w[0]; }).join('').toUpperCase();
  }
  /** Colores oscuros de la escala de precio (legibles con texto blanco encima). */
  var COLOR = { verde: '#0b5f34', ambar: '#8a4b00', rojo: '#a51f14', gris: '#464663' };
  var TEXTO = { verde: 'precio-verde', ambar: 'precio-ambar', rojo: 'precio-rojo', gris: 'precio-gris' };

  /** Escala semántica del precio, la misma que la app real (FAKE.colorPrecio). */
  function escala(p) { return F.colorPrecio(p); }
  function claseTexto(p) { return TEXTO[escala(p)] || ''; }
  function colorDe(p) { return COLOR[escala(p)] || COLOR.gris; }
  function etiquetaEscala(p) {
    var e = escala(p);
    return e === 'verde' ? 'Barata' : e === 'naranja' ? 'Precio medio' : e === 'rojo' ? 'Cara' : 'Sin datos';
  }

  /** Precio mostrado en toda la maqueta: el del Ministerio menos el descuento. */
  function precio(est, fuel) { return F.precioConDescuento(est, fuel); }

  /** Valoración determinista 3,6–4,7 a partir del id (no hay reseñas reales). */
  var cacheVal = {};
  function valoracion(est) {
    if (cacheVal[est.id] == null) {
      var n = String(est.id).split('').reduce(function (a, c) { return a + Number(c); }, 0);
      cacheVal[est.id] = Math.round((3.6 + (n % 12) / 10) * 10) / 10;
    }
    return cacheVal[est.id];
  }
  /** Minutos de coche estimados (a 45 km/h de media en ciudad). */
  function minutos(dist) { return Math.max(2, Math.round(dist * 1.6)); }

  /* =======================================================================
   * 2. Estado en memoria
   * ===================================================================== */
  var estado = {
    vista: 'inicio',
    prov: '28',
    fuel: 'Gasolina 95 E5',
    orden: 'precio',
    texto: '',
    seleccion: null,
    favoritos: {},
    zoom: 1, panX: 0, panY: 0,
    histFuel: 'Gasolina 95 E5',
    histDias: 14,
    /* Asistente: camino elegido y respuestas de los pasos */
    asistente: { camino: null, paso: 0, fuel: null, prov: null, prioridad: null, cerca: false, radio: 20, estacion: null },
    ia: { prov: 'general', modelos: {}, mensajes: {}, enviando: false },
    cfg: {
      pagina: F.config.pageSize, ttl: F.config.cacheTtl, cacheTab: 'indexeddb', logTab: 'api',
      push: true, pushSubida: false, intervalo: F.config.checkInterval, diasFall: F.config.priceFallDays,
      modo: F.config.priceCheckMode, iaVisibles: {}, iaDefecto: 'general',
      vigiladas: {}
    }
  };
  F.estaciones.forEach(function (e) { if (e.fav) estado.favoritos[e.id] = true; });
  var PROVEEDORES_REALES = ['groq', 'mistral', 'openrouter', 'llm7', 'nvidia', 'google', 'chrome-nano'];
  PROVEEDORES_REALES.forEach(function (p) { estado.cfg.iaVisibles[p] = true; });

  function esFav(id) { return !!estado.favoritos[id]; }
  function favsDe(prov) {
    return F.estacionesDe(prov).filter(function (e) { return esFav(e.id); });
  }

  /* =======================================================================
   * 3. Iconos SVG inline
   * ===================================================================== */
  var ICO = {
    inicio: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 11 12 4l8 7"/><path d="M6 10v9h12v-9"/></svg>',
    mapa: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"><path d="M9 3 3 5v16l6-2 6 2 6-2V3l-6 2-6-2Z"/><path d="M9 3v16M15 5v16"/></svg>',
    explorar: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.6-3.6"/></svg>',
    ia: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M12 3v3M12 18v3M3 12h3M18 12h3M5.6 5.6l2.1 2.1M16.3 16.3l2.1 2.1M18.4 5.6l-2.1 2.1M7.7 16.3l-2.1 2.1"/><circle cx="12" cy="12" r="3.4"/></svg>',
    config: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M4 7h10M18 7h2M4 17h4M12 17h8"/><circle cx="16" cy="7" r="2.2"/><circle cx="10" cy="17" r="2.2"/></svg>',
    surtidor: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 21V5a2 2 0 0 1 2-2h5a2 2 0 0 1 2 2v16"/><path d="M3 21h13"/><path d="M14 9h2.5a2 2 0 0 1 2 2v6a1.5 1.5 0 0 0 3 0V9l-2.5-2.5"/></svg>',
    ruta: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="6" cy="18" r="2.5"/><circle cx="18" cy="6" r="2.5"/><path d="M8.5 18H14a3.5 3.5 0 0 0 0-7h-4a3.5 3.5 0 0 1 0-7h3.5"/></svg>',
    campana: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 9a6 6 0 0 1 12 0c0 4 1.5 5.5 2 6H4c.5-.5 2-2 2-6Z"/><path d="M10 19a2 2 0 0 0 4 0"/></svg>'
  };

  /* =======================================================================
   * 4. Navegación (barra inferior en móvil, raíl en PC)
   * ===================================================================== */
  var VISTAS = [
    { id: 'inicio', nombre: 'Inicio', ico: ICO.inicio },
    { id: 'mapa', nombre: 'Mapa', ico: ICO.mapa },
    { id: 'explorar', nombre: 'Explorar', ico: ICO.explorar },
    { id: 'ia', nombre: 'IA', ico: ICO.ia },
    { id: 'config', nombre: 'Config', ico: ICO.config }
  ];

  function pintarNav() {
    $('#navPrincipal').innerHTML = VISTAS.map(function (v) {
      return '<button data-vista="' + v.id + '" class="nav-btn' + (estado.vista === v.id ? ' activo' : '') +
        '" type="button" aria-label="' + v.nombre + '">' + v.ico + '<span>' + v.nombre + '</span></button>';
    }).join('');
    /* Un único control marcado para las capturas automáticas. */
    var marca = $('#navPrincipal [data-vista="mapa"]');
    if (marca) marca.dataset.shot = 'vista';
  }

  function setVista(id) {
    estado.vista = id;
    $$('.vista').forEach(function (s) { s.classList.toggle('activa', s.dataset.vista === id); });
    $$('#navPrincipal .nav-btn').forEach(function (b) { b.classList.toggle('activo', b.dataset.vista === id); });
    if (id === 'explorar') pintarExplorar();
    if (id === 'ia') pintarIA();
    if (id === 'config') pintarConfig();
    if (id === 'mapa') pintarMapa();
    if (id === 'inicio') pintarInicio();
  }

  /* =======================================================================
   * 5. Cabecera
   * ===================================================================== */
  function pintarCabecera() {
    $('#cabeceraSub').textContent = F.provinciaNombre(estado.prov) + ' · ' + estado.fuel;
    var chip = $('#cabeceraChip');
    var n = favsDe(estado.prov).length;
    chip.textContent = n ? n + (n === 1 ? ' favorita' : ' favoritas') : 'Sin alertas activas';
    chip.classList.toggle('alerta', n > 0);
  }

  /* =======================================================================
   * 6. Vista Inicio · asistente por decisiones
   * ===================================================================== */
  var CAMINOS = [
    { id: 'barato', titulo: 'Repostar barato ahora', sub: 'El precio más bajo de tu provincia en 3 preguntas', ico: ICO.surtidor, pasos: ['fuel', 'prov', 'prioridad'] },
    { id: 'ruta', titulo: 'Ahorrar en mi ruta', sub: 'Ordena las paradas más baratas del trayecto', ico: ICO.ruta, pasos: ['fuel', 'prioridad'] },
    { id: 'vigilar', titulo: 'Vigilar una estación', sub: 'Avísame cuando baje de precio', ico: ICO.campana, pasos: ['fuel', 'prov', 'estacion'] }
  ];
  var PRIORIDADES = [
    { id: 'barato', titulo: 'La más barata', sub: 'Minimizar el precio por litro', ico: '💰' },
    { id: 'cerca', titulo: 'La más cercana', sub: 'Perder el menor tiempo posible', ico: '📍' },
    { id: 'valor', titulo: 'La mejor valorada', sub: 'Equilibrio entre precio, cercanía y servicio', ico: '⭐' }
  ];
  function camino(id) {
    return CAMINOS.filter(function (c) { return c.id === id; })[0] || null;
  }
  function pasoActual() {
    var c = camino(estado.asistente.camino);
    return c ? c.pasos[estado.asistente.paso] : null;
  }

  function pintarInicio() {
    var caja = $('#lienzoAsistente');
    var a = estado.asistente;
    if (!a.camino) { caja.innerHTML = portadaHTML(); return; }
    var c = camino(a.camino);
    if (!c) { a.camino = null; caja.innerHTML = portadaHTML(); return; }
    var paso = c.pasos[a.paso];
    if (!paso) { caja.innerHTML = resultadoHTML(); return; }
    caja.innerHTML = pasoHTML(c, paso);
  }

  function portadaHTML() {
    var barata = F.masBarata(estado.prov, estado.fuel);
    var sug = '';
    if (barata) {
      var p = precio(barata.e, estado.fuel);
      sug = '<div class="sugerencia" role="button" tabindex="0" data-estacion="' + exc(barata.e.id) + '" data-shot="detalle" ' +
        'aria-label="' + exc('Abrir detalle de ' + barata.e.marca + ' ' + barata.e.nombre) + '">' +
        '<span class="sugerencia-cab"><span class="sugerencia-etq">Recomendación de hoy</span>' +
        '<span class="sugerencia-hint">Abrir detalle ›</span></span>' +
        '<span class="sugerencia-cuerpo">' +
        '<span class="sugerencia-datos">' +
        '<span class="sugerencia-nombre">' + exc(barata.e.marca + ' · ' + barata.e.nombre) + '</span>' +
        '<span class="sugerencia-meta">' + exc(barata.e.localidad) + ' · ' + km(barata.e.dist) + ' · ' + exc(barata.e.direccion) + '</span>' +
        '</span>' +
        '<span class="sugerencia-precio ' + claseTexto(p) + '">' + num3(p) +
        '<small>' + exc('€/L ' + estado.fuel) + '</small></span>' +
        '</span></div>';
    }
    return '<div class="asistente-caja">' +
      '<div class="hero">' +
      '<p class="hero-saludo">Asistente de repostaje</p>' +
      '<h1 class="hero-titulo">No busques.<br>Deja que te lo pregunte.</h1>' +
      '<p class="hero-sub">Dos o tres decisiones y tienes una estación recomendada con el motivo, el precio con descuento y el camino. Nada de rastrear listas.</p>' +
      '</div>' +
      '<div class="caminos" role="group" aria-label="¿Qué necesitas?">' + CAMINOS.map(function (c) {
        return '<button class="camino" type="button" data-camino="' + c.id + '">' +
          '<span class="camino-ico" aria-hidden="true">' + c.ico + '</span>' +
          '<span class="camino-txt"><span class="camino-titulo">' + exc(c.titulo) + '</span>' +
          '<span class="camino-sub">' + exc(c.sub) + '</span></span>' +
          '<span class="camino-flecha" aria-hidden="true">›</span></button>';
      }).join('') + '</div>' +
      sug + '</div>';
  }

  /* --- Pantalla de un paso --- */
  function pasoHTML(c, paso) {
    var a = estado.asistente;
    var titulos = {
      fuel: ['¿Qué combustible necesitas?', 'Solo aparecerán las estaciones que lo venden.'],
      prov: ['¿Dónde lo vas a repostar?', 'Elige una provincia o deja que busque cerca de tu ubicación.'],
      prioridad: ['¿Qué es más importante para ti?', 'Con esto decido qué estación recomendarte.'],
      estacion: ['¿Qué estación quieres vigilar?', 'Te avisaré cuando baje de precio. Ahora mismo estas son las más baratas.']
    };
    var t = titulos[paso] || ['', ''];
    var idx = a.paso + 1, total = c.pasos.length;
    var puntos = c.pasos.map(function (_, i) {
      return '<span class="progreso-punto' + (i <= a.paso ? ' on' : '') + '"></span>';
    }).join('');

    return '<div class="paso"><div class="asistente-caja">' +
      '<div class="paso-cabecera">' +
      '<button class="btn-atras" type="button" data-accion="atras">‹ Atrás</button>' +
      '<span class="progreso" aria-hidden="true">' + puntos + '</span>' +
      '<button class="btn-reiniciar" type="button" data-accion="reiniciar">↺ Reiniciar</button>' +
      '</div>' +
      '<p class="paso-indice">' + exc(c.titulo) + ' · paso ' + idx + ' de ' + total + '</p>' +
      '<h2 class="pregunta">' + exc(t[0]) + '</h2>' +
      '<p class="ayuda">' + exc(t[1]) + '</p>' +
      '<div class="opciones">' + opcionesHTML(paso) + '</div>' +
      '<div class="cta"><p class="cta-info">' + exc(ctaInfo(paso)) + '</p></div>' +
      '</div></div>';
  }

  function ctaInfo(paso) {
    if (paso === 'fuel') return 'Después te preguntaré por la zona y por lo que más te importa.';
    if (paso === 'prov') return 'Los precios que verás son los de la última actualización del Ministerio.';
    if (paso === 'prioridad') return 'Puedes reiniciar el asistente cuando quieras.';
    return 'Puedes cambiar de estación las veces que quieras.';
  }

  function opcionesHTML(paso) {
    var a = estado.asistente;
    if (paso === 'fuel') {
      return F.combustiblesVisibles.map(function (f) {
        var n = F.estacionesDe(a.prov || estado.prov).filter(function (e) { return e.precios[f] != null; }).length;
        return opcion(f, '⛽', f, n ? n + ' estaciones en ' + F.provinciaNombre(a.prov || estado.prov) : 'sin datos en la zona', a.fuel === f);
      }).join('');
    }
    if (paso === 'prov') {
      var cerca = opcion('cerca', '📍', 'Cerca de mí', 'Busca por distancia desde tu ubicación (Madrid centro)', a.cerca === true);
      return cerca + F.provincias.map(function (p) {
        var n = F.estacionesDe(p.id).length;
        var m = F.mediaProvincia(p.id, a.fuel || estado.fuel);
        return opcion(p.id, '🗺️', p.nombre, n + ' estaciones · media ' + num3(m) + ' €/L', !a.cerca && a.prov === p.id);
      }).join('');
    }
    if (paso === 'prioridad') {
      return PRIORIDADES.map(function (p) {
        return opcion(p.id, p.ico, p.titulo, p.sub, a.prioridad === p.id);
      }).join('');
    }
    /* estacion: las 4 más baratas de la provincia elegida */
    var lista = ranking(a.prov || estado.prov, a.fuel || estado.fuel, 'barato').slice(0, 4);
    if (!lista.length) return '<p class="ayuda">No hay estaciones con ese combustible en la zona.</p>';
    return lista.map(function (c) {
      return opcion(c.e.id, iniciales(c.e.marca), c.e.marca + ' · ' + c.e.nombre,
        num3(c.p) + ' €/L · ' + km(c.e.dist) + ' · ' + c.e.horario, a.estacion === c.e.id);
    }).join('');
  }

  function opcion(valor, ico, titulo, sub, activa) {
    return '<button class="opcion-paso' + (activa ? ' on' : '') + '" type="button" data-opcion-paso="' + exc(valor) + '">' +
      '<span class="op-ico" aria-hidden="true">' + exc(ico) + '</span>' +
      '<span class="op-txt"><span class="op-titulo">' + exc(titulo) + '</span>' +
      '<span class="op-sub">' + exc(sub) + '</span></span>' +
      '<span class="op-check" aria-hidden="true">✓</span></button>';
  }

  /* --- Ranking de candidatas según la prioridad elegida --- */
  function ranking(prov, fuel, prioridad) {
    var lista = F.estacionesDe(prov).map(function (e) {
      return { e: e, p: precio(e, fuel), d: e.dist, v: valoracion(e) };
    }).filter(function (c) { return c.p != null; });
    if (prioridad === 'cerca') {
      return lista.sort(function (x, y) { return x.d - y.d || x.p - y.p; });
    }
    if (prioridad === 'valor') {
      return lista.sort(function (x, y) { return y.v - x.v || x.p - y.p || x.d - y.d; });
    }
    var radio = 20;
    var cerca = lista.filter(function (c) { return c.d <= radio; });
    return (cerca.length ? cerca : lista).sort(function (x, y) { return x.p - y.p || x.d - y.d; });
  }

  /* --- Marcado de la gráfica en miniatura (sparkline) --- */
  function sparkline(id, fuel, dias) {
    var serie = F.historico(id, fuel, dias || 14);
    if (serie.length < 2) return '';
    var ps = serie.map(function (s) { return s.precio; });
    var min = Math.min.apply(null, ps), max = Math.max.apply(null, ps);
    var rango = max - min || 0.01;
    var pts = serie.map(function (s, i) {
      var x = (i / (serie.length - 1)) * 100;
      var y = 34 - ((s.precio - min) / rango) * 28 - 3;
      return { x: x, y: y };
    });
    var linea = pts.map(function (p, i) { return (i ? 'L' : 'M') + p.x.toFixed(2) + ' ' + p.y.toFixed(2); }).join(' ');
    var area = linea + ' L100 40 L0 40 Z';
    return '<svg viewBox="0 0 100 40" preserveAspectRatio="none" aria-hidden="true">' +
      '<path d="' + area + '" fill="rgba(79,70,229,.14)"/>' +
      '<path d="' + linea + '" fill="none" stroke="#4f46e5" stroke-width="1.6" stroke-linejoin="round" ' +
      'vector-effect="non-scaling-stroke"/></svg>';
  }
  function tendencia(id, fuel, dias) {
    var serie = F.historico(id, fuel, dias || 14);
    if (serie.length < 2) return 0;
    var a = serie[0].precio, b = serie[serie.length - 1].precio;
    return a ? (b - a) / a * 100 : 0;
  }

  /* --- Pantalla de resultado: la recomendación --- */
  function resultadoHTML() {
    var a = estado.asistente;
    var c = camino(a.camino);

    if (a.camino === 'vigilar') return resultadoVigilar();

    if (a.camino === 'ruta') {
      var paradas = ranking(a.prov, a.fuel, a.prioridad).slice(0, 3);
      return rutaHTML(paradas);
    }

    var rank = ranking(a.prov, a.fuel, a.prioridad);
    if (!rank.length) {
      return '<div class="paso"><div class="asistente-caja">' +
        '<h2 class="pregunta">Sin resultados</h2>' +
        '<p class="ayuda">No hay estaciones con ' + exc(a.fuel) + ' en esa zona. Prueba otra provincia.</p>' +
        '<div class="cta"><button class="btn btn-primario" type="button" data-accion="reiniciar">Empezar de nuevo</button></div>' +
        '</div></div>';
    }
    var top = rank[0];
    var media = F.mediaProvincia(a.prov, a.fuel);
    var alt = rank.slice(1, 3);
    var t = tendencia(top.e.id, a.fuel, 14);
    var sinDesc = F.precioDe(top.e, a.fuel);
    var desc = F.descuentos[top.e.marca] || 0;
    var ahorro = media != null ? media - top.p : null;

    var etiquetas = '';
    if (a.prioridad === 'barato') etiquetas += '<span class="etiqueta ok">★ La más barata</span>';
    if (a.prioridad === 'cerca') etiquetas += '<span class="etiqueta info">📍 La más cercana</span>';
    if (a.prioridad === 'valor') etiquetas += '<span class="etiqueta info">⭐ La mejor valorada</span>';
    if (esFav(top.e.id)) etiquetas += '<span class="etiqueta info">Favorita</span>';
    if (desc > 0) etiquetas += '<span class="etiqueta aviso">−' + eur2(desc) + ' € con descuento</span>';
    etiquetas += '<span class="etiqueta">' + exc(top.e.horario) + '</span>';

    var motivos = motivosHTML(top, a, media);
    var alternativas = alt.length ? '<div class="bloque">' +
      '<p class="bloque-titulo">Alternativas</p>' +
      '<div class="chips-fila">' + alt.map(function (x) {
        return '<button class="chip" type="button" data-estacion="' + exc(x.e.id) + '">' +
          '<span class="chip-punto" style="background:' + colorDe(x.p) + '"></span>' +
          exc(x.e.marca) + ' · ' + num3(x.p) + ' € · ' + km(x.d) + '</button>';
      }).join('') + '</div></div>' : '';

    return '<div class="paso"><div class="asistente-caja">' +
      '<div class="paso-cabecera">' +
      '<button class="btn-atras" type="button" data-accion="atras">‹ Cambiar respuesta</button>' +
      '<button class="btn-reiniciar" type="button" data-accion="reiniciar">↺ Reiniciar</button>' +
      '</div>' +
      '<p class="paso-indice">' + exc(c.titulo) + ' · recomendación</p>' +
      '<h2 class="pregunta">Te recomiendo esta</h2>' +

      '<div class="tarjeta-reco">' +
      '<div class="reco-top">' +
      '<span class="reco-logo" aria-hidden="true">' + exc(iniciales(top.e.marca)) + '</span>' +
      '<span class="reco-datos"><span class="reco-nombre">' + exc(top.e.nombre) + '</span>' +
      '<span class="reco-meta">' + exc(top.e.direccion + ' · ' + top.e.localidad + ' (' + top.e.prov + ')') + '</span></span>' +
      '</div>' +
      '<div class="reco-precio ' + claseTexto(top.p) + '">' + num3(top.p) +
      '<small>€/L ' + exc(a.fuel) + '</small></div>' +
      (desc > 0 ? '<span class="reco-descuento">Descuento ' + exc(top.e.marca) + ' · precio del surtidor ' + eur(sinDesc) + '</span>' : '') +
      '<div class="reco-mini">' + sparkline(top.e.id, a.fuel, 14) +
      '<div class="reco-mini-pie"><span>' + exc('14 días · ' + a.fuel) + '</span>' +
      '<span>tendencia ' + pct(t) + '</span></div></div>' +
      '<p class="reco-meta">' + motivos.motivo + '</p>' +
      '<div class="reco-etiquetas">' + etiquetas + '</div>' +
      '<div class="comparativa">' +
      '<div class="comp-tarjeta"><span class="t">Precio con descuento</span><span class="v ' + claseTexto(top.p) + '">' + num3(top.p) + '</span><span class="s">€/L · surtidor ' + num3(sinDesc) + '</span></div>' +
      '<div class="comp-tarjeta"><span class="t">Distancia</span><span class="v">' + km(top.d) + '</span><span class="s">' + minutos(top.d) + ' min en coche</span></div>' +
      '<div class="comp-tarjeta"><span class="t">Frente a la media</span><span class="v ' + (ahorro != null && ahorro > 0 ? 'precio-verde' : '') + '">' +
      (ahorro == null ? '—' : (ahorro >= 0 ? '−' : '+') + num3(Math.abs(ahorro))) + '</span><span class="s">' + exc('media ' + num3(media) + ' €/L') + '</span></div>' +
      '</div>' +
      '<div class="reco-comp">' + motivos.filas + '</div>' +
      '<div class="reco-acciones">' +
      '<button class="btn btn-primario" type="button" data-estacion="' + exc(top.e.id) + '">Ver detalle</button>' +
      '<button class="btn btn-secundario" type="button" data-accion="ver-mapa" data-estacion="' + exc(top.e.id) + '">Ver en el mapa</button>' +
      '</div>' +
      '</div>' +
      alternativas +
      '<div class="cta"><p class="cta-info">¿No te convence? Cambia una respuesta y vuelvo a calcularlo.</p>' +
      '<div class="cta-fila"><button class="btn btn-suave" type="button" data-accion="reiniciar">Empezar de nuevo</button></div></div>' +
      '</div></div>';
  }

  function motivosHTML(top, a, media) {
    var prov = F.provinciaNombre(a.prov);
    var cercanas = ranking(a.prov, a.fuel, 'barato');
    var masBarata = cercanas.length ? cercanas[0] : null;
    var motivo, filas = [];
    if (a.prioridad === 'barato') {
      motivo = 'La más barata de <b>' + exc(prov) + '</b> a menos de ' + a.radio + ' km: <b>' + eur(top.p) + '/L</b> con descuento.';
      filas.push(fila('💰', 'Es la opción más económica que vende <b>' + exc(a.fuel) + '</b> en un radio de ' + a.radio + ' km.'));
    } else if (a.prioridad === 'cerca') {
      var dif = masBarata && masBarata.p != null ? top.p - masBarata.p : 0;
      motivo = 'La más cercana a tu ubicación: <b>' + km(top.d) + '</b>' + (dif > 0.0005 ? ' y solo ' + eur(dif) + '/L por encima de la más barata.' : ' y además es la más barata de la zona.');
      filas.push(fila('📍', 'Está a <b>' + km(top.d) + '</b>, unos ' + minutos(top.d) + ' minutos en coche.'));
      if (masBarata) filas.push(fila('💰', 'La más barata de la provincia (<b>' + exc(masBarata.e.marca) + '</b>, ' + eur(masBarata.p) + '/L) está a ' + km(masBarata.d) + '.'));
    } else {
      motivo = 'La mejor valorada de <b>' + exc(prov) + '</b>: <b>' + String(top.v).replace('.', ',') + ' ★</b> a ' + eur(top.p) + '/L.';
      filas.push(fila('⭐', 'Nota media de <b>' + String(top.v).replace('.', ',') + ' ★</b> entre los usuarios de la zona.'));
      if (masBarata) filas.push(fila('💰', 'La más barata cuesta ' + eur(masBarata.p) + '/L, ' + eur(Math.abs(masBarata.p - top.p)) + '/L ' + (masBarata.p < top.p ? 'menos' : 'más') + '.'));
    }
    filas.push(fila('🏷️', (F.descuentos[top.e.marca] ? 'Descuento de <b>' + eur2(F.descuentos[top.e.marca]) + ' €/L</b> ya aplicado.' : 'Esta marca no tiene descuento activo en tu configuración.')));
    filas.push(fila('🕒', 'Horario: <b>' + exc(top.e.horario) + '</b>' + (media != null ? ' · media provincial ' + eur(media) + '/L.' : '.')));
    return { motivo: motivo, filas: filas.join('') };
  }
  function fila(ico, texto) {
    return '<div class="comp-fila"><span class="comp-ico" aria-hidden="true">' + ico + '</span>' +
      '<span class="comp-txt">' + texto + '</span></div>';
  }

  /* --- Resultado del camino «Ahorrar en mi ruta» --- */
  function rutaHTML(paradas) {
    var a = estado.asistente;
    if (!paradas.length) {
      return '<div class="paso"><div class="asistente-caja"><h2 class="pregunta">Sin paradas</h2>' +
        '<p class="ayuda">No hay estaciones con ' + exc(a.fuel) + ' en esa zona.</p>' +
        '<div class="cta"><button class="btn btn-primario" type="button" data-accion="reiniciar">Empezar de nuevo</button></div></div></div>';
    }
    var media = F.mediaProvincia(a.prov, a.fuel);
    var mejor = paradas[0];
    var ahorro = media != null ? media - mejor.p : 0;
    return '<div class="paso"><div class="asistente-caja">' +
      '<div class="paso-cabecera">' +
      '<button class="btn-atras" type="button" data-accion="atras">‹ Cambiar respuesta</button>' +
      '<button class="btn-reiniciar" type="button" data-accion="reiniciar">↺ Reiniciar</button>' +
      '</div>' +
      '<p class="paso-indice">Ahorrar en mi ruta · 3 paradas</p>' +
      '<h2 class="pregunta">Tu ruta más barata</h2>' +
      '<p class="ayuda">Ordenadas de mejor a peor para ' + exc(a.fuel) + ' en ' + exc(F.provinciaNombre(a.prov)) + '. Pulsa una parada para ver el detalle.</p>' +
      '<div class="resumen-ruta">Ahorras ' + eur(Math.abs(ahorro)) + '/L frente a la media provincial' +
      '<span>' + exc('media ' + num3(media) + ' €/L · ' + km(mejor.e.dist) + ' hasta la primera parada') + '</span></div>' +
      paradas.map(function (c, i) {
        return '<div class="parada">' +
          '<span class="parada-num" aria-hidden="true">' + (i + 1) + '</span>' +
          '<div class="parada-cuerpo">' +
          '<span class="parada-titulo">' + exc(c.e.marca + ' · ' + c.e.nombre) + '</span>' +
          '<span class="parada-meta">' + exc(c.e.localidad + ' · ' + c.e.direccion) + '</span>' +
          '<div class="parada-metricas">' +
          '<span class="metrica' + (c.p < (media || 99) ? ' ok' : '') + '">' + num3(c.p) + ' €/L</span>' +
          '<span class="metrica">' + km(c.d) + '</span>' +
          '<span class="metrica">' + minutos(c.d) + ' min</span>' +
          '<span class="metrica aviso">' + exc(c.e.horario) + '</span>' +
          '</div>' +
          '<div class="chips-fila">' +
          '<button class="chip" type="button" data-estacion="' + exc(c.e.id) + '">Ver detalle</button>' +
          '<button class="chip" type="button" data-accion="ruta" data-estacion="' + exc(c.e.id) + '">Cómo llegar</button>' +
          '</div>' +
          '</div>' +
          '<span class="parada-precio ' + claseTexto(c.p) + '">' + num3(c.p) + '</span>' +
          '</div>';
      }).join('') +
      '<div class="cta"><button class="btn btn-primario" type="button" data-accion="ver-mapa" data-estacion="' + exc(mejor.e.id) + '">Ver la ruta en el mapa</button>' +
      '<p class="cta-info">Las paradas se calculan con el precio con descuento de cada marca.</p></div>' +
      '</div></div>';
  }

  /* --- Resultado del camino «Vigilar una estación» --- */
  function resultadoVigilar() {
    var a = estado.asistente;
    var e = F.estaciones.filter(function (x) { return x.id === a.estacion; })[0];
    if (!e) {
      return '<div class="paso"><div class="asistente-caja"><h2 class="pregunta">Elige una estación</h2>' +
        '<p class="ayuda">Vuelve atrás y selecciona la estación que quieres vigilar.</p>' +
        '<div class="cta"><button class="btn btn-primario" type="button" data-accion="atras">Elegir estación</button></div></div></div>';
    }
    var p = precio(e, a.fuel);
    var t = tendencia(e.id, a.fuel, 14);
    var vigilada = !!estado.cfg.vigiladas[e.id];
    return '<div class="paso"><div class="asistente-caja">' +
      '<div class="paso-cabecera">' +
      '<button class="btn-atras" type="button" data-accion="atras">‹ Cambiar estación</button>' +
      '<button class="btn-reiniciar" type="button" data-accion="reiniciar">↺ Reiniciar</button>' +
      '</div>' +
      '<p class="paso-indice">Vigilar una estación · confirmación</p>' +
      '<h2 class="pregunta">Vigilando «' + exc(e.marca) + '»</h2>' +
      '<p class="ayuda">Te avisaré cuando el precio baje. Así se vería la notificación en tu móvil:</p>' +

      '<div class="notif-preview">' +
      '<p class="notif-aviso">Vista previa de la notificación</p>' +
      '<div class="notif-caja">' +
      '<div class="notif-cab"><span class="notif-punto" aria-hidden="true">A</span>' +
      '<span class="notif-app">Asistente de repostaje</span>' +
      '<span class="notif-hora">ahora</span></div>' +
      '<p class="notif-titulo">' + exc(e.marca + ' ha bajado de precio') + '</p>' +
      '<p class="notif-texto">' + exc('Ahora ' + num3(p) + ' €/L (' + pct(t) + ' en 14 días). Está a ' + km(e.dist) + ' de ti.') + '</p>' +
      '</div>' +
      '<div class="notif-pie">' +
      '<button class="btn btn-primario" type="button" data-accion="vigilar">' + (vigilada ? '✓ Vigilando' : 'Vigilar esta estación') + '</button>' +
      '<button class="btn btn-secundario" type="button" data-estacion="' + exc(e.id) + '">Ver detalle</button>' +
      '</div>' +
      '</div>' +

      '<div class="tarjeta-reco">' +
      '<div class="reco-top">' +
      '<span class="reco-logo" aria-hidden="true">' + exc(iniciales(e.marca)) + '</span>' +
      '<span class="reco-datos"><span class="reco-nombre">' + exc(e.nombre) + '</span>' +
      '<span class="reco-meta">' + exc(e.direccion + ' · ' + e.localidad) + '</span></span>' +
      '</div>' +
      '<div class="reco-precio ' + claseTexto(p) + '">' + num3(p) + '<small>€/L ' + exc(a.fuel) + '</small></div>' +
      '<div class="reco-mini">' + sparkline(e.id, a.fuel, 14) +
      '<div class="reco-mini-pie"><span>14 días · precio actual</span><span>tendencia ' + pct(t) + '</span></div></div>' +
      '<div class="reco-etiquetas">' +
      '<span class="etiqueta ' + (t <= 0 ? 'ok' : 'aviso') + '">' + (t <= 0 ? 'Bajando ' + pct(t) : 'Subiendo ' + pct(t)) + '</span>' +
      '<span class="etiqueta">' + exc(e.horario) + '</span>' +
      (esFav(e.id) ? '<span class="etiqueta info">Favorita</span>' : '') +
      '</div>' +
      '</div>' +

      '<div class="tarjeta-reco">' +
      '<p class="bloque-titulo">Ajustes del aviso</p>' +
      '<details class="tarjeta-config" open><summary><span class="ic" aria-hidden="true">🔔</span>Cuándo quiero que me avise<span class="chev" aria-hidden="true">›</span></summary>' +
      '<div class="cuerpo">' +
      '<label><input type="checkbox" data-cfg-chk="push"' + (estado.cfg.push ? ' checked' : '') + '> Avisar cuando baje el precio</label>' +
      '<label><input type="checkbox" data-cfg-chk="pushSubida"' + (estado.cfg.pushSubida ? ' checked' : '') + '> Avisar también cuando suba</label>' +
      '<div class="fila-input"><span>Bajada mínima</span><input type="number" min="0" max="0.2" step="0.005" value="' + estado.cfg.diasFall / 60 + '" data-cfg="bajadaMin" aria-label="Bajada mínima en euros por litro"></div>' +
      '<div class="fila-input"><span>Comprobar cada</span><input type="number" min="1" max="24" value="' + estado.cfg.intervalo + '" data-cfg="intervalo" aria-label="Intervalo de comprobación en horas"><span>h</span></div>' +
      '</div></details>' +
      '</div>' +

      '<div class="cta"><p class="cta-info">Las comprobaciones se hacen en segundo plano cada ' + estado.cfg.intervalo + ' h.</p>' +
      '<button class="btn btn-suave" type="button" data-accion="reiniciar">Vigilar otra estación</button></div>' +
      '</div></div>';
  }
  /* =======================================================================
   * 7. Vista Mapa · fondo fake + marcadores-precio + ruta
   * ===================================================================== */
  function pintarFondo() {
    var cont = $('#mapaFondo');
    if (!cont || cont.dataset.pintado) return;
    cont.dataset.pintado = '1';
    var m = F.mapa;
    var svg = '<svg viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">';
    svg += '<rect width="100" height="100" fill="#dfe3f2"/>';
    m.manchas.forEach(function (b) {
      svg += '<rect x="' + b.x + '" y="' + b.y + '" width="' + b.w + '" height="' + b.h + '" rx="2.4" fill="#e9ecf8"/>';
    });
    svg += '<path d="' + m.agua.d + '" fill="#c6d3ee"/>';
    m.viales.forEach(function (v) {
      svg += '<path d="' + v.d + '" fill="none" stroke="#ffffff" stroke-width="' + (v.w * 2.4) + '" stroke-linecap="round"/>';
      svg += '<path d="' + v.d + '" fill="none" stroke="#d3d8ec" stroke-width="' + v.w + '" stroke-linecap="round"/>';
    });
    svg += '<circle cx="' + m.tuPosicion.mx + '" cy="' + m.tuPosicion.my + '" r="1.6" fill="#4f46e5" opacity=".22"/>';
    svg += '</svg>';
    cont.innerHTML = svg;
  }

  function posMarcador(mx, my) {
    var x = 50 + (mx - 50) * estado.zoom + estado.panX;
    var y = 50 + (my - 50) * estado.zoom + estado.panY;
    return { left: Math.max(3, Math.min(97, x)) + '%', top: Math.max(5, Math.min(95, y)) + '%' };
  }

  /** Estaciones del mapa: las de la provincia activa que venden el combustible. */
  function estacionesMapa() {
    return F.estacionesDe(estado.prov).filter(function (e) {
      return F.precioDe(e, estado.fuel) != null;
    }).sort(function (a, b) { return precio(a, estado.fuel) - precio(b, estado.fuel); });
  }

  function pintarMapa() {
    pintarFondo();
    var lista = estacionesMapa();
    var capa = $('#mapaMarcadores');
    if (!capa) return;
    var yo = posMarcador(F.mapa.tuPosicion.mx, F.mapa.tuPosicion.my);
    var principal = estado.seleccion && lista.some(function (e) { return e.id === estado.seleccion; })
      ? estado.seleccion
      : (lista.length ? lista[0].id : null);

    var html = '<div class="marcador-yo" style="left:' + yo.left + ';top:' + yo.top + '" title="Tu ubicación"></div>';
    lista.slice(0, 40).forEach(function (e) {
      var p = precio(e, estado.fuel);
      var pos = posMarcador(e.mx, e.my);
      html += '<button class="marcador' + (e.id === principal ? ' principal' : '') + '" type="button" ' +
        'data-marcador="' + exc(e.id) + '" style="left:' + pos.left + ';top:' + pos.top + ';--c:' + colorDe(p) + '" ' +
        'aria-label="' + exc(e.marca + ' ' + e.nombre + ', ' + num3(p) + ' euros por litro') + '">' +
        num3(p) + '</button>';
    });
    capa.innerHTML = html;

    pintarRuta(principal);
    pintarLeyenda();
    pintarResumenMapa(lista, principal);

    if ($('#mapaFondo')) {
      $('#mapaFondo').style.transform = 'scale(' + (0.62 + (estado.zoom - 1) * 0.5) + ') translate(' +
        (estado.panX * 0.6) + '%, ' + (estado.panY * 0.6) + '%)';
    }
  }

  function pintarRuta(id) {
    var svg = $('#mapaRuta');
    if (!svg) return;
    var e = id ? F.estaciones.filter(function (x) { return x.id === id; })[0] : null;
    if (!e) { svg.innerHTML = ''; return; }
    var x0 = F.mapa.tuPosicion.mx, y0 = F.mapa.tuPosicion.my;
    var x1 = e.mx, y1 = e.my;
    var cx = (x0 + x1) / 2 + (y1 - y0) * 0.2;
    var cy = (y0 + y1) / 2 - (x1 - x0) * 0.2;
    var d = 'M' + x0 + ',' + y0 + ' Q' + cx.toFixed(2) + ',' + cy.toFixed(2) + ' ' + x1 + ',' + y1;
    svg.innerHTML =
      '<path d="' + d + '" fill="none" stroke="#ffffff" stroke-width="5" stroke-linecap="round" vector-effect="non-scaling-stroke"/>' +
      '<path d="' + d + '" fill="none" stroke="#4f46e5" stroke-width="2.6" stroke-dasharray="7 5" stroke-linecap="round" vector-effect="non-scaling-stroke"/>' +
      '<circle cx="' + x0 + '" cy="' + y0 + '" r="1.1" fill="#4f46e5"/>' +
      '<circle cx="' + x1 + '" cy="' + y1 + '" r="1.1" fill="#0b5f34"/>';
  }

  function pintarLeyenda() {
    var caja = $('#mapaLeyenda');
    if (!caja) return;
    var items = [
      { c: COLOR.verde, t: '‹ 1,50 €' },
      { c: COLOR.ambar, t: '1,50 – 1,70 €' },
      { c: COLOR.rojo, t: '› 1,70 €' }
    ];
    caja.innerHTML = '<span>Precio/L</span>' + items.map(function (i) {
      return '<span><i style="background:' + i.c + '"></i>' + exc(i.t) + '</span>';
    }).join('');
  }

  function pintarResumenMapa(lista, principal) {
    var resumen = $('#mapaResumen');
    if (!resumen) return;
    var media = F.mediaProvincia(estado.prov, estado.fuel);
    var prov = F.provinciaNombre(estado.prov);
    var e = principal ? F.estaciones.filter(function (x) { return x.id === principal; })[0] : null;
    var parte = lista.length + (lista.length === 1 ? ' estación' : ' estaciones') + ' en ' + prov +
      ' · media ' + num3(media) + ' €/L';
    if (e) parte += ' · ruta hasta ' + e.marca + ' (' + km(e.dist) + ')';
    resumen.textContent = parte;
  }

  /** Arrastre del mapa con pointer events (móvil y ratón). */
  function activarArrastre() {
    var cont = $('#mapaPrincipal');
    if (!cont || cont.dataset.arrastre) return;
    cont.dataset.arrastre = '1';
    var activo = false, x0 = 0, y0 = 0, px = 0, py = 0;
    cont.addEventListener('pointerdown', function (ev) {
      if (ev.target.closest('.marcador, .mapa-hud, .mapa-zoom')) return;
      activo = true; x0 = ev.clientX; y0 = ev.clientY; px = estado.panX; py = estado.panY;
      cont.classList.add('arrastrando');
      if (cont.setPointerCapture) cont.setPointerCapture(ev.pointerId);
    });
    cont.addEventListener('pointermove', function (ev) {
      if (!activo) return;
      var r = cont.getBoundingClientRect();
      if (!r.width || !r.height) return;
      estado.panX = Math.max(-30, Math.min(30, px + (ev.clientX - x0) / r.width * 100));
      estado.panY = Math.max(-30, Math.min(30, py + (ev.clientY - y0) / r.height * 100));
      pintarMapa();
    });
    var soltar = function () { activo = false; cont.classList.remove('arrastrando'); };
    cont.addEventListener('pointerup', soltar);
    cont.addEventListener('pointercancel', soltar);
  }

  function zoom(factor) {
    estado.zoom = Math.max(1, Math.min(2.4, estado.zoom * factor));
    if ($('#mapaFondo')) $('#mapaFondo').style.transition = 'transform .25s';
    pintarMapa();
  }
  function centrarMapa() {
    estado.zoom = 1; estado.panX = 0; estado.panY = 0;
    pintarMapa();
    aviso('Mapa centrado en tu ubicación');
  }

  /* =======================================================================
   * 8. Vista Explorar · filtros + lista de estaciones
   * ===================================================================== */
  function listaExplorar() {
    var lista = F.estacionesDe(estado.prov).filter(function (e) {
      return estado.fuel ? e.precios[estado.fuel] != null : true;
    });
    if (estado.texto) {
      var q = norm(estado.texto);
      lista = lista.filter(function (e) {
        return norm([e.marca, e.nombre, e.localidad, e.direccion].join(' ')).indexOf(q) !== -1;
      });
    }
    var cp = function (e) { return precio(e, estado.fuel); };
    return lista.sort(function (a, b) {
      var r;
      if (estado.orden === 'dist') r = a.dist - b.dist;
      else if (estado.orden === 'marca') r = a.marca.localeCompare(b.marca, 'es');
      else r = (cp(a) == null ? Infinity : cp(a)) - (cp(b) == null ? Infinity : cp(b));
      if (!r) r = (cp(a) || 0) - (cp(b) || 0);
      return r;
    });
  }

  function pintarExplorar() {
    /* Selects (son estáticos en el HTML) */
    var sp = $('#filtroProv');
    if (sp && sp.options.length !== F.provincias.length) {
      sp.innerHTML = F.provincias.map(function (p) {
        return '<option value="' + p.id + '">' + exc(p.nombre) + '</option>';
      }).join('');
    }
    var sf = $('#filtroFuel');
    if (sf && sf.options.length !== F.combustiblesVisibles.length) {
      sf.innerHTML = F.combustiblesVisibles.map(function (f) {
        return '<option value="' + exc(f) + '">' + exc(f) + '</option>';
      }).join('');
    }
    if (sp) sp.value = estado.prov;
    if (sf) sf.value = estado.fuel;
    if ($('#filtroTexto') && $('#filtroTexto').value !== estado.texto) $('#filtroTexto').value = estado.texto;

    /* Segmentado de orden */
    $$('#vista-explorar .segmentado button').forEach(function (b) {
      var on = b.dataset.orden === estado.orden;
      b.classList.toggle('on', on);
      b.setAttribute('aria-pressed', on ? 'true' : 'false');
    });

    var lista = listaExplorar();
    var caja = $('#explorarLista');
    if (!caja) return;
    if (!lista.length) {
      caja.innerHTML = '<p class="lista-info"><b>0</b> estaciones en ' + exc(F.provinciaNombre(estado.prov)) + '</p>' +
        '<div class="vacio"><h3>Sin resultados</h3>' +
        '<p>Prueba con otro combustible, otra provincia o borra la búsqueda.</p>' +
        '<button class="btn btn-secundario" type="button" data-accion="limpiar-filtros">Limpiar filtros</button></div>';
      return;
    }
    var orden = estado.orden === 'dist' ? 'por distancia' : estado.orden === 'marca' ? 'por marca' : 'por precio';
    caja.innerHTML = '<p class="lista-info"><b>' + lista.length + '</b> ' +
      (lista.length === 1 ? 'estación' : 'estaciones') + ' con ' + exc(estado.fuel) + ' en ' + exc(F.provinciaNombre(estado.prov)) +
      ' · ordenadas ' + orden + '</p>' + lista.map(tarjetaHTML).join('');
  }

  function tarjetaHTML(e, i) {
    var p = precio(e, estado.fuel);
    var desc = F.descuentos[e.marca] || 0;
    var barata = i === 0;
    var etqs = '';
    if (barata) etqs += '<span class="etiqueta ok">★ Más barata</span>';
    if (esFav(e.id)) etqs += '<span class="etiqueta info">Favorita</span>';
    if (desc > 0) etqs += '<span class="etiqueta aviso">−' + eur2(desc) + ' € con descuento</span>';
    if (e.horario === '24 h') etqs += '<span class="etiqueta">Abierta 24 h</span>';
    etqs += '<span class="etiqueta">' + etiquetaEscala(p) + '</span>';
    return '<div class="tarjeta' + (barata ? ' barata' : '') + (esFav(e.id) ? ' fav' : '') + '" role="button" tabindex="0" ' +
      'data-estacion="' + exc(e.id) + '" aria-label="' + exc('Abrir detalle de ' + e.marca + ' ' + e.nombre + ', ' + num3(p) + ' euros por litro') + '">' +
      '<span class="tarjeta-top">' +
      '<span class="tarjeta-logo" aria-hidden="true">' + exc(iniciales(e.marca)) + '</span>' +
      '<span class="tarjeta-nombre">' + exc(e.marca + ' · ' + e.nombre) + '</span>' +
      '</span>' +
      '<span class="tarjeta-precio ' + claseTexto(p) + '">' + num3(p) +
      '<small>' + exc('€/L · ' + estado.fuel) + '</small></span>' +
      '<span class="tarjeta-meta">' + exc(e.localidad) + ' · ' + km(e.dist) + ' · ' + exc(e.direccion) + '</span>' +
      '<span class="tarjeta-etqs">' + etqs +
      '<button class="estrella' + (esFav(e.id) ? ' on' : '') + '" type="button" data-fav="' + exc(e.id) + '" ' +
      'aria-label="' + (esFav(e.id) ? 'Quitar de favoritas' : 'Añadir a favoritas') + '">' + (esFav(e.id) ? '★' : '☆') + '</button>' +
      '</span>' +
      '</div>';
  }
  /* =======================================================================
   * 9. Detalle de estación (superpuesto) con histórico en canvas
   * ===================================================================== */
  var detalleId = null;
  var DIAS = [7, 14, 21, 30, 60, 90];

  function abrirDetalle(id) {
    var e = F.estaciones.filter(function (x) { return x.id === id; })[0];
    if (!e) return;
    detalleId = id;
    estado.seleccion = id;
    var p = precio(e, estado.fuel);
    var cantidades = Object.keys(e.precios).filter(function (k) { return e.precios[k] != null; });

    $('#detMarca').textContent = e.marca;
    $('#detTitulo').textContent = e.nombre;
    $('#detPrecio').innerHTML = '<span class="' + claseTexto(p) + '">' + eur(p) + '</span>' +
      '<small>' + exc('/L · ' + estado.fuel + (F.descuentos[e.marca] ? ' (con descuento)' : '')) + '</small>';
    $('#detMeta').textContent = e.direccion + ' · ' + e.localidad + ' (' + F.provinciaNombre(e.prov) + ') · ' +
      km(e.dist) + ' · ' + e.horario;
    var fav = $('#detFav');
    fav.className = 'btn-accion' + (esFav(e.id) ? ' on' : '');
    fav.textContent = esFav(e.id) ? '★ Favorita' : '☆ Favorita';

    if (cantidades.indexOf(estado.histFuel) === -1) estado.histFuel = cantidades.indexOf(estado.fuel) !== -1 ? estado.fuel : cantidades[0];
    $('#detalle').hidden = false;

    $('#detCuerpo').innerHTML =
      '<div class="bloque"><p class="bloque-titulo">Precios por combustible</p>' +
      '<div class="lista-combustibles">' + listaCombustibles(e) + '</div></div>' +

      '<div class="bloque"><p class="bloque-titulo">Histórico de precios</p>' +
      '<div class="hist-controles">' +
      '<select id="histFuel" aria-label="Combustible del histórico">' + cantidades.map(function (k) {
        return '<option value="' + exc(k) + '"' + (k === estado.histFuel ? ' selected' : '') + '>' + exc(k) + '</option>';
      }).join('') + '</select>' +
      '<select id="histDias" aria-label="Días de histórico">' + DIAS.map(function (d) {
        return '<option value="' + d + '"' + (d === estado.histDias ? ' selected' : '') + '>' + d + ' días</option>';
      }).join('') + '</select>' +
      '</div>' +
      '<div class="grafica-caja">' +
      '<canvas id="histCanvas" aria-label="Evolución del precio"></canvas>' +
      '<div class="grafica-tooltip" id="histTooltip" hidden></div>' +
      '</div>' +
      '<dl class="hist-resumen" id="histResumen"></dl>' +
      '</div>';

    dibujarGrafica();
  }

  function listaCombustibles(e) {
    var claves = Object.keys(e.precios).filter(function (k) { return e.precios[k] != null; });
    var desc = F.descuentos[e.marca] || 0;
    var mejor = claves.slice().sort(function (a, b) {
      return precio(e, a) - precio(e, b);
    })[0];
    return claves.map(function (k) {
      var p = precio(e, k);
      return '<div class="combustible' + (k === mejor ? ' mejor' : '') + '">' +
        '<span class="nombre">' + exc(k) +
        '<small>' + (desc > 0
          ? exc('Ministerio ' + eur(e.precios[k]) + ' · −' + eur2(desc) + ' € de descuento')
          : exc('Precio en el surtidor')) +
        (k === mejor ? exc(' · el más barato que vende') : '') + '</small></span>' +
        '<span class="importe ' + claseTexto(p) + '">' + eur(p) + '</span></div>';
    }).join('');
  }

  function cerrarDetalle() {
    $('#detalle').hidden = true;
    detalleId = null;
    ocultarTooltip();
  }

  function dibujarGrafica() {
    var cv = $('#histCanvas');
    if (!cv || !detalleId) return;
    var serie = F.historico(detalleId, estado.histFuel, estado.histDias);
    if (serie.length < 2) return;
    var caja = cv.parentElement;
    var W = Math.max(220, Math.round(caja.clientWidth || 300));
    var H = 190;
    var dpr = Math.min(window.devicePixelRatio || 1, 2);
    cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr);
    cv.style.width = W + 'px'; cv.style.height = H + 'px';
    var ctx = cv.getContext('2d');
    if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, W, H);

    var ps = serie.map(function (s) { return s.precio; });
    var min = Math.min.apply(null, ps), max = Math.max.apply(null, ps);
    var media = ps.reduce(function (a, b) { return a + b; }, 0) / ps.length;
    var pad = Math.max(0.004, (max - min) * 0.25);
    var inf = min - pad, sup = max + pad;
    var P = { izq: 52, der: 12, arr: 14, aba: 26 };
    var ancho = W - P.izq - P.der, alto = H - P.arr - P.aba;
    var x = function (i) { return P.izq + i / (serie.length - 1) * ancho; };
    var y = function (v) { return P.arr + (1 - (v - inf) / (sup - inf)) * alto; };

    ctx.font = '11px ui-monospace, monospace';
    ctx.textAlign = 'right'; ctx.textBaseline = 'middle';
    for (var g = 0; g <= 4; g++) {
      var v = inf + (sup - inf) * g / 4;
      var yy = y(v);
      ctx.strokeStyle = g === 0 ? '#d6daee' : '#eceefa';
      ctx.beginPath(); ctx.moveTo(P.izq, yy); ctx.lineTo(W - P.der, yy); ctx.stroke();
      ctx.fillStyle = '#66668a';
      ctx.fillText(num3(v), P.izq - 7, yy);
    }
    ctx.setLineDash([4, 4]); ctx.strokeStyle = '#a9aede';
    ctx.beginPath(); ctx.moveTo(P.izq, y(media)); ctx.lineTo(W - P.der, y(media)); ctx.stroke();
    ctx.setLineDash([]);

    var grad = ctx.createLinearGradient(0, P.arr, 0, P.arr + alto);
    grad.addColorStop(0, 'rgba(79,70,229,.22)');
    grad.addColorStop(1, 'rgba(79,70,229,0)');
    ctx.beginPath();
    serie.forEach(function (s, i) { if (i) ctx.lineTo(x(i), y(s.precio)); else ctx.moveTo(x(i), y(s.precio)); });
    ctx.lineTo(x(serie.length - 1), P.arr + alto); ctx.lineTo(x(0), P.arr + alto); ctx.closePath();
    ctx.fillStyle = grad; ctx.fill();

    ctx.beginPath();
    serie.forEach(function (s, i) { if (i) ctx.lineTo(x(i), y(s.precio)); else ctx.moveTo(x(i), y(s.precio)); });
    ctx.strokeStyle = '#4f46e5'; ctx.lineWidth = 2.2; ctx.lineJoin = 'round'; ctx.stroke();

    var pts = [];
    serie.forEach(function (s, i) {
      var px = x(i), py = y(s.precio);
      pts.push({ x: px, y: py, fecha: s.fecha, precio: s.precio });
      if (serie.length <= 32) {
        ctx.beginPath(); ctx.arc(px, py, 2.4, 0, Math.PI * 2);
        ctx.fillStyle = '#fff'; ctx.fill();
        ctx.strokeStyle = '#4f46e5'; ctx.lineWidth = 1.6; ctx.stroke();
      }
    });
    cv._pts = pts;

    var iMin = ps.indexOf(min), iMax = ps.indexOf(max);
    ctx.font = '11px system-ui, sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
    ctx.fillStyle = '#0b5f34';
    ctx.fillText(eur(min), Math.max(P.izq + 22, Math.min(W - P.der - 22, x(iMin))), y(min) - 9);
    ctx.fillStyle = '#a51f14';
    ctx.fillText(eur(max), Math.max(P.izq + 22, Math.min(W - P.der - 22, x(iMax))), y(max) + 16);

    ctx.fillStyle = '#66668a'; ctx.textBaseline = 'top';
    var paso = Math.max(1, Math.round((serie.length - 1) / 4));
    serie.forEach(function (s, i) {
      if (i % paso === 0 || i === serie.length - 1) {
        ctx.fillText(s.fecha.slice(0, 5), Math.max(P.izq + 18, Math.min(W - P.der - 18, x(i))), P.arr + alto + 8);
      }
    });

    var act = ps[ps.length - 1], prim = ps[0];
    var var_ = prim ? (act - prim) / prim * 100 : 0;
    $('#histResumen').innerHTML =
      celda('Mínimo', eur(min), 'precio-verde') +
      celda('Máximo', eur(max), 'precio-rojo') +
      celda('Media', eur(media), '') +
      celda('Actual', eur(act), claseTexto(act)) +
      celda('Tendencia', pct(var_), var_ <= 0 ? 'precio-verde' : 'precio-rojo') +
      celda('Días', String(serie.length), '');
  }
  function celda(t, v, clase) {
    return '<div><dt>' + exc(t) + '</dt><dd class="' + clase + '">' + exc(v) + '</dd></div>';
  }

  function tooltipGrafica(ev) {
    var cv = $('#histCanvas');
    var tt = $('#histTooltip');
    if (!cv || !tt || !cv._pts) return;
    var r = cv.getBoundingClientRect();
    var mx = ev.clientX - r.left;
    var mejor = null;
    cv._pts.forEach(function (p) {
      var d = Math.abs(p.x - mx);
      if (!mejor || d < mejor.d) mejor = { d: d, p: p };
    });
    if (!mejor || mejor.d > 30) { ocultarTooltip(); return; }
    tt.hidden = false;
    tt.style.left = mejor.p.x + 'px';
    tt.style.top = mejor.p.y + 'px';
    tt.innerHTML = '<b style="font-family:ui-monospace,monospace">' + exc(eur(mejor.p.precio)) + '</b><br>' + exc(mejor.p.fecha);
  }
  function ocultarTooltip() {
    var tt = $('#histTooltip');
    if (tt) tt.hidden = true;
  }

  /* =======================================================================
   * 10. Vista IA · chat con markdown
   * ===================================================================== */
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
    'chrome-nano': ['IA integrada en Chrome']
  };
  function modeloDe(p) { return estado.ia.modelos[p] || (MODELOS[p] || [])[0] || 'integrado'; }
  function proveedoresVisibles() {
    return PROVEEDORES.filter(function (p) { return p.id === 'general' || estado.cfg.iaVisibles[p.id]; });
  }

  function mensajesDe(p) {
    if (!estado.ia.mensajes[p]) {
      estado.ia.mensajes[p] = (F.chatsIA[p] || []).map(function (m, i) {
        return {
          rol: m.role === 'user' ? 'usuario' : 'ia',
          texto: m.content,
          modelo: modeloDe(p),
          ms: m.role === 'user' ? null : (0.8 + (i % 4) * 0.3)
        };
      });
    }
    return estado.ia.mensajes[p];
  }

  function pintarIA() {
    var visibles = proveedoresVisibles();
    if (estado.ia.prov !== 'general' && !estado.cfg.iaVisibles[estado.ia.prov]) estado.ia.prov = 'general';
    var prov = estado.ia.prov;
    $('#iaPills').innerHTML = visibles.map(function (p) {
      return '<button class="ia-pill' + (p.id === prov ? ' activo' : '') + '" type="button" role="tab" ' +
        'data-iaprov="' + p.id + '" aria-selected="' + (p.id === prov ? 'true' : 'false') + '">' + exc(p.nombre) + '</button>';
    }).join('');

    var listos = visibles.length - 1;
    $('#iaCabecera').innerHTML = prov === 'general'
      ? '<span>La misma pregunta a los ' + listos + ' proveedores visibles, en paralelo.</span>' +
        '<span class="ia-estado ok">✅ ' + listos + '/' + listos + ' listos</span>'
      : '<label>Modelo' + '<select id="iaModelo" aria-label="Modelo de IA">' +
        (MODELOS[prov] || ['integrado']).map(function (m) {
          return '<option' + (m === modeloDe(prov) ? ' selected' : '') + '>' + exc(m) + '</option>';
        }).join('') + '</select></label>' +
        '<span class="ia-estado ' + (prov === 'chrome-nano' ? 'no' : 'ok') + '">' +
        exc(prov === 'chrome-nano' ? 'IA integrada en el navegador' : '✅ API Key cargada') + '</span>';

    pintarMensajesIA();
  }

  function pintarMensajesIA() {
    var caja = $('#iaMensajes');
    var lista = mensajesDe(estado.ia.prov);
    if (!lista.length) {
      caja.innerHTML = '<div class="burbuja ia"><p>Pregúntame por precios, tendencias o por una estación concreta.</p></div>';
      return;
    }
    caja.innerHTML = lista.map(function (m) {
      if (m.rol === 'cargando') {
        return '<div class="burbuja cargando">Pensando…</div>';
      }
      if (m.rol === 'usuario') {
        return '<div class="burbuja usuario">' + markdownIA(m.texto) + '</div>';
      }
      return '<div class="burbuja ia">' + markdownIA(m.texto) +
        (m.ms ? '<div class="meta">⏱ ' + exc(m.modelo || 'modelo') + ' · ' + String(m.ms).replace('.', ',') + ' s</div>' : '') +
        '</div>';
    }).join('');
    caja.scrollTop = caja.scrollHeight;
  }

  /** Markdown mínimo (títulos, negrita, listas, tablas, código y enlaces). */
  function markdownIA(texto) {
    var lineas = exc(texto).split('\n');
    var salida = [], enLista = null, enTabla = false, enCodigo = false, filas = 0;
    var fmt = function (s) {
      return s
        .replace(/`([^`]+)`/g, '<code>$1</code>')
        .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
        .replace(/(^|[\s(])\*([^*\n]+)\*(?=[\s.,;:)]|$)/g, '$1<em>$2</em>')
        .replace(/\[([^\]]+)\]\((https?:[^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>');
    };
    var cerrar = function () { if (enLista) { salida.push('</' + enLista + '>'); enLista = null; } };
    lineas.forEach(function (l) {
      if (l.trim().indexOf('```') === 0) {
        cerrar();
        salida.push(enCodigo ? '</code></pre>' : '<pre><code>');
        enCodigo = !enCodigo; return;
      }
      if (enCodigo) { salida.push(l); return; }
      var t = l.trim();
      if (!t) { cerrar(); return; }
      var h = t.match(/^(#{1,4})\s+(.*)$/);
      if (h) { cerrar(); salida.push('<h4>' + fmt(h[2]) + '</h4>'); return; }
      if (/^(-{3,}|\*{3,})$/.test(t)) { cerrar(); salida.push('<hr>'); return; }
      if (t.indexOf('|') === 0 && t.lastIndexOf('|') > 0) {
        cerrar();
        if (/^\|[\s:|-]+\|$/.test(t)) return;
        var celdas = t.split('|').slice(1, -1).map(function (c) { return c.trim(); });
        if (!enTabla) { enTabla = true; filas = 0; salida.push('<table>'); }
        var cab = filas === 0; filas++;
        salida.push('<tr>' + celdas.map(function (c) {
          return (cab ? '<th>' : '<td>') + fmt(c) + (cab ? '</th>' : '</td>');
        }).join('') + '</tr>');
        return;
      }
      if (enTabla) { salida.push('</table>'); enTabla = false; }
      if (/^>\s?/.test(t)) { cerrar(); salida.push('<blockquote>' + fmt(t.replace(/^>\s?/, '')) + '</blockquote>'); return; }
      var ul = t.match(/^[-*]\s+(.*)$/), ol = t.match(/^\d+[.)]\s+(.*)$/);
      if (ul || ol) {
        var tipo = ul ? 'ul' : 'ol';
        if (enLista !== tipo) { cerrar(); salida.push('<' + tipo + '>'); enLista = tipo; }
        salida.push('<li>' + fmt((ul || ol)[1]) + '</li>'); return;
      }
      cerrar();
      salida.push('<p>' + fmt(t) + '</p>');
    });
    if (enTabla) salida.push('</table>');
    cerrar();
    if (enCodigo) salida.push('</code></pre>');
    return salida.join('');
  }

  function enviarIA(texto) {
    texto = String(texto || '').trim();
    if (!texto || estado.ia.enviando) return;
    var prov = estado.ia.prov;
    var lista = mensajesDe(prov);
    lista.push({ rol: 'usuario', texto: texto });
    lista.push({ rol: 'cargando' });
    estado.ia.enviando = true;
    pintarMensajesIA();
    setTimeout(function () {
      lista.pop();
      estado.ia.enviando = false;
      if (prov === 'general') {
        proveedoresVisibles().slice(1, 4).forEach(function (p) {
          lista.push({ rol: 'ia', modelo: modeloDe(p.id), ms: 1.1,
            texto: '### ' + p.nombre + '\n\n' + respuestaSimulada(p.id) });
        });
        if (lista[lista.length - 1].rol !== 'ia') lista.push({ rol: 'ia', modelo: 'integrado', ms: 1.0, texto: respuestaSimulada('general') });
      } else {
        lista.push({ rol: 'ia', modelo: modeloDe(prov), ms: 1.2, texto: respuestaSimulada(prov) });
      }
      pintarMensajesIA();
    }, 900);
  }

  /** Estilo de apertura distinto por proveedor, para que la pestaña General no parezca clonada. */
  var ESTILO_IA = {
    groq: 'Respuesta rápida, sin rodeos:',
    mistral: 'He mirado tu provincia y este es el resumen:',
    openrouter: 'Modelo enrutado automáticamente. Resultado:',
    llm7: 'Resumen del plan gratuito:',
    nvidia: 'Análisis con los precios en vivo:',
    google: 'Con el contexto de tu provincia cargado:',
    'chrome-nano': 'Calculado en tu propio dispositivo:',
    general: 'Comparativa de los proveedores activos:'
  };

  /** Respuesta simulada pero construida con los datos cargados ahora mismo. */
  function respuestaSimulada(provIa) {
    var fuel = estado.fuel;
    var prov = F.provinciaNombre(estado.prov);
    var barata = F.masBarata(estado.prov, fuel);
    var media = F.mediaProvincia(estado.prov, fuel);
    var favoritas = favsDe(estado.prov);
    var lineas = [];
    if (!barata) {
      lineas.push('No hay datos de **' + fuel + '** en ' + prov + '. Prueba con otro combustible y vuelvo a mirarlo.');
      return lineas.join('\n');
    }
    var p = precio(barata.e, fuel);
    var desc = F.descuentos[barata.e.marca] || 0;
    var t = tendencia(barata.e.id, fuel, 14);
    lineas.push('### ' + fuel + ' en ' + prov);
    lineas.push('');
    lineas.push('_' + (ESTILO_IA[provIa] || 'Aquí tienes lo que veo en los datos:') + '_');
    lineas.push('');
    lineas.push('La más barata es **' + barata.e.marca + ' · ' + barata.e.nombre + '** a **' + eur(p) + '/L**' +
      (desc > 0 ? ' (ya con el descuento de ' + eur2(desc) + ' € de la marca)' : '') + '.');
    lineas.push('');
    lineas.push('- Distancia: **' + km(barata.e.dist) + '** desde tu ubicación');
    lineas.push('- Media provincial: **' + eur(media) + '/L**');
    lineas.push('- Tendencia de 14 días: **' + pct(t) + '**');
    lineas.push('');
    var top = ranking(estado.prov, fuel, 'barato').slice(0, 3);
    lineas.push('| Estación | Precio | Distancia |');
    lineas.push('|---|---|---|');
    top.forEach(function (c) {
      lineas.push('| ' + c.e.marca + ' ' + c.e.localidad + ' | ' + num3(c.p) + ' € | ' + km(c.d) + ' |');
    });
    lineas.push('');
    lineas.push('Tienes **' + favoritas.length + '** ' + (favoritas.length === 1 ? 'favorita' : 'favoritas') +
      ' en ' + prov + ' y ' + F.estacionesDe(estado.prov).length + ' estaciones cargadas.');
    return lineas.join('\n');
  }
  /* =======================================================================
   * 11. Vista Config · acordeón de tarjetas
   * ===================================================================== */
  function pintarConfig() {
    var caja = $('#configLista');
    if (caja.children.length) {
      var ab = {};
      $$('#configLista .tarjeta-config').forEach(function (d) { if (d.open) ab[d.dataset.card] = true; });
      estado.cfg.abiertas = ab;
    }
    var c = estado.cfg;
    var abiertas = c.abiertas || { paginacion: true, cache: true };
    var ab = function (id) { return !!abiertas[id]; };
    var log = c.logTab === 'api' ? F.logApi : F.logPush;

    caja.innerHTML =
      tarjeta('paginacion', '📄', 'Paginación', ab('paginacion'),
        '<p>Cuántas estaciones se listan de golpe en la vista Explorar.</p>' +
        '<label>Resultados por página<select data-cfg="pagina" aria-label="Resultados por página">' +
        F.config.paginas.map(function (n) {
          return '<option value="' + n + '"' + (n === c.pagina ? ' selected' : '') + '>' + (n === 0 ? 'Todas' : n) + '</option>';
        }).join('') + '</select></label>') +

      tarjeta('cache', '🗃️', 'Caché de datos', ab('cache'),
        '<div class="mini-tabs"><button type="button" data-cachetab="indexeddb" class="' + (c.cacheTab === 'indexeddb' ? 'on' : '') + '">IndexedDB</button>' +
        '<button type="button" data-cachetab="localstorage" class="' + (c.cacheTab === 'localstorage' ? 'on' : '') + '">localStorage</button></div>' +
        (c.cacheTab === 'indexeddb'
          ? '<p><b>' + F.cacheInfo.provincias + ' provincias</b> · ' + F.cacheInfo.gasolineras.toLocaleString('es-ES') +
            ' gasolineras · ' + F.cacheInfo.historicoDias + ' días de histórico<br>' + exc(F.cacheInfo.idb) +
            ' · actualizado ' + exc(F.cacheInfo.ultimaActualizacion) + '</p>' +
            '<div class="fila-input"><span>Horas de caché</span><input type="number" min="0" max="72" value="' + c.ttl + '" data-cfg="ttl" aria-label="Horas de caché"></div>' +
            '<button class="btn btn-mini" type="button" data-accion="limpiar-cache">🗑️ Limpiar caché</button>'
          : '<p><b>' + F.cacheInfo.lsClaves + ' claves</b> con prefijo <b>gasolineras_</b> (estado, filtros por provincia, registros y chats de IA).</p>' +
            '<button class="btn btn-mini" type="button" data-accion="limpiar-cache">🗑️ Borrar claves</button>')) +

      tarjeta('push', '🔔', 'Notificaciones', ab('push'),
        '<label><input type="checkbox" data-cfg-chk="push"' + (c.push ? ' checked' : '') + '> Avisar cuando baje el precio</label>' +
        '<label><input type="checkbox" data-cfg-chk="pushSubida"' + (c.pushSubida ? ' checked' : '') + '> Avisar también cuando suba</label>' +
        '<div class="fila-input"><span>Comprobar cada</span><input type="number" min="1" max="24" value="' + c.intervalo + '" data-cfg="intervalo" aria-label="Horas entre comprobaciones"><span>h</span></div>' +
        '<div class="fila-input"><span>Ventana de caída</span><input type="number" min="2" max="90" value="' + c.diasFall + '" data-cfg="diasFall" aria-label="Días de ventana"><span>d</span></div>' +
        '<div class="mini-tabs"><button type="button" data-modo="average" class="' + (c.modo === 'average' ? 'on' : '') + '">Promedio</button>' +
        '<button type="button" data-modo="consecutive" class="' + (c.modo === 'consecutive' ? 'on' : '') + '">Días consecutivos</button></div>' +
        '<button class="btn btn-mini" type="button" data-accion="probar-push">Enviar notificación de prueba</button>') +

      tarjeta('ia', '💬', 'Inteligencia artificial', ab('ia'),
        '<p>Pestañas del chat que quieres ver. Siempre debe quedar al menos una.</p>' +
        '<div class="rejilla-2">' + PROVEEDORES_REALES.map(function (id) {
          var n = PROVEEDORES.filter(function (p) { return p.id === id; })[0];
          return '<label><input type="checkbox" data-ia-visible="' + id + '"' + (c.iaVisibles[id] ? ' checked' : '') + '> ' +
            exc(n ? n.nombre : id) + '</label>';
        }).join('') + '</div>' +
        '<label>Proveedor por defecto<select data-cfg="iaDefecto" aria-label="Proveedor por defecto">' +
        '<option value="general"' + (c.iaDefecto === 'general' ? ' selected' : '') + '>General (todos)</option>' +
        PROVEEDORES_REALES.map(function (id) {
          var n = PROVEEDORES.filter(function (p) { return p.id === id; })[0];
          return '<option value="' + id + '"' + (c.iaDefecto === id ? ' selected' : '') + '>' + exc(n ? n.nombre : id) + '</option>';
        }).join('') + '</select></label>') +

      tarjeta('log', '📝', 'Registro de actividad', ab('log'),
        '<div class="mini-tabs"><button type="button" data-logtab="api" class="' + (c.logTab === 'api' ? 'on' : '') + '">API</button>' +
        '<button type="button" data-logtab="push" class="' + (c.logTab === 'push' ? 'on' : '') + '">Push</button></div>' +
        '<div class="consola">' + log.map(function (l) {
          var ok = l.estado === 200 || l.estado === 'ok';
          return '<div><b>' + exc(l.t) + '</b> ' + exc(l.url) + ' <span class="' + (ok ? 'ok' : 'ko') + '">' +
            exc(l.estado + (l.ms != null ? ' · ' + l.ms + ' ms' : '')) + '</span></div>';
        }).join('') + '</div>' +
        '<button class="btn btn-mini" type="button" data-accion="limpiar-log">🗑️ Borrar registro</button>') +

      tarjeta('version', '🔄', 'Actualización de la app', ab('version'),
        '<p>Versión instalada <b>' + exc(F.versionApp.texto) + '</b><br>Compilación <b>' + exc(F.versionApp.build) + '</b></p>' +
        '<p>Esta maqueta no se actualiza: los datos son simulados.</p>' +
        '<button class="btn btn-mini" type="button" data-accion="buscar-actualizacion">Comprobar actualizaciones</button>');
  }

  function tarjeta(id, ico, titulo, abierta, cuerpo) {
    return '<details class="tarjeta-config" data-card="' + id + '"' + (abierta ? ' open' : '') + '>' +
      '<summary><span class="ic" aria-hidden="true">' + ico + '</span>' + exc(titulo) +
      '<span class="chev" aria-hidden="true">›</span></summary>' +
      '<div class="cuerpo">' + cuerpo + '</div></details>';
  }

  /* =======================================================================
   * 12. Aviso (toast) y utilidades de vista
   * ===================================================================== */
  function aviso(msg) {
    var a = $('#aviso');
    a.textContent = msg;
    a.hidden = false;
    a.classList.add('visible');
    clearTimeout(a._t);
    a._t = setTimeout(function () {
      a.classList.remove('visible');
      a._t = setTimeout(function () { a.hidden = true; }, 240);
    }, 2400);
  }
  function arriba() { var l = $('#lienzoAsistente'); if (l) l.scrollTop = 0; }

  /* =======================================================================
   * 13. Asistente: responder a los pasos
   * ===================================================================== */
  function iniciarCamino(id) {
    var a = estado.asistente;
    a.camino = id; a.paso = 0; a.fuel = null; a.prov = null; a.prioridad = null;
    a.cerca = false; a.estacion = null;
    pintarInicio();
    arriba();
  }
  function responderPaso(valor) {
    var a = estado.asistente, paso = pasoActual(), c = camino(a.camino);
    if (!c || !paso) return;
    if (paso === 'fuel') { a.fuel = valor; estado.fuel = valor; }
    else if (paso === 'prov') {
      if (valor === 'cerca') { a.cerca = true; a.prov = estado.prov; }
      else { a.cerca = false; a.prov = valor; estado.prov = valor; }
    } else if (paso === 'prioridad') { a.prioridad = valor; }
    else if (paso === 'estacion') { a.estacion = valor; }
    a.paso = Math.min(a.paso + 1, c.pasos.length);
    pintarInicio();
    pintarCabecera();
    arriba();
  }
  function atras() {
    var a = estado.asistente;
    if (!a.camino) return;
    if (a.paso === 0) { reiniciar(); return; }
    a.paso--;
    pintarInicio();
    arriba();
  }
  function reiniciar() {
    var a = estado.asistente;
    a.camino = null; a.paso = 0; a.fuel = null; a.prov = null; a.prioridad = null;
    a.cerca = false; a.estacion = null;
    pintarInicio();
    arriba();
  }

  /* =======================================================================
   * 14. Acciones de botones
   * ===================================================================== */
  function accion(el) {
    var a = el.dataset.accion;
    var id = el.dataset.estacion;
    if (a === 'atras') { atras(); return; }
    if (a === 'reiniciar') { reiniciar(); aviso('Asistente reiniciado'); return; }
    if (a === 'ver-mapa') {
      if (id) estado.seleccion = id;
      if (id) estado.prov = (F.estaciones.filter(function (x) { return x.id === id; })[0] || {}).prov || estado.prov;
      setVista('mapa');
      return;
    }
    if (a === 'ir-explorar') { setVista('explorar'); return; }
    if (a === 'ruta') { aviso('Abriendo la ruta hasta la estación en tu navegador…'); return; }
    if (a === 'vigilar') {
      if (!id) id = estado.asistente.estacion;
      if (!id) return;
      if (estado.cfg.vigiladas[id]) { delete estado.cfg.vigiladas[id]; aviso('Aviso desactivado para esta estación'); }
      else { estado.cfg.vigiladas[id] = true; aviso('🔔 Te avisaré cuando baje de precio'); }
      pintarInicio();
      return;
    }
    if (a === 'limpiar-filtros') {
      estado.texto = ''; estado.orden = 'precio';
      pintarExplorar(); aviso('Filtros de la lista restablecidos');
      return;
    }
    if (a === 'limpiar-cache') { aviso('Caché borrada (simulado en la maqueta)'); return; }
    if (a === 'limpiar-log') { aviso('Registro borrado (simulado en la maqueta)'); return; }
    if (a === 'probar-push') {
      var e = F.masBarata(estado.prov, estado.fuel);
      aviso(e ? '🔔 Prueba: ' + e.e.marca + ' está a ' + eur(precio(e.e, estado.fuel)) + '/L' : '🔔 Notificación de prueba enviada');
      return;
    }
    if (a === 'buscar-actualizacion') {
      el.disabled = true;
      el.textContent = 'Comprobando…';
      setTimeout(function () {
        el.disabled = false;
        el.textContent = 'Comprobar actualizaciones';
        aviso('Ya tienes la última versión (' + F.versionApp.texto + ')');
      }, 900);
      return;
    }
  }

  /* =======================================================================
   * 15. Eventos y arranque
   * ===================================================================== */
  function enganchar() {
    document.addEventListener('click', function (ev) {
      var nav = ev.target.closest('button[data-vista], a[data-vista]');
      if (nav) { setVista(nav.dataset.vista); return; }

      var zoomBtn = ev.target.closest('[data-zoom]');
      if (zoomBtn) {
        if (zoomBtn.dataset.zoom === 'mas') zoom(1.25);
        else if (zoomBtn.dataset.zoom === 'menos') zoom(1 / 1.25);
        else centrarMapa();
        return;
      }

      var caminoBtn = ev.target.closest('[data-camino]');
      if (caminoBtn) { iniciarCamino(caminoBtn.dataset.camino); return; }

      var op = ev.target.closest('[data-opcion-paso]');
      if (op) { responderPaso(op.dataset.opcionPaso); return; }

      var fav = ev.target.closest('[data-fav]');
      if (fav) {
        var fid = fav.dataset.fav;
        if (estado.favoritos[fid]) delete estado.favoritos[fid]; else estado.favoritos[fid] = true;
        aviso(esFav(fid) ? '★ Añadida a favoritas' : 'Quitada de favoritas');
        pintarCabecera();
        if (estado.vista === 'explorar') pintarExplorar();
        if (estado.vista === 'inicio') pintarInicio();
        if (!$('#detalle').hidden) abrirDetalle(fid);
        return;
      }

      var est = ev.target.closest('[data-estacion]');
      if (est) { abrirDetalle(est.dataset.estacion); return; }

      var marc = ev.target.closest('[data-marcador]');
      if (marc) { abrirDetalle(marc.dataset.marcador); return; }

      var pill = ev.target.closest('[data-iaprov]');
      if (pill) { estado.ia.prov = pill.dataset.iaprov; pintarIA(); return; }

      var orden = ev.target.closest('[data-orden]');
      if (orden) { estado.orden = orden.dataset.orden; pintarExplorar(); return; }

      if (ev.target.closest('[data-cachetab]')) { estado.cfg.cacheTab = ev.target.closest('[data-cachetab]').dataset.cachetab; pintarConfig(); return; }
      if (ev.target.closest('[data-logtab]')) { estado.cfg.logTab = ev.target.closest('[data-logtab]').dataset.logtab; pintarConfig(); return; }
      if (ev.target.closest('[data-modo]')) { estado.cfg.modo = ev.target.closest('[data-modo]').dataset.modo; pintarConfig(); return; }

      if (ev.target.closest('#detCerrar')) { cerrarDetalle(); return; }
      if (ev.target.closest('#detFav')) {
        var did = detalleId;
        if (!did) return;
        if (estado.favoritos[did]) delete estado.favoritos[did]; else estado.favoritos[did] = true;
        abrirDetalle(did);
        pintarCabecera();
        if (estado.vista === 'explorar') pintarExplorar();
        return;
      }
      if (ev.target.closest('#detRuta')) { aviso('Abriendo la ruta en tu navegador…'); return; }
      if (ev.target.closest('#detCompartir')) { aviso('Enlace copiado: gasolineras.app/e/' + detalleId); return; }
      if (ev.target.closest('#detLlamar')) { aviso('Llamando al ' + telefono(detalleId) + '…'); return; }
      if (ev.target.id === 'detalle') { cerrarDetalle(); return; }

      var acc = ev.target.closest('[data-accion]');
      if (acc) { accion(acc); return; }
    });

    document.addEventListener('change', function (ev) {
      var t = ev.target;
      if (t.id === 'filtroProv') { estado.prov = t.value; estado.seleccion = null; pintarExplorar(); pintarCabecera(); pintarMapa(); return; }
      if (t.id === 'filtroFuel') { estado.fuel = t.value; estado.histFuel = t.value; pintarExplorar(); pintarCabecera(); pintarMapa(); return; }
      if (t.id === 'histFuel') { estado.histFuel = t.value; dibujarGrafica(); return; }
      if (t.id === 'histDias') { estado.histDias = Number(t.value) || 14; dibujarGrafica(); return; }
      if (t.id === 'iaModelo') { estado.ia.modelos[estado.ia.prov] = t.value; return; }
      if (t.matches('[data-cfg-chk]')) {
        estado.cfg[t.dataset.cfgChk] = t.checked;
        aviso(t.checked ? 'Aviso activado' : 'Aviso desactivado');
        return;
      }
      if (t.matches('[data-ia-visible]')) {
        var id2 = t.dataset.iaVisible;
        if (t.checked) { estado.cfg.iaVisibles[id2] = true; }
        else if (PROVEEDORES_REALES.filter(function (p) { return estado.cfg.iaVisibles[p]; }).length <= 1) {
          t.checked = true; aviso('Debe quedar al menos una pestaña visible'); return;
        } else { delete estado.cfg.iaVisibles[id2]; }
        aviso('Pestañas de IA actualizadas');
        return;
      }
      if (t.matches('[data-cfg]')) {
        var clave = t.dataset.cfg;
        if (clave === 'pagina') { estado.cfg.pagina = Number(t.value); }
        else if (clave === 'ttl') { estado.cfg.ttl = Number(t.value) || 0; aviso('Caché: ' + estado.cfg.ttl + ' h'); }
        else if (clave === 'iaDefecto') { estado.cfg.iaDefecto = t.value; }
        else {
          var v = Number(t.value);
          estado.cfg[clave] = isNaN(v) ? 0 : v;
          if (clave === 'intervalo') aviso('Comprobación cada ' + estado.cfg.intervalo + ' h');
        }
        return;
      }
    });

    var buscador = $('#filtroTexto');
    if (buscador) {
      buscador.addEventListener('input', function () {
        estado.texto = buscador.value;
        pintarExplorar();
      });
    }

    var form = $('#iaForm');
    if (form) {
      form.addEventListener('submit', function (ev) {
        ev.preventDefault();
        var input = $('#iaInput');
        var texto = input.value;
        input.value = '';
        enviarIA(texto);
      });
    }

    var cuerpo = $('#detCuerpo');
    if (cuerpo) {
      cuerpo.addEventListener('mousemove', function (ev) {
        if (ev.target.id === 'histCanvas') tooltipGrafica(ev); else ocultarTooltip();
      });
      cuerpo.addEventListener('mouseleave', ocultarTooltip);
      cuerpo.addEventListener('touchmove', function (ev) {
        if (ev.target.id !== 'histCanvas') return;
        var t = ev.touches[0];
        tooltipGrafica({ clientX: t.clientX, clientY: t.clientY });
      }, { passive: true });
    }

    document.addEventListener('keydown', function (ev) {
      if (ev.key === 'Escape' && !$('#detalle').hidden) { cerrarDetalle(); return; }
      var est = ev.target.closest ? ev.target.closest('[data-estacion]') : null;
      if (est && (ev.key === 'Enter' || ev.key === ' ') && ev.target === est) {
        ev.preventDefault();
        abrirDetalle(est.dataset.estacion);
      }
    });

    window.addEventListener('resize', function () {
      if (!$('#detalle').hidden) dibujarGrafica();
    });
  }

  function telefono(id) {
    var n = String(id || '1001').split('').reduce(function (a, c) { return a + Number(c); }, 0);
    return '91 ' + (200 + (n % 700)) + ' ' + (10 + (n % 80)) + ' ' + (10 + (n % 60));
  }

  function init() {
    pintarNav();
    enganchar();
    activarArrastre();
    pintarCabecera();
    pintarInicio();
    pintarExplorar();
    pintarMapa();
    aviso('Prototipo 7 · elige un camino y responde 3 preguntas');
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
