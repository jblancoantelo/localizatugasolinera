/* ============================================================
   C4 · Radar — lógica
   ============================================================ */
(function () {
  'use strict';
  UI.aplicarPreviewMovil();
  var P = window.PETROL;
  var combSel = 'g95';
  var ordenAsc = true;
  var comparar = []; // ids

  // KPIs
  var k = P.kpis(combSel);
  document.getElementById('rdKpis').innerHTML =
    kpi('Media Madrid', UI.fmtPrecio(k.media), '€/L', '') +
    kpi('Más barata', UI.fmtPrecio(k.min), k.minEst ? k.minEst.loc : '', 'good') +
    kpi('Variación 7d', (k.var7 >= 0 ? '+' : '−') + Math.abs(k.var7 * 100).toFixed(1).replace('.', ',') + ' ¢', k.tendencia, k.var7 < 0 ? 'good' : 'bad');

  function kpi(lab, val, sub, cls) {
    return '<div class="kpi"><div class="k-lab">' + lab + '</div><div class="k-val ' + cls + '">' + val + '</div><div class="k-sub">' + sub + '</div></div>';
  }

  // "¿Repostar hoy?"
  var when = document.getElementById('rdWhen');
  var cuando = {
    bajando: { ico: '🟢', t: 'Sí, es buen momento', d: 'El precio ha bajado ' + Math.abs(k.var7 * 100).toFixed(1).replace('.', ',') + ' ¢ esta semana y sigue a la baja. Repostar hoy sale barato.' },
    subiendo: { ico: '🔴', t: 'Mejor si puedes, pronto', d: 'El precio está subiendo (' + (k.var7 * 100).toFixed(1).replace('.', ',') + ' ¢ esta semana). Si tienes depósito, repostar pronto.' },
    estable: { ico: '🟡', t: 'Sin prisa', d: 'El precio está estable esta semana. Reposta cuando te venga bien.' }
  }[k.tendencia];
  when.innerHTML = '<div class="when-ico">' + cuando.ico + '</div><div class="when-txt"><b>' + cuando.t + '</b>' + cuando.d + '</div>';

  // Ranking
  function lista() {
    var vals = P.ESTACIONES.map(function (e) { return e.precios[combSel]; }).filter(function (v) { return v != null; });
    var min = Math.min.apply(null, vals), max = Math.max.apply(null, vals);
    var l = P.ESTACIONES.filter(function (e) { return e.precios[combSel] != null; })
      .map(function (e) {
        return Object.assign({}, e, {
          _pvp: e.precios[combSel], _min: min, _max: max,
          _color: UI.colorPrecio(e.precios[combSel], min, max),
          _fav: P.FAVORITAS.indexOf(e.id) >= 0
        });
      });
    l.sort(function (a, b) { return ordenAsc ? a._pvp - b._pvp : b._pvp - a._pvp; });
    return l;
  }

  var LITROS_TANQUE = 55; // para el ahorro simulado

  function pintarRank() {
    var l = lista();
    var minP = Math.min.apply(null, l.map(function (e) { return e._pvp; }));
    document.getElementById('rdRank').innerHTML = l.map(function (e, i) {
      var ahorro = (e._pvp - minP) * LITROS_TANQUE;
      var pct = ((e._max - e._pvp) / (e._max - e._min) * 100).toFixed(0);
      var enCmp = comparar.indexOf(e.id) >= 0;
      return '<div class="rank-row' + (enCmp ? ' cmp' : '') + '" data-id="' + e.id + '">' +
        '<div class="rank-num">' + (i + 1) + '</div>' +
        UI.badgeMarca(e.marca, 34) +
        '<div class="rank-info"><div class="rank-name">' + e.rotulo + (e._fav ? ' <span class="star">★</span>' : '') + '</div>' +
        '<div class="rank-addr">' + e.dir + ' · ' + e.loc + '</div>' +
        '<div class="rank-bar"><i style="width:' + Math.max(8, pct) + '%;background:' + e._color + '"></i></div></div>' +
        '<div class="rank-right"><div class="rank-price" style="color:' + e._color + '">' + UI.fmtPrecio(e._pvp) + '</div>' +
        '<div class="rank-ahorro ' + (i === 0 ? 'save' : 'more') + '">' + (i === 0 ? 'más barata' : '+' + (ahorro).toFixed(2).replace('.', ',') + ' €/tanque') + '</div></div>' +
        '<button class="rank-cmp-btn" data-cmp="' + e.id + '" title="Comparar">⇄</button>' +
        '</div>';
    }).join('');

    document.querySelectorAll('.rank-row').forEach(function (r) {
      r.addEventListener('click', function (ev) {
        if (ev.target.dataset.cmp) { toggleCmp(ev.target.dataset.cmp); return; }
        abrirSheet(r.dataset.id);
      });
    });
  }

  // Comparador
  function toggleCmp(id) {
    var i = comparar.indexOf(id);
    if (i >= 0) comparar.splice(i, 1);
    else { if (comparar.length >= 3) { UI.toast('Máximo 3 estaciones'); return; } comparar.push(id); }
    pintarCmp();
    pintarRank();
  }
  document.getElementById('rdCmpClear').addEventListener('click', function () { comparar = []; pintarCmp(); pintarRank(); });

  function pintarCmp() {
    var box = document.getElementById('rdCompare');
    document.getElementById('rdCmpN').textContent = comparar.length;
    if (!comparar.length) { box.classList.remove('show'); return; }
    box.classList.add('show');
    document.getElementById('rdCmpChips').innerHTML = comparar.map(function (id) {
      var e = P.estacion(id);
      return '<span class="cmp-chip">' + e.rotulo + ' · ' + e.loc + ' <span class="x" data-rm="' + id + '">✕</span></span>';
    }).join('');
    document.querySelectorAll('.cmp-chip .x').forEach(function (x) {
      x.addEventListener('click', function () { toggleCmp(x.dataset.rm); });
    });
    // gráfica superpuesta (series de las comparadas)
    var colores = ['#1a73e8', '#d93025', '#1e8e3e'];
    var series = comparar.map(function (id) { return P.historico(P.estacion(id), combSel); });
    document.getElementById('rdCmpChart').innerHTML = graficaMulti(series, colores.slice(0, comparar.length));
  }

  // Gráfica multi-serie simple
  function graficaMulti(series, colores) {
    var W = 600, H = 190, padL = 40, padR = 8, padT = 12, padB = 24;
    var todos = [];
    series.forEach(function (s) { s.forEach(function (p) { todos.push(p.precio); }); });
    var min = Math.min.apply(null, todos), max = Math.max.apply(null, todos);
    var m = Math.max(0.005, (max - min) * 0.15); min -= m; max += m;
    var iw = W - padL - padR, ih = H - padT - padB;
    var n = series[0].length;
    function X(i) { return padL + (i / (n - 1)) * iw; }
    function Y(v) { return padT + ih - ((v - min) / (max - min)) * ih; }
    var out = '<svg class="g-svg" viewBox="0 0 ' + W + ' ' + H + '" preserveAspectRatio="none">';
    for (var g = 0; g <= 2; g++) {
      var v = min + ((max - min) * g) / 2, y = Y(v);
      out += '<line x1="' + padL + '" y1="' + y + '" x2="' + (W - padR) + '" y2="' + y + '" class="g-grid"/>' +
        '<text x="' + (padL - 5) + '" y="' + (y + 3) + '" text-anchor="end" class="g-lab">' + v.toFixed(3).replace('.', ',') + '</text>';
    }
    series.forEach(function (s, si) {
      var d = '';
      s.forEach(function (p, i) { d += (i ? ' L' : 'M') + X(i).toFixed(1) + ' ' + Y(p.precio).toFixed(1); });
      out += '<path d="' + d + '" fill="none" stroke="' + colores[si] + '" stroke-width="2.4" stroke-linejoin="round" class="g-line"/>';
    });
    // eje X
    [0, Math.floor(n / 2), n - 1].forEach(function (i) {
      out += '<text x="' + X(i).toFixed(1) + '" y="' + (H - 7) + '" text-anchor="middle" class="g-lab">' + series[0][i].fechaTxt.slice(0, 5) + '</text>';
    });
    out += '</svg>';
    return out;
  }

  // Sheet detalle
  var sheet = document.getElementById('rdSheet');
  function abrirSheet(id) {
    var e = lista().find(function (x) { return x.id === id; });
    if (!e) return;
    var serie = P.historico(P.estacion(id), combSel);
    var fuels = Object.keys(e.precios).map(function (kk) {
      var c = P.COMBUSTIBLES.find(function (x) { return x.id === kk; });
      return c ? '<div class="fuel-cell"><div class="fn">' + c.nombre + '</div><div class="fp">' + UI.fmtPrecio(e.precios[kk]) + '</div></div>' : '';
    }).join('');
    var nomC = (P.COMBUSTIBLES.find(function (x) { return x.id === combSel; }) || {}).nombre || '';
    document.getElementById('rdSheetBody').innerHTML =
      '<div class="rd-head">' + UI.badgeMarca(e.marca, 48) +
      '<div><h3 class="rd-name">' + e.rotulo + '</h3><p class="rd-addr">' + e.dir + ' · ' + e.loc + '</p></div></div>' +
      '<div class="rd-hero"><span class="big" style="color:' + e._color + '">' + UI.fmtPrecio(e._pvp) + '</span><span class="unit">' + nomC + ' · ' + UI.fmtDist(e.dist) + '</span></div>' +
      '<div class="rd-sect"><h4>Evolución 30 días</h4><div class="chart-box">' + UI.grafica(serie, { color: e._color }) + '</div></div>' +
      '<div class="rd-sect"><h4>Combustibles</h4><div class="fuel-grid">' + fuels + '</div></div>' +
      '<div class="rd-actions"><button id="rdFav">' + (e._fav ? '★ Guardada' : '☆ Guardar') + '</button><button id="rdCmp">⇄ Comparar</button><button class="primary" id="rdRoute">🧭 Ir</button></div>';
    document.getElementById('rdFav').addEventListener('click', function () { this.textContent = '★ Guardada'; UI.toast('Favorita guardada'); });
    document.getElementById('rdCmp').addEventListener('click', function () { toggleCmp(id); cerrarSheet(); });
    document.getElementById('rdRoute').addEventListener('click', function () { UI.toast('Abriendo navegación…'); });
    sheet.dataset.open = 'si';
    document.getElementById('rdBackdrop').classList.add('show');
  }
  function cerrarSheet() { sheet.dataset.open = 'no'; document.getElementById('rdBackdrop').classList.remove('show'); }
  document.getElementById('rdClose').addEventListener('click', cerrarSheet);
  document.getElementById('rdBackdrop').addEventListener('click', cerrarSheet);

  // Mapa
  var mv = document.getElementById('rdMapView');
  document.getElementById('rdMapBtn').addEventListener('click', function () {
    UI.mapaFake(document.getElementById('rdMapHolder'), lista(), { estilo: 'claro', yo: { x: 50, y: 52 }, onClick: function (id) { mv.classList.remove('show'); abrirSheet(id); } });
    mv.classList.add('show');
  });
  document.getElementById('rdMapClose').addEventListener('click', function () { mv.classList.remove('show'); });

  // Sort
  document.getElementById('rdSort').addEventListener('click', function () {
    ordenAsc = !ordenAsc;
    this.textContent = ordenAsc ? 'Menor primero ▲' : 'Mayor primero ▼';
    pintarRank();
  });

  // Combustible (título clickeable)
  document.querySelector('.rd-title').addEventListener('click', function () {
    var i = P.COMBUSTIBLES.filter(function (c) { return c.activo; }).findIndex(function (c) { return c.id === combSel; });
    var act = P.COMBUSTIBLES.filter(function (c) { return c.activo; });
    combSel = act[(i + 1) % act.length].id;
    this.innerHTML = (combSel === 'da' ? 'Gasóleo A' : 'Gasolina 95') + ' <span class="rd-chev">▾</span>';
    var k2 = P.kpis(combSel);
    document.getElementById('rdKpis').innerHTML =
      kpi('Media Madrid', UI.fmtPrecio(k2.media), '€/L', '') +
      kpi('Más barata', UI.fmtPrecio(k2.min), k2.minEst ? k2.minEst.loc : '', 'good') +
      kpi('Variación 7d', (k2.var7 >= 0 ? '+' : '−') + Math.abs(k2.var7 * 100).toFixed(1).replace('.', ',') + ' ¢', k2.tendencia, k2.var7 < 0 ? 'good' : 'bad');
    pintarRank(); pintarCmp();
  });

  // Nav (fake — radar es la vista principal)
  document.querySelectorAll('.rd-n').forEach(function (n) {
    n.addEventListener('click', function () {
      document.querySelectorAll('.rd-n').forEach(function (x) { x.classList.remove('active'); });
      n.classList.add('active');
      if (n.dataset.rv === 'favs') UI.toast('Favoritas (fake)');
      else if (n.dataset.rv === 'ia') UI.toast('IA (fake)');
    });
  });

  pintarRank();
  // precarga comparador con 2 para demostrar
  comparar = [lista()[0].id, lista()[3] ? lista()[3].id : lista()[1].id];
  pintarCmp(); pintarRank();
})();
