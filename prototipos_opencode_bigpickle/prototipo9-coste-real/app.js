/* =============================================================================
 * Prototipo 9 · «Coste real» — lógica de la maqueta
 * -----------------------------------------------------------------------------
 * Idea: ordenar por COSTE TOTAL de un repostaje (litros + desvío), no por €/L.
 * Todo se calcula con window.FAKE (../shared/datos-fake.js). Sin red.
 *
 * Persistencia: localStorage['gasolineras_proto9_estado'] guarda filtros,
 * litros, radio, consumo, favoritos, descuentos, vista y preferencias.
 * Chats: localStorage['gasolineras_proto9_ia_<proveedor>'].
 * ========================================================================== */
(function () {
  'use strict';

  var F = window.FAKE;
  var LS_ESTADO = 'gasolineras_proto9_estado';
  var LS_IA = 'gasolineras_proto9_ia_';
  var LS_PREFIJO = 'gasolineras_proto9';

  var DIAS_OPCIONES = [7, 14, 21, 30, 60, 90, 180];
  var TAM_OPCIONES = [5, 10, 15, 30, 50, 0];

  var IA_PROVEEDORES = [
    { id: 'general', nombre: 'General', modelo: '7 proveedores', nota: 'pregunta a todos a la vez' },
    { id: 'groq', nombre: 'Groq', modelo: 'qwen/qwen3.8-27b' },
    { id: 'mistral', nombre: 'Mistral', modelo: 'open-mistral-nemo' },
    { id: 'openrouter', nombre: 'OpenRouter', modelo: 'nvidia/nemotron-3-ultra-550b-a55b:free' },
    { id: 'llm7', nombre: 'LLM7.io', modelo: 'codestral-latest' },
    { id: 'nvidia', nombre: 'NVIDIA', modelo: 'nvidia/nemotron-3-ultra-550b-a55b' },
    { id: 'google', nombre: 'Gemini', modelo: 'gemini-3.8-flash' },
    { id: 'chrome-nano', nombre: 'Chrome IA', modelo: 'IA integrada del navegador' }
  ];

  /* ---------------------------------------------------------------- helpers */
  function $(sel, raiz) { return (raiz || document).querySelector(sel); }
  function $$(sel, raiz) { return Array.prototype.slice.call((raiz || document).querySelectorAll(sel)); }

  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  function norm(s) {
    return String(s == null ? '' : s).toLowerCase()
      .normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  }

  function num(v, dec) {
    if (v == null || !isFinite(v)) return '—';
    return Number(v).toFixed(dec || 0).replace('.', ',');
  }

  function eur3(p) { return p == null || !isFinite(p) ? '—' : num(p, 3) + ' €'; }
  function eur2(p) { return p == null || !isFinite(p) ? '—' : num(p, 2) + ' €'; }
  function eurCorto(p) { return p == null || !isFinite(p) ? '—' : num(p, 3); }
  function km(v) { return v == null || !isFinite(v) ? '—' : num(v, 1) + ' km'; }
  function pct(v) { return v == null || !isFinite(v) ? '—' : (v > 0 ? '+' : '') + num(v, 1) + ' %'; }

  function iniciales(marca) {
    var partes = String(marca || '').replace(/[^A-Za-zÁÉÍÓÚÜÑáéíóúüñ. ]/g, '').split(/[\s.]+/).filter(Boolean);
    if (!partes.length) return '··';
    if (partes.length === 1) return partes[0].slice(0, 2);
    return (partes[0][0] + partes[1][0]).toUpperCase();
  }

  /* ----------------------------------------------------------------- estado */
  var S = {
    prov: '28',
    fuel: 'Gasolina 95 E5',
    loc: '',
    marcas: [],
    texto: '',
    soloFav: false,
    orden: 'coste',
    vista: 'decision',
    pagina: 1,
    pageSize: 10,
    litros: 50,
    radio: 0,
    consumo: 6.5,
    idaVuelta: true,
    descuentos: {},
    mapaEstilo: 'calles',
    fichaFuel: 'Gasolina 95 E5',
    fichaDias: 30,
    iaProv: 'general',
    cacheTab: 'idb',
    logTab: 'api',
    cacheTtl: 12,
    pushOn: true,
    pushIntervalo: 8,
    pushDias: 3,
    persistir: true
  };

  var favoritos = {};
  var iaCharla = {};
  var descuentos = {};
  var logs = { api: F.logApi.slice(), push: F.logPush.slice() };
  var cacheVacia = false;
  var marcasPendientes = {};
  var listo = false;
  var temporizadorGuardado = null;
  var temporizadorAviso = null;
  var fichaActual = null;
  var iaPensando = false;

  var ETIQUETAS_TAM = { 0: 'Todas', 5: '5', 10: '10', 15: '15', 30: '30', 50: '50' };

  /* ------------------------------------------------------------- persistencia */
  function estadoSerializable() {
    return {
      prov: S.prov, fuel: S.fuel, loc: S.loc, marcas: S.marcas, texto: S.texto,
      soloFav: S.soloFav, orden: S.orden, vista: S.vista, pagina: S.pagina,
      pageSize: S.pageSize, litros: S.litros, radio: S.radio, consumo: S.consumo,
      idaVuelta: S.idaVuelta, descuentos: descuentos, favoritos: Object.keys(favoritos),
      mapaEstilo: S.mapaEstilo, fichaFuel: S.fichaFuel, fichaDias: S.fichaDias,
      iaProv: S.iaProv, cacheTab: S.cacheTab, logTab: S.logTab, cacheTtl: S.cacheTtl,
      pushOn: S.pushOn, pushIntervalo: S.pushIntervalo, pushDias: S.pushDias,
      persistir: S.persistir
    };
  }

  function guardar() {
    if (!listo || !S.persistir) return;
    try {
      localStorage.setItem(LS_ESTADO, JSON.stringify(estadoSerializable()));
    } catch (e) { /* almacenamiento lleno o bloqueado: la maqueta sigue */ }
  }

  function guardarPronto() {
    window.clearTimeout(temporizadorGuardado);
    temporizadorGuardado = window.setTimeout(guardar, 160);
  }

  function cargarEstado() {
    var crudo = null;
    try { crudo = localStorage.getItem(LS_ESTADO); } catch (e) { crudo = null; }
    if (crudo) {
      try {
        var d = JSON.parse(crudo);
        if (d && typeof d === 'object') {
          if (F.provincias.some(function (p) { return p.id === d.prov; })) S.prov = d.prov;
          if (F.combustiblesVisibles.indexOf(d.fuel) !== -1) S.fuel = d.fuel;
          S.loc = typeof d.loc === 'string' ? d.loc : '';
          S.marcas = Array.isArray(d.marcas) ? d.marcas.filter(function (m) { return typeof m === 'string'; }) : [];
          S.texto = typeof d.texto === 'string' ? d.texto : '';
          S.soloFav = !!d.soloFav;
          S.orden = ['coste', 'precio', 'precio-desc', 'dist', 'marca'].indexOf(d.orden) !== -1 ? d.orden : 'coste';
          S.vista = ['decision', 'lista', 'mapa', 'ia', 'config'].indexOf(d.vista) !== -1 ? d.vista : 'decision';
          S.pagina = Math.max(1, Number(d.pagina) || 1);
          S.pageSize = TAM_OPCIONES.indexOf(Number(d.pageSize)) !== -1 ? Number(d.pageSize) : 10;
          S.litros = Math.min(120, Math.max(5, Number(d.litros) || 50));
          S.radio = Math.min(40, Math.max(0, Number(d.radio) || 0));
          S.consumo = Math.min(15, Math.max(3, Number(d.consumo) || 6.5));
          S.idaVuelta = d.idaVuelta !== false;
          if (d.descuentos && typeof d.descuentos === 'object') {
            Object.keys(d.descuentos).forEach(function (m) {
              var v = Number(d.descuentos[m]);
              if (isFinite(v) && v >= 0 && v < 1) descuentos[m] = Math.round(v * 1000) / 1000;
            });
          }
          if (Array.isArray(d.favoritos)) {
            d.favoritos.forEach(function (id) {
              if (F.estaciones.some(function (e) { return e.id === id; })) favoritos[id] = true;
            });
          }
          if (['calles', 'satelite', 'oscuro', 'relieve'].indexOf(d.mapaEstilo) !== -1) S.mapaEstilo = d.mapaEstilo;
          if (F.combustiblesVisibles.indexOf(d.fichaFuel) !== -1) S.fichaFuel = d.fichaFuel;
          if (DIAS_OPCIONES.indexOf(Number(d.fichaDias)) !== -1) S.fichaDias = Number(d.fichaDias);
          if (IA_PROVEEDORES.some(function (p) { return p.id === d.iaProv; })) S.iaProv = d.iaProv;
          S.cacheTab = d.cacheTab === 'ls' ? 'ls' : 'idb';
          S.logTab = d.logTab === 'push' ? 'push' : 'api';
          S.cacheTtl = Math.min(72, Math.max(1, Number(d.cacheTtl) || 12));
          S.pushOn = d.pushOn !== false;
          S.pushIntervalo = [1, 4, 8, 12, 24].indexOf(Number(d.pushIntervalo)) !== -1 ? Number(d.pushIntervalo) : 8;
          S.pushDias = [1, 3, 7, 14].indexOf(Number(d.pushDias)) !== -1 ? Number(d.pushDias) : 3;
          S.persistir = d.persistir !== false;
        }
      } catch (e) { /* estado corrupto: se ignoran los valores guardados */ }
    }

    /* Semilla de descuentos: los de la maqueta + favoritos marcados en los datos */
    if (!Object.keys(descuentos).length) {
      Object.keys(F.descuentos).forEach(function (m) { descuentos[m] = F.descuentos[m]; });
    }
    if (!Object.keys(favoritos).length) {
      F.estaciones.forEach(function (e) { if (e.fav) favoritos[e.id] = true; });
    }
  }

  function borrarDatosGuardados() {
    try {
      Object.keys(localStorage).forEach(function (k) {
        if (k.indexOf(LS_PREFIJO) === 0) localStorage.removeItem(k);
      });
    } catch (e) { /* nada */ }
  }

  /* ---------------------------------------------------------------- datos */
  function estacionesProv() { return F.estacionesDe(S.prov); }

  function precioFinal(e) {
    var p = e.precios[S.fuel];
    if (p == null) return null;
    var d = descuentos[e.marca] || 0;
    return Math.round((p - d) * 1000) / 1000;
  }

  function descuentoDe(e) { return descuentos[e.marca] || 0; }

  function filtrar() {
    var q = norm(S.texto);
    return estacionesProv().filter(function (e) {
      if (e.precios[S.fuel] == null) return false;
      if (S.loc && e.localidad !== S.loc) return false;
      if (S.marcas.length && S.marcas.indexOf(e.marca) === -1) return false;
      if (S.soloFav && !favoritos[e.id]) return false;
      if (S.radio > 0 && e.dist > S.radio) return false;
      if (q) {
        var pajar = norm([e.marca, e.nombre, e.localidad, e.direccion].join(' '));
        if (pajar.indexOf(q) === -1) return false;
      }
      return true;
    });
  }

  function datosDe(e) {
    var precio = precioFinal(e);
    if (precio == null) return null;
    var trayecto = S.idaVuelta ? e.dist * 2 : e.dist;
    var costeTrayecto = trayecto * (S.consumo / 100) * precio;
    var repostaje = S.litros * precio;
    return {
      e: e,
      precio: precio,
      trayecto: trayecto,
      costeTrayecto: costeTrayecto,
      repostaje: repostaje,
      total: repostaje + costeTrayecto
    };
  }

  function porCoste(a, b) { return a.total - b.total; }

  function ordenar(lista) {
    var arr = lista.map(datosDe).filter(Boolean);
    if (S.orden === 'precio') arr.sort(function (a, b) { return a.precio - b.precio; });
    else if (S.orden === 'precio-desc') arr.sort(function (a, b) { return b.precio - a.precio; });
    else if (S.orden === 'dist') arr.sort(function (a, b) { return a.e.dist - b.e.dist; });
    else if (S.orden === 'marca') arr.sort(function (a, b) {
      var r = a.e.marca.localeCompare(b.e.marca, 'es');
      return r || a.total - b.total;
    });
    else arr.sort(porCoste);
    return arr;
  }

  function mediaProvincia() {
    var vals = estacionesProv().map(precioFinal).filter(function (v) { return v != null; });
    if (!vals.length) return null;
    return Math.round(vals.reduce(function (a, b) { return a + b; }, 0) / vals.length * 1000) / 1000;
  }

  function tendencia(id, fuel, dias) {
    var serie = F.historico(id, fuel, dias);
    if (serie.length < 2) return null;
    var a = serie[0].precio, b = serie[serie.length - 1].precio;
    if (!a) return null;
    return (b - a) / a * 100;
  }

  function colorPrecio(p) { return F.colorPrecio(p, 1.5, 1.7); }

  /* ---------------------------------------------------------------- selects */
  function pintarSelects() {
    $('#selProv').innerHTML = F.provincias.map(function (p) {
      return '<option value="' + p.id + '">' + esc(p.nombre) + '</option>';
    }).join('');
    $('#selProv').value = S.prov;

    $('#selFuel').innerHTML = F.combustiblesVisibles.map(function (f) {
      return '<option value="' + esc(f) + '">' + esc(f) + '</option>';
    }).join('');
    $('#selFuel').value = S.fuel;

    pintarLocalidades();

    var opcionesTam = TAM_OPCIONES.map(function (t) {
      return '<option value="' + t + '">' + ETIQUETAS_TAM[t] + '</option>';
    }).join('');
    $('#pageSizeSel').innerHTML = opcionesTam;
    $('#pageSizeCfg').innerHTML = opcionesTam;
    $('#pageSizeSel').value = String(S.pageSize);
    $('#pageSizeCfg').value = String(S.pageSize);

    $('#ordenSel').value = S.orden;
    $('#mapaEstilo').value = S.mapaEstilo;
    $('#litros').value = String(S.litros);
    $('#consumo').value = String(S.consumo);
    $('#radio').value = String(S.radio);
    $('#idaVuelta').checked = S.idaVuelta;
    $('#chkFav').checked = S.soloFav;
    $('#cacheTtl').value = String(S.cacheTtl);
    $('#cfgPersistir').checked = S.persistir;
    $('#pushOn').checked = S.pushOn;
    $('#pushIntervalo').value = String(S.pushIntervalo);
    $('#pushDias').value = String(S.pushDias);
    $('#buscar').value = S.texto;
    actualizarRadioTexto();
  }

  function pintarLocalidades() {
    var sel = $('#selLocalidad');
    var lista = F.localidadesDe(S.prov);
    if (S.loc && lista.indexOf(S.loc) === -1) S.loc = '';
    sel.innerHTML = '<option value="">Todas</option>' + lista.map(function (l) {
      return '<option value="' + esc(l) + '">' + esc(l) + '</option>';
    }).join('');
    sel.value = S.loc;
  }

  function actualizarRadioTexto() {
    $('#radioVal').textContent = S.radio > 0 ? '≤ ' + num(S.radio, 0) + ' km' : 'sin límite';
  }

  function pintarPrompts() {
    $('#iaPrompts').innerHTML = F.prompts.map(function (p) {
      return '<button type="button" class="prompt-chip" data-prompt="' + esc(p) + '">' + esc(p) + '</button>';
    }).join('');
  }

  /* -------------------------------------------------------------- navegación */
  function setVista(vista, silencioso) {
    if (['decision', 'lista', 'mapa', 'ia', 'config'].indexOf(vista) === -1) vista = 'decision';
    S.vista = vista;
    $$('[data-panel]').forEach(function (p) {
      p.hidden = p.getAttribute('data-panel') !== vista;
    });
    $$('[data-vista]').forEach(function (b) {
      var act = b.getAttribute('data-vista') === vista;
      b.setAttribute('aria-selected', act ? 'true' : 'false');
    });
    if (!silencioso) {
      render();
      guardarPronto();
    }
  }

  function toast(msg) {
    var el = $('#aviso');
    el.textContent = msg;
    el.classList.add('visible');
    window.clearTimeout(temporizadorAviso);
    temporizadorAviso = window.setTimeout(function () { el.classList.remove('visible'); }, 2400);
  }

  /* ---------------------------------------------------------------- render */
  function render() {
    actualizarFiltros();
    if (S.vista === 'decision') renderDecision();
    else if (S.vista === 'lista') renderLista();
    else if (S.vista === 'mapa') renderMapa();
    else if (S.vista === 'ia') renderIA();
    else if (S.vista === 'config') renderConfig();
  }

  function actualizarFiltros() {
    var n = 0;
    if (S.loc) n++;
    if (S.marcas.length) n++;
    if (S.texto) n++;
    if (S.soloFav) n++;
    if (S.radio > 0) n++;
    $('#btnLimpiar').hidden = n === 0;
    var cuenta = $('#marcasCuenta');
    cuenta.hidden = S.marcas.length === 0;
    cuenta.textContent = String(S.marcas.length);
    $('#btnMarcas').setAttribute('aria-expanded', $('#marcasPop').hidden ? 'false' : 'true');
    if (!$('#buscadorFila').hidden) $('#btnBuscar').setAttribute('aria-expanded', 'true');
    else $('#btnBuscar').setAttribute('aria-expanded', 'false');
  }

  /* --------------------------------------------------------------- decisión */
  function renderDecision() {
    var cont = $('#decisionContenido');
    /* La decisión siempre se ordena por coste total, sea cual sea el orden
       elegido en la lista. */
    var lista = ordenar(filtrar()).sort(porCoste);
    var media = mediaProvincia();

    if (!lista.length) {
      cont.innerHTML = '<div class="vacio">' +
        '<strong>Ninguna estación entra con estos filtros</strong>' +
        '<p>' + (S.radio > 0
          ? 'El radio de ' + num(S.radio, 0) + ' km deja fuera todas las estaciones de ' + esc(F.provinciaNombre(S.prov)) + '.'
          : 'Prueba con otro combustible, localidad o marca.') + '</p>' +
        '<button type="button" class="btn-primario" data-accion="limpiar">Quitar filtros</button>' +
        '</div>';
      return;
    }

    var mejor = lista[0];
    var peorTotal = lista[lista.length - 1].total;
    var porPrecio = lista.slice().sort(function (a, b) { return a.precio - b.precio; })[0];
    var dto = descuentoDe(mejor.e);
    var tend = tendencia(mejor.e.id, S.fuel, 14);
    var bruto = media != null ? S.litros * (media - mejor.precio) : null;
    var neto = bruto != null ? bruto - mejor.costeTrayecto : null;
    var nombreProv = F.provinciaNombre(S.prov);

    var razones = [];
    razones.push('Precio con descuento: <b>' + eur3(mejor.precio) + '/L</b>' +
      (dto > 0 ? ' (' + esc(mejor.e.marca) + ' −' + num(dto, 3) + ')' : ' (sin descuento de marca)'));
    razones.push('Repostaje: <b>' + num(S.litros, 0) + ' L × ' + eur3(mejor.precio) + ' = ' + eur2(mejor.repostaje) + '</b>');
    razones.push('Desvío: <b>' + km(mejor.e.dist) + '</b>' +
      (S.idaVuelta ? ' (ida y vuelta ' + km(mejor.trayecto) + ')' : '') +
      ' → ' + eur2(mejor.costeTrayecto) + ' de combustible');
    if (media != null && bruto != null) {
      razones.push('Frente a la media de ' + esc(nombreProv) + ' (' + eur3(media) + '): ' +
        '<b>' + (bruto >= 0 ? 'ahorras ' : 'pierdes ') + eur2(Math.abs(bruto)) + '</b> antes del desvío');
      razones.push('Ahorro neto (descontando el desvío): <b style="color:' + (neto >= 0 ? '#b7f0cf' : '#ffe08a') + '">' +
        (neto >= 0 ? '+' : '−') + eur2(Math.abs(neto)) + '</b>');
    }
    if (tend != null) {
      razones.push('Tendencia 14 días: <b>' + pct(tend) + '</b> · ' + (tend <= 0 ? 'bajando' : 'subiendo'));
    }

    var aviso;
    if (porPrecio.e.id !== mejor.e.id) {
      aviso = '<p class="aviso-cambio">⚠️ La más barata por litro es <b>' + esc(porPrecio.e.nombre) +
        '</b> (' + eur3(porPrecio.precio) + ', a ' + km(porPrecio.e.dist) + '), pero su total es ' +
        eur2(porPrecio.total) + ': el desvío se come el ahorro.</p>';
    } else {
      aviso = '<p class="aviso-cambio aviso-igual">✓ También es la más barata por litro (' +
        eur3(porPrecio.precio) + '): con estos litros el desvío no le quita el primer puesto.</p>';
    }

    var alternativas = lista.slice(1, 5);
    var htmlAlts = alternativas.map(function (d, i) {
      return '<li class="alt">' +
        '<span class="alt-puesto">' + (i + 2) + '</span>' +
        '<span class="alt-txt">' +
          '<span class="alt-nombre">' + esc(d.e.marca) + ' · ' + esc(d.e.localidad) + '</span>' +
          '<span class="alt-sub">' + eur3(d.precio) + '/L · ' + km(d.e.dist) + ' · desvío ' + eur2(d.costeTrayecto) + '</span>' +
        '</span>' +
        '<span class="alt-derecha">' +
          '<span class="alt-total">' + eur2(d.total) + '</span>' +
          '<span class="alt-delta">+' + eur2(d.total - mejor.total) + '</span>' +
          '<button type="button" class="btn-mini" data-ficha="' + d.e.id + '">Ficha</button>' +
        '</span>' +
      '</li>';
    }).join('');

    var top = lista.slice(0, 6);
    var max = top[0].total;
    var htmlBarras = top.map(function (d, i) {
      var ancho = Math.max(7, d.total / peorTotal * 100);
      return '<div class="barra' + (i === 0 ? ' mejor' : '') + '">' +
        '<span class="barra-nom">' + esc(d.e.marca) + '</span>' +
        '<span class="barra-pista"><span class="barra-fill" style="width:' + num(ancho, 1) + '%"></span></span>' +
        '<b>' + eur2(d.total) + '</b>' +
      '</div>';
    }).join('');

    cont.innerHTML = '<div class="decision-grid">' +
      '<article class="hero">' +
        '<p class="hero-etq">Mejor coste total</p>' +
        '<h2 class="hero-nombre">' + esc(mejor.e.nombre) + '</h2>' +
        '<p class="hero-dir">' + esc(mejor.e.direccion) + ' · ' + esc(mejor.e.localidad) + ' · ' + km(mejor.e.dist) +
          (favoritos[mejor.e.id] ? ' · ★ favorita' : '') + '</p>' +
        '<div class="hero-total"><strong>' + eur2(mejor.total) + '</strong>' +
          '<span>coste total de repostar ' + num(S.litros, 0) + ' L' + (S.idaVuelta ? ' (ida y vuelta incluida)' : '') + '</span></div>' +
        '<dl class="hero-grid">' +
          '<div><dt>Precio/L</dt><dd>' + eur3(mejor.precio) + '</dd></div>' +
          '<div><dt>Repostaje</dt><dd>' + eur2(mejor.repostaje) + '</dd></div>' +
          '<div><dt>Desvío</dt><dd>' + eur2(mejor.costeTrayecto) + '</dd></div>' +
          '<div><dt>Ahorro neto</dt><dd>' + (neto == null ? '—' : (neto >= 0 ? '+' : '−') + eur2(Math.abs(neto))) + '</dd></div>' +
        '</dl>' +
        '<ul class="hero-razones">' + razones.map(function (r) { return '<li>' + r + '</li>'; }).join('') + '</ul>' +
        aviso +
        '<div class="hero-acciones">' +
          '<button type="button" class="btn-primario" data-shot="detalle" data-ficha="' + mejor.e.id + '">Ver ficha y gráfica</button>' +
          '<button type="button" class="btn-sec" data-shot="vista">Ver las ' + lista.length + ' estaciones</button>' +
        '</div>' +
      '</article>' +
      '<aside>' +
        '<section class="alts">' +
          '<h2>Otras opciones</h2>' +
          '<p class="pista">Ordenadas por coste total con ' + num(S.litros, 0) + ' L y ' + num(S.consumo, 1) + ' L/100 km.</p>' +
          '<ul>' + htmlAlts + '</ul>' +
        '</section>' +
        '<section class="barras">' +
          '<h2>Coste total</h2>' +
          '<p class="pista">La barra más corta es la que menos te cuesta, aunque no tenga el precio más bajo.</p>' +
          '<div class="barras-lista">' + htmlBarras + '</div>' +
        '</section>' +
      '</aside>' +
    '</div>';
  }

  /* ------------------------------------------------------------------ lista */
  function renderLista() {
    var lista = ordenar(filtrar());
    var media = mediaProvincia();
    var minimoTotal = lista.reduce(function (min, d) { return d.total < min ? d.total : min; }, Infinity);
    $('#listaSub').textContent = lista.length
      ? lista.length + ' estaciones · ' + num(S.litros, 0) + ' L · media ' + eur3(media) +
        ' · coste desde ' + eur2(minimoTotal)
      : 'Sin resultados con estos filtros';

    var paginas = S.pageSize > 0 ? Math.max(1, Math.ceil(lista.length / S.pageSize)) : 1;
    if (S.pagina > paginas) S.pagina = paginas;
    var inicio = S.pageSize > 0 ? (S.pagina - 1) * S.pageSize : 0;
    var visibles = S.pageSize > 0 ? lista.slice(inicio, inicio + S.pageSize) : lista;

    $('#tablaCuerpo').innerHTML = visibles.length ? visibles.map(function (d) {
      var p = d.precio;
      var col = colorPrecio(p);
      var fav = favoritos[d.e.id];
      return '<tr data-ficha="' + d.e.id + '">' +
        '<td><span class="ini">' + esc(iniciales(d.e.marca)) + '</span>' + esc(d.e.marca) +
          (fav ? ' <span class="pildora naranja" aria-label="Favorita">★</span>' : '') + '</td>' +
        '<td><span class="pildora ' + col + '">' + eur3(p) + '</span></td>' +
        '<td><b>' + eur2(d.total) + '</b></td>' +
        '<td>' + km(d.e.dist) + '</td>' +
        '<td>' + esc(d.e.localidad) + '</td>' +
        '<td class="td-calle">' + esc(d.e.direccion) + '</td>' +
        '<td><button type="button" class="btn-mini" data-ficha="' + d.e.id + '">Ficha</button></td>' +
      '</tr>';
    }).join('') : '<tr class="fila-vacia"><td colspan="7">Ninguna estación coincide con los filtros. Prueba a ampliar el radio o quitar la marca.</td></tr>';

    $('#pagInfo').textContent = lista.length
      ? (S.pageSize > 0
        ? (inicio + 1) + '–' + Math.min(inicio + S.pageSize, lista.length) + ' de ' + lista.length + ' · pág. ' + S.pagina + '/' + paginas
        : 'Todas (' + lista.length + ')')
      : '0 estaciones';
    $('#pagPrev').disabled = S.pagina <= 1;
    $('#pagNext').disabled = S.pagina >= paginas;
    $('#pageSizeSel').value = String(S.pageSize);
    $('#pageSizeCfg').value = String(S.pageSize);
  }

  /* ------------------------------------------------------------------- mapa */
  function pintarMapaSvg() {
    var m = F.mapa;
    var bloques = m.manchas.map(function (b) {
      return '<rect class="bloque" x="' + b.x + '" y="' + b.y + '" width="' + b.w + '" height="' + b.h + '" rx="2"/>';
    }).join('');
    var vias = m.viales.map(function (v) {
      return '<path class="' + (v.w >= 3 ? 'via' : 'via-fina') + '" d="' + v.d + '" stroke-width="' + (v.w * 0.9) + '"/>';
    }).join('');
    $('#mapaSvg').innerHTML = '<svg viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">' +
      bloques + '<path class="agua" d="' + m.agua.d + '"/>' + vias + '</svg>';
  }

  function renderMapa() {
    var lista = ordenar(filtrar());
    $('#mapaCaja').setAttribute('data-estilo', S.mapaEstilo);
    $('#mapaEstilo').value = S.mapaEstilo;

    $('#marcadores').innerHTML = lista.map(function (d) {
      var col = colorPrecio(d.precio);
      var e = d.e;
      return '<button type="button" class="marcador ' + col + (favoritos[e.id] ? ' fav' : '') + '"' +
        ' style="left:' + num(e.mx, 1) + '%;top:' + num(e.my, 1) + '%"' +
        ' data-ficha="' + e.id + '"' +
        ' aria-label="' + esc(e.marca + ' ' + e.nombre + ', ' + eur3(d.precio) + ', total ' + eur2(d.total) + ', a ' + km(e.dist)) + '">' +
        eurCorto(d.precio) + '</button>';
    }).join('');

    $('#mapaSub').textContent = lista.length
      ? lista.length + ' estaciones en ' + F.provinciaNombre(S.prov) + ' · ' + S.fuel
      : 'Sin estaciones que mostrar';
    $('#mapaPista').textContent = lista.length
      ? 'Toca un precio para abrir la ficha con el histórico. Los favoritos llevan ★.'
      : 'Amplía el radio o quita filtros para ver estaciones en el mapa.';
  }

  /* --------------------------------------------------------------------- IA */
  function proveedorIA(id) {
    return IA_PROVEEDORES.filter(function (p) { return p.id === id; })[0] || IA_PROVEEDORES[0];
  }

  function cargarChats() {
    IA_PROVEEDORES.forEach(function (p) {
      var crudo = null;
      try { crudo = localStorage.getItem(LS_IA + p.id); } catch (e) { crudo = null; }
      if (crudo) {
        try {
          var arr = JSON.parse(crudo);
          if (Array.isArray(arr)) {
            iaCharla[p.id] = arr.filter(function (m) {
              return m && typeof m.content === 'string' && (m.role === 'user' || m.role === 'assistant');
            }).slice(-100).map(function (m) {
              /* la marca de agua viaja con el mensaje para que sobreviva al
                 cambiar de pestaña y a la recarga */
              return { role: m.role, content: m.content, meta: typeof m.meta === 'string' ? m.meta : '' };
            });
          }
        } catch (e) { /* chat corrupto: se ignora */ }
      }
      if (!iaCharla[p.id]) iaCharla[p.id] = [];
    });
  }

  function guardarChat(id) {
    try {
      localStorage.setItem(LS_IA + id, JSON.stringify(iaCharla[id].slice(-100)));
    } catch (e) { /* sin espacio: la conversación sigue en memoria */ }
  }

  /* Markdown mínimo y seguro: escapa primero y luego aplica formato. */
  function renderMarkdown(texto) {
    var lineas = String(texto == null ? '' : texto).replace(/\r\n/g, '\n').split('\n');
    var salida = [];
    var enCodigo = false;
    var enLista = null;
    var tabla = [];

    function cerrarLista() {
      if (enLista) { salida.push('</' + enLista + '>'); enLista = null; }
    }

    function cerrarTabla() {
      if (!tabla.length) return;
      var filas = tabla;
      tabla = [];
      var html = '<table class="ia-md-table"><thead><tr>';
      filas[0].forEach(function (c) { html += '<th>' + enLinea(c) + '</th>'; });
      html += '</tr></thead><tbody>';
      filas.slice(1).forEach(function (f) {
        html += '<tr>';
        f.forEach(function (c) { html += '<td>' + enLinea(c) + '</td>'; });
        html += '</tr>';
      });
      salida.push(html + '</tbody></table>');
    }

    function enLinea(txt) {
      var t = esc(txt);
      t = t.replace(/`([^`]+)`/g, '<code class="ia-md-code">$1</code>');
      t = t.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
      t = t.replace(/__([^_]+)__/g, '<strong>$1</strong>');
      t = t.replace(/(^|[\s(])\*([^*\s][^*]*)\*/g, '$1<em>$2</em>');
      t = t.replace(/(^|[\s(])_([^_\s][^_]*)_/g, '$1<em>$2</em>');
      t = t.replace(/\[([^\]]+)\]\((https?:[^)\s]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>');
      t = t.replace(/(^|\s)(https?:\/\/[^\s<]+)/g, '$1<a href="$2" target="_blank" rel="noopener">$2</a>');
      return t;
    }

    lineas.forEach(function (linea, i) {
      var l = linea;
      var m;

      if (/^```/.test(l.trim())) {
        if (enCodigo) { salida.push('</code></pre>'); enCodigo = false; }
        else { cerrarLista(); cerrarTabla(); salida.push('<pre class="ia-md-pre"><code>'); enCodigo = true; }
        return;
      }
      if (enCodigo) { salida.push(esc(l) + '\n'); return; }

      if (/^\s*\|/.test(l)) {
        cerrarLista();
        var celdas = l.trim().replace(/^\|/, '').replace(/\|$/, '').split('|').map(function (c) { return c.trim(); });
        if (celdas.every(function (c) { return /^:?-{2,}:?$/.test(c); })) return;
        tabla.push(celdas);
        return;
      }
      cerrarTabla();

      if (!l.trim()) { cerrarLista(); return; }

      if ((m = l.match(/^\s*#{1,4}\s+(.*)$/))) {
        cerrarLista();
        var nivel = Math.min(4, m[1].length + 2);
        salida.push('<div class="ia-md-h' + nivel + '">' + enLinea(m[1]) + '</div>');
        return;
      }
      if (/^\s*(---+|\*\*\*+)\s*$/.test(l)) {
        cerrarLista();
        salida.push('<hr class="ia-md-hr">');
        return;
      }
      if ((m = l.match(/^\s*>\s?(.*)$/))) {
        cerrarLista();
        salida.push('<blockquote class="ia-md-quote">' + enLinea(m[1]) + '</blockquote>');
        return;
      }
      if ((m = l.match(/^\s*[-*+]\s+(.*)$/))) {
        if (enLista !== 'ul') { cerrarLista(); salida.push('<ul class="ia-md-ul">'); enLista = 'ul'; }
        salida.push('<li>' + enLinea(m[1]) + '</li>');
        return;
      }
      if ((m = l.match(/^\s*\d+[.)]\s+(.*)$/))) {
        if (enLista !== 'ol') { cerrarLista(); salida.push('<ol class="ia-md-ol">'); enLista = 'ol'; }
        salida.push('<li>' + enLinea(m[1]) + '</li>');
        return;
      }

      cerrarLista();
      salida.push('<p class="ia-md-p">' + enLinea(l) + '</p>');
      if (i === lineas.length - 1) return;
    });

    cerrarLista();
    cerrarTabla();
    if (enCodigo) salida.push('</code></pre>');
    return salida.join('');
  }

  function renderIA() {
    var prov = proveedorIA(S.iaProv);
    S.iaProv = prov.id;

    $('#iaPills').innerHTML = IA_PROVEEDORES.map(function (p) {
      return '<button type="button" class="ia-pill" role="tab" data-iaprov="' + p.id + '"' +
        ' aria-selected="' + (p.id === prov.id ? 'true' : 'false') + '">' + esc(p.nombre) + '</button>';
    }).join('');

    $('#iaEstado').textContent = prov.id === 'general'
      ? '7 proveedores + General · respuestas simuladas'
      : prov.nombre + ' · ' + prov.modelo + ' · respuesta simulada';

    renderMensajesIA();
  }

  function renderMensajesIA() {
    var cont = $('#iaMensajes');
    var lista = iaCharla[S.iaProv] || [];
    var html = lista.map(function (m) {
      var meta = m.meta && m.role === 'assistant'
        ? '<div class="ia-msg-meta">' + esc(m.meta) + '</div>'
        : '';
      return '<div class="ia-msg ' + esc(m.role) + '">' + renderMarkdown(m.content) + meta + '</div>';
    }).join('');

    if (!lista.length) {
      html += '<div class="ia-msg info">Pregunta por precios, tendencias o tus favoritas. Las respuestas son simuladas con los datos de la maqueta.</div>';
    }
    if (iaPensando) html += '<div class="ia-msg info" id="iaPensando">Pensando…</div>';
    cont.innerHTML = html;
    cont.scrollTop = cont.scrollHeight;
  }

  function respuestaGenerica() {
    var lista = ordenar(filtrar());
    if (!lista.length) {
      return 'Con los filtros actuales no queda ninguna estación. Prueba a **ampliar el radio**, quitar la marca o cambiar de combustible.';
    }
    var m = lista[0];
    var filas = lista.slice(0, 3).map(function (d) {
      return '| ' + d.e.marca + ' · ' + d.e.localidad + ' | ' + eur3(d.precio) + ' | ' + eur2(d.total) + ' | ' + km(d.e.dist) + ' |';
    }).join('\n');

    return '### La mejor con tus ' + num(S.litros, 0) + ' L\n\n' +
      '**' + m.e.nombre + '** te cuesta **' + eur2(m.total) + '** en total (' +
      eur3(m.precio) + '/L + ' + eur2(m.costeTrayecto) + ' de desvío).\n\n' +
      '| Estación | Precio | Coste total | Distancia |\n|---|---|---|---|\n' + filas + '\n\n' +
      '- Si repostaras en la media de ' + F.provinciaNombre(S.prov) + ' (' + eur3(mediaProvincia()) + ') el coste sería ' +
      eur2(S.litros * mediaProvincia()) + '.\n' +
      '- El histórico de 30 días marca una tendencia de ' + pct(tendencia(m.e.id, S.fuel, 30)) + '.';
  }

  function enviarIA(texto) {
    var limpio = String(texto || '').trim();
    if (!limpio || iaPensando) return;

    var id = S.iaProv;
    iaCharla[id].push({ role: 'user', content: limpio, meta: '' });
    guardarChat(id);
    iaPensando = true;
    renderMensajesIA();
    $('#iaInput').value = '';

    var prov = proveedorIA(id);
    var modelo = prov.id === 'general' ? 'general' : prov.modelo;
    var inicio = Date.now();

    window.setTimeout(function () {
      var banco = F.chatsIA[id] || [];
      var respuesta = null;
      for (var i = 0; i < banco.length; i++) {
        if (banco[i].role === 'assistant') { respuesta = banco[i].content; break; }
      }
      if (!respuesta) respuesta = respuestaGenerica();

      var ms = Date.now() - inicio;
      var seg = ms < 1000 ? ms + ' ms' : num(ms / 1000, 1) + ' s';
      var etiqueta = prov.id === 'general' ? 'General · 7 proveedores' : prov.nombre + ' · ' + modelo;

      iaCharla[id].push({
        role: 'assistant',
        content: respuesta,
        meta: '⏱ ' + etiqueta + ' · ' + seg
      });
      iaPensando = false;
      renderMensajesIA();
      guardarChat(id);
    }, 650);
  }

  /* ------------------------------------------------------------------ ficha */
  function estacionPorId(id) {
    return F.estaciones.filter(function (e) { return e.id === id; })[0] || null;
  }

  function abrirFicha(id) {
    var e = estacionPorId(id);
    if (!e) return;
    fichaActual = id;
    S.fichaFuel = e.precios[S.fuel] != null ? S.fuel : (Object.keys(e.precios).filter(function (k) { return e.precios[k] != null; })[0] || S.fuel);

    $('#fichaMarca').textContent = e.marca;
    $('#fichaNombre').textContent = e.nombre;

    var p = e.precios[S.fuel] != null ? precioFinal(e) : F.precioDe(e, S.fichaFuel);
    var dto = descuentoDe(e);
    $('#fichaPrecio').innerHTML = '<strong>' + eur3(p) + '</strong><span>' + esc(S.fuel) + '</span>' +
      (dto > 0 && e.precios[S.fuel] != null ? '<span class="ficha-descuento">−' + num(dto, 3) + ' €/L por marca</span>' : '');

    var d = datosDe(e);
    $('#fichaDatos').innerHTML =
      '<div><dt>Dirección</dt><dd>' + esc(e.direccion) + '</dd></div>' +
      '<div><dt>Localidad</dt><dd>' + esc(e.localidad) + '</dd></div>' +
      '<div><dt>Distancia</dt><dd>' + km(e.dist) + '</dd></div>' +
      '<div><dt>Horario</dt><dd>' + esc(e.horario) + '</dd></div>' +
      '<div><dt>Teléfono</dt><dd>+34 91 555 01' + esc(e.id.slice(-2)) + '</dd></div>' +
      '<div><dt>IDEESS</dt><dd>' + esc(e.id) + '</dd></div>' +
      (d ? '<div><dt>Coste total</dt><dd>' + eur2(d.total) + '</dd></div>' : '') +
      '<div><dt>Actualizado</dt><dd>16/10/26 09:12</dd></div>';

    $('#fichaPrecios').innerHTML = Object.keys(e.precios).filter(function (k) {
      return e.precios[k] != null;
    }).map(function (k) {
      var base = e.precios[k];
      var fin = Math.round((base - descuentoDe(e)) * 1000) / 1000;
      var col = colorPrecio(fin);
      var cls = col === 'verde' ? 'verde' : col === 'naranja' ? 'naranja' : col === 'rojo' ? 'rojo' : 'gris';
      return '<span class="precio-chip pildora ' + cls + '">' + esc(k) + ' · ' + eur3(fin) + '</span>';
    }).join('');

    var combustibles = Object.keys(e.precios).filter(function (k) { return e.precios[k] != null; });
    $('#fichaFuel').innerHTML = combustibles.map(function (k) {
      return '<option value="' + esc(k) + '">' + esc(k) + '</option>';
    }).join('');
    $('#fichaFuel').value = S.fichaFuel;

    $('#fichaDias').innerHTML = DIAS_OPCIONES.map(function (n) {
      return '<option value="' + n + '">' + n + ' días</option>';
    }).join('');
    $('#fichaDias').value = String(S.fichaDias);

    actualizarFavBoton();

    $('#ficha').hidden = false;
    $('#velo').hidden = false;
    document.body.classList.add('con-ficha');
    $('#fichaCerrar').focus();

    window.requestAnimationFrame(function () {
      dibujarGrafica();
      actualizarResumen();
    });
  }

  function cerrarFicha() {
    fichaActual = null;
    $('#ficha').hidden = true;
    $('#velo').hidden = true;
    $('#graficaTip').hidden = true;
    document.body.classList.remove('con-ficha');
  }

  function actualizarFavBoton() {
    var on = !!favoritos[fichaActual];
    var b = $('#fichaFav');
    b.textContent = (on ? '★' : '☆') + ' Favorita';
    b.classList.toggle('activo', on);
    b.setAttribute('aria-pressed', on ? 'true' : 'false');
  }

  function dibujarGrafica() {
    if (!fichaActual) return;
    var cv = $('#grafica');
    if (!cv) return;
    var serie = F.historico(fichaActual, S.fichaFuel, S.fichaDias);
    if (serie.length < 2) { cv._pts = []; return; }

    var W = cv.clientWidth || 520;
    var H = cv.clientHeight || 200;
    var dpr = Math.min(window.devicePixelRatio || 1, 2);
    cv.width = Math.round(W * dpr);
    cv.height = Math.round(H * dpr);

    var ctx = cv.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, W, H);

    var precios = serie.map(function (p) { return p.precio; });
    var mn = Math.min.apply(null, precios);
    var mx = Math.max.apply(null, precios);
    var margen = Math.max((mx - mn) * 0.25, 0.004);
    var lo = mn - margen;
    var hi = mx + margen;

    var izq = 48, der = 10, arriba = 12, abajo = 24;
    var ancho = W - izq - der;
    var alto = H - arriba - abajo;

    function x(i) { return izq + (serie.length === 1 ? ancho / 2 : ancho * i / (serie.length - 1)); }
    function y(v) { return arriba + alto - (v - lo) / (hi - lo) * alto; }

    ctx.font = '12px system-ui, sans-serif';
    ctx.textBaseline = 'middle';

    /* Rejilla y eje de precios */
    for (var i = 0; i <= 3; i++) {
      var v = lo + (hi - lo) * i / 3;
      var yy = y(v);
      ctx.strokeStyle = '#dbe4ec';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(izq, yy);
      ctx.lineTo(W - der, yy);
      ctx.stroke();
      ctx.fillStyle = '#4f5d6b';
      ctx.textAlign = 'right';
      ctx.fillText(num(v, 3), izq - 6, yy);
    }

    /* Área */
    var grad = ctx.createLinearGradient(0, arriba, 0, arriba + alto);
    grad.addColorStop(0, 'rgba(11,90,140,0.22)');
    grad.addColorStop(1, 'rgba(11,90,140,0.02)');
    ctx.beginPath();
    ctx.moveTo(x(0), y(precios[0]));
    for (var j = 1; j < serie.length; j++) ctx.lineTo(x(j), y(precios[j]));
    ctx.lineTo(x(serie.length - 1), arriba + alto);
    ctx.lineTo(x(0), arriba + alto);
    ctx.closePath();
    ctx.fillStyle = grad;
    ctx.fill();

    /* Línea */
    ctx.beginPath();
    ctx.moveTo(x(0), y(precios[0]));
    for (var k = 1; k < serie.length; k++) ctx.lineTo(x(k), y(precios[k]));
    ctx.strokeStyle = '#0b5a8c';
    ctx.lineWidth = 2;
    ctx.lineJoin = 'round';
    ctx.stroke();

    /* Puntos */
    cv._pts = serie.map(function (p, idx) {
      var px = x(idx), py = y(p.precio);
      ctx.beginPath();
      ctx.arc(px, py, 2.8, 0, Math.PI * 2);
      ctx.fillStyle = '#0b5a8c';
      ctx.fill();
      ctx.strokeStyle = '#fff';
      ctx.lineWidth = 1.5;
      ctx.stroke();
      return { x: px, y: py, fecha: p.fecha, precio: p.precio };
    });

    /* Etiquetas de fecha */
    var saltos = Math.min(4, serie.length);
    ctx.fillStyle = '#4f5d6b';
    ctx.textAlign = 'center';
    for (var m = 0; m < saltos; m++) {
      var idx2 = Math.round(m * (serie.length - 1) / Math.max(1, saltos - 1));
      var texto = serie[idx2].fecha.slice(0, 5);
      var px2 = Math.min(Math.max(x(idx2), izq + 16), W - der - 16);
      ctx.fillText(texto, px2, H - 10);
    }
  }

  function actualizarResumen() {
    if (!fichaActual) return;
    var serie = F.historico(fichaActual, S.fichaFuel, S.fichaDias);
    if (!serie.length) { $('#fichaResumen').innerHTML = ''; return; }
    var precios = serie.map(function (p) { return p.precio; });
    var mn = Math.min.apply(null, precios);
    var mx = Math.max.apply(null, precios);
    var media = precios.reduce(function (a, b) { return a + b; }, 0) / precios.length;
    var vari = (precios[precios.length - 1] - precios[0]) / precios[0] * 100;

    $('#fichaResumen').innerHTML =
      '<div><dt>Mínimo</dt><dd class="txt-verde">' + eur3(mn) + '</dd></div>' +
      '<div><dt>Máximo</dt><dd class="txt-rojo">' + eur3(mx) + '</dd></div>' +
      '<div><dt>Media</dt><dd>' + eur3(media) + '</dd></div>' +
      '<div><dt>Tendencia</dt><dd class="' + (vari <= 0 ? 'txt-verde' : 'txt-rojo') + '">' + pct(vari) + '</dd></div>' +
      '<div><dt>Actual</dt><dd>' + eur3(precios[precios.length - 1]) + '</dd></div>' +
      '<div><dt>Días</dt><dd>' + serie.length + '</dd></div>';
  }

  /* ---------------------------------------------------------------- config */
  function renderConfig() {
    renderDescuentos();
    renderCache();
    renderLog();
    renderClaves();
    $('#versionTexto').textContent = 'Versión instalada: ' + F.versionApp.texto + ' · build ' + F.versionApp.build;
    $('#versionChip').textContent = 'v' + F.versionApp.version;
    $('#cacheTtl').value = String(S.cacheTtl);
    $('#cfgPersistir').checked = S.persistir;
    $('#pageSizeCfg').value = String(S.pageSize);
    $('#pushOn').checked = S.pushOn;
    $('#pushIntervalo').value = String(S.pushIntervalo);
    $('#pushDias').value = String(S.pushDias);
  }

  function renderDescuentos() {
    var marcas = Object.keys(descuentos).sort(function (a, b) { return a.localeCompare(b, 'es'); });
    $('#descLista').innerHTML = marcas.map(function (m) {
      return '<div class="desc-fila">' +
        '<span class="desc-marca">' + esc(m) + '</span>' +
        '<input type="number" min="0" max="0.5" step="0.01" value="' + Number(descuentos[m]).toFixed(2) + '"' +
          ' data-desc="' + esc(m) + '" aria-label="Descuento de ' + esc(m) + ' en euros por litro">' +
        '<span class="pista">€/L</span>' +
      '</div>';
    }).join('');
  }

  function renderCache() {
    $$('.tab-cache').forEach(function (b) {
      var act = b.getAttribute('data-cache') === S.cacheTab;
      b.classList.toggle('activo', act);
      b.setAttribute('aria-selected', act ? 'true' : 'false');
    });
    $('#cacheIdb').hidden = S.cacheTab !== 'idb';
    $('#cacheLs').hidden = S.cacheTab !== 'ls';

    var info = F.cacheInfo;
    $('#cacheIdb').innerHTML = cacheVacia
      ? '<p class="pista">Caché vacía. Se volverá a llenar en cuanto consultes una provincia o el histórico.</p>'
      : '<div class="cache-fila"><span class="cache-clave">provincias</span><span class="cache-meta">' + info.provincias + ' guardadas</span></div>' +
        '<div class="cache-fila"><span class="cache-clave">gasolineras</span><span class="cache-meta">' + info.gasolineras + ' estaciones</span></div>' +
        '<div class="cache-fila"><span class="cache-clave">historico</span><span class="cache-meta">' + info.historicoDias + ' días</span></div>' +
        '<div class="cache-fila"><span class="cache-clave">' + esc(info.idb) + '</span><span class="cache-meta">' + esc(info.ultimaActualizacion) + '</span></div>';

    var claves = [];
    try { claves = Object.keys(localStorage).filter(function (k) { return k.indexOf(LS_PREFIJO) === 0; }).sort(); } catch (e) { claves = []; }
    $('#cacheLs').innerHTML = claves.length ? claves.map(function (k) {
      var tam = 0;
      try { tam = (localStorage.getItem(k) || '').length; } catch (e) { tam = 0; }
      return '<div class="cache-fila">' +
        '<span class="cache-clave">' + esc(k) + '</span>' +
        '<span class="cache-meta">' + (tam > 1023 ? num(tam / 1024, 1) + ' kB' : tam + ' B') + '</span>' +
        '<button type="button" class="btn-x" data-borrar-clave="' + esc(k) + '" aria-label="Borrar ' + esc(k) + '">✕</button>' +
      '</div>';
    }).join('') : '<p class="pista">Aún no hay claves guardadas. Cambia un filtro o envía un mensaje a la IA y aparecerán aquí.</p>';
  }

  function renderLog() {
    $$('.tab-log').forEach(function (b) {
      var act = b.getAttribute('data-log') === S.logTab;
      b.classList.toggle('activo', act);
      b.setAttribute('aria-selected', act ? 'true' : 'false');
    });
    var filas = logs[S.logTab] || [];
    $('#logCuerpo').innerHTML = filas.length ? filas.slice().reverse().map(function (r) {
      var mal = r.estado !== 200 && r.estado !== 'ok';
      return '<div class="log-fila">' +
        '<span class="log-hora">' + esc(r.t) + '</span>' +
        '<span class="log-url">' + esc(r.url) + '</span>' +
        '<span class="log-estado ' + (mal ? 'error' : 'ok') + '">' + esc(String(r.estado)) + '</span>' +
        '<span class="log-ms">' + esc(String(r.ms)) + ' ms</span>' +
      '</div>';
    }).join('') : '<p class="pista">Registro vacío.</p>';
  }

  function renderClaves() {
    var estado = $('#clavesEstado');
    var lista = $('#clavesLista');
    if (!estado.dataset.cargadas) {
      estado.textContent = 'Sin claves cargadas en esta sesión.';
      lista.innerHTML = '';
      return;
    }
    estado.textContent = '✓ Claves descifradas y listas (simulado).';
    lista.innerHTML = ['Groq', 'Mistral', 'OpenRouter', 'LLM7.io', 'Gemini'].map(function (n) {
      return '<div class="clave-fila"><span class="log-estado ok">✓</span><span>' + esc(n) + '</span><span class="pista">clave válida</span></div>';
    }).join('');
  }

  /* -------------------------------------------------------------- eventos */
  function enlazar() {
    /* Navegación, fichas y acciones genéricas */
    document.addEventListener('click', function (ev) {
      var t = ev.target;

      var nav = t.closest('[data-vista]');
      if (nav) { setVista(nav.getAttribute('data-vista')); return; }

      var shotVista = t.closest('[data-shot="vista"]');
      if (shotVista) { setVista('lista'); return; }

      var ficha = t.closest('[data-ficha]');
      if (ficha) {
        cerrarMarcas();
        abrirFicha(ficha.getAttribute('data-ficha'));
        return;
      }

      if (t.closest('#fichaCerrar') || t.closest('#velo')) { cerrarFicha(); return; }

      if (t.closest('#fichaFav')) {
        if (!fichaActual) return;
        if (favoritos[fichaActual]) {
          delete favoritos[fichaActual];
          toast('Quitada de favoritas');
        } else {
          favoritos[fichaActual] = true;
          toast('Añadida a favoritas');
        }
        actualizarFavBoton();
        guardarPronto();
        render();
        return;
      }

      if (t.closest('#fichaIr')) { toast('Ruta simulada: se abriría el mapa con la estación seleccionada'); return; }

      var paso = t.closest('[data-paso]');
      if (paso) {
        S.litros = Math.min(120, Math.max(5, S.litros + Number(paso.getAttribute('data-paso'))));
        $('#litros').value = String(S.litros);
        renderDecision();
        guardarPronto();
        return;
      }

      if (t.closest('#btnMarcas')) { alternarMarcas(); return; }
      if (t.closest('#marcaTodas')) { marcarTodas(true); return; }
      if (t.closest('#marcaNinguna')) { marcarTodas(false); return; }
      if (t.closest('#marcaAplicar')) {
        S.marcas = Object.keys(marcasPendientes).filter(function (m) { return marcasPendientes[m]; });
        S.pagina = 1;
        cerrarMarcas();
        render();
        guardarPronto();
        toast(S.marcas.length ? S.marcas.length + ' marcas seleccionadas' : 'Todas las marcas');
        return;
      }

      if (t.closest('#btnBuscar')) {
        var fila = $('#buscadorFila');
        fila.hidden = !fila.hidden;
        if (!fila.hidden) $('#buscar').focus();
        actualizarFiltros();
        return;
      }

      if (t.closest('#btnLimpiar')) { limpiarFiltros(); return; }
      if (t.closest('[data-accion="limpiar"]')) { limpiarFiltros(); return; }

      if (t.closest('#pagPrev')) { S.pagina = Math.max(1, S.pagina - 1); renderLista(); guardarPronto(); return; }
      if (t.closest('#pagNext')) {
        var paginas = S.pageSize > 0 ? Math.max(1, Math.ceil(ordenar(filtrar()).length / S.pageSize)) : 1;
        S.pagina = Math.min(paginas, S.pagina + 1);
        renderLista();
        guardarPronto();
        return;
      }

      var iaPill = t.closest('[data-iaprov]');
      if (iaPill) {
        cerrarFicha();
        S.iaProv = iaPill.getAttribute('data-iaprov');
        renderIA();
        guardarPronto();
        return;
      }

      var prompt = t.closest('[data-prompt]');
      if (prompt) {
        $('#iaInput').value = prompt.getAttribute('data-prompt');
        enviarIA(prompt.getAttribute('data-prompt'));
        return;
      }

      if (t.closest('#iaBorrar')) {
        iaCharla[S.iaProv] = [];
        try { localStorage.removeItem(LS_IA + S.iaProv); } catch (e) { /* nada */ }
        renderMensajesIA();
        renderCache();
        toast('Conversación borrada');
        return;
      }

      var tabCache = t.closest('.tab-cache');
      if (tabCache) { S.cacheTab = tabCache.getAttribute('data-cache'); renderCache(); guardarPronto(); return; }

      var tabLog = t.closest('.tab-log');
      if (tabLog) { S.logTab = tabLog.getAttribute('data-log'); renderLog(); guardarPronto(); return; }

      var borrarClave = t.closest('[data-borrar-clave]');
      if (borrarClave) {
        var clave = borrarClave.getAttribute('data-borrar-clave');
        try { localStorage.removeItem(clave); } catch (e) { /* nada */ }
        if (clave.indexOf(LS_IA) === 0) {
          var provBorrado = clave.slice(LS_IA.length);
          if (iaCharla[provBorrado]) iaCharla[provBorrado] = [];
          if (provBorrado === S.iaProv) renderMensajesIA();
        }
        renderCache();
        toast('Clave borrada');
        return;
      }

      if (t.closest('#btnDescReset')) {
        descuentos = {};
        Object.keys(F.descuentos).forEach(function (m) { descuentos[m] = F.descuentos[m]; });
        renderDescuentos();
        render();
        guardarPronto();
        toast('Descuentos restablecidos');
        return;
      }

      if (t.closest('#btnLimpiarCache')) {
        cacheVacia = true;
        renderCache();
        toast('Caché de IndexedDB vaciada: 0 provincias y 0 días de histórico');
        return;
      }

      if (t.closest('#btnLimpiarLog')) {
        logs[S.logTab] = [];
        renderLog();
        toast('Registro vaciado');
        return;
      }

      if (t.closest('#btnCargarClaves')) {
        var pass = $('#clavesPass').value;
        if (pass.length >= 6) {
          $('#clavesEstado').dataset.cargadas = '1';
          renderClaves();
          toast('Claves cargadas (simulado)');
        } else {
          delete $('#clavesEstado').dataset.cargadas;
          $('#clavesEstado').textContent = '❌ Contraseña incorrecta: se necesitan 6 caracteres.';
          $('#clavesLista').innerHTML = '';
        }
        return;
      }

      if (t.closest('#pushProbar')) { toast('Comprobación simulada: 1 bajada en 3 favoritas'); return; }
      if (t.closest('#btnActualizar')) { toast('Ya tienes la última versión: ' + F.versionApp.texto); return; }

      if (t.closest('#btnOlvidar')) {
        /* cancelar el guardado pendiente: si no, el timer reescribiría el
           estado justo después de borrarlo */
        listo = false;
        window.clearTimeout(temporizadorGuardado);
        borrarDatosGuardados();
        toast('Datos guardados borrados. Recargando de cero…');
        window.setTimeout(function () { window.location.reload(); }, 700);
        return;
      }

      /* Clic fuera del desplegable de marcas */
      if ($('#marcasPop').hidden === false && !t.closest('#marcasPop')) cerrarMarcas();
    });

    document.addEventListener('change', function (ev) {
      var t = ev.target;

      if (t.id === 'selProv') {
        S.prov = t.value;
        S.loc = '';
        S.pagina = 1;
        pintarLocalidades();
        render();
        guardarPronto();
        return;
      }
      if (t.id === 'selFuel') { S.fuel = t.value; S.pagina = 1; render(); guardarPronto(); return; }
      if (t.id === 'selLocalidad') { S.loc = t.value; S.pagina = 1; render(); guardarPronto(); return; }
      if (t.id === 'ordenSel') { S.orden = t.value; S.pagina = 1; renderLista(); guardarPronto(); return; }
      if (t.id === 'pageSizeSel' || t.id === 'pageSizeCfg') {
        S.pageSize = Number(t.value);
        S.pagina = 1;
        $('#pageSizeSel').value = String(S.pageSize);
        $('#pageSizeCfg').value = String(S.pageSize);
        if (S.vista === 'lista') renderLista();
        guardarPronto();
        return;
      }
      if (t.id === 'chkFav') { S.soloFav = t.checked; S.pagina = 1; render(); guardarPronto(); return; }
      if (t.id === 'idaVuelta') { S.idaVuelta = t.checked; render(); guardarPronto(); return; }
      if (t.id === 'mapaEstilo') { S.mapaEstilo = t.value; renderMapa(); guardarPronto(); return; }
      if (t.id === 'fichaFuel') { S.fichaFuel = t.value; dibujarGrafica(); actualizarResumen(); guardarPronto(); return; }
      if (t.id === 'fichaDias') { S.fichaDias = Number(t.value); dibujarGrafica(); actualizarResumen(); guardarPronto(); return; }
      if (t.id === 'cfgPersistir') {
        S.persistir = t.checked;
        if (S.persistir) { guardarPronto(); toast('Se guardarán tus ajustes'); }
        else {
          borrarDatosGuardados();
          toast('Persistencia desactivada');
        }
        return;
      }
      if (t.id === 'cacheTtl') { S.cacheTtl = Math.min(72, Math.max(1, Number(t.value) || 12)); guardarPronto(); return; }
      if (t.id === 'pushOn') { S.pushOn = t.checked; guardarPronto(); toast(t.checked ? 'Avisos activados' : 'Avisos desactivados'); return; }
      if (t.id === 'pushIntervalo') { S.pushIntervalo = Number(t.value); guardarPronto(); return; }
      if (t.id === 'pushDias') { S.pushDias = Number(t.value); guardarPronto(); return; }

      if (t.matches('[data-marca]')) {
        marcasPendientes[t.getAttribute('data-marca')] = t.checked;
        return;
      }
    });

    document.addEventListener('input', function (ev) {
      var t = ev.target;

      if (t.id === 'buscar') {
        S.texto = t.value;
        S.pagina = 1;
        render();
        guardarPronto();
        return;
      }
      if (t.id === 'litros') {
        S.litros = Math.min(120, Math.max(5, Number(t.value) || 5));
        renderDecision();
        guardarPronto();
        return;
      }
      if (t.id === 'consumo') {
        S.consumo = Math.min(15, Math.max(3, Number(t.value) || 6.5));
        renderDecision();
        guardarPronto();
        return;
      }
      if (t.id === 'radio') {
        S.radio = Number(t.value) || 0;
        actualizarRadioTexto();
        actualizarFiltros();
        render();
        guardarPronto();
        return;
      }
      if (t.matches('[data-desc]')) {
        var marca = t.getAttribute('data-desc');
        var v = Number(t.value);
        descuentos[marca] = isFinite(v) && v >= 0 && v < 1 ? Math.round(v * 1000) / 1000 : 0;
        render();
        guardarPronto();
        return;
      }
    });

    document.addEventListener('submit', function (ev) {
      if (ev.target.id !== 'iaForm') return;
      ev.preventDefault();
      enviarIA($('#iaInput').value);
    });

    document.addEventListener('keydown', function (ev) {
      if (ev.key === 'Escape') {
        if (!$('#marcasPop').hidden) { cerrarMarcas(); return; }
        if (!$('#ficha').hidden) { cerrarFicha(); return; }
      }
      if (ev.key === '/' && document.activeElement !== $('#buscar') && document.activeElement !== $('#iaInput') &&
        document.activeElement.tagName !== 'INPUT' && document.activeElement.tagName !== 'SELECT') {
        ev.preventDefault();
        if ($('#buscadorFila').hidden) $('#buscadorFila').hidden = false;
        $('#buscar').focus();
      }
    });

    /* Tooltip de la gráfica */
    var cv = $('#grafica');
    cv.addEventListener('pointermove', function (ev) {
      var pts = cv._pts || [];
      if (!pts.length) return;
      var r = cv.getBoundingClientRect();
      var x = ev.clientX - r.left;
      var mejor = null;
      var dist = 1e9;
      pts.forEach(function (p) {
        var d = Math.abs(p.x - x);
        if (d < dist) { dist = d; mejor = p; }
      });
      var tip = $('#graficaTip');
      if (!mejor || dist > 34) { tip.hidden = true; return; }
      /* el tooltip vive en .grafica-caja, no en el canvas: hay que sumar el
         desplazamiento del canvas (padding del marco) */
      var offX = cv.offsetLeft;
      var offY = cv.offsetTop;
      tip.hidden = false;
      tip.innerHTML = '<b>' + eur3(mejor.precio) + '</b><span>' + esc(mejor.fecha) + '</span>';
      tip.style.left = Math.min(Math.max(mejor.x + offX, 62), r.width + offX - 62) + 'px';
      tip.style.top = Math.max(mejor.y + offY - 8, 46) + 'px';
    });
    cv.addEventListener('pointerleave', function () { $('#graficaTip').hidden = true; });

    window.addEventListener('resize', function () {
      if (fichaActual) { dibujarGrafica(); actualizarResumen(); }
    });
  }

  function alternarMarcas() {
    var pop = $('#marcasPop');
    if (!pop.hidden) { cerrarMarcas(); return; }
    marcasPendientes = {};
    S.marcas.forEach(function (m) { marcasPendientes[m] = true; });
    var marcas = F.marcasDe(S.prov);
    $('#marcasLista').innerHTML = marcas.map(function (m) {
      var n = estacionesProv().filter(function (e) { return e.marca === m && e.precios[S.fuel] != null; }).length;
      return '<label class="marca-item">' +
        '<input type="checkbox" data-marca="' + esc(m) + '"' + (marcasPendientes[m] ? ' checked' : '') + '>' +
        '<span class="caja" aria-hidden="true"></span>' +
        '<span>' + esc(m) + '</span>' +
        '<span class="pista">' + n + '</span>' +
      '</label>';
    }).join('');
    $('#marcasPista').textContent = marcas.length + ' marcas';
    pop.hidden = false;
    $('#btnMarcas').setAttribute('aria-expanded', 'true');
  }

  function cerrarMarcas() {
    $('#marcasPop').hidden = true;
    $('#btnMarcas').setAttribute('aria-expanded', 'false');
  }

  function marcarTodas(valor) {
    $$('#marcasLista [data-marca]').forEach(function (c) {
      c.checked = valor;
      marcasPendientes[c.getAttribute('data-marca')] = valor;
    });
  }

  function limpiarFiltros() {
    S.loc = '';
    S.marcas = [];
    S.texto = '';
    S.soloFav = false;
    S.radio = 0;
    S.pagina = 1;
    $('#buscar').value = '';
    $('#chkFav').checked = false;
    $('#radio').value = '0';
    $('#buscadorFila').hidden = true;
    actualizarRadioTexto();
    pintarLocalidades();
    render();
    guardarPronto();
    toast('Filtros quitados');
  }

  /* ----------------------------------------------------------------- inicio */
  function iniciar() {
    cargarChats();
    cargarEstado();
    pintarSelects();
    pintarMapaSvg();
    pintarPrompts();
    enlazar();
    /* si el texto venía restaurado, la fila de búsqueda debe estar abierta */
    if (S.texto) $('#buscadorFila').hidden = false;
    setVista(S.vista, true);
    render();
    listo = true;
    /* No se guarda en el arranque: la primera escritura la provoca un cambio
       real del usuario. Así «Borrar datos guardados» deja localStorage limpio
       hasta que vuelvas a tocar algo. */
  }

  iniciar();
})();
