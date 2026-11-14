/* ============================================================
   C5 · Cockpit — lógica
   ============================================================ */
(function () {
  'use strict';
  UI.aplicarPreviewMovil();
  var P = window.PETROL;
  var combSel = 'g95';
  var selId = null;
  var vista = 'mapa';

  // KPIs rail
  var k = P.kpis(combSel);
  document.getElementById('ckMedia').textContent = UI.fmtPrecio(k.media).replace(' €', '');
  document.getElementById('ckMin').textContent = UI.fmtPrecio(k.min).replace(' €', '');
  var v = document.getElementById('ckVar');
  v.textContent = (k.var7 < 0 ? '▼' : '▲') + Math.abs(k.var7 * 100).toFixed(1).replace('.', ',') + '¢';
  v.className = 'ck-kpi-v ' + (k.var7 < 0 ? 'good' : '');

  // Lista combustibles rail
  var fl = document.getElementById('ckFuelList');
  P.COMBUSTIBLES.filter(function (c) { return c.activo; }).forEach(function (c) {
    var b = document.createElement('button');
    b.className = 'ck-fuel' + (c.id === combSel ? ' on' : '');
    var p = P.ESTACIONES[0].precios[c.id];
    b.innerHTML = '<span>' + c.nombre + '</span><span class="p">' + (p != null ? UI.fmtPrecio(p) : '—') + '</span>';
    b.addEventListener('click', function () {
      combSel = c.id;
      fl.querySelectorAll('.ck-fuel').forEach(function (x) { x.classList.remove('on'); });
      b.classList.add('on');
      var k2 = P.kpis(combSel);
      document.getElementById('ckMedia').textContent = UI.fmtPrecio(k2.media).replace(' €', '');
      document.getElementById('ckMin').textContent = UI.fmtPrecio(k2.min).replace(' €', '');
      pintar();
    });
    fl.appendChild(b);
  });

  document.getElementById('ckGeo').addEventListener('click', function () { UI.toast('📍 Usando tu ubicación (fake)'); });
  document.getElementById('ckSearch').addEventListener('input', function () { UI.toast('Buscando: ' + this.value); });

  function lista() {
    var vals = P.ESTACIONES.map(function (e) { return e.precios[combSel]; }).filter(function (v) { return v != null; });
    var min = Math.min.apply(null, vals), max = Math.max.apply(null, vals);
    return P.ESTACIONES.filter(function (e) { return e.precios[combSel] != null; })
      .map(function (e) {
        return Object.assign({}, e, {
          _pvp: e.precios[combSel], _color: UI.colorPrecio(e.precios[combSel], min, max),
          _fav: P.FAVORITAS.indexOf(e.id) >= 0
        });
      }).sort(function (a, b) { return a._pvp - b._pvp; });
  }

  function filaHTML(e) {
    return '<div class="ck-fila" data-id="' + e.id + '">' + UI.badgeMarca(e.marca, 34) +
      '<div class="ck-fi"><div class="ck-fn">' + e.rotulo + (e._fav ? ' <span class="star">★</span>' : '') + '</div>' +
      '<div class="ck-fa">' + e.dir + ' · ' + e.loc + '</div></div>' +
      '<div class="ck-fr"><div class="ck-fp" style="color:' + e._color + '">' + UI.fmtPrecio(e._pvp) + '</div>' +
      '<div class="ck-fd">' + UI.fmtDist(e.dist) + '</div></div></div>';
  }

  function pintar() {
    var l = lista();
    document.getElementById('ckList').innerHTML = l.map(filaHTML).join('');
    document.querySelectorAll('.ck-fila').forEach(function (f) {
      f.addEventListener('click', function () { seleccionar(f.dataset.id); });
    });
    UI.mapaFake(document.getElementById('ckMap'), l, {
      estilo: 'claro', yo: { x: 50, y: 52 },
      onClick: function (id) { seleccionar(id); }
    });
  }

  function seleccionar(id) {
    selId = id;
    document.querySelectorAll('.mf-pin').forEach(function (p) { p.classList.toggle('sel', p.dataset.id === id); });
    pintarDetalle();
    // en móvil abre el sheet de detalle
    if (window.innerWidth < 900) {
      document.getElementById('ckDetail').classList.add('show');
      document.querySelectorAll('.ck-mn').forEach(function (x) { x.classList.remove('active'); });
      document.querySelector('.ck-mn[data-cm="detalle"]').classList.add('active');
    }
  }

  function pintarDetalle() {
    var e = lista().find(function (x) { return x.id === selId; });
    if (!e) return;
    document.getElementById('ckDetailEmpty').style.display = 'none';
    var wrap = document.getElementById('ckDetailContent');
    wrap.style.display = 'block';
    var serie = P.historico(P.estacion(selId), combSel);
    var var7 = serie.length > 7 ? Math.round((serie[serie.length - 1].precio - serie[serie.length - 8].precio) * 1000) / 1000 : 0;
    var fuels = Object.keys(e.precios).map(function (kk) {
      var c = P.COMBUSTIBLES.find(function (x) { return x.id === kk; });
      return c ? '<div class="cdc-fuel"><div class="fn">' + c.nombre + '</div><div class="fp">' + UI.fmtPrecio(e.precios[kk]) + '</div></div>' : '';
    }).join('');
    var nomC = (P.COMBUSTIBLES.find(function (x) { return x.id === combSel; }) || {}).nombre || '';
    wrap.innerHTML =
      '<div class="cdc-head">' + UI.badgeMarca(e.marca, 46) +
      '<div><h3 class="cdc-name">' + e.rotulo + '</h3><p class="cdc-addr">' + e.dir + ' · ' + e.loc + '</p></div></div>' +
      '<div class="cdc-hero"><span class="big" style="color:' + e._color + '">' + UI.fmtPrecio(e._pvp) + '</span><span class="unit">' + nomC + ' · ' + UI.fmtDist(e.dist) + ' · ' + e.horario + '</span></div>' +
      '<div class="cdc-sect"><h4>Evolución 30 días · var. 7d ' + (var7 >= 0 ? '+' : '−') + Math.abs(var7 * 100).toFixed(1).replace('.', ',') + ' ¢</h4><div class="cdc-chart">' + UI.grafica(serie, { color: e._color }) + '</div></div>' +
      '<div class="cdc-sect"><h4>Combustibles</h4><div class="cdc-grid">' + fuels + '</div></div>' +
      '<div class="cdc-actions"><button id="cdcFav">' + (e._fav ? '★ Guardada' : '☆ Guardar') + '</button><button class="primary" id="cdcRoute">🧭 Cómo llegar</button></div>';
    document.getElementById('cdcFav').addEventListener('click', function () { this.textContent = '★ Guardada'; UI.toast('Favorita guardada'); });
    document.getElementById('cdcRoute').addEventListener('click', function () { UI.toast('Abriendo navegación…'); });
  }

  // View tabs
  document.querySelectorAll('.ck-vt').forEach(function (t) {
    t.addEventListener('click', function () {
      document.querySelectorAll('.ck-vt').forEach(function (x) { x.classList.remove('active'); });
      t.classList.add('active');
      vista = t.dataset.cv;
      var ws = document.getElementById('ckWorkspace');
      ws.className = 'ck-workspace' + (vista === 'lista' ? ' show-list' : vista === 'ambos' ? ' show-ambos' : '');
    });
  });

  // Panel IA
  var aiPanel = document.getElementById('ckAiPanel');
  document.getElementById('ckAiOpen').addEventListener('click', function () { aiPanel.dataset.open = 'si'; scrollIa(); });
  document.getElementById('ckAiClose').addEventListener('click', function () { aiPanel.dataset.open = 'no'; });
  var PROMPTS = ['¿Dónde repostar barato?', '¿Baja o sube?', 'Compara 2 marcas', 'Mejor 24h cerca'];
  var chips = document.getElementById('ckAiChips');
  PROMPTS.forEach(function (t) {
    var b = document.createElement('button');
    b.className = 'ck-ai-chip'; b.textContent = t;
    b.addEventListener('click', function () { document.getElementById('ckAiInput').value = t; enviar(); });
    chips.appendChild(b);
  });
  function scrollIa() { var m = document.getElementById('ckAiMsgs'); if (m) m.scrollTop = m.scrollHeight; }
  function burbuja(rol, txt, meta) {
    var d = document.createElement('div'); d.className = 'ck-bub ' + rol;
    d.innerHTML = txt + (meta ? '<span style="display:block;font-size:.6rem;color:var(--texto-2);margin-top:6px">' + meta + '</span>' : '');
    document.getElementById('ckAiMsgs').appendChild(d); scrollIa();
  }
  function enviar() {
    var inp = document.getElementById('ckAiInput'), t = inp.value.trim(); if (!t) return;
    burbuja('user', t.replace(/</g, '&lt;')); inp.value = '';
    var l = burbuja('ia', 'Pensando…');
    setTimeout(function () { l.innerHTML = 'La gasolina 95 más barata es <strong>E.Leclerc</strong> (1,439 €/L). La media provincial ha bajado 3,2 ¢ esta semana.<span style="display:block;font-size:.6rem;color:var(--texto-2);margin-top:6px">⏱ qwen · fake</span>'; scrollIa(); }, 900);
  }
  document.getElementById('ckAiSend').addEventListener('click', enviar);
  document.getElementById('ckAiInput').addEventListener('keydown', function (e) { if (e.key === 'Enter') enviar(); });
  burbuja('ia', 'Hola 👋 Pregúntame por precios en Madrid o compárame estaciones.');

  // Nav móvil
  document.querySelectorAll('.ck-mn').forEach(function (n) {
    n.addEventListener('click', function () {
      document.querySelectorAll('.ck-mn').forEach(function (x) { x.classList.remove('active'); });
      n.classList.add('active');
      var d = n.dataset.cm;
      document.getElementById('ckRail').classList.remove('show');
      document.getElementById('ckDetail').classList.remove('show');
      if (d === 'rail') document.getElementById('ckRail').classList.add('show');
      else if (d === 'detalle') document.getElementById('ckDetail').classList.add('show');
      else if (d === 'ia') { aiPanel.dataset.open = 'si'; scrollIa(); }
      else aiPanel.dataset.open = 'no';
    });
  });

  pintar();
  // selección inicial en escritorio
  if (window.innerWidth >= 900) seleccionar(lista()[0].id);
})();
