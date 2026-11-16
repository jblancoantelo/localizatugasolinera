/* ============================================================================
   ProtoChart — gráfica de líneas en canvas (sin librerías)
   ----------------------------------------------------------------------------
   Usada por el histórico del panel de detalle, del popup del mapa, del
   comparador y de los KPIs. Soporta 1-3 series, tooltip táctil, media,
   marcadores de mínimo/máximo y etiquetas de fecha dd/mm.
   ========================================================================== */
const ProtoChart = (() => {
  'use strict';

  const PAD = { l: 46, r: 12, t: 16, b: 26 };

  function setup(canvas) {
    const dpr = Math.min(window.devicePixelRatio || 1, 3);
    let W = canvas.clientWidth || canvas.parentElement?.clientWidth || 320;
    let H = parseInt(canvas.dataset.h || '180', 10);
    if (!W) W = 320;
    canvas.width = Math.round(W * dpr);
    canvas.height = Math.round(H * dpr);
    canvas.style.width = '100%';
    canvas.style.height = H + 'px';
    const ctx = canvas.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, W, H);
    return { ctx, W, H };
  }

  const css = (name, fallback) => {
    const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
    return v || fallback;
  };

  function niceRange(values) {
    let min = Math.min(...values), max = Math.max(...values);
    if (!isFinite(min) || !isFinite(max)) { min = 0; max = 1; }
    const span = Math.max(max - min, 0.004);
    const pad = span * 0.18;
    return { lo: Math.max(0, min - pad), hi: max + pad };
  }

  /**
   * Dibuja la gráfica.
   * opts.series = [{ label, color, data:[{date,price}], dash?:bool, area?:bool }]
   */
  function draw(canvas, opts) {
    const series = (opts.series || []).filter(s => s.data && s.data.length);
    if (!series.length) return null;
    const { ctx, W, H } = setup(canvas);
    const grid = css('--line', '#e3e8ee');
    const fg = css('--fg', '#111');
    const fg2 = css('--fg-2', '#666');
    const accent = css('--brand', '#0b62d6');
    const font = '11px -apple-system, system-ui, sans-serif';

    const all = series.flatMap(s => s.data.map(d => d.price));
    const { lo, hi } = niceRange(all);
    const base = series[0].data;
    /* xCount permite superponer una previsión corta con offset (v8). Sin
       opciones extra el comportamiento es el de siempre. */
    const n = opts.xCount || Math.max(...series.map(s => (s.offset || 0) + s.data.length));
    const iw = W - PAD.l - PAD.r, ih = H - PAD.t - PAD.b;
    const x = (i) => PAD.l + (n === 1 ? iw / 2 : (i / (n - 1)) * iw);
    const y = (v) => PAD.t + (1 - (v - lo) / (hi - lo)) * ih;

    /* rejilla + eje de precios */
    ctx.font = font; ctx.textBaseline = 'middle';
    for (let g = 0; g <= 4; g++) {
      const yy = PAD.t + (g / 4) * ih;
      const val = hi - (g / 4) * (hi - lo);
      ctx.strokeStyle = grid; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(PAD.l, yy + .5); ctx.lineTo(W - PAD.r, yy + .5); ctx.stroke();
      ctx.fillStyle = fg2; ctx.textAlign = 'right';
      ctx.fillText(val.toFixed(3).replace('.', ','), PAD.l - 7, yy);
    }

    /* eje de fechas: 3 etiquetas como máximo */
    const dates = opts.dates || base.map(p => p.date);
    const idxs = n <= 2 ? dates.map((_, i) => i) : [...new Set([0, Math.floor((n - 1) / 2), n - 1])];
    ctx.textAlign = 'center'; ctx.fillStyle = fg2;
    idxs.forEach(i => {
      const d = dates[i] || dates[dates.length - 1], short = d.slice(0, 5).replace('-', '/');
      ctx.fillText(short, Math.min(Math.max(x(i), PAD.l + 12), W - PAD.r - 12), H - PAD.b / 2 - 1);
    });

    /* series */
    series.forEach((s, si) => {
      const col = s.color || accent;
      const pts = s.data;
      const off = s.offset || 0;
      const at = (i) => x(off + i);
      const path = new Path2D();
      pts.forEach((p, i) => { const px = at(i), py = y(p.price); i ? path.lineTo(px, py) : path.moveTo(px, py); });

      if (s.area !== false) {
        const grad = ctx.createLinearGradient(0, PAD.t, 0, H - PAD.b);
        grad.addColorStop(0, hexA(col, .28)); grad.addColorStop(1, hexA(col, .02));
        ctx.beginPath();
        ctx.moveTo(at(0), y(pts[0].price));
        pts.forEach((p, i) => ctx.lineTo(at(i), y(p.price)));
        ctx.lineTo(at(pts.length - 1), H - PAD.b); ctx.lineTo(at(0), H - PAD.b); ctx.closePath();
        ctx.fillStyle = grad; ctx.fill();
      }
      ctx.lineJoin = 'round'; ctx.lineCap = 'round';
      ctx.setLineDash(s.dash ? [5, 4] : []);
      ctx.strokeStyle = col; ctx.lineWidth = s.dash ? 1.6 : 2.2;
      ctx.stroke(path);
      ctx.setLineDash([]);

      /* puntos: pocos datos → todos; muchos → extremos y último */
      const show = pts.length <= 16;
      pts.forEach((p, i) => {
        const extreme = p.price === Math.min(...pts.map(q => q.price)) || p.price === Math.max(...pts.map(q => q.price));
        if (!show && !extreme && i !== pts.length - 1) return;
        ctx.beginPath(); ctx.arc(at(i), y(p.price), si === 0 ? 2.6 : 2, 0, 7);
        ctx.fillStyle = col; ctx.fill();
        ctx.strokeStyle = css('--surface', '#fff'); ctx.lineWidth = 1.4; ctx.stroke();
      });

      /* mínimo / máximo de la primera serie */
      if (si === 0 && pts.length > 3) {
        const vals = pts.map(p => p.price), mn = Math.min(...vals), mx = Math.max(...vals);
        const iMin = vals.indexOf(mn), iMax = vals.indexOf(mx);
        label(ctx, 'min', at(iMin), y(mn), mn, fg2, css('--surface'), 1);
        label(ctx, 'max', at(iMax), y(mx), mx, fg2, css('--surface'), -1);
      }

      /* último valor destacado */
      if (si === 0) {
        const last = pts[pts.length - 1], lx = at(pts.length - 1), ly = y(last.price);
        ctx.beginPath(); ctx.arc(lx, ly, 4.5, 0, 7); ctx.fillStyle = col; ctx.fill();
        ctx.strokeStyle = css('--surface', '#fff'); ctx.lineWidth = 2; ctx.stroke();
      }
    });

    /* media (línea discontinua fina) */
    if (opts.avg !== false && series[0].data.length > 2) {
      const avg = series[0].data.reduce((a, p) => a + p.price, 0) / n;
      ctx.setLineDash([2, 3]); ctx.strokeStyle = fg2; ctx.globalAlpha = .55; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(PAD.l, y(avg)); ctx.lineTo(W - PAD.r, y(avg)); ctx.stroke();
      ctx.setLineDash([]); ctx.globalAlpha = 1;
    }

    return { ctx, W, H, x, y, series, lo, hi, PAD };
  }

  function label(ctx, kind, x, y, val, color, bg, dir) {
    const txt = val.toFixed(3).replace('.', ',');
    ctx.font = 'bold 10px -apple-system, system-ui, sans-serif';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    const w = ctx.measureText(txt).width + 8;
    const ty = y + dir * 14;
    ctx.fillStyle = bg; ctx.globalAlpha = .9;
    roundRect(ctx, x - w / 2, ty - 8, w, 15, 4); ctx.fill(); ctx.globalAlpha = 1;
    ctx.fillStyle = color; ctx.fillText(txt, x, ty - 1);
  }

  function roundRect(ctx, x, y, w, h, r) {
    ctx.beginPath(); ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
  }

  function hexA(hex, a) {
    const h = hex.replace('#', '');
    const v = h.length === 3 ? h.split('').map(c => c + c).join('') : h;
    const num = parseInt(v, 16);
    return `rgba(${(num >> 16) & 255},${(num >> 8) & 255},${num & 255},${a})`;
  }

  /** Tooltip táctil/ratón. `host` es el contenedor .chartbox */
  function tooltip(canvas, host, geom, opts = {}) {
    if (!geom) return;
    let tip = host.querySelector('.chart-tip');
    if (!tip) { tip = document.createElement('div'); tip.className = 'chart-tip'; host.appendChild(tip); }
    const move = (ev) => {
      const r = canvas.getBoundingClientRect();
      const cx = (ev.touches ? ev.touches[0].clientX : ev.clientX) - r.left;
      const n = geom.series[0].data.length;
      const iw = geom.W - geom.PAD.l - geom.PAD.r;
      const step = n > 1 ? iw / (n - 1) : iw;
      let i = n > 1 ? Math.round((cx - geom.PAD.l) / step) : 0;
      i = Math.max(0, Math.min(n - 1, i));
      const d = geom.series[0].data[i];
      const prev = i > 0 ? geom.series[0].data[i - 1].price : null;
      const diff = prev != null ? (d.price - prev) : 0;
      const arrow = diff > 0 ? '▲' : diff < 0 ? '▼' : '=';
      const dcol = diff > 0 ? 'var(--hi)' : diff < 0 ? 'var(--lo)' : 'inherit';
      tip.innerHTML = `<b>${d.price.toFixed(3).replace('.', ',')} €</b><br>` +
        `${d.date}` + (opts.live && d.live ? ' · en vivo' : '') +
        (prev != null ? `<br><span style="color:${dcol}">${arrow} ${Math.abs(diff * 100).toFixed(1).replace('.', ',')} ¢</span>` : '');
      tip.classList.add('on');
      const px = geom.x(i), py = geom.y(d.price);
      tip.style.left = Math.max(46, Math.min(geom.W - 46, px)) + 'px';
      tip.style.top = Math.max(38, py) + 'px';
      if (opts.onIndex) opts.onIndex(i, d);
    };
    const hide = () => { tip.classList.remove('on'); if (opts.onLeave) opts.onLeave(); };
    canvas.addEventListener('pointermove', move);
    canvas.addEventListener('pointerdown', move);
    canvas.addEventListener('pointerleave', hide);
    canvas.addEventListener('pointerup', () => { /* mantiene el tooltip en táctil */ });
    canvas.addEventListener('touchstart', (e) => { e.preventDefault(); move(e); }, { passive: false });
    canvas.addEventListener('touchmove', (e) => { e.preventDefault(); move(e); }, { passive: false });
    canvas.addEventListener('touchend', hide);
  }

  /** Sparkline inline (SVG) para tarjetas y listas. */
  function spark(values, { color = 'currentColor', w = 62, h = 20 } = {}) {
    if (!values || values.length < 2) return '';
    const min = Math.min(...values), max = Math.max(...values);
    const span = Math.max(max - min, 0.002);
    const pts = values.map((v, i) => [
      (i / (values.length - 1)) * (w - 2) + 1,
      h - 2 - ((v - min) / span) * (h - 4),
    ]);
    const d = pts.map((p, i) => (i ? 'L' : 'M') + p[0].toFixed(1) + ' ' + p[1].toFixed(1)).join(' ');
    const last = pts[pts.length - 1];
    return `<svg viewBox="0 0 ${w} ${h}" width="${w}" height="${h}" aria-hidden="true" style="overflow:visible">` +
      `<path d="${d}" fill="none" stroke="${color}" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/>` +
      `<circle cx="${last[0].toFixed(1)}" cy="${last[1].toFixed(1)}" r="2" fill="${color}"/></svg>`;
  }

  return { draw, tooltip, spark, hexA, css };
})();
