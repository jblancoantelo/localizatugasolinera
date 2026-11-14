/* ============================================================
   C2 · Atlas — lógica
   ============================================================ */
(function () {
  'use strict';
  UI.aplicarPreviewMovil();
  var P = window.PETROL;
  var combSel = 'g95';
  var soloFavs = false;
  var ordenDir = 'asc';

  // ---- chips combustible flotantes ----
  var flotFiltros = document.getElementById('flotFiltros');
  P.COMBUSTIBLES.forEach(function (c) {
    if (!c.activo) return;
    var b = document.createElement('button');
    b.className = 'flot-chip' + (c.id === combSel ? ' active' : '');
    b.textContent = c.corto; b.title = c.nombre;
    b.addEventListener('click', function () {
      combSel = c.id;
      flotFiltros.querySelectorAll('.flot-chip').forEach(function (x) { x.classList.remove('active'); });
      b.classList.add('active');
      pintar();
    });
    flotFiltros.appendChild(b);
  });

  // ---- datos preparados ----
  function lista() {
    var vals = P.ESTACIONES.map(function (e) { return e.precios[combSel]; }).filter(function (v) { return v != null; });
    var min = Math.min.apply(null, vals), max = Math.max.apply(null, vals);
    var l = P.ESTACIONES
      .filter(function (e) { return e.precios[combSel] != null; })
      .filter(function (e) { return !soloFavs || P.FAVORITAS.indexOf(e.id) >= 0; })
      .map(function (e) {
        return Object.assign({}, e, {
          _pvp: e.precios[combSel], _min: min, _max: max,
          _color: UI.colorPrecio(e.precios[combSel], min, max),
          _fav: P.FAVORITAS.indexOf(e.id) >= 0
        });
      })
      .sort(function (a, b) { return ordenDir === 'asc' ? a._pvp - b._pvp : b._pvp - a._pvp; });
    return l;
  }
  function nomComb() { var c = P.COMBUSTIBLES.find(function (x) { return x.id === combSel; }); return c ? c.nombre : ''; }

  // ---- mapa ----
  function pintarMapa() {
    UI.mapaFake(document.getElementById('mapFull'), lista(), {
      estilo: 'satelite', yo: { x: 50, y: 52 },
      onClick: function (id) { abrirFicha(id); }
    });
  }

  // ---- lista dentro del sheet ----
  function filaHTML(e) {
    var pct = ((e._max - e._pvp) / (e._max - e._min) * 100).toFixed(0);
    return '<div class="fila-st" data-id="' + e.id + '">' +
      UI.badgeMarca(e.marca, 36) +
      '<div class="fila-info"><div class="fila-name">' + e.rotulo + (e._fav ? ' <span class="star">★</span>' : '') + '</div>' +
      '<div class="fila-addr">' + e.dir + ' · ' + e.loc + '</div></div>' +
      '<div class="fila-right"><div class="fila-price" style="color:' + e._color + '">' + UI.fmtPrecio(e._pvp) + '</div>' +
      '<div class="fila-dist">' + UI.fmtDist(e.dist) + '</div>' +
      '<div class="barra"><i style="width:' + Math.max(8, pct) + '%;background:' + e._color + '"></i></div></div></div>';
  }

  function pintarLista() {
    var l = lista();
    document.getElementById('bsList').innerHTML = l.map(filaHTML).join('');
    var favs = l.filter(function (e) { return e._fav; });
    document.getElementById('bsFavList').innerHTML = favs.length ? favs.map(filaHTML).join('') : '<div class="empty">Sin favoritas todavía. Pulsa ★ en una estación.</div>';
    // resumen
    var min = Math.min.apply(null, l.map(function (e) { return e._pvp; }));
    var max = Math.max.apply(null, l.map(function (e) { return e._pvp; }));
    document.getElementById('bsTitle').textContent = l.length + ' estaciones cerca';
    document.getElementById('bsSub').textContent = nomComb() + ' · Madrid' + (soloFavs ? ' · solo favoritas' : '');
    document.getElementById('bsRange').textContent = UI.fmtPrecio(min) + ' – ' + UI.fmtPrecio(max);
    // bind filas
    document.querySelectorAll('.fila-st').forEach(function (f) {
      f.addEventListener('click', function () { abrirFicha(f.dataset.id); });
    });
  }

  // ---- ficha estación ----
  var ficha = document.getElementById('ficha');
  function abrirFicha(id) {
    var e = lista().find(function (x) { return x.id === id; }) || (function () {
      var raw = P.estacion(id);
      var vals = P.ESTACIONES.map(function (x) { return x.precios[combSel]; }).filter(function (v) { return v != null; });
      var mn = Math.min.apply(null, vals), mx = Math.max.apply(null, vals);
      return Object.assign({}, raw, { _pvp: raw.precios[combSel], _color: UI.colorPrecio(raw.precios[combSel], mn, mx), _fav: P.FAVORITAS.indexOf(id) >= 0 });
    })();
    if (!e || e._pvp == null) return;
    var serie = P.historico(P.estacion(id), combSel);
    var fuels = Object.keys(e.precios).map(function (k) {
      var c = P.COMBUSTIBLES.find(function (x) { return x.id === k; });
      return c ? '<div class="fuel-cell"><div class="fn">' + c.nombre + '</div><div class="fp">' + UI.fmtPrecio(e.precios[k]) + '</div></div>' : '';
    }).join('');
    document.getElementById('fichaBody').innerHTML =
      '<div class="fh-head">' + UI.badgeMarca(e.marca, 48) +
      '<div><h3 class="fh-name">' + e.rotulo + '</h3><p class="fh-addr">' + e.dir + ' · ' + e.loc + '</p></div></div>' +
      '<div class="fh-hero"><span class="big" style="color:' + e._color + '">' + UI.fmtPrecio(e._pvp) + '</span><span class="unit">' + nomComb() + ' · ' + UI.fmtDist(e.dist) + ' · ' + e.horario + '</span></div>' +
      '<div class="fh-sect"><h4>Evolución 30 días</h4><div class="chart-box">' + UI.grafica(serie, { color: e._color }) + '</div></div>' +
      '<div class="fh-sect"><h4>Combustibles</h4><div class="fuel-grid">' + fuels + '</div></div>' +
      '<div class="fh-actions"><button id="fhFav">' + (e._fav ? '★ Guardada' : '☆ Guardar') + '</button><button class="primary">🧭 Cómo llegar</button></div>';
    document.getElementById('fhFav').addEventListener('click', function () { UI.toast('Favorita alternada (fake)'); this.textContent = '★ Guardada'; });
    document.querySelectorAll('.fh-actions .primary').forEach(function (b) { b.addEventListener('click', function () { UI.toast('Abriendo navegación…'); }); });
    ficha.classList.add('show');
    // marcar pin
    document.querySelectorAll('.mf-pin').forEach(function (p) { p.classList.toggle('sel', p.dataset.id === id); });
  }
  document.getElementById('fichaClose').addEventListener('click', function () { ficha.classList.remove('show'); });

  // ---- sheet drag snaps ----
  var bsheet = document.getElementById('bsheet');
  var SNAPS = ['peek', 'mid', 'full'];
  (function () {
    var startY = 0, startSnap = 'peek', drag = false;
    var grabEls = [document.getElementById('bsGrab'), document.getElementById('bsSummary')];
    grabEls.forEach(function (g) {
      g.addEventListener('touchstart', function (e) { startY = e.touches[0].clientY; startSnap = bsheet.dataset.snap; drag = true; bsheet.style.transition = 'none'; }, { passive: true });
      g.addEventListener('touchmove', function (e) {
        if (!drag) return;
        var dy = e.touches[0].clientY - startY, i = SNAPS.indexOf(startSnap);
        if (dy < -40 && i < SNAPS.length - 1) { bsheet.dataset.snap = SNAPS[i + 1]; startY = e.touches[0].clientY; }
        else if (dy > 40 && i > 0) { bsheet.dataset.snap = SNAPS[i - 1]; startY = e.touches[0].clientY; }
      }, { passive: true });
      g.addEventListener('touchend', function () { drag = false; bsheet.style.transition = ''; });
      g.addEventListener('mousedown', function (e) { startY = e.clientY; startSnap = bsheet.dataset.snap; drag = true; bsheet.style.transition = 'none'; e.preventDefault(); });
    });
    window.addEventListener('mousemove', function (e) {
      if (!drag) return;
      var dy = e.clientY - startY, i = SNAPS.indexOf(startSnap);
      if (dy < -40 && i < SNAPS.length - 1) { bsheet.dataset.snap = SNAPS[i + 1]; startY = e.clientY; }
      else if (dy > 40 && i > 0) { bsheet.dataset.snap = SNAPS[i - 1]; startY = e.clientY; }
    });
    window.addEventListener('mouseup', function () { drag = false; bsheet.style.transition = ''; });
  })();
  // tocar el grabber alterna peek <-> full
  document.getElementById('bsGrab').addEventListener('click', function () {
    bsheet.dataset.snap = bsheet.dataset.snap === 'full' ? 'peek' : 'full';
  });

  // ---- tabs del sheet ----
  document.querySelectorAll('.bs-tab').forEach(function (t) {
    t.addEventListener('click', function () {
      document.querySelectorAll('.bs-tab').forEach(function (x) { x.classList.remove('active'); });
      document.querySelectorAll('.bs-pane').forEach(function (x) { x.classList.remove('active'); });
      t.classList.add('active');
      document.getElementById('bp-' + t.dataset.bstab).classList.add('active');
      if (t.dataset.bstab === 'filtros') pintarFiltros();
    });
  });

  // ---- filtros fake ----
  function pintarFiltros() {
    var marcas = P.MARCAS.slice(0, 6);
    document.getElementById('bsFiltros').innerHTML =
      '<div class="fgroup"><h4>Provincia</h4><div class="opts">' + P.PROVINCIAS.slice(0, 5).map(function (p, i) { return '<button class="f-opt' + (i === 0 ? ' on' : '') + '">' + p.nombre + '</button>'; }).join('') + '</div></div>' +
      '<div class="fgroup"><h4>Marcas</h4><div class="opts">' + marcas.map(function (m) { return '<button class="f-opt">' + m.nombre + '</button>'; }).join('') + '</div></div>' +
      '<div class="fgroup"><h4>Solo favoritas</h4><div class="opts"><button class="f-opt' + (soloFavs ? ' on' : '') + '" id="optFavs">★ Favoritas</button></div></div>' +
      '<div class="fgroup"><h4>Distancia máx.</h4><div class="opts">' + ['1', '5', '10', '25', '50'].map(function (k) { return '<button class="f-opt">' + k + ' km</button>'; }).join('') + '</div></div>';
    document.querySelectorAll('#bsFiltros .f-opt').forEach(function (o) {
      o.addEventListener('click', function () {
        if (o.id === 'optFavs') { soloFavs = !soloFavs; o.classList.toggle('on', soloFavs); document.getElementById('favBtn').classList.toggle('on', soloFavs); pintar(); return; }
        o.classList.toggle('on');
        UI.toast('Filtro aplicado (fake)');
      });
    });
  }

  // ---- flot-acts ----
  document.getElementById('geolocBtn').addEventListener('click', function () { UI.toast('📍 Centrando en tu ubicación…'); });
  document.getElementById('favBtn').addEventListener('click', function () { soloFavs = !soloFavs; this.classList.toggle('on', soloFavs); pintar(); });
  document.getElementById('styleBtn').addEventListener('click', function () { UI.toast('Estilo de mapa: satélite (fake)'); });
  document.getElementById('locBtn').addEventListener('click', function () { UI.toast('Selector de provincia (fake)'); });
  document.getElementById('searchBtn').addEventListener('click', function () { UI.toast('🔍 Buscador (fake)'); });

  // ---- IA overlay ----
  var iao = document.getElementById('iaOverlay');
  document.getElementById('aiBtn').addEventListener('click', function () { iao.classList.add('show'); scrollIa(); });
  document.getElementById('iaoClose').addEventListener('click', function () { iao.classList.remove('show'); });
  function scrollIa() { var m = document.getElementById('iaoMsgs'); if (m) m.scrollTop = m.scrollHeight; }
  function burbuja(rol, txt, meta) {
    var d = document.createElement('div'); d.className = 'iao-bub ' + rol;
    d.innerHTML = txt + (meta ? '<span class="meta" style="display:block;font-size:.6rem;color:var(--texto-2);margin-top:6px">' + meta + '</span>' : '');
    document.getElementById('iaoMsgs').appendChild(d); scrollIa();
  }
  function enviar() {
    var inp = document.getElementById('iaoInput'), t = inp.value.trim(); if (!t) return;
    burbuja('user', t.replace(/</g, '&lt;')); inp.value = '';
    var l = burbuja('ia', 'Pensando…');
    setTimeout(function () { l.innerHTML = 'La gasolina 95 más barata es <strong>E.Leclerc Las Rozas</strong> (1,439 €). ¿Quieres que compare con tu favorita?<span style="display:block;font-size:.6rem;color:var(--texto-2);margin-top:6px">⏱ groq · fake</span>'; }, 900);
  }
  document.getElementById('iaoSend').addEventListener('click', enviar);
  document.getElementById('iaoInput').addEventListener('keydown', function (e) { if (e.key === 'Enter') enviar(); });
  burbuja('ia', 'Hola 👋 Estoy contextualizado con las 14 estaciones de Madrid. Pregunta lo que quieras.');

  // ---- navegación inferior ----
  document.querySelectorAll('.an').forEach(function (a) {
    a.addEventListener('click', function () {
      document.querySelectorAll('.an').forEach(function (x) { x.classList.remove('active'); });
      a.classList.add('active');
      var d = a.dataset.an;
      if (d === 'mapa') { bsheet.dataset.snap = 'peek'; }
      else if (d === 'lista') { bsheet.dataset.snap = 'full'; }
      else if (d === 'ia') { iao.classList.add('show'); }
    });
  });

  // ---- pintar todo ----
  function pintar() { pintarMapa(); pintarLista(); }
  pintar();
})();
