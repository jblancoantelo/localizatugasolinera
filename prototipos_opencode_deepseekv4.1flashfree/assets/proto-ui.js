/* ============================================================================
   Proto — kit de interfaz compartido
   ----------------------------------------------------------------------------
   Iconos SVG, sheets arrastrables, navegación entre paneles (con memoria),
   tema claro/oscuro, toasts y renderizador de tarjetas de gasolinera.
   ========================================================================== */
const Proto = (() => {
  'use strict';

  /* === 1. Iconos ======================================================== */
  const ICONS = {
    search: '<circle cx="11" cy="11" r="7.5"/><path d="m20.5 20.5-4.2-4.2"/>',
    sliders: '<path d="M4 6h10M18 6h2M4 12h4M12 12h8M4 18h12M20 18h0"/><circle cx="16" cy="6" r="2.2"/><circle cx="10" cy="12" r="2.2"/><circle cx="18" cy="18" r="2.2"/>',
    close: '<path d="M18 6 6 18M6 6l12 12"/>',
    star: '<path d="m12 3.6 2.6 5.3 5.9.9-4.3 4.1 1 5.8-5.2-2.7-5.2 2.7 1-5.8L3.5 9.8l5.9-.9z"/>',
    starFill: '<path d="m12 3.6 2.6 5.3 5.9.9-4.3 4.1 1 5.8-5.2-2.7-5.2 2.7 1-5.8L3.5 9.8l5.9-.9z"/>',
    bell: '<path d="M6 9a6 6 0 0 1 12 0c0 6 2.5 8 2.5 8h-17S6 15 6 9"/><path d="M10.3 20.5a2 2 0 0 0 3.4 0"/>',
    map: '<path d="M9 3.5 3.5 6v14.5L9 18l6 2.5 5.5-2.5V3.5L15 6 9 3.5Z"/><path d="M9 3.5V18M15 6v14.5"/>',
    list: '<path d="M8 6h12M8 12h12M8 18h12M4 6h.01M4 12h.01M4 18h.01"/>',
    columns: '<rect x="3" y="3.5" width="18" height="17" rx="2.5"/><path d="M12 3.5v17"/>',
    sparkles: '<path d="m12 3 1.7 4.3L18 9l-4.3 1.7L12 15l-1.7-4.3L6 9l4.3-1.7z"/><path d="m18.5 15 .9 2.1 2.1.9-2.1.9-.9 2.1-.9-2.1-2.1-.9 2.1-.9z"/>',
    gear: '<circle cx="12" cy="12" r="3.2"/><path d="M19.3 15.2a1.7 1.7 0 0 0 .3 1.9l.1.1a2 2 0 1 1-2.9 2.9l-.1-.1a1.7 1.7 0 0 0-2.9 1.2v.2a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.6 1.7 1.7 0 0 0-1.9.4l-.1.1a2 2 0 1 1-2.9-2.9l.1-.1a1.7 1.7 0 0 0-1.2-2.9h-.2a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.6-1.1 1.7 1.7 0 0 0-.4-1.9l-.1-.1a2 2 0 1 1 2.9-2.9l.1.1a1.7 1.7 0 0 0 1.9.3h.1A1.7 1.7 0 0 0 10 4.6v-.2a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 2.9 1.2l.1-.1a2 2 0 1 1 2.9 2.9l-.1.1a1.7 1.7 0 0 0-.3 1.9v.1a1.7 1.7 0 0 0 1.6 1.1h.2a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.6 1.1z"/>',
    moon: '<path d="M20.8 13.6A8.6 8.6 0 1 1 11 3.4a6.7 6.7 0 0 0 9.8 10.2z"/>',
    sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2.5v2M12 19.5v2M4.4 4.4l1.4 1.4M18.2 18.2l1.4 1.4M2.5 12h2M19.5 12h2M4.4 19.6l1.4-1.4M18.2 5.8l1.4-1.4"/>',
    refresh: '<path d="M20.5 5.5v5h-5"/><path d="M3.5 18.5v-5h5"/><path d="M4.9 10a8 8 0 0 1 13.2-3.4l2.4 2.3M3.5 15.4l2.4 2.3A8 8 0 0 0 19.1 14"/>',
    share: '<circle cx="18" cy="5.5" r="2.6"/><circle cx="6" cy="12" r="2.6"/><circle cx="18" cy="18.5" r="2.6"/><path d="m8.4 13.3 7.2 3.9M15.6 6.8 8.4 10.7"/>',
    navigate: '<path d="M3.5 11 21 3.5 13.5 21l-2.2-6.8z"/>',
    crosshair: '<circle cx="12" cy="12" r="8.5"/><path d="M12 2v3.5M12 18.5V22M2 12h3.5M18.5 12H22"/>',
    plus: '<path d="M12 5.5v13M5.5 12h13"/>',
    minus: '<path d="M5.5 12h13"/>',
    chevronDown: '<path d="m6.5 9.5 5.5 5.5 5.5-5.5"/>',
    chevronRight: '<path d="m9.5 6 6 6-6 6"/>',
    chevronLeft: '<path d="m14.5 6-6 6 6 6"/>',
    arrowUp: '<path d="M12 19.5V5M6 11l6-6 6 6"/>',
    arrowDown: '<path d="M12 4.5V19M18 13l-6 6-6-6"/>',
    arrowLeft: '<path d="M19.5 12h-15M11 6l-6 6 6 6"/>',
    check: '<path d="m20 6.5-11 11-5-5"/>',
    trash: '<path d="M4 6.5h16M9.5 6.5V4h5v2.5M18.5 6.5 17.5 20h-11L5.5 6.5"/>',
    mic: '<path d="M12 3a3 3 0 0 0-3 3v5a3 3 0 0 0 6 0V6a3 3 0 0 0-3-3z"/><path d="M18.5 11v1a6.5 6.5 0 0 1-13 0v-1M12 19.5V22"/>',
    send: '<path d="M21 3 10.5 13.5M21 3l-6.5 18-4-8-8-4z"/>',
    clock: '<circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3.2 2"/>',
    info: '<circle cx="12" cy="12" r="8.5"/><path d="M12 16.5V12M12 8.2h.01"/>',
    alert: '<path d="M10.3 3.8 1.9 18a2 2 0 0 0 1.7 3h16.8a2 2 0 0 0 1.7-3L13.7 3.8a2 2 0 0 0-3.4 0z"/><path d="M12 9v4M12 17h.01"/>',
    wifiOff: '<path d="M2 2l20 20"/><path d="M16.7 11.1A11 11 0 0 1 19 12.6M5 12.6A11 11 0 0 1 10.2 10.2M10.7 5.1A16 16 0 0 1 22.6 9M1.4 9a16 16 0 0 1 4.7-2.9M8.5 16.1a6 6 0 0 1 7 0M12 20h.01"/>',
    trendDown: '<path d="M22 17.5 13.5 9l-4.5 4.5L2 6.5"/><path d="M17 17.5h5v-5"/>',
    trendUp: '<path d="M22 6.5 13.5 15l-4.5-4.5L2 17.5"/><path d="M17 6.5h5v5"/>',
    droplet: '<path d="M12 3.2 17.5 9a7.7 7.7 0 1 1-11 0z"/>',
    flame: '<path d="M12 3s5 4.5 5 9a5 5 0 0 1-10 0c0-1.6.7-3 1.6-4.2C9.8 9.3 12 10 12 3z"/>',
    flask: '<path d="M9 3.5h6M10 3.5v6L5.5 18a2 2 0 0 0 1.8 3h9.4a2 2 0 0 0 1.8-3L14 9.5v-6"/><path d="M7.5 15h9"/>',
    car: '<path d="M3.5 13.5 5.5 8a2 2 0 0 1 1.9-1.4h9.2A2 2 0 0 1 18.5 8l2 5.5v5h-3.5M3.5 18.5v-5"/><circle cx="7.5" cy="18.5" r="1.6"/><circle cx="16.5" cy="18.5" r="1.6"/><path d="M9.1 18.5h6.8"/>',
    wallet: '<rect x="2.5" y="6" width="19" height="13" rx="2.5"/><path d="M2.5 10.5h19"/><circle cx="17" cy="15" r="1.3"/>',
    compare: '<path d="M12 3.5v17"/><rect x="3" y="6.5" width="6" height="11" rx="1.8"/><rect x="15" y="6.5" width="6" height="11" rx="1.8"/>',
    expand: '<path d="M8 3.5H5.5A2 2 0 0 0 3.5 5.5V8M16 3.5h2.5a2 2 0 0 1 2 2V8M16 20.5h2.5a2 2 0 0 0 2-2V16M8 20.5H5.5a2 2 0 0 1-2-2V16"/>',
    layers: '<path d="m12 3 8.5 4.5L12 12 3.5 7.5z"/><path d="m3.5 12.5 8.5 4.5 8.5-4.5"/>',
    grid: '<rect x="3.5" y="3.5" width="7" height="7" rx="2"/><rect x="13.5" y="3.5" width="7" height="7" rx="2"/><rect x="3.5" y="13.5" width="7" height="7" rx="2"/><rect x="13.5" y="13.5" width="7" height="7" rx="2"/>',
    eye: '<path d="M2 12s3.7-7 10-7 10 7 10 7-3.7 7-10 7-10-7-10-7z"/><circle cx="12" cy="12" r="3"/>',
    percent: '<path d="M19 5 5 19"/><circle cx="7.5" cy="7.5" r="2.6"/><circle cx="16.5" cy="16.5" r="2.6"/>',
    route: '<circle cx="6" cy="19" r="2.5"/><circle cx="18" cy="5" r="2.5"/><path d="M8.5 19h5a3.5 3.5 0 0 0 0-7h-3a3.5 3.5 0 0 1 0-7h5"/>',
    filter: '<path d="M3.5 5.5h17l-6.5 7.5v6l-4 3v-9z"/>',
    bookmark: '<path d="M6.5 3.5h11v17l-5.5-4-5.5 4z"/>',
    shield: '<path d="M12 3 5 5.5v6c0 4.5 3 8.2 7 9.5 4-1.3 7-5 7-9.5v-6z"/><path d="m9.2 12 2 2 3.6-3.6"/>',
    key: '<circle cx="8" cy="15.5" r="3.5"/><path d="m10.6 13.2 8-8M16.5 5.5l2.4 2.4M14.5 7.6l2.4 2.4"/>',
    speed: '<path d="M4.5 18a9 9 0 1 1 15 0"/><path d="m12 13.5 4-4"/>',
    bank: '<path d="M3.5 9.5 12 4l8.5 5.5v1H3.5zM5.5 10.5v7M9.5 10.5v7M14.5 10.5v7M18.5 10.5v7M3 20.5h18"/>',
    coffee: '<path d="M4 8.5h12v5.5a5 5 0 0 1-5 5H9a5 5 0 0 1-5-5z"/><path d="M16 10h1.5a2.5 2.5 0 0 1 0 5H16M4.5 4.5c0-1 1-1 1-2M9 4.5c0-1 1-1 1-2M13.5 4.5c0-1 1-1 1-2"/>',
    spray: '<path d="M8 9h6v12H8zM8 9V6h6v3M17 6h3M17 10h3M17 14h2"/>',
    shieldCheck: '<path d="M12 3 5 5.5v6c0 4.5 3 8.2 7 9.5 4-1.3 7-5 7-9.5v-6z"/><path d="m9.2 12 2 2 3.6-3.6"/>',
    arrowRight: '<path d="M4.5 12h15M13 6l6 6-6 6"/>',
    pencil: '<path d="M4 20.5h4L18.5 10a2.6 2.6 0 0 0-3.7-3.7L4.3 16.8 4 20.5z"/><path d="m14.2 7.6 3.2 3.2"/>',
    palette: '<circle cx="12" cy="12" r="8.5"/><circle cx="12" cy="8" r="1.2"/><circle cx="8.5" cy="13" r="1.2"/><circle cx="15.5" cy="13" r="1.2"/>',
    lock: '<rect x="4.5" y="10" width="15" height="10.5" rx="2.5"/><path d="M8 10V7.5a4 4 0 0 1 8 0V10"/>',
    download: '<path d="M12 3.5v12M7.5 11l4.5 4.5 4.5-4.5M4 20.5h16"/>',
    power: '<path d="M12 3v9"/><path d="M6.5 6.5a8 8 0 1 0 11 0"/>',
    battery: '<rect x="2.5" y="8" width="17" height="8.5" rx="2.5"/><path d="M21.5 11v2.5"/><rect x="4.5" y="10" width="12" height="4.5" rx="1" fill="currentColor"/>',
    signal: '<path d="M4 19v-4M9.5 19V11M15 19V7.5M20.5 19V4"/>',
  };

  function icon(name, cls = '') {
    const p = ICONS[name] || ICONS.info;
    return `<span class="ico ${cls}" aria-hidden="true"><svg viewBox="0 0 24 24">${p}</svg></span>`;
  }
  function hydrateIcons(root = document) {
    root.querySelectorAll('[data-ico]').forEach(el => {
      el.innerHTML = `<svg viewBox="0 0 24 24" aria-hidden="true">${ICONS[el.dataset.ico] || ICONS.info}</svg>`;
      if (!el.classList.contains('ico')) el.classList.add('ico');
    });
  }

  /* === 2. Utilidades DOM ================================================ */
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const el = (html) => { const t = document.createElement('template'); t.innerHTML = html.trim(); return t.content.firstElementChild; };
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const param = (k, d = '') => new URLSearchParams(location.search).get(k) ?? d;
  const isEmbed = () => param('embed') === '1';

  /* === 3. Tema ========================================================== */
  const theme = {
    get() { return document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light'; },
    set(t, persist = true) {
      document.documentElement.dataset.theme = t;
      if (persist) { try { localStorage.setItem('proto_theme', t); } catch (e) {} }
      document.querySelectorAll('[data-theme-toggle]').forEach(b => {
        b.innerHTML = icon(t === 'dark' ? 'sun' : 'moon');
        b.title = t === 'dark' ? 'Tema claro' : 'Tema oscuro';
      });
      document.dispatchEvent(new CustomEvent('proto:theme', { detail: t }));
    },
    toggle() { this.set(this.get() === 'dark' ? 'light' : 'dark'); },
    init() {
      let t = param('theme');
      if (!t) { try { t = localStorage.getItem('proto_theme'); } catch (e) {} }
      if (!t) t = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
      this.set(t, false);
      $$('[data-theme-toggle]').forEach(b => b.addEventListener('click', () => this.toggle()));
    },
  };

  /* === 4. Toast ========================================================= */
  function toast(msg, { iconName = 'check', ms = 2200 } = {}) {
    let host = $('.toast-host');
    if (!host) { host = el('<div class="toast-host"></div>'); document.body.appendChild(host); }
    const t = el(`<div class="toast">${icon(iconName, 'sm')}<span>${esc(msg)}</span></div>`);
    host.appendChild(t);
    setTimeout(() => { t.style.transition = 'opacity .2s, transform .2s'; t.style.opacity = '0'; t.style.transform = 'translateY(8px)'; }, ms);
    setTimeout(() => t.remove(), ms + 260);
  }

  /* === 5. Navegación entre paneles ===================================== */
  /** nav(navEl, {panes, paneAttr, key:'data-tab', store, onSwitch}) */
  function nav(navEl, opts = {}) {
    const attr = opts.attr || 'data-tab';
    const paneAttr = opts.paneAttr || 'data-panel';
    const key = opts.store || ('proto_pane_' + (navEl.dataset.nav || 'main'));
    const btns = $$(`[${attr}]`, navEl);
    const panes = opts.panes ? $$(opts.panes) : $$(`[${paneAttr}]`);
    let current = null;

    function go(k, { silent = false } = {}) {
      current = k;
      btns.forEach(b => {
        const on = b.getAttribute(attr) === k;
        b.classList.toggle('on', on);
        b.setAttribute('aria-selected', on ? 'true' : 'false');
      });
      panes.forEach(p => p.classList.toggle('on', p.getAttribute(paneAttr) === k));
      if (!silent) {
        try { localStorage.setItem(key, k); } catch (e) {}
        const u = new URL(location.href);
        if (opts.hash !== false) { u.hash = k; if (location.hash !== '#' + k) history.replaceState(null, '', u); }
        opts.onSwitch && opts.onSwitch(k);
        document.dispatchEvent(new CustomEvent('proto:nav', { detail: k }));
      }
    }
    btns.forEach(b => b.addEventListener('click', () => go(b.getAttribute(attr))));

    let start = param('screen') || (opts.hash !== false && location.hash ? location.hash.slice(1) : '');
    if (!start) { try { start = localStorage.getItem(key) || ''; } catch (e) {} }
    if (!btns.some(b => b.getAttribute(attr) === start)) start = opts.start || btns[0]?.getAttribute(attr);
    if (start) go(start, { silent: true });
    opts.onSwitch && opts.onSwitch(current);
    return { go, get current() { return current; }, btns };
  }

  /* === 6. Segmented ===================================================== */
  function segmented(host, onChange) {
    const btns = $$('button', host);
    btns.forEach(b => b.addEventListener('click', () => {
      btns.forEach(x => x.classList.toggle('on', x === b));
      onChange && onChange(b.dataset.val ?? b.textContent.trim(), b);
    }));
    return { set(v) { btns.forEach(b => b.classList.toggle('on', (b.dataset.val ?? b.textContent.trim()) === v)); } };
  }

  /* === 7. Sheet arrastrable con puntos de anclaje ====================== */
  /**
   * sheet(el, {snaps:['peek','half','full'], start:'half', peek:148, half:.52, full:.92,
   *            scrim:bool, mask:bool, onSnap(name), onClose()})
   */
  function sheet(element, opts = {}) {
    const snaps = opts.snaps || ['half', 'full'];
    const peekPx = opts.peek ?? 150;
    const hostile = () => window.innerHeight;
    let scrim = null;
    if (opts.scrim !== false) {
      scrim = el('<div class="scrim"></div>');
      (opts.host || document.body).appendChild(scrim);
      scrim.addEventListener('click', () => close());
    }
    const sheetH = () => hostile() * (opts.full ?? 0.92);
    let current = null, dragging = false, startY = 0, startT = 0, y = 0;

    const visibleFor = (name) => {
      if (name === 'peek') return Math.min(peekPx, sheetH() * .35);
      if (name === 'half') return hostile() * (opts.half ?? 0.52);
      if (name === 'full') return sheetH();
      return sheetH();
    };
    const yFor = (name) => sheetH() - visibleFor(name);

    function apply(v, animate = true) {
      y = v;
      element.style.height = sheetH() + 'px';
      element.style.transitionProperty = animate ? 'transform' : 'none';
      element.style.setProperty('--sheet-y', v + 'px');
    }
    function snapTo(name, { silent = false } = {}) {
      current = name;
      apply(yFor(name));
      element.classList.remove('dragging');
      element.dataset.snap = name;
      if (!silent) opts.onSnap && opts.onSnap(name);
    }
    function open(name) {
      const start = name || opts.start || snaps[0];
      element.classList.add('open');
      apply(sheetH(), false);
      requestAnimationFrame(() => { snapTo(start); scrim && scrim.classList.add('on'); });
    }
    function close() {
      element.classList.remove('open');
      apply(sheetH() + 24);
      scrim && scrim.classList.remove('on');
      opts.onClose && opts.onClose();
    }

    /* arrastre (los botones de la cabecera no lo inician: si no, el
       setPointerCapture se queda con el click y las X no cierran) */
    const dragArea = opts.handle || element.querySelector('.sheet-head') || element;
    const NO_DRAG = 'button, a, input, select, textarea, label, [data-no-drag]';
    dragArea.style.touchAction = 'none';
    dragArea.addEventListener('pointerdown', (e) => {
      if (e.target.closest(NO_DRAG)) return;
      dragging = true; startY = e.clientY; startT = y;
      element.classList.add('dragging');
      dragArea.setPointerCapture?.(e.pointerId);
    });
    dragArea.addEventListener('pointermove', (e) => {
      if (!dragging) return;
      const dy = e.clientY - startY;
      const max = sheetH() + 40;
      apply(Math.max(-8, Math.min(max, startT + dy)), false);
    });
    const endDrag = () => {
      if (!dragging) return;
      dragging = false;
      const h = sheetH();
      const order = snaps.map(n => ({ n, y: yFor(n) }));
      if (y > h * .82) { close(); return; }
      order.sort((a, b) => Math.abs(a.y - y) - Math.abs(b.y - y));
      snapTo(order[0].n);
    };
    dragArea.addEventListener('pointerup', endDrag);
    dragArea.addEventListener('pointercancel', endDrag);
    /* El click de cierre se escucha en el documento: así funciona aunque el
       puntero se haya capturado por el arrastre. */
    element.addEventListener('click', (e) => { if (e.target.closest('[data-sheet-close]')) close(); });
    window.addEventListener('resize', () => { if (element.classList.contains('open')) snapTo(current, { silent: true }); });

    return { open, close, snapTo, get snap() { return current; }, element };
  }

  /* === 8. Tarjeta de gasolinera ======================================== */
  /** 'REPSOL Repsol Chamberí' → 'Chamberí' (quita la marca del nombre). */
  function shortName(st) {
    const n = st.name.replace(new RegExp('^' + st.brand.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\s*', 'i'), '').trim();
    return n || st.area || st.city;
  }
  function titleCase(b) { return b.charAt(0) + b.slice(1).toLowerCase(); }

  /**
   * stationCard(st, {fuel, stats, km, variant, actions, selected, showDrive, showSpark})
   * variant: 'card' (por defecto) | 'compact' | 'minimal'
   */
  function stationCard(st, o = {}) {
    const fuel = o.fuel || 'g95';
    const price = PROTO.finalPrice(st, fuel);
    const meta = PROTO.brandMeta(st.brand);
    const km = o.km ?? PROTO.kmFromUser(st);
    const lvl = o.stats ? PROTO.level(price, o.stats.lo, o.stats.hi) : (price < 1.52 ? 'lo' : price < 1.65 ? 'mid' : 'hi');
    const s = PROTO.seriesStats(PROTO.series(st, fuel, 14));
    const delta = s ? s.diff : 0;
    const flat = Math.abs(delta) < 0.0005;
    const dcls = flat ? 'flat' : delta < 0 ? 'down' : 'up';
    const dicon = flat ? 'minus' : delta < 0 ? 'trendDown' : 'trendUp';
    const best = o.stats && price === o.stats.min;
    const initials = st.brand.slice(0, 2);
    const flags = [];
    if (best) flags.push('<span class="badge ok">Más barata</span>');
    if (meta.discount) flags.push(`<span class="badge ok">-${meta.discount} ¢ con app</span>`);
    flags.push(`<span class="badge">${st.schedule === '24h' ? '24 h' : st.schedule}</span>`);
    if (st.services.includes('lavado')) flags.push('<span class="badge">Lavado</span>');
    if (st.services.includes('cafe')) flags.push('<span class="badge">Café</span>');
    if (st.services.includes('super')) flags.push('<span class="badge">Súper</span>');
    if (st.updatedMin > 25) flags.push(`<span class="badge warn">Sin publicar ${PROTO.since(st.updatedMin)}</span>`);

    if (o.variant === 'minimal') {
      return `<button class="station ${o.selected ? 'sel' : ''}" data-id="${st.id}" style="grid-template-columns:auto minmax(0,1fr) auto">
        <span class="brandlogo sm" style="background:${meta.color};color:${meta.ink}">${initials}</span>
        <span class="s-main"><span class="s-name truncate">${esc(st.name)}</span>
        <span class="s-meta truncate">${PROTO.dist(km)} · ${esc(st.city)}</span></span>
        <span class="s-right"><span class="price p-sm ${lvl}">${price != null ? PROTO.money(price, 3).replace(' €', '') : '—'}<span class="p-unit">€/L</span></span></span>
      </button>`;
    }

    const distTxt = o.showDrive && km < 12 ? `${PROTO.dist(km)} · ${PROTO.driveMin(km)} min` : PROTO.dist(km);
    const actions = o.actions ? `<div class="row mt2" style="gap:6px">
        <button class="btn sm soft" data-act="route">${icon('navigate', 'xs')} Ir</button>
        <button class="btn sm ghost" data-act="detail">${icon('info', 'xs')} Detalle</button>
        <button class="btn sm ghost" data-act="compare">${icon('compare', 'xs')} Comparar</button>
      </div>` : '';

    return `<article class="station ${o.selected ? 'sel' : ''} ${best ? 'best' : ''}" data-id="${st.id}" role="button" tabindex="0">
      <span class="brandlogo" style="background:${meta.color};color:${meta.ink}" aria-hidden="true">${initials}</span>
      <div class="s-main">
        <div class="s-name"><span class="bold">${esc(titleCase(st.brand))}</span> <span class="muted">${esc(shortName(st))}</span></div>
        <div class="s-meta">${distTxt} · ${esc(st.address)}</div>
        <div class="s-flags">${flags.join('')}</div>
        ${actions}
      </div>
      <div class="s-right">
        <span class="price ${lvl}">${price != null ? PROTO.money(price, 3).replace(' €', '') : '—'}<span class="p-unit">€/L</span></span>
        <span class="delta ${dcls}">${icon(dicon, 'xs')}${flat ? 'sin cambios' : Math.abs(delta * 100).toFixed(1).replace('.', ',') + ' ¢'}</span>
        ${o.showSpark ? `<span class="spark" style="color:var(--${lvl})">${ProtoChart.spark(PROTO.series(st, fuel, 14).map(x => x.price), { color: `var(--${lvl})` })}</span>` : ''}
        <span class="tiny dim">${PROTO.since(st.updatedMin)}</span>
      </div>
      <button class="iconbtn sm s-fav ${st.fav ? 'on' : ''}" data-act="fav" title="Guardar en favoritos" aria-label="Guardar en favoritos">${icon(st.fav ? 'starFill' : 'star', 'sm' + (st.fav ? ' fill' : ''))}</button>
    </article>`;
  }

  /** Delegación de acciones de las tarjetas. */
  function bindCards(host, handlers = {}) {
    host.addEventListener('click', (e) => {
      const card = e.target.closest('.station');
      if (!card) return;
      const id = card.dataset.id;
      const st = PROTO.STATIONS.find(s => s.id === id);
      const act = e.target.closest('[data-act]')?.dataset.act;
      if (act === 'fav') { st.fav = !st.fav; e.stopPropagation(); handlers.onFav && handlers.onFav(st); paintFav(card, st); return; }
      if (act === 'route') { handlers.onRoute && handlers.onRoute(st); return; }
      if (act === 'compare') { handlers.onCompare && handlers.onCompare(st); return; }
      handlers.onOpen && handlers.onOpen(st, card);
    });
  }
  function paintFav(card, st) {
    const b = card.querySelector('[data-act="fav"]');
    if (!b) return;
    b.classList.toggle('on', st.fav);
    b.innerHTML = icon(st.fav ? 'starFill' : 'star', 'sm' + (st.fav ? ' fill' : ''));
  }

  /* === 9. Detalle de estación (compartido v2/v3/v5/v6) ================= */
  /**
   * Dibuja la serie propia + la media de las 6 más baratas de la lista.
   * Devuelve la geometría de ProtoChart (o null).
   */
  function drawStationChart(canvas, st, o = {}) {
    const fuel = o.fuel || 'diesel', days = o.days || 14;
    const own = PROTO.series(st, fuel, days);
    if (!own.length) return null;
    const pool = PROTO.sortStations(o.list || PROTO.STATIONS, 'price', 'asc', fuel).slice(0, 6);
    const avg = own.map((_, i) => {
      const vals = pool.map(s2 => PROTO.series(s2, fuel, days)[i]?.price).filter(v => v != null);
      return { date: own[i].date, price: vals.reduce((a, b) => a + b, 0) / (vals.length || 1) };
    });
    const geom = ProtoChart.draw(canvas, {
      series: [
        { label: 'Media zona', color: ProtoChart.css('--brand'), data: avg, dash: true, area: false },
        { label: st.brand, color: ProtoChart.css('--mid'), data: own },
      ],
      avg: false,
    });
    ProtoChart.tooltip(canvas, canvas.parentElement, geom, { live: true });
    canvas.onpointermove = null;
    return geom;
  }

  /**
   * Pinta el detalle completo de una estación dentro de `root` y cablea sus
   * controles (combustible, días, acciones). Devuelve {redraw, fuel, days}.
   */
  function stationDetail(root, st, o = {}) {
    let fuel = o.fuel && st.prices[o.fuel] != null ? o.fuel : (st.prices.diesel != null ? 'diesel' : 'g95');
    let days = o.days || 14;
    const dayOpts = o.dayOptions || [7, 14, 21, 30, 60, 90, 180];
    const list = o.list || PROTO.STATIONS;

    function html() {
      const stats = PROTO.stats(list, fuel);
      const price = PROTO.finalPrice(st, fuel);
      const s = PROTO.seriesStats(PROTO.series(st, fuel, days)) || { min: price, max: price, avg: price, diff: 0, minDate: '—' };
      const meta = PROTO.brandMeta(st.brand);
      const save = PROTO.savingVsAvg(st, list, fuel, 50);
      const lvl = stats ? PROTO.level(price, stats.lo, stats.hi) : 'mid';
      const pos = stats && stats.spread > 0 ? Math.max(2, Math.min(98, ((price - stats.min) / stats.spread) * 100)) : 50;
      const flat = Math.abs(s.diff) < 0.0005;

      return `
      <div class="row top" style="gap:var(--s3)">
        <span class="brandlogo lg" style="background:${meta.color};color:${meta.ink}">${esc(st.brand.slice(0, 2))}</span>
        <div class="grow">
          <div class="bold md">${esc(st.name)}</div>
          <div class="tiny muted">${esc(st.address)} · ${esc(st.city)} (${esc(st.province)})</div>
          <div class="row wrap mt2" style="gap:4px">
            <span class="badge">${st.schedule === '24h' ? '24 h' : esc(st.schedule)}</span>
            <span class="badge">★ ${String(st.rating).replace('.', ',')} · ${st.reviews}</span>
            <span class="badge">${PROTO.dist(PROTO.kmFromUser(st))} · ${PROTO.driveMin(PROTO.kmFromUser(st))} min</span>
          </div>
        </div>
      </div>

      <div class="actions-grid mt3">
        <button class="action-tile" data-act="route">${icon('navigate')}<span>Ir</span></button>
        <button class="action-tile" data-act="compare">${icon('compare')}<span>Comparar</span></button>
        <button class="action-tile ${st.fav ? 'on' : ''}" data-act="fav">${icon(st.fav ? 'starFill' : 'star', st.fav ? 'fill' : '')}<span>${st.fav ? 'Guardada' : 'Guardar'}</span></button>
        <button class="action-tile" data-act="alert">${icon('bell')}<span>Avisar</span></button>
      </div>

      <div class="card mt3" style="background:var(--bg-2)">
        <div class="row between top">
          <div>
            <div class="tiny muted">${esc(PROTO.fuelName(fuel))}</div>
            <div class="price p-xl ${lvl}">${price.toFixed(3).replace('.', ',').slice(0, -1)}<span class="p-dec">${price.toFixed(3).slice(-1)}</span><span class="p-unit">€/L</span></div>
            <div class="row mt1" style="gap:var(--s2)">
              <span class="delta ${flat ? 'flat' : s.diff < 0 ? 'down' : 'up'}">${icon(flat ? 'minus' : s.diff < 0 ? 'trendDown' : 'trendUp', 'xs')}${Math.abs(s.diff * 100).toFixed(1).replace('.', ',')} ¢ en ${days} d</span>
              <span class="tiny dim">${PROTO.since(st.updatedMin)}</span>
            </div>
          </div>
          <div class="col tr" style="gap:3px">
            <div class="tiny muted">Con descuento</div>
            <div class="badge ok lg">${meta.discount ? '-' + meta.discount + ' ¢ · ' + esc(meta.program) : 'Sin descuento'}</div>
            <div class="tiny muted mt1">Ahorro 50 L</div>
            <div class="bold num">${PROTO.money(save, 2)}</div>
          </div>
        </div>
        <div class="mt3">
          <div class="row between tiny muted"><span>más barata de la zona</span><span>más cara</span></div>
          <div class="levelbar mt2"><span class="pin" style="left:${pos}%"></span></div>
          <div class="row between tiny muted mt1"><span class="num">${PROTO.money(stats ? stats.min : price, 3)}</span><span class="num">media ${PROTO.money(stats ? stats.avg : price, 3)}</span><span class="num">${PROTO.money(stats ? stats.max : price, 3)}</span></div>
        </div>
      </div>

      <div class="chartbox mt3"><canvas data-h="176"></canvas><div class="chart-tip"></div></div>
      <div class="row between mt2" style="gap:var(--s2)">
        <select class="select-native js-det-fuel" style="width:auto;min-width:132px;min-height:38px">
          ${PROTO.FUELS.filter(f => st.prices[f.id] != null).map(f => `<option value="${f.id}" ${f.id === fuel ? 'selected' : ''}>${esc(f.name)}</option>`).join('')}
        </select>
        <div class="chips" style="flex-wrap:wrap">
          ${dayOpts.map(d => `<button class="chip js-det-day ${d === days ? 'on' : ''}" data-days="${d}">${d} d</button>`).join('')}
        </div>
      </div>

      <div class="kpis mt4">
        <div class="kpi"><div class="k-label">Mínimo</div><div class="k-val num" style="font-size:var(--t-xl)">${s.min.toFixed(3).replace('.', ',')}</div><div class="k-sub">${s.minDate}</div></div>
        <div class="kpi"><div class="k-label">Media</div><div class="k-val num" style="font-size:var(--t-xl)">${s.avg.toFixed(3).replace('.', ',')}</div><div class="k-sub">${s.days} días con precio</div></div>
        <div class="kpi"><div class="k-label">Máximo</div><div class="k-val num" style="font-size:var(--t-xl)">${s.max.toFixed(3).replace('.', ',')}</div><div class="k-sub">${s.maxDate}</div></div>
      </div>

      <div class="mt4">
        <div class="small bold mb2">Todos los combustibles</div>
        <div class="list">
          ${PROTO.FUELS.filter(f => st.prices[f.id] != null).map(f => `
            <div class="row-item"><div class="ri-main"><div class="ri-title">${esc(f.name)}</div>
            <div class="ri-sub">${f.id === 'glp' ? 'GLP · granel' : 'Suministro en estación'}</div></div>
            <span class="price p-sm ${stats ? PROTO.level(PROTO.finalPrice(st, f.id), stats.lo, stats.hi) : ''}">${PROTO.money(PROTO.finalPrice(st, f.id), 3).replace(' €', '')}<span class="p-unit">€/L</span></span></div>`).join('')}
        </div>
      </div>

      <div class="mt4">
        <div class="small bold mb2">Servicios</div>
        <div class="chips wrap">${st.services.map(sv => `<span class="chip">${esc(sv)}</span>`).join('')}${meta.program ? `<span class="chip soft">${esc(meta.program)}</span>` : ''}</div>
      </div>

      <div class="banner info mt4">${icon('info', 'sm')}<span>Comparado con las ${stats ? stats.count : 0} estaciones ${esc(st.province)} cargadas · histórico del Ministerio con un día de retraso</span></div>`;
    }

    function paint() {
      root.innerHTML = html();
      hydrateIcons(root);
      const canvas = root.querySelector('canvas');
      if (canvas) drawStationChart(canvas, st, { fuel, days, list });
      const sel = root.querySelector('.js-det-fuel');
      if (sel) sel.addEventListener('change', () => { fuel = sel.value; o.onFuel?.(fuel, st); paint(); });
      $$('.js-det-day', root).forEach(b => b.addEventListener('click', () => { days = +b.dataset.days; o.onDays?.(days, st); paint(); }));
      $$('[data-act]', root).forEach(b => b.addEventListener('click', () => {
        const act = b.dataset.act;
        if (act === 'fav') { st.fav = !st.fav; toast(st.fav ? st.name + ' en favoritos' : 'Quitada de favoritos', { iconName: st.fav ? 'starFill' : 'star' }); paint(); return; }
        if (act === 'route') { toast('Ruta a ' + st.name + ' · ' + driveMin(kmFromUser(st)) + ' min', { iconName: 'navigate' }); return; }
        if (act === 'compare') { toast('Añadida al comparador (mock)'); return; }
        if (act === 'alert') { toast('Te avisaremos si baja de ' + PROTO.money(Math.max(0.001, (PROTO.finalPrice(st, fuel) || 0) - 0.03), 3)); return; }
        o.onAction?.(act, st);
      }));
      o.afterPaint?.(root, { fuel, days });
    }

    paint();
    return { redraw: paint, get fuel() { return fuel; }, get days() { return days; }, el: root };
  }

  /* === 10. Skeleton ===================================================== */
  function skeleton(host, n = 5) {
    host.innerHTML = Array.from({ length: n }, () => '<div class="skeleton sk-card"></div>').join('');
  }

  /* === 11. Arranque común ============================================== */
  function boot() {
    document.body.classList.toggle('embed', isEmbed());
    hydrateIcons();
    $$('[data-ico]').forEach(() => {});
    theme.init();
    document.addEventListener('click', (e) => {
      const h = e.target.closest('[data-toast]');
      if (h) toast(h.dataset.toast, { iconName: h.dataset.toastIcon || 'check' });
    });
  }

  return {
    ICONS, icon, hydrateIcons, $, $$, el, esc, param, isEmbed, shortName, titleCase,
    theme, toast, nav, segmented, sheet, stationCard, bindCards, paintFav, skeleton, boot,
    stationDetail, drawStationChart,
  };
})();
