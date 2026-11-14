/* ============================================================
   C6 · Gesture — lógica (swipe, stack, pull-to-refresh)
   ============================================================ */
(function () {
  'use strict';
  UI.aplicarPreviewMovil();
  var P = window.PETROL;
  var combSel = 'g95';
  var pagina = 1; // 0 favs, 1 lista, 2 mapa

  // ---- Chips combustible ----
  var chips = document.getElementById('gsChips');
  P.COMBUSTIBLES.filter(function (c) { return c.activo; }).forEach(function (c) {
    var b = document.createElement('button');
    b.className = 'gs-chip' + (c.id === combSel ? ' active' : '');
    b.textContent = c.corto;
    b.addEventListener('click', function () {
      combSel = c.id;
      chips.querySelectorAll('.gs-chip').forEach(function (x) { x.classList.remove('active'); });
      b.classList.add('active');
      pintar();
    });
    chips.appendChild(b);
  });

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

  // ---- Tarjetas apiladas (top 3) + resto ----
  function pintarStack() {
    var l = lista();
    var stack = document.getElementById('gsStack');
    var top3 = l.slice(0, 3);
    // capas de atrás hacia delante
    var clases = ['s2', 's1', 'top'];
    stack.innerHTML = top3.map(function (e, i) {
      var cls = clases[i] || 'top';
      return '<div class="gs-stacked ' + cls + '" data-id="' + e.id + '" data-idx="' + i + '">' +
        UI.badgeMarca(e.marca, 48) +
        '<div class="st-name">' + e.rotulo + (e._fav ? ' ★' : '') + '</div>' +
        '<div class="st-addr">' + e.dir + ' · ' + e.loc + '</div>' +
        '<div class="st-price" style="color:' + e._color + '">' + UI.fmtPrecio(e._pvp) + '</div>' +
        '<div class="st-dist">' + UI.fmtDist(e.dist) + ' · ' + e.horario + '</div>' +
        '</div>';
    }).reverse().join(''); // reverso para z-order correcto
    document.querySelectorAll('.gs-stacked').forEach(function (c) {
      bindStackDrag(c);
    });
    // hint
    var old = document.querySelector('.gs-swipe-hint');
    if (old) old.remove();
    var hint = document.createElement('div');
    hint.className = 'gs-swipe-hint';
    hint.textContent = '👆 Desliza la tarjeta superior para descartar · toca para abrir';
    stack.parentNode.insertBefore(hint, stack.nextSibling);

    // resto de la lista
    document.getElementById('gsRest').innerHTML = l.slice(3).map(function (e) {
      return '<div class="gs-fila" data-id="' + e.id + '">' + UI.badgeMarca(e.marca, 36) +
        '<div class="gs-fi"><div class="gs-fn">' + e.rotulo + (e._fav ? ' ★' : '') + '</div>' +
        '<div class="gs-fa">' + e.dir + ' · ' + e.loc + '</div></div>' +
        '<div class="gs-fr"><div class="gs-fp" style="color:' + e._color + '">' + UI.fmtPrecio(e._pvp) + '</div>' +
        '<div class="gs-fd">' + UI.fmtDist(e.dist) + '</div></div></div>';
    }).join('');
    document.querySelectorAll('.gs-fila').forEach(function (f) {
      f.addEventListener('click', function () { abrir(f.dataset.id); });
    });
  }

  // Arrastrar la tarjeta superior (descartar / abrir)
  function bindStackDrag(card) {
    var startX = 0, startY = 0, dx = 0, dy = 0, arrastrando = false;
    function down(x, y) {
      if (!card.classList.contains('top')) return;
      startX = x; startY = y; dx = 0; dy = 0; arrastrando = true;
      card.classList.add('dragging');
    }
    function move(x, y) {
      if (!arrastrando) return;
      dx = x - startX; dy = y - startY;
      card.style.transform = 'translate(' + dx + 'px,' + (dy * 0.3) + 'px) rotate(' + (dx / 18) + 'deg)';
      // feedback: verde si se descarta a la derecha (guardar), azul si a la izquierda (descartar)
      card.style.opacity = String(Math.max(0.4, 1 - Math.abs(dx) / 260));
    }
    function up() {
      if (!arrastrando) return;
      arrastrando = false;
      card.classList.remove('dragging');
      card.style.transition = 'transform .3s, opacity .3s';
      if (Math.abs(dx) > 110) {
        if (dx > 0) { UI.toast('★ Guardada en favoritas'); }
        else { UI.toast('Tarjeta descartada (por ahora)'); }
        card.style.transform = 'translate(' + (dx > 0 ? 500 : -500) + 'px,0) rotate(' + (dx > 0 ? 30 : -30) + 'deg)';
        card.style.opacity = '0';
        setTimeout(function () { card.style.display = 'none'; }, 300);
      } else {
        card.style.transform = '';
        card.style.opacity = '';
      }
      if (Math.abs(dx) < 8 && Math.abs(dy) < 8) abrir(card.dataset.id);
    }
    card.addEventListener('touchstart', function (e) { down(e.touches[0].clientX, e.touches[0].clientY); }, { passive: true });
    card.addEventListener('touchmove', function (e) { move(e.touches[0].clientX, e.touches[0].clientY); }, { passive: true });
    card.addEventListener('touchend', up);
    card.addEventListener('mousedown', function (e) { down(e.clientX, e.clientY); e.preventDefault(); });
    window.addEventListener('mousemove', function (e) { move(e.clientX, e.clientY); });
    window.addEventListener('mouseup', up);
  }

  // ---- Favoritas ----
  function pintarFavs() {
    var favs = lista().filter(function (e) { return e._fav; });
    var wrap = document.getElementById('gsFavCards');
    wrap.innerHTML = favs.length ? favs.map(function (e) {
      return '<div class="gs-fila" data-id="' + e.id + '">' + UI.badgeMarca(e.marca, 36) +
        '<div class="gs-fi"><div class="gs-fn">' + e.rotulo + ' ★</div><div class="gs-fa">' + e.dir + ' · ' + e.loc + '</div></div>' +
        '<div class="gs-fr"><div class="gs-fp" style="color:' + e._color + '">' + UI.fmtPrecio(e._pvp) + '</div>' +
        '<div class="gs-fd">' + UI.fmtDist(e.dist) + '</div></div></div>';
    }).join('') : '<div class="gs-fav-empty">Desliza una tarjeta a la derecha ➡️ para añadirla a favoritas y seguir su precio.</div>';
    wrap.querySelectorAll('.gs-fila').forEach(function (f) {
      f.addEventListener('click', function () { abrir(f.dataset.id); });
    });
  }

  // ---- Mapa ----
  function pintarMapa() {
    UI.mapaFake(document.getElementById('gsMapPage'), lista(), {
      estilo: 'claro', yo: { x: 50, y: 52 }, onClick: abrir
    });
  }

  // ---- Navegación por página (swipe track) ----
  var track = document.getElementById('gsTrack');
  var dots = document.getElementById('gsDots');
  [0, 1, 2].forEach(function (i) {
    var d = document.createElement('button');
    d.className = 'gs-dot' + (i === 1 ? ' active' : '');
    d.dataset.i = i;
    d.addEventListener('click', function () { irA(i); });
    dots.appendChild(d);
  });

  function irA(i) {
    pagina = Math.max(0, Math.min(2, i));
    // en escritorio: mostrar solo la página activa (sin track)
    if (window.innerWidth >= 900) {
      document.querySelectorAll('.gs-page').forEach(function (p) { p.classList.toggle('active', +p.dataset.pg === pagina); });
      track.style.transform = '';
    } else {
      track.style.transform = 'translateX(' + (-pagina * 33.3333) + '%)';
    }
    dots.querySelectorAll('.gs-dot').forEach(function (d) { d.classList.toggle('active', +d.dataset.i === pagina); });
    document.getElementById('gsNavMap').classList.toggle('active', pagina === 2);
    document.getElementById('gsNavList').classList.toggle('active', pagina === 1);
    document.getElementById('gsNavFav').classList.toggle('active', pagina === 0);
    document.querySelector('.gs-chips').style.display = pagina === 2 ? 'none' : 'flex';
    if (pagina === 2) pintarMapa();
  }

  // Swipe horizontal en el track (solo en móvil)
  (function () {
    var startX = 0, startY = 0, swipe = false;
    if (window.innerWidth >= 900) return;
    track.addEventListener('touchstart', function (e) { startX = e.touches[0].clientX; startY = e.touches[0].clientY; swipe = true; }, { passive: true });
    track.addEventListener('touchmove', function (e) {
      if (!swipe) return;
      var dx = e.touches[0].clientX - startX, dy = e.touches[0].clientY - startY;
      if (Math.abs(dx) > Math.abs(dy) && Math.abs(dx) > 10) {
        track.style.transition = 'none';
        track.style.transform = 'translateX(calc(' + (-pagina * 33.3333) + '% + ' + dx + 'px))';
      }
    }, { passive: true });
    track.addEventListener('touchend', function (e) {
      if (!swipe) return;
      swipe = false;
      track.style.transition = '';
      var dx = (e.changedTouches[0].clientX - startX);
      if (dx < -60 && pagina < 2) irA(pagina + 1);
      else if (dx > 60 && pagina > 0) irA(pagina - 1);
      else irA(pagina);
    });
  })();

  // Nav buttons
  document.getElementById('gsNavMap').addEventListener('click', function () { irA(2); });
  document.getElementById('gsNavList').addEventListener('click', function () { irA(1); });
  document.getElementById('gsNavFav').addEventListener('click', function () { irA(0); });

  // ---- Pull to refresh (en la página de lista) ----
  (function () {
    var ptr = document.getElementById('gsPtr');
    var startY = 0, arrastrando = false, paginaEnPull = 1;
    var listaPage = document.querySelector('.gs-page[data-pg="1"]');
    listaPage.addEventListener('touchstart', function (e) {
      if (listaPage.scrollTop > 0) return;
      startY = e.touches[0].clientY; arrastrando = true;
    }, { passive: true });
    listaPage.addEventListener('touchmove', function (e) {
      if (!arrastrando) return;
      var dy = e.touches[0].clientY - startY;
      if (dy > 0) {
        ptr.classList.add('show');
        ptr.classList.toggle('ready', dy > 70);
      }
    }, { passive: true });
    listaPage.addEventListener('touchend', function () {
      if (!arrastrando) return;
      arrastrando = false;
      if (ptr.classList.contains('ready')) {
        ptr.querySelector('.gs-ptr-ico').style.transform = 'rotate(360deg)';
        ptr.querySelector('.gs-ptr-txt').textContent = 'Actualizando…';
        setTimeout(function () {
          ptr.classList.remove('show', 'ready');
          ptr.querySelector('.gs-ptr-ico').style.transform = '';
          ptr.querySelector('.gs-ptr-txt').textContent = 'Suelta para actualizar';
          UI.toast('Precios actualizados ✓');
        }, 900);
      } else {
        ptr.classList.remove('show', 'ready');
      }
    });
  })();

  // ---- Sheet detalle ----
  var sheet = document.getElementById('gsSheet');
  function abrir(id) {
    var e = lista().find(function (x) { return x.id === id; });
    if (!e) return;
    var serie = P.historico(P.estacion(id), combSel);
    var fuels = Object.keys(e.precios).map(function (kk) {
      var c = P.COMBUSTIBLES.find(function (x) { return x.id === kk; });
      return c ? '<div class="fuel-cell"><div class="fn">' + c.nombre + '</div><div class="fp">' + UI.fmtPrecio(e.precios[kk]) + '</div></div>' : '';
    }).join('');
    var nomC = (P.COMBUSTIBLES.find(function (x) { return x.id === combSel; }) || {}).nombre || '';
    document.getElementById('gsSheetBody').innerHTML =
      '<div class="gh-head">' + UI.badgeMarca(e.marca, 48) +
      '<div><h3 class="gh-name">' + e.rotulo + '</h3><p class="gh-addr">' + e.dir + ' · ' + e.loc + '</p></div></div>' +
      '<div class="gh-hero"><span class="big" style="color:' + e._color + '">' + UI.fmtPrecio(e._pvp) + '</span><span class="unit">' + nomC + ' · ' + UI.fmtDist(e.dist) + ' · ' + e.horario + '</span></div>' +
      '<div class="gh-sect"><h4>Evolución 30 días</h4><div class="chart-box">' + UI.grafica(serie, { color: e._color }) + '</div></div>' +
      '<div class="gh-sect"><h4>Combustibles</h4><div class="fuel-grid">' + fuels + '</div></div>' +
      '<div class="gh-actions"><button id="ghFav">' + (e._fav ? '★ Guardada' : '☆ Guardar') + '</button><button class="primary" id="ghRoute">🧭 Cómo llegar</button></div>';
    document.getElementById('ghFav').addEventListener('click', function () { this.textContent = '★ Guardada'; UI.toast('Añadida a favoritas'); });
    document.getElementById('ghRoute').addEventListener('click', function () { UI.toast('Abriendo navegación…'); });
    sheet.dataset.open = 'si';
    document.getElementById('gsBackdrop').classList.add('show');
  }
  function cerrar() { sheet.dataset.open = 'no'; document.getElementById('gsBackdrop').classList.remove('show'); }
  document.getElementById('gsClose').addEventListener('click', cerrar);
  document.getElementById('gsBackdrop').addEventListener('click', cerrar);

  // ---- IA ----
  var ov = document.getElementById('gsIaOv');
  document.getElementById('gsIaBtn').addEventListener('click', function () { ov.classList.add('show'); scroll(); });
  document.getElementById('gsIaClose').addEventListener('click', function () { ov.classList.remove('show'); });
  function scroll() { var m = document.getElementById('gsIaMsgs'); if (m) m.scrollTop = m.scrollHeight; }
  function burbuja(rol, txt, meta) {
    var d = document.createElement('div'); d.className = 'gs-bub ' + rol;
    d.innerHTML = txt + (meta ? '<span style="display:block;font-size:.6rem;color:var(--texto-2);margin-top:6px">' + meta + '</span>' : '');
    document.getElementById('gsIaMsgs').appendChild(d); scroll();
  }
  function enviar() {
    var inp = document.getElementById('gsIaInput'), t = inp.value.trim(); if (!t) return;
    burbuja('user', t.replace(/</g, '&lt;')); inp.value = '';
    var l = burbuja('ia', 'Pensando…');
    setTimeout(function () { l.innerHTML = 'La 95 más barata es <strong>E.Leclerc</strong> (1,439 €).<span style="display:block;font-size:.6rem;color:var(--texto-2);margin-top:6px">⏱ gemini · fake</span>'; scroll(); }, 900);
  }
  document.getElementById('gsIaSend').addEventListener('click', enviar);
  document.getElementById('gsIaInput').addEventListener('keydown', function (e) { if (e.key === 'Enter') enviar(); });
  burbuja('ia', 'Hola 👋 Desliza para explorar. Pregúntame por precios.');

  document.getElementById('gsLoc').addEventListener('click', function () { UI.toast('Selector de provincia (fake)'); });

  // ---- Arranque ----
  function pintar() { pintarStack(); pintarFavs(); if (pagina === 2) pintarMapa(); }
  pintar();
  irA(1);
})();
