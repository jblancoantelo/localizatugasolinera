/* ============================================================
   C3 · Nocturne — lógica
   ============================================================ */
(function () {
  'use strict';
  UI.aplicarPreviewMovil();
  var P = window.PETROL;
  var combSel = 'g95';

  // KPIs de cabecera
  var k = P.kpis('g95');
  document.getElementById('nxMedia').textContent = UI.fmtPrecio(k.media).replace(' €', '');
  var vEl = document.getElementById('nxVar');
  vEl.textContent = (k.var7 < 0 ? '▼ ' : '▲ ') + Math.abs(k.var7 * 100).toFixed(1).replace('.', ',') + ' ¢';
  vEl.style.color = k.var7 < 0 ? 'var(--barata)' : 'var(--cara)';
  document.getElementById('nxHint').textContent = k.tendencia === 'bajando'
    ? '📉 Reppostar hoy sale barato · mínimo de la semana'
    : (k.tendencia === 'subiendo' ? '📈 El precio sube · si puedes, repostar pronto' : 'Precio estable');

  // Quick actions
  var quick = document.getElementById('nxQuick');
  [['📍 Cerca de mí', true], ['★ Favoritas', false], ['⛽ Gasóleo A', false], ['🔄 Refrescar', false]].forEach(function (q) {
    var b = document.createElement('button');
    b.className = 'nx-qc' + (q[1] ? ' on' : ''); b.textContent = q[0];
    b.addEventListener('click', function () {
      quick.querySelectorAll('.nx-qc').forEach(function (x) { x.classList.remove('on'); });
      b.classList.add('on');
      if (q[0].indexOf('Gasóleo') >= 0) { combSel = 'da'; pintar(); }
      else if (q[0].indexOf('Favoritas') >= 0) { UI.toast('Mostrando favoritas (fake)'); }
      else if (q[0].indexOf('Refrescar') >= 0) { UI.toast('Actualizando precios…'); }
      else { combSel = 'g95'; pintar(); }
    });
    quick.appendChild(b);
  });

  function lista() {
    var vals = P.ESTACIONES.map(function (e) { return e.precios[combSel]; }).filter(function (v) { return v != null; });
    var min = Math.min.apply(null, vals), max = Math.max.apply(null, vals);
    return P.ESTACIONES.filter(function (e) { return e.precios[combSel] != null; })
      .map(function (e) {
        return Object.assign({}, e, {
          _pvp: e.precios[combSel],
          _color: UI.colorPrecio(e.precios[combSel], min, max),
          _fav: P.FAVORITAS.indexOf(e.id) >= 0
        });
      })
      .sort(function (a, b) { return a._pvp - b._pvp; });
  }

  function tarjeta(e, i) {
    var svc = e.servicios.slice(0, 3).map(function (s) {
      var t = { '24h': '24 h', autoservicio: 'Auto', lavado: 'Lavado', cajero: 'Cajero', tienda: 'Tienda', aire: 'Aire' }[s] || s;
      return '<span class="nx-tag' + (s === '24h' ? ' h24' : '') + '">' + t + '</span>';
    }).join('');
    return '<div class="nx-card' + (i === 0 ? ' best' : '') + '" data-id="' + e.id + '">' +
      UI.badgeMarca(e.marca, 42) +
      '<div class="nx-info"><div class="nx-name">' + e.rotulo + (e._fav ? ' ★' : '') + '</div>' +
      '<div class="nx-addr">' + e.dir + ' · ' + e.loc + '</div>' +
      '<div class="nx-svc">' + svc + '</div></div>' +
      '<div class="nx-right"><div class="nx-price" style="color:' + e._color + '">' + UI.fmtPrecio(e._pvp) + '</div>' +
      '<div class="nx-dist">' + UI.fmtDist(e.dist) + '</div></div></div>';
  }

  function pintar() {
    var l = lista();
    document.getElementById('nxCards').innerHTML = l.map(tarjeta).join('');
    document.querySelectorAll('#nxCards .nx-card').forEach(function (c) {
      c.addEventListener('click', function () { abrir(c.dataset.id); });
    });
    UI.mapaFake(document.getElementById('nxMap'), l, { estilo: 'oscuro', yo: { x: 50, y: 52 }, onClick: abrir });
  }

  // Sheet detalle
  var sheet = document.getElementById('nxSheet');
  function abrir(id) {
    var e = lista().find(function (x) { return x.id === id; });
    if (!e) return;
    var serie = P.historico(P.estacion(id), combSel);
    var fuels = Object.keys(e.precios).map(function (kk) {
      var c = P.COMBUSTIBLES.find(function (x) { return x.id === kk; });
      return c ? '<div class="fuel-cell"><div class="fn">' + c.nombre + '</div><div class="fp">' + UI.fmtPrecio(e.precios[kk]) + '</div></div>' : '';
    }).join('');
    var nomC = (P.COMBUSTIBLES.find(function (x) { return x.id === combSel; }) || {}).nombre || '';
    document.getElementById('nxSheetBody').innerHTML =
      '<div class="nd-head">' + UI.badgeMarca(e.marca, 50) +
      '<div><h3 class="nd-name">' + e.rotulo + '</h3><p class="nd-addr">' + e.dir + ' · ' + e.loc + '</p></div></div>' +
      '<div class="nd-hero"><span class="big" style="color:' + e._color + '">' + UI.fmtPrecio(e._pvp) + '</span><span class="unit">' + nomC + ' · ' + UI.fmtDist(e.dist) + ' · ' + e.horario + '</span></div>' +
      '<div class="nd-sect"><h4>Evolución 30 días</h4><div class="chart-box">' + UI.grafica(serie, { color: e._color }) + '</div></div>' +
      '<div class="nd-sect"><h4>Todos los combustibles</h4><div class="fuel-grid">' + fuels + '</div></div>' +
      '<div class="nd-actions"><button id="ndFav">' + (e._fav ? '★ Guardada' : '☆ Guardar') + '</button><button class="primary" id="ndRoute">🧭 Cómo llegar</button></div>';
    document.getElementById('ndFav').addEventListener('click', function () { this.textContent = '★ Guardada'; UI.toast('Avisaremos si baja'); });
    document.getElementById('ndRoute').addEventListener('click', function () { UI.toast('Abriendo navegación…'); });
    sheet.dataset.open = 'si';
    document.getElementById('nxBackdrop').classList.add('show');
  }
  function cerrar() { sheet.dataset.open = 'no'; document.getElementById('nxBackdrop').classList.remove('show'); }
  document.getElementById('nxClose').addEventListener('click', cerrar);
  document.getElementById('nxBackdrop').addEventListener('click', cerrar);

  // IA
  var msgs = document.getElementById('nxIaMsgs');
  function burbuja(rol, txt, meta) {
    var d = document.createElement('div'); d.className = 'nx-bub ' + rol;
    d.innerHTML = txt + (meta ? '<span style="display:block;font-size:.6rem;color:var(--texto-2);margin-top:6px">' + meta + '</span>' : '');
    msgs.appendChild(d); msgs.scrollTop = msgs.scrollHeight;
  }
  function enviar() {
    var inp = document.getElementById('nxIaInput'), t = inp.value.trim(); if (!t) return;
    burbuja('user', t.replace(/</g, '&lt;')); inp.value = '';
    var l = burbuja('ia', 'Pensando…');
    setTimeout(function () { l.innerHTML = 'La 95 más barata es <strong>E.Leclerc</strong> (1,439 €) y la media provincial ha bajado 3,2 ¢ esta semana.<span style="display:block;font-size:.6rem;color:var(--texto-2);margin-top:6px">⏱ mistral · fake</span>'; msgs.scrollTop = msgs.scrollHeight; }, 900);
  }
  document.getElementById('nxIaSend').addEventListener('click', enviar);
  document.getElementById('nxIaInput').addEventListener('keydown', function (e) { if (e.key === 'Enter') enviar(); });
  burbuja('ia', 'Buenas noches 👋 Pregúntame por precios o tendencias.');

  // Ajustes
  document.getElementById('nxSettings').innerHTML =
    '<div class="nx-set-card"><h3>🔔 Avisos de precio</h3>' +
    fila('Avisos de bajada', 'Cuando baje en tus favoritas', switchOn(true)) +
    fila('Avisos de subida', 'Si sube por tu límite', switchOn(false)) +
    fila('Intervalo', 'Chequeo en 2º plano cada', '<span style="font-weight:700;color:var(--acento)">8 h</span>') +
    '</div>' +
    '<div class="nx-set-card"><h3>🌙 Modo noche</h3>' +
    fila('Tema oscuro automático', 'Al atardecer', switchOn(true)) +
    fila('Tipografía grande', 'Mejor legibilidad al conducir', switchOn(true)) +
    '</div>' +
    '<div class="nx-set-card"><h3>🤖 IA</h3>' +
    fila('Proveedor', 'Modelo activo', '<span style="font-weight:700;color:var(--acento)">Groq · Qwen</span>') +
    '</div>';
  function fila(lbl, hint, ctrl) { return '<div class="nx-set-row"><div>' + lbl + '<span style="display:block;font-size:.66rem;color:var(--texto-2);margin-top:2px">' + hint + '</span></div>' + ctrl + '</div>'; }
  function switchOn(on) { return '<label class="nx-switch"><input type="checkbox"' + (on ? ' checked' : '') + '><span class="track"></span></label>'; }

  // Nav
  document.querySelectorAll('.nx-n').forEach(function (n) {
    n.addEventListener('click', function () {
      document.querySelectorAll('.nx-n').forEach(function (x) { x.classList.remove('active'); });
      document.querySelectorAll('.nx-view').forEach(function (x) { x.classList.remove('active'); });
      n.classList.add('active');
      document.getElementById('nv-' + n.dataset.nv).classList.add('active');
    });
  });
  document.getElementById('nxBell').addEventListener('click', function () { UI.toast('🔔 Avisos activos'); });

  pintar();
})();
