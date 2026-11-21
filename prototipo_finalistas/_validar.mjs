// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 Juan Blanco Antelo — Localiza tu Gasolinera

/**
 * Validador de los tres finalistas.
 *
 *   node prototipo_finalistas/_validar.mjs
 *
 * · Levanta un servidor HTTP local para el modo normal y comprueba además una
 *   página por file:// (el requisito real: doble clic).
 * · Recorre 390×844 y 1440×900, pulsa navegación, filtra, abre fichas, cambia
 *   litros, usa la paleta y recarga para verificar la persistencia.
 * · Falla (exit 1) si hay errores de consola, excepciones o una comprobación
 *   no se cumple. Guarda capturas en capturas/ e informe.json.
 */
import { chromium } from 'playwright';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = __dirname;
const OUT = path.join(ROOT, 'capturas');
fs.mkdirSync(OUT, { recursive: true });

const PAGES = [
  { id: '01-pulgar', layout: 'thumb', file: 'finalista-01-pulgar.html', name: 'El pulgar' },
  { id: '02-torre', layout: 'tower', file: 'finalista-02-torre.html', name: 'Torre de control' },
  { id: '03-una-app', layout: 'unified', file: 'finalista-03-una-app.html', name: 'Una app' },
];
const VIEWPORTS = [
  { id: 'mv', width: 390, height: 844, label: 'móvil 390×844' },
  { id: 'pc', width: 1440, height: 900, label: 'escritorio 1440×900' },
];

const MIME = {
  '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8', '.svg': 'image/svg+xml',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.ico': 'image/x-icon',
};

function serve() {
  const server = http.createServer((req, res) => {
    const url = decodeURIComponent((req.url || '/').split('?')[0]);
    const rel = url === '/' ? 'index.html' : url.replace(/^\/+/, '');
    const abs = path.join(ROOT, rel);
    if (!abs.startsWith(ROOT)) { res.writeHead(403).end(''); return; }
    fs.readFile(abs, (err, data) => {
      if (err) { res.writeHead(404, { 'Content-Type': 'text/plain' }).end('not found'); return; }
      res.writeHead(200, { 'Content-Type': MIME[path.extname(abs).toLowerCase()] || 'application/octet-stream' });
      res.end(data);
    });
  });
  return new Promise((resolve) => server.listen(0, '127.0.0.1', () => resolve({ server, port: server.address().port })));
}

const results = [];
function check(scope, ok, detail = '') {
  results.push({ scope, ok: !!ok, detail });
  const mark = ok ? '  ✓' : '  ✗';
  console.log(`${mark} ${scope}${detail ? ' — ' + detail : ''}`);
}

async function closeAll(page) {
  await page.evaluate(() => {
    document.querySelectorAll('.pf-overlay.on [data-fl-act="close-overlay"], .sheet.open [data-fl-act="close-detail"]').forEach(b => b.click());
  }).catch(() => {});
  await page.waitForTimeout(140);
}

async function visible(locator) {
  return locator.count() > 0 && await locator.first().isVisible();
}

async function openTab(page, layout, tab) {
  const nav = layout === 'thumb' ? '.fl-thumb-nav' : layout === 'tower' ? ':is(.fl-rail-nav,.fl-tower-nav)' : '.fl-bottomnav';
  const btn = page.locator(`${nav} [data-tab="${tab}"]:visible`).first();
  if (await btn.count()) { await btn.click(); return true; }
  return false;
}

async function paletteRun(page, text) {
  await page.keyboard.press('Control+K');
  await page.waitForSelector('.fl-cmdk.on input', { timeout: 2000 });
  await page.fill('.fl-cmdk.on input', text);
  await page.waitForTimeout(90);
  await page.keyboard.press('Enter');
  await page.waitForTimeout(220);
}

async function openDetail(page, layout) {
  if (layout === 'unified') {
    await openTab(page, layout, 'tabla');
    await page.waitForTimeout(150);
    await page.locator('#flTableUni tbody tr').first().click();
  } else if (layout === 'tower') {
    await page.locator('#flCenterBody .fl-row').first().click();
  } else {
    await page.locator('#flSheetBody .fl-row').first().click();
  }
  await page.waitForTimeout(260);
}

async function closeDetail(page) {
  await page.evaluate(() => {
    document.querySelectorAll('.pf-overlay.on [data-fl-act="close-overlay"], .sheet.open [data-fl-act="close-detail"]').forEach(b => b.click());
  });
  await page.waitForTimeout(180);
}

async function runOne(browser, baseURL, pageDef, vp) {
  const scope = `${pageDef.id} · ${vp.id}`;
  console.log(`\n▶ ${pageDef.name} · ${vp.label}`);
  const context = await browser.newContext({ viewport: { width: vp.width, height: vp.height }, deviceScaleFactor: 1 });
  const page = await context.newPage();
  const errors = [];
  page.on('console', (m) => {
    if (m.type() !== 'error') return;
    const t = m.text();
    if (/favicon|ERR_FILE_NOT_FOUND.*favicon/i.test(t)) return;
    errors.push(t);
  });
  page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));

  await page.goto(`${baseURL}/${pageDef.file}`, { waitUntil: 'load' });
  await page.waitForSelector('[data-fl]', { timeout: 4000 });
  await page.waitForTimeout(700);

  const hasApp = await page.locator('.fl-app, .fl-tower, .fl-unified').count() > 0;
  check(`${scope} · arranca`, hasApp, pageDef.name);
  check(`${scope} · consola limpia al cargar`, errors.length === 0, errors.join(' | '));
  await page.screenshot({ path: path.join(OUT, `finalista-${pageDef.id}-${vp.id}-inicio.png`) });

  /* Lista / tabla inicial ------------------------------------------------ */
  if (pageDef.layout === 'unified') {
    await openTab(page, pageDef.layout, 'tabla');
    await page.waitForTimeout(220);
    const rows = await page.locator('#flTableUni tbody tr').count();
    check(`${scope} · tabla con estaciones`, rows === 11, `${rows} filas de Madrid`);
  } else {
    const rows = await page.locator(pageDef.layout === 'thumb' ? '#flSheetBody .fl-row' : '#flCenterBody .fl-row').count();
    check(`${scope} · lista con estaciones`, rows === 11, `${rows} filas de Madrid`);
  }

  /* Provincia ------------------------------------------------------------ */
  const provSel = pageDef.layout === 'thumb' ? '.fl-thumb-top [data-fl-field="province"]'
    : pageDef.layout === 'tower' ? '[data-fl-field="province"]:visible'
    : '#flToolbar [data-fl-field="province"]';
  const prov = page.locator(provSel).first();
  await prov.selectOption('Zaragoza');
  await page.waitForTimeout(260);
  let count;
  if (pageDef.layout === 'unified') {
    count = await page.locator('#flTableUni tbody tr').count();
  } else {
    count = await page.locator(pageDef.layout === 'thumb' ? '#flSheetBody .fl-row' : '#flCenterBody .fl-row').count();
  }
  check(`${scope} · filtro provincia`, count === 6, `Zaragoza → ${count} estaciones`);

  /* Combustible ---------------------------------------------------------- */
  const fuelSel = pageDef.layout === 'thumb' ? '.fl-thumb-top [data-fl-field="fuel"]'
    : pageDef.layout === 'tower' ? '[data-fl-field="fuel"]:visible'
    : '#flToolbar [data-fl-field="fuel"]';
  await page.locator(fuelSel).first().selectOption('g98');
  await page.waitForTimeout(200);
  const fuel = await page.evaluate(() => FinalistCore.state.fuel);
  check(`${scope} · cambio de combustible`, fuel === 'g98', 'Gasolina 98');
  await page.locator(fuelSel).first().selectOption('diesel');
  await page.waitForTimeout(200);

  /* Estilos de mapa ------------------------------------------------------ */
  /* En "Una app" el selector vive sobre el mapa: hay que abrir esa pestaña. */
  if (pageDef.layout === 'unified') {
    await openTab(page, pageDef.layout, 'mapa');
    await page.waitForTimeout(250);
  }
  const styleSel = page.locator('[data-fl-field="mapStyle"]:visible').first();
  let styleOk = false;
  if (await styleSel.count()) {
    await styleSel.selectOption('satelite');
    await page.waitForTimeout(180);
    styleOk = await page.evaluate(() => {
      const maps = Array.from(document.querySelectorAll('.pm'));
      return maps.length > 0 && maps.every(el => el.dataset.mapstyle === 'satelite');
    });
    await styleSel.selectOption('claro');
    await page.waitForTimeout(150);
  }
  check(`${scope} · estilos de mapa`, styleOk, '10 paletas · Satélite aplicado');

  await prov.selectOption('Madrid');
  await page.waitForTimeout(260);

  /* Detalle + favorito --------------------------------------------------- */
  await openDetail(page, pageDef.layout);
  const actionTile = page.locator('.actions-grid').first();
  check(`${scope} · ficha con acciones`, await actionTile.isVisible(), '4 acciones');
  const hasChart = await page.locator('.sheet.open canvas, .pf-overlay.on canvas, #flInspectorBody canvas').first().isVisible().catch(() => false);
  check(`${scope} · histórico con gráfica`, hasChart);

  const favBefore = await page.evaluate(() => FinalistCore.state.favIds.length);
  await page.locator('.actions-grid [data-act="fav"]').first().click();
  await page.waitForTimeout(320);
  const favAfter = await page.evaluate(() => FinalistCore.state.favIds.length);
  check(`${scope} · favorito desde la ficha`, favAfter === favBefore + 1, `${favBefore} → ${favAfter}`);

  await closeDetail(page);

  /* Comparador ----------------------------------------------------------- */
  if (pageDef.layout === 'thumb') {
    await page.locator('#flSheetBody [data-fl-act="comparar"]').first().click();
  } else {
    await openTab(page, pageDef.layout, 'comparar');
  }
  await page.waitForTimeout(350);
  const hero = page.locator('.fl-cmp-hero').first();
  check(`${scope} · comparador`, await hero.isVisible());
  const litres = page.locator('.fl-cmp-hero, .pf-overlay.on, #flCenterBody').locator('input[data-fl-field="litros"]').first();
  if (await litres.count()) {
    const before = await hero.innerText();
    await litres.fill('80');
    await litres.press('Tab');
    await page.waitForTimeout(300);
    const after = await page.locator('.fl-cmp-hero').first().innerText();
    check(`${scope} · comparador recalcula`, before !== after, 'litros 50 → 80');
  } else {
    check(`${scope} · comparador recalcula`, false, 'no se encontró el campo de litros');
  }
  await page.screenshot({ path: path.join(OUT, `finalista-${pageDef.id}-${vp.id}-comparador.png`) });
  await closeAll(page);

  /* Planificador --------------------------------------------------------- */
  if (!(await openTab(page, pageDef.layout, 'plan'))) await paletteRun(page, 'planificador');
  await page.waitForTimeout(350);
  const dayCount = await page.locator('.fl-day').count();
  check(`${scope} · planificador`, dayCount === 7, `${dayCount} días de previsión`);
  const gauge = await page.locator('.fl-gauge').count();
  check(`${scope} · depósito y autonomía`, gauge > 0);
  await page.screenshot({ path: path.join(OUT, `finalista-${pageDef.id}-${vp.id}-plan.png`) });
  await closeAll(page);

  /* Asistente ------------------------------------------------------------ */
  if (!(await openTab(page, pageDef.layout, 'asistente'))) {
    const top = page.locator('[data-fl-act="asistente"]:visible').first();
    if (await top.count()) await top.click();
  }
  await page.waitForTimeout(300);
  const stepChoices = await page.locator('.fl-choice').count();
  check(`${scope} · asistente paso 1`, stepChoices > 0);
  await page.locator('[data-fl-act="assist-next"]').first().click();
  await page.waitForTimeout(200);
  await page.locator('[data-fl-act="assist-next"]').first().click();
  await page.waitForTimeout(300);
  check(`${scope} · asistente recomendación`, await page.locator('.fl-reco').first().isVisible());
  await closeAll(page);

  /* Configuración -------------------------------------------------------- */
  if (!(await openTab(page, pageDef.layout, 'config'))) await paletteRun(page, 'configuración');
  await page.waitForTimeout(400);
  check(`${scope} · configuración`, await page.locator('.pf-cfg').first().isVisible());
  const secs = await page.locator('.pf-cfg [data-sec]').count();
  check(`${scope} · tarjetas de configuración`, secs >= 8, `${secs} secciones`);
  const disc = page.locator('.pf-cfg [data-sec="disc"]').first();
  check(`${scope} · descuentos por marca`, await disc.isVisible());
  await closeAll(page);

  /* Chat IA -------------------------------------------------------------- */
  if (!(await openTab(page, pageDef.layout, 'ia'))) await paletteRun(page, 'chat ia');
  await page.waitForTimeout(400);
  check(`${scope} · panel IA`, await page.locator('.pf-ia').first().isVisible());
  const iaTabs = await page.locator('.pf-ia-tabs .chip').count();
  check(`${scope} · General + 7 proveedores`, iaTabs === 8, `${iaTabs} pestañas`);
  await closeAll(page);

  /* Insights ------------------------------------------------------------- */
  let openedInsights = await openTab(page, pageDef.layout, 'insights');
  if (!openedInsights) {
    const insBtn = page.locator('[data-fl-act="insights"]:visible').first();
    if (await insBtn.count()) { await insBtn.click(); openedInsights = true; }
  }
  if (!openedInsights) { await paletteRun(page, 'insights'); openedInsights = true; }
  await page.waitForTimeout(350);
  const insights = await page.locator('.fl-insight').count();
  check(`${scope} · insights`, insights >= 3, `${insights} tarjetas`);
  await closeAll(page);

  /* Paleta de comandos + tema ------------------------------------------- */
  await page.keyboard.press('Control+K');
  await page.waitForSelector('.fl-cmdk.on input', { timeout: 2000 });
  const cmds = await page.locator('.fl-cmdk-item').count();
  check(`${scope} · paleta Ctrl+K`, cmds >= 10, `${cmds} comandos`);
  await page.fill('.fl-cmdk.on input', 'tema');
  await page.waitForTimeout(120);
  const themeBefore = await page.evaluate(() => document.documentElement.dataset.theme);
  await page.keyboard.press('Enter');
  await page.waitForTimeout(250);
  const themeAfter = await page.evaluate(() => document.documentElement.dataset.theme);
  check(`${scope} · cambio de tema`, themeBefore !== themeAfter, `${themeBefore} → ${themeAfter}`);
  await page.keyboard.press('Control+K');
  await page.fill('.fl-cmdk.on input', 'tema');
  await page.keyboard.press('Enter');
  await page.waitForTimeout(200);

  /* Modo conducción ------------------------------------------------------ */
  const driveBtn = page.locator('[data-fl-act="drive"]:visible').first();
  if (await driveBtn.count()) {
    await driveBtn.click();
    await page.waitForTimeout(300);
    const driveOn = await page.locator('.fl-drive').count();
    check(`${scope} · modo conducción`, driveOn > 0);
    if (driveOn) {
      const price = await page.locator('.fl-drive .p').first().innerText();
      check(`${scope} · precio legible`, /\d,\d{3}/.test(price), price.replace(/\s+/g, ' '));
      await page.locator('.fl-drive [data-fl-act="drive-next"]').click();
      await page.waitForTimeout(180);
      await page.locator('.fl-drive [data-fl-act="drive-close"]').first().click();
      await page.waitForTimeout(180);
    }
  } else {
    check(`${scope} · modo conducción`, false, 'botón no visible');
  }

  /* Persistencia --------------------------------------------------------- */
  await page.evaluate(() => { FinalistCore.set({ province: 'Sevilla', fuel: 'g95' }); });
  await page.waitForTimeout(320);
  await page.reload({ waitUntil: 'load' });
  await page.waitForSelector('[data-fl]', { timeout: 4000 });
  await page.waitForTimeout(600);
  const persisted = await page.evaluate(() => ({
    province: FinalistCore.state.province,
    fuel: FinalistCore.state.fuel,
    favs: FinalistCore.state.favIds.length,
    saved: !!localStorage.getItem('gasolineras_finalistas_v1'),
  }));
  check(`${scope} · persistencia tras recarga`, persisted.province === 'Sevilla' && persisted.fuel === 'g95' && persisted.saved,
    `provincia ${persisted.province}, combustible ${persisted.fuel}`);
  check(`${scope} · favoritos persisten`, persisted.favs === favAfter, `${persisted.favs} favoritos`);

  if (pageDef.layout === 'unified') {
    await openTab(page, pageDef.layout, 'tabla');
    await page.waitForTimeout(250);
    const n = await page.locator('#flTableUni tbody tr').count();
    check(`${scope} · provincia restaurada en la vista`, n === 4, `Sevilla → ${n} estaciones`);
  } else {
    /* La torre restaura el último panel abierto (insights en este recorrido):
       hay que volver a Explorar para contar las estaciones de la provincia. */
    if (pageDef.layout === 'tower') {
      await openTab(page, pageDef.layout, 'explorar');
      await page.waitForTimeout(250);
    }
    const n = await page.locator(pageDef.layout === 'thumb' ? '#flSheetBody .fl-row' : '#flCenterBody .fl-row').count();
    check(`${scope} · provincia restaurada en la vista`, n === 4, `Sevilla → ${n} estaciones`);
  }

  check(`${scope} · consola limpia al final`, errors.length === 0, errors.slice(0, 4).join(' | '));

  /* Restaurar un estado limpio para la siguiente pasada. */
  await page.evaluate(() => { FinalistCore.reset(); localStorage.removeItem('proto_theme'); });
  await page.waitForTimeout(200);

  await context.close();
  return { page: pageDef.id, viewport: vp.id, errors, checks: results.filter(r => r.scope.startsWith(scope)) };
}

async function runFileProtocol(browser) {
  console.log('\n▶ file:// (doble clic) · finalista 01');
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error' && !/favicon/i.test(m.text())) errors.push(m.text()); });
  const url = 'file:///' + path.join(ROOT, 'finalista-01-pulgar.html').replace(/\\/g, '/');
  await page.goto(url, { waitUntil: 'load' });
  await page.waitForSelector('[data-fl]', { timeout: 4000 });
  await page.waitForTimeout(700);
  const rows = await page.locator('#flSheetBody .fl-row').count();
  check('file:// · abre y pinta estaciones', rows === 11, `${rows} filas`);
  check('file:// · consola limpia', errors.length === 0, errors.join(' | '));
  await context.close();
}

(async () => {
  const { server, port } = await serve();
  const baseURL = `http://127.0.0.1:${port}`;
  console.log(`Servidor local: ${baseURL}`);
  const browser = await chromium.launch({ headless: true });
  let failed = false;
  try {
    for (const pageDef of PAGES) {
      for (const vp of VIEWPORTS) {
        await runOne(browser, baseURL, pageDef, vp);
      }
    }
    await runFileProtocol(browser);
  } catch (e) {
    failed = true;
    console.error('\n✗ Excepción en la validación:', e);
  } finally {
    await browser.close();
    server.close();
  }

  const total = results.length;
  const ok = results.filter(r => r.ok).length;
  const report = {
    fecha: new Date().toISOString(),
    total, ok, fallos: total - ok,
    checks: results,
  };
  fs.writeFileSync(path.join(OUT, 'informe.json'), JSON.stringify(report, null, 2), 'utf8');
  console.log(`\n${ok}/${total} comprobaciones OK${total - ok ? ` · ${total - ok} FALLOS` : ''}`);
  console.log(`Capturas e informe en ${path.relative(process.cwd(), OUT)}`);
  process.exit(failed || ok !== total ? 1 : 0);
})();
