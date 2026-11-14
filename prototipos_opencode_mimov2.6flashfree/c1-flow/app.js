/* ============================================================
   C1 · Card Flow — lógica del prototipo
   ============================================================ */
(function () {
  'use strict';
  UI.aplicarPreviewMovil();

  var P = window.PETROL;
  var combustibleSel = 'g95';
  var vistaSel = 'lista';
  var ordenDir = 'asc';
  var estacionSel = null;

  // ---------- Topbar: provincia fake ----------
  document.getElementById('provBtn').addEventListener('click', function () {
    UI.toast('Aquí se abriría el selector de provincia');
  });
  document.getElementById('pushBtn').addEventListener('click', function () {
    UI.toast('🔔 Avisos activos: te avisamos si baja el precio de tus favoritas');
  });
  document.getElementById('themeBtn').addEventListener('click', function () {
    UI.toast('Estilo de mapa: satélite (simulado en el prototipo)');
  });
  document.getElementById('searchPill').addEventListener('click', function () {
    UI.toast('🔍 Buscador (simulado)');
  });

  // ---------- Chips de combustible ----------
  var chipsEl = document.getElementById('fuelChips');
  P.COMBUSTIBLES.forEach(function (c) {
    if (!c.activo) return;
    var b = document.createElement('button');
    b.className = 'chip' + (c.id === combustibleSel ? ' active' : '');
    b.textContent = c.grupo === 'Gasolina' ? '⛽ ' + c.corto : '🛢 ' + c.corto;
    b.title = c.nombre;
    b.addEventListener('click', function () {
      combustibleSel = c.id;
      chipsEl.querySelectorAll('.chip').forEach(function (x) { x.classList.remove('active'); });
      b.classList.add('active');
      pintarTodo();
    });
    chipsEl.appendChild(b);
  });

  // ---------- Preparar estaciones con precio/color según combustible ----------
  function preparadas() {
    var vals = P.ESTACIONES.map(function (e) { return e.precios[combustibleSel]; }).filter(function (v) { return v != null; });
    var min = Math.min.apply(null, vals), max = Math.max.apply(null, vals);
    return P.ESTACIONES
      .filter(function (e) { return e.precios[combustibleSel] != null; })
      .map(function (e) {
        return Object.assign({}, e, {
          _pvp: e.precios[combustibleSel],
          _color: UI.colorPrecio(e.precios[combustibleSel], min, max),
          _fav: P.FAVORITAS.indexOf(e.id) >= 0
        });
      })
      .sort(function (a, b) { return ordenDir === 'asc' ? a._pvp - b._pvp : b._pvp - a._pvp; });
  }

  // ---------- Tarjeta de estación ----------
  function tarjetaHTML(e, i) {
    var svc = e.servicios.slice(0, 3).map(function (s) {
      var t = { '24h': '24 h', autoservicio: 'Autoserv.', lavado: 'Lavado', cajero: 'Cajero', tienda: 'Tienda', aire: 'Aire' }[s] || s;
      return '<span class="tag-svc' + (s === '24h' ? ' h24' : '') + '">' + t + '</span>';
    }).join('');
    return '<div class="card-st' + (i === 0 && ordenDir === 'asc' ? ' cheap' : '') + '" data-id="' + e.id + '">' +
      UI.badgeMarca(e.marca, 38) +
      '<div class="card-info">' +
      '<div class="card-name">' + e.rotulo + (e._fav ? ' <span class="star">★</span>' : '') + (i === 0 && ordenDir === 'asc' ? ' <span class="chip-barata">más barata</span>' : '') + '</div>' +
      '<div class="card-addr">' + e.dir + ' · ' + e.loc + '</div>' +
      '<div class="card-tags">' + svc + '</div>' +
      '</div>' +
      '<div class="card-price">' +
      '<div class="price-big" style="color:' + e._color + '"><span class="sem-dot" style="background:' + e._color + '"></span>' + UI.fmtPrecio(e._pvp) + '</div>' +
      '<div class="price-unit">' + nombreCombustible() + '</div>' +
      '<div class="price-dist">' + UI.fmtDist(e.dist) + '</div>' +
      '</div></div>';
  }
  function nombreCombustible() {
    var c = P.COMBUSTIBLES.find(function (x) { return x.id === combustibleSel; });
    return c ? c.nombre : '';
  }

  function pintarCards() {
    var lista = preparadas();
    document.getElementById('cards').innerHTML = lista.map(tarjetaHTML).join('');
    document.getElementById('listSub').textContent = lista.length + ' estaciones · ' + nombreCombustible() + ' · hace 12 min';
    document.querySelectorAll('#cards .card-st').forEach(function (c) {
      c.addEventListener('click', function () { abrirSheet(c.dataset.id); });
    });
  }

  function pintarFavs() {
    var favs = preparadas().filter(function (e) { return e._fav; });
    var wrap = document.getElementById('favCards');
    document.getElementById('favEmpty').style.display = favs.length ? 'none' : 'block';
    wrap.innerHTML = favs.map(function (e, i) { return tarjetaHTML(e, i); }).join('');
    wrap.querySelectorAll('.card-st').forEach(function (c) {
      c.addEventListener('click', function () { abrirSheet(c.dataset.id); });
    });
  }

  function pintarMapa() {
    var holder = document.getElementById('mapHolder');
    UI.mapaFake(holder, preparadas(), {
      estilo: 'claro',
      yo: { x: 48, y: 50 },
      onClick: function (id) { abrirSheet(id); }
    });
  }

  function pintarTodo() {
    pintarCards(); pintarFavs(); pintarMapa();
  }

  // ---------- Orden ----------
  document.getElementById('sortBtn').addEventListener('click', function () {
    ordenDir = ordenDir === 'asc' ? 'desc' : 'asc';
    this.textContent = 'Precio ' + (ordenDir === 'asc' ? '▲' : '▼');
    pintarCards();
  });

  // ---------- Bottom sheet ----------
  var sheet = document.getElementById('sheet');
  var backdrop = document.getElementById('sheetBackdrop');

  function abrirSheet(id) {
    estacionSel = id;
    var e = preparadas().find(function (x) { return x.id === id; });
    if (!e) return;
    var fav = e._fav;
    var serie = P.historico(P.estacion(id), combustibleSel);
    var var7 = serie.length > 7 ? Math.round((serie[serie.length - 1].precio - serie[serie.length - 8].precio) * 1000) / 1000 : 0;

    var fuels = Object.keys(e.precios).map(function (k) {
      var c = P.COMBUSTIBLES.find(function (x) { return x.id === k; });
      if (!c) return '';
      return '<div class="fuel-cell"><div class="fn">' + c.nombre + '</div><div class="fp">' + UI.fmtPrecio(e.precios[k]) + '</div></div>';
    }).join('');

    document.getElementById('sheetBody').innerHTML =
      '<div class="det-head">' + UI.badgeMarca(e.marca, 46) +
      '<div><h3 class="det-name">' + e.rotulo + '</h3><p class="det-addr">' + e.dir + ' · ' + e.loc + ' (' + e.cp + ')</p></div></div>' +
      '<div class="det-price-hero"><span class="big" style="color:' + e._color + '">' + UI.fmtPrecio(e._pvp) + '</span><span class="unit">' + nombreCombustible() + ' · ' + UI.fmtDist(e.dist) + '</span></div>' +
      '<div class="det-sect"><h4>Evolución 30 días (var. 7d: ' + (var7 >= 0 ? '+' : '−') + Math.abs(var7 * 100).toFixed(1).replace('.', ',') + ' ¢)</h4>' +
      '<div class="chart-box">' + UI.grafica(serie, { color: e._color }) + '</div></div>' +
      '<div class="det-sect"><h4>Todos los combustibles</h4><div class="fuel-grid">' + fuels + '</div></div>' +
      '<div class="det-sect"><h4>Servicios</h4><div class="card-tags">' + e.servicios.map(function (s) { return '<span class="tag-svc">' + s + '</span>'; }).join('') + '<span class="tag-svc">🕒 ' + e.horario + '</span></div></div>' +
      '<div class="det-actions">' +
      '<button class="' + (fav ? 'faved' : '') + '" id="detFav">' + (fav ? '★ Guardada' : '☆ Guardar') + '</button>' +
      '<button class="primary" id="detRoute">🧭 Cómo llegar</button>' +
      '</div>';

    document.getElementById('detFav').addEventListener('click', function () {
      UI.toast(fav ? '★ Estrella quitada (simulado)' : '★ Añadida a favoritas · te avisaremos si baja');
      this.classList.toggle('faved');
      this.innerHTML = this.classList.contains('faved') ? '★ Guardada' : '☆ Guardar';
    });
    document.getElementById('detRoute').addEventListener('click', function () { UI.toast('Abriendo app de navegación…'); });

    sheet.dataset.snap = 'half';
    backdrop.classList.add('show');
    marcarPinSel(id);
  }

  function cerrarSheet() {
    sheet.dataset.snap = 'none';
    backdrop.classList.remove('show');
    estacionSel = null;
    marcarPinSel(null);
  }
  function marcarPinSel(id) {
    document.querySelectorAll('.mf-pin').forEach(function (p) {
      p.classList.toggle('sel', p.dataset.id === id);
    });
  }

  document.getElementById('sheetClose').addEventListener('click', cerrarSheet);
  backdrop.addEventListener('click', cerrarSheet);

  // Snap al arrastrar el grabber (y el cuerpo)
  (function () {
    var grab = document.getElementById('sheetGrab');
    var startY = 0, startSnap = 'none', arrastrando = false;
    var ORDEN = ['none', 'peek', 'half', 'full'];
    function down(y) { startY = y; startSnap = sheet.dataset.snap; arrastrando = true; sheet.style.transition = 'none'; }
    function move(y) {
      if (!arrastrando) return;
      var dy = y - startY;
      var i = ORDEN.indexOf(startSnap);
      if (dy < -40 && i < ORDEN.length - 1) { sheet.dataset.snap = ORDEN[i + 1]; startY = y; }
      else if (dy > 40 && i > 0) { sheet.dataset.snap = ORDEN[i - 1]; startY = y; if (sheet.dataset.snap === 'none') cerrarSheet(); }
    }
    function up() { arrastrando = false; sheet.style.transition = ''; }
    grab.addEventListener('touchstart', function (e) { down(e.touches[0].clientY); }, { passive: true });
    grab.addEventListener('touchmove', function (e) { move(e.touches[0].clientY); }, { passive: true });
    grab.addEventListener('touchend', up);
    grab.addEventListener('mousedown', function (e) { down(e.clientY); e.preventDefault(); });
    window.addEventListener('mousemove', function (e) { move(e.clientY); });
    window.addEventListener('mouseup', up);
  })();

  // ---------- Navegación ----------
  function irA(vista) {
    vistaSel = vista;
    document.querySelectorAll('.bn-item').forEach(function (b) { b.classList.toggle('active', b.dataset.view === vista); });
    document.querySelectorAll('.view').forEach(function (v) { v.classList.toggle('active', v.id === 'v-' + vista); });
    document.getElementById('app').className = 'app show-' + vista;
    if (vista === 'ia') scrollIa();
  }
  document.querySelectorAll('.bn-item').forEach(function (b) {
    b.addEventListener('click', function () { irA(b.dataset.view); });
  });
  document.getElementById('mapToList').addEventListener('click', function () { irA('lista'); });

  // ---------- IA fake ----------
  var PROMPTS = ['¿Dónde está la 95 más barata?', '¿Bajará el precio?', 'Mejor gasóleo A cerca', 'Compara Repsol y Cepsa'];
  var chipsIa = document.getElementById('iaChips');
  PROMPTS.forEach(function (t) {
    var b = document.createElement('button');
    b.className = 'ia-chip'; b.textContent = t;
    b.addEventListener('click', function () { document.getElementById('iaInput').value = t; enviarIa(); });
    chipsIa.appendChild(b);
  });

  function burbuja(rol, txt, meta) {
    var d = document.createElement('div');
    d.className = 'ia-bub ' + rol;
    d.innerHTML = txt + (meta ? '<span class="meta">' + meta + '</span>' : '');
    document.getElementById('iaMsgs').appendChild(d);
    scrollIa();
    return d;
  }
  function scrollIa() {
    var m = document.getElementById('iaMsgs');
    if (m) m.scrollTop = m.scrollHeight;
  }
  function enviarIa() {
    var inp = document.getElementById('iaInput');
    var t = inp.value.trim();
    if (!t) return;
    burbuja('user', t.replace(/</g, '&lt;'));
    inp.value = '';
    var loading = burbuja('ia', 'Pensando…');
    setTimeout(function () {
      loading.innerHTML = 'La gasolina 95 más barata hoy es <strong>E.Leclerc Las Rozas</strong> (1,439 €/L), seguida de Carrefour Pozuelo (1,442 €).<span class="meta">⏱ qwen3.8-27b · 1,1 s (fake)</span>';
      scrollIa();
    }, 900);
  }
  document.getElementById('iaSend').addEventListener('click', enviarIa);
  document.getElementById('iaInput').addEventListener('keydown', function (e) { if (e.key === 'Enter') enviarIa(); });
  burbuja('ia', 'Hola 👋 Pregúntame por precios, tendencias o la estación más barata cerca de ti.');

  // ---------- Ajustes fake ----------
  var settings = document.getElementById('settings');
  settings.innerHTML =
    '<div class="set-card"><h3>🔔 Notificaciones</h3>' +
    fila('Avisos de bajada', 'Te avisamos cuando baje el precio de una favorita', '<label class="switch"><input type="checkbox" checked><span class="track"></span></label>') +
    fila('Avisos de subida', 'También si el precio sube por encima de tu límite', '<label class="switch"><input type="checkbox"><span class="track"></span></label>') +
    fila('Intervalo de chequeo', 'Cada cuánto comprueba precios en segundo plano', '<input class="set-input" type="number" value="8">') +
    '</div>' +
    '<div class="set-card"><h3>⛽ Descuentos por marca</h3>' +
    fila('Repsol', 'Tarjeta fidelización · ¢/litro', '<input class="set-input" type="number" value="6">') +
    fila('Cepsa', 'Tarjeta fidelización · ¢/litro', '<input class="set-input" type="number" value="4">') +
    fila('E.Leclerc', 'Tarjeta fidelización · ¢/litro', '<input class="set-input" type="number" value="8">') +
    '</div>' +
    '<div class="set-card"><h3>🤖 Asistente IA</h3>' +
    fila('Proveedor', 'Modelo que responde a tus preguntas', '<span style="font-size:.74rem;color:var(--acento);font-weight:700">Groq · Qwen 3.8</span>') +
    fila('Contexto automático', 'Incluye tus estaciones y favoritas en las preguntas', '<label class="switch"><input type="checkbox" checked><span class="track"></span></label>') +
    '</div>' +
    '<div class="set-card"><h3>💾 Caché y datos</h3>' +
    fila('Datos cacheados', '12 provincias · 4,2 MB', '<button style="border:1px solid var(--borde);background:var(--tarjeta);border-radius:8px;padding:5px 10px;font-size:.72rem;cursor:pointer">Limpiar</button>') +
    fila('Versión', 'Prototipo de rediseño', '<span style="font-size:.72rem;color:var(--texto-2)">2026.10</span>') +
    '</div>';

  function fila(lbl, hint, ctrl) {
    return '<div class="set-row"><div><span class="lbl">' + lbl + '</span><span class="hint">' + hint + '</span></div>' + ctrl + '</div>';
  }

  // ---------- Arranque ----------
  document.getElementById('app').className = 'app show-lista';
  pintarTodo();
})();
