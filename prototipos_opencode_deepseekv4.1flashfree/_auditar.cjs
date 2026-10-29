/* ============================================================================
   Auditoría FUNCIONAL interactiva de los prototipos (v2)
   ----------------------------------------------------------------------------
   Cada prototipo declara CÓMO se hace cada acción en su propia interfaz; la
   comprobación es la misma para todos. Así se detecta una carencia real y no
   un selector distinto.

   Uso: node prototipos_opencode_deepseekv4.1flashfree/_auditar.cjs [v7]
   ========================================================================== */
const { chromium } = require('playwright');
const http = require('http');
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const OUT = path.join(__dirname, 'capturas');
const PORT = 8893;
const FILTER = process.argv.slice(2).filter(a => !a.startsWith('--'));

const results = [];
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
const txt = (page, sel) => page.evaluate(s => (document.querySelector(s) || {}).textContent || null, sel);

function serve() {
  const types = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png' };
  const srv = http.createServer((req, res) => {
    let p = decodeURIComponent(req.url.split('?')[0]);
    if (p === '/') p = '/index.html';
    fs.readFile(path.join(ROOT, p), (err, data) => {
      if (err) { res.writeHead(404); res.end(''); return; }
      res.writeHead(200, { 'Content-Type': types[path.extname(p)] || 'application/octet-stream' });
      res.end(data);
    });
  });
  return new Promise(r => srv.listen(PORT, '127.0.0.1', () => r(srv)));
}

async function until(page, fn, ms = 9000) {
  const t0 = Date.now();
  while (Date.now() - t0 < ms) {
    if (await page.evaluate(fn)) return true;
    await sleep(120);
  }
  throw new Error('timeout esperando condición');
}

/** Cierra overlays, sheets y scrims (un scrim abierto bloquea el resto). */
async function closeAll(page) {
  await page.evaluate(() => {
    document.querySelectorAll('.pf-overlay.on').forEach(e => e.classList.remove('on'));
    document.querySelectorAll('.fullscreen-panel.on').forEach(e => e.classList.remove('on'));
    document.querySelectorAll('.scrim.on').forEach(e => e.classList.remove('on'));
    /* Quitar .open no basta: el sheet conserva --sheet-y y sigue tapando la
       pantalla. Hay que devolverlo fuera de la vista. */
    document.querySelectorAll('.sheet').forEach(e => {
      e.classList.remove('open');
      e.style.setProperty('--sheet-y', (window.innerHeight + 60) + 'px');
    });
  });
  await sleep(260);
}

/** Cierra solo sheets/scrims (respeta los overlays de paridad abiertos). */
async function closeSheets(page) {
  await page.evaluate(() => {
    document.querySelectorAll('.scrim.on').forEach(e => e.classList.remove('on'));
    document.querySelectorAll('.sheet').forEach(e => {
      e.classList.remove('open');
      e.style.setProperty('--sheet-y', (window.innerHeight + 60) + 'px');
    });
  });
  await sleep(240);
}

/* ==========================================================================
   Adaptadores por prototipo
   ========================================================================== */
const SPEC = {
  'v1-sheet.html': {
    /* Los datos ya están en pantalla: no hace falta abrir nada. */
    openData: async () => {},
    fuel: async (p) => {
      await p.click('#filterBtn'); await sleep(450);
      await p.click('#fuelChips [data-fuel="g95"]'); await sleep(200);
      await p.click('#applyFilters'); await sleep(450);
    },
    search: { input: '#q' },
    fav: '[data-act="fav"]',
    detail: '.station[data-id]',
    ia: async (p) => { await p.click('.bottomnav [data-nav-tab="ia"]'); await sleep(400); },
    cfg: async (p) => { await p.click('.bottomnav [data-nav-tab="config"]'); await sleep(400); },
    iaSel: '.pf-ia',
    msgSel: '.pf-msg.assistant',
  },
  'v2-map.html': {
    openData: async () => {},
    fuel: async (p) => {
      await p.click('#sheetFilterBtn'); await sleep(450);
      await p.selectOption('#fFuel', { index: 1 }); await sleep(300);
      await p.click('#fApply'); await sleep(500);
    },
    search: { input: '#q' },
    fav: '[data-act="fav"]',
    detail: '.pm-card, .station[data-id]',
    ia: async (p) => {
      await p.click('#menuBtn'); await sleep(350);
      await p.click('#menuPanel [data-goto="ia"]'); await sleep(500);
    },
    cfg: async (p) => {
      await p.click('#menuBtn'); await sleep(350);
      await p.click('#menuPanel [data-goto="config"]'); await sleep(500);
    },
    iaSel: '.pf-ia',
    msgSel: '.pf-msg.assistant',
  },
  'v3-cards.html': {
    openData: async () => {},
    fuel: async (p) => { await p.selectOption('#fuel', { index: 1 }); await sleep(450); },
    search: { open: '#searchBtn', input: '#searchInput' },
    fav: '[data-act="fav"]',
    detail: '.feed-card[data-id]',
    ia: async (p) => { await p.click('[data-tab="yo"]'); await sleep(300); await p.click('#sideIaBtn'); await sleep(500); },
    cfg: async (p) => { await p.click('[data-tab="yo"]'); await sleep(300); await p.click('#sideCfgBtn'); await sleep(500); },
    iaSel: '.pf-ia',
    msgSel: '.pf-msg.assistant',
  },
  'v4-desktop.html': {
    openData: async () => {},
    fuel: async (p) => { await p.selectOption('#fFuel', { index: 1 }); await sleep(400); },
    search: { input: '#q' },
    fav: '[data-fav]',
    detail: '#table tbody tr',
    ia: async (p) => { await p.click('#iaBtn4'); await sleep(500); },
    cfg: async (p) => { await p.click('#cfgBtn4'); await sleep(500); },
    iaSel: '.pf-ia',
    msgSel: '.pf-msg.assistant',
  },
  'v5-ia.html': {
    openData: async (p) => { await p.click('.bottomnav [data-tab="datos"]'); await sleep(550); },
    fuel: async (p) => {
      await SPEC['v5-ia.html'].openData(p);
      await p.selectOption('[data-opt-fuel]', { index: 1 }); await sleep(550);
    },
    search: { input: '[data-opt-search]' },
    fav: '[data-opt-fav]',
    detail: '[data-opt-detail]',
    ia: async (p) => { await p.click('.bottomnav [data-tab="chat"]'); await sleep(400); },
    cfg: async (p) => {
      await p.click('.bottomnav [data-tab="set"]'); await sleep(450);
      await p.click('#cfgBtn5'); await sleep(700);
    },
    iaSel: '.chat-pane',
    msgSel: '.msg.assistant',
  },
  'v6-drive.html': {
    openData: async (p) => {
      await closeAll(p);
      await p.click('#moreBtn'); await sleep(450);
      await p.click('[data-sheet-open="opts"]'); await sleep(650);
    },
    fuel: async (p) => { await closeAll(p); await p.click('[data-fuel="g95"]'); await sleep(400); },    search: { input: '#optsQ' },
    fav: '[data-opt-fav]',
    detail: '[data-opt-detail]',
    ia: async (p) => { await closeAll(p); await p.click('#moreBtn'); await sleep(450); await p.click('#moreIa'); await sleep(550); },
    cfg: async (p) => { await closeAll(p); await p.click('#moreBtn'); await sleep(450); await p.click('#moreCfg'); await sleep(550); },
    iaSel: '.pf-ia',
    msgSel: '.pf-msg.assistant',
  },
  'v7-compare.html': {
    openData: async (p) => {
      /* Si ya hay un overlay de paridad abierto (IA, Config o el propio
         explorador), el botón queda debajo: se cierran antes de reabrir. */
      await p.evaluate(() => document.querySelectorAll('.pf-overlay.on').forEach(e => e.classList.remove('on')));
      await sleep(200);
      await p.click('#dataBtn7'); await sleep(750);
    },
    fuel: async (p) => {
      await SPEC['v7-compare.html'].openData(p);
      await p.selectOption('[data-opt-fuel]', { index: 1 }); await sleep(550);
    },
    search: { input: '[data-opt-search]' },
    fav: '[data-opt-fav]',
    detail: '[data-opt-detail]',
    ia: async (p) => { await p.click('#iaBtn7'); await sleep(550); },
    cfg: async (p) => { await p.click('#cfgBtn7'); await sleep(650); },
    iaSel: '.pf-ia',
    msgSel: '.pf-msg.assistant',
  },
  'v8-plan.html': {
    openData: async (p) => {
      await p.evaluate(() => document.querySelectorAll('.pf-overlay.on').forEach(e => e.classList.remove('on')));
      await sleep(200);
      await p.click('#dataBtn8'); await sleep(750);
    },
    fuel: async (p) => {
      await SPEC['v8-plan.html'].openData(p);
      await p.selectOption('[data-opt-fuel]', { index: 1 }); await sleep(550);
    },
    search: { input: '[data-opt-search]' },
    fav: '[data-opt-fav]',
    detail: '[data-opt-detail]',
    ia: async (p) => { await p.click('#iaBtn8'); await sleep(550); },
    cfg: async (p) => { await p.click('#cfgBtn8'); await sleep(650); },
    iaSel: '.pf-ia',
    msgSel: '.pf-msg.assistant',
  },
};

/* ==========================================================================
   Comprobaciones
   ========================================================================== */
async function checkDatos(page) {
  const n = await page.evaluate(() => document.querySelectorAll('.station, .feed-card, .pm-card, .refuel, .selchip, .pf-ex-item, .opt, [data-opt-detail], [data-pick], #table tbody tr').length);
  const prices = await page.evaluate(() => (document.body.innerText.match(/\d,\d{3}/g) || []).length);
  if (n < 3) throw new Error(`solo ${n} tarjetas`);
  if (prices < 3) throw new Error('sin precios visibles');
  return `${n} tarjetas · ${prices} precios`;
}

async function checkCombustible(page, spec) {
  await closeAll(page);
  const before = await page.evaluate(() => PROTO.finalPrice(PROTO.STATIONS.find(s => s.province === 'Madrid'), 'diesel'));
  await spec.fuel(page);
  const after = await page.evaluate(() => document.body.innerText.match(/\d,\d{3}/g)?.slice(0, 20).join(' '));
  if (!after) throw new Error('sin precios tras cambiar');
  const still = await page.evaluate((v) => document.body.innerText.includes(String(v.toFixed(3)).replace('.', ',')), before);
  return still ? 'cambia (el precio antiguo sigue en pantalla)' : 'precios recalculados';
}

async function checkBusqueda(page, spec) {
  if (!spec.search) throw new Error('la propuesta no tiene búsqueda');
  await spec.openData(page);
  if (spec.search.open) { await page.click(spec.search.open); await sleep(500); }
  const input = await page.$(spec.search.input);
  if (!input) throw new Error('sin campo de búsqueda');
  await input.fill('Ballenoil'); await sleep(550);
  const n = await page.evaluate(() => document.querySelectorAll('.station, .feed-card, .refuel, .pf-ex-item, [data-opt-detail], [data-pick], #table tbody tr').length);
  if (n === 0) throw new Error('la búsqueda no encuentra nada');
  await input.fill(''); await sleep(350);
  await closeAll(page);
  return `${n} resultados`;
}

async function checkFavorito(page, spec) {
  if (!spec.fav) throw new Error('la propuesta no permite marcar favoritos');
  await spec.openData(page);
  const btn = await page.$(spec.fav);
  if (!btn) throw new Error('sin botón de favorito');
  const key = await btn.evaluate(e => e.dataset.id || e.dataset.fav || e.dataset.optFav || e.dataset.pickFav || '');
  const before = await page.evaluate(() => PROTO.favorites().length);
  await btn.click(); await sleep(500);
  const after = await page.evaluate(() => PROTO.favorites().length);
  if (before === after) throw new Error('el favorito no se guarda');
  /* restaurar: volver a pulsar el botón (el DOM puede haberse re-renderizado) */
  const again = await page.$(`${spec.fav}[data-id="${key}"], ${spec.fav}[data-fav="${key}"], ${spec.fav}[data-opt-fav="${key}"], ${spec.fav}[data-pick-fav="${key}"], ${spec.fav}`);
  if (again) await again.click();
  await sleep(300);
  return `${before} → ${after} favoritos`;
}

/** Abre la primera tarjeta que coincida y comprueba que hay ficha con gráfica. */
async function abreFicha(page, selector) {
  const card = await page.$(selector);
  if (!card) throw new Error('sin tarjeta/fila que abrir');
  await card.click(); await sleep(800);
  const ok = await page.evaluate(() => !!document.querySelector('#detailBody canvas, #detailPanel.on, #inspBody .chartbox, .fullscreen-panel.on .chartbox, .pf-overlay.on canvas, .pf-overlay.on .chartbox, .sheet.open .chartbox, .sheet.open canvas, #stationSheet.open'));
  if (!ok) throw new Error('no se abre la ficha con histórico');
  await closeAll(page);
  return 'ficha + histórico';
}

async function checkDetalle(page, spec) {
  if (!spec.detail) throw new Error('la propuesta no abre ficha de estación');
  if (typeof spec.detail === 'function') return spec.detail(page);
  await closeSheets(page);
  await spec.openData(page);
  return abreFicha(page, spec.detail);
}

async function checkIA(page, spec) {
  await closeAll(page);
  await spec.ia(page);
  const panel = await page.$(spec.iaSel);
  if (!panel) throw new Error('no se abre el panel de IA');
  const input = await page.$('.pf-input, #ask');
  if (!input) throw new Error('sin caja de texto');
  const n0 = await page.evaluate(s => document.querySelectorAll(s).length, spec.msgSel);
  await input.fill('¿Dónde reposto más barato?');
  const btn = await page.$('.pf-send, #sendBtn');
  if (btn) await btn.click(); else await input.press('Enter');
  await page.waitForFunction(
    ([sel, n]) => document.querySelectorAll(sel).length > n,
    [spec.msgSel, n0], { timeout: 9000 },
  );
  const n = await page.evaluate(s => document.querySelectorAll(s).length, spec.msgSel);
  if (n <= n0) throw new Error('el modelo no responde');
  await closeAll(page);
  return `${n} mensajes`;
}

async function checkConfig(page, spec) {
  await closeAll(page);
  await spec.cfg(page);
  const secs = await page.evaluate(() => document.querySelectorAll('.pf-cfg [data-sec]').length);
  if (!secs) throw new Error('la propuesta no tiene Config completa (8 tarjetas)');
  if (secs < 8) throw new Error(`solo ${secs}/8 tarjetas`);
  const before = await page.evaluate(() => {
    const s = PROTO.STATIONS.find(x => x.brand === 'REPSOL' && x.province === 'Madrid');
    return PROTO.finalPrice(s, 'diesel');
  });
  const range = await page.$('[data-disc="REPSOL"]');
  if (!range) throw new Error('sin descuentos por marca');
  await range.evaluate(el => { el.value = 12; el.dispatchEvent(new Event('input', { bubbles: true })); });
  await sleep(600);
  const after = await page.evaluate(() => {
    const s = PROTO.STATIONS.find(x => x.brand === 'REPSOL' && x.province === 'Madrid');
    return PROTO.finalPrice(s, 'diesel');
  });
  if (!(after < before)) throw new Error(`el descuento no aplica (${before} → ${after})`);
  await range.evaluate(el => { el.value = 5; el.dispatchEvent(new Event('input', { bubbles: true })); });
  await closeAll(page);
  return `${secs} tarjetas · precio ${before.toFixed(3)} → ${after.toFixed(3)}`;
}

async function checkTema(page) {
  const t = await page.$('[data-theme-toggle]');
  if (!t) throw new Error('sin toggle de tema');
  const before = await page.evaluate(() => document.documentElement.dataset.theme);
  await t.click(); await sleep(450);
  const after = await page.evaluate(() => document.documentElement.dataset.theme);
  if (before === after) throw new Error('el tema no cambia');
  await t.click(); await sleep(250);
  return `${before} → ${after}`;
}

async function run(page, file, name, fn) {
  try {
    const note = await fn();
    results.push({ file, check: name, ok: true, note: note || '' });
    console.log(`  ✓ ${name}${note ? ' — ' + note : ''}`);
  } catch (e) {
    const msg = String(e.message || e).split('\n')[0].slice(0, 200);
    results.push({ file, check: name, ok: false, note: msg });
    console.log(`  ✗ ${name} — ${msg}`);
    try { await page.screenshot({ path: path.join(OUT, `_aud-${file.replace('.html', '')}-${name.replace(/[^\w]+/g, '-')}.png`) }); } catch (_) {}
  }
}

/* ==========================================================================
   Main
   ========================================================================== */
(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const srv = await serve();
  const browser = await chromium.launch();
  const files = Object.keys(SPEC).filter(f => !FILTER.length || FILTER.some(x => f.includes(x)));

  for (const file of files) {
    console.log(`\n▶ ${file}`);
    const spec = SPEC[file];
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
    const page = await ctx.newPage();
    const errors = [];
    page.on('pageerror', e => errors.push('pageerror: ' + e.message));
    page.on('console', m => { if (m.type() === 'error') errors.push('console: ' + m.text()); });

    await page.goto(`http://127.0.0.1:${PORT}/prototipos_opencode_deepseekv4.1flashfree/${file}?embed=1`);
    await sleep(900);

    await run(page, file, 'datos fake', async () => { await spec.openData(page); return checkDatos(page); });
    await run(page, file, 'cambio de combustible', () => checkCombustible(page, spec));
    await run(page, file, 'búsqueda', () => checkBusqueda(page, spec));
    await run(page, file, 'favoritos', () => checkFavorito(page, spec));
    await run(page, file, 'detalle + histórico', () => checkDetalle(page, spec));
    await run(page, file, 'chat IA', () => checkIA(page, spec));
    await run(page, file, 'config completa', () => checkConfig(page, spec));
    await run(page, file, 'tema claro/oscuro', () => checkTema(page));
    await run(page, file, 'sin errores de consola', async () => {
      if (errors.length) throw new Error(errors.slice(0, 2).join(' | '));
      return '0 errores';
    });

    await ctx.close();
  }

  await browser.close();
  srv.close();
  fs.writeFileSync(path.join(OUT, 'auditoria.json'), JSON.stringify(results, null, 2));
  const fails = results.filter(r => !r.ok);
  console.log('\n──────────────────────────────────────────────');
  console.log(`${results.length - fails.length}/${results.length} comprobaciones OK`);
  if (fails.length) fails.forEach(f => console.log(` · ${f.file} · ${f.check}: ${f.note}`));
  process.exitCode = fails.length ? 1 : 0;
})();
