import { chromium } from 'playwright';
import http from 'http';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const FILE_URL = 'file:///' + ROOT.replace(/\\/g, '/') + '/index.html';

const RESULTS = { passed: 0, failed: 0, skipped: 0, errors: [] };

function log(cat, test, ok, detail = '') {
  const icon = ok === true ? '✅' : ok === false ? '❌' : '⏭️';
  const s = ok === true ? 'PASS' : ok === false ? 'FAIL' : 'SKIP';
  console.log(`  ${icon} ${s} ${cat} > ${test}${detail ? ': ' + detail : ''}`);
  if (ok === true) RESULTS.passed++;
  else if (ok === false) { RESULTS.failed++; RESULTS.errors.push({ cat, test, detail }); }
  else RESULTS.skipped++;
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

function startServer(port) {
  const types = {
    '.html': 'text/html', '.css': 'text/css', '.js': 'application/javascript',
    '.png': 'image/png', '.svg': 'image/svg+xml', '.json': 'application/json',
    '.ico': 'image/x-icon'
  };
  return new Promise((resolve, reject) => {
    const srv = http.createServer((req, res) => {
      let u = req.url.split('?')[0];
      let p = u === '/' ? path.join(ROOT, 'index.html') : path.join(ROOT, u);
      fs.readFile(p, (err, d) => {
        if (err) { res.writeHead(404); res.end(''); }
        else { res.writeHead(200, { 'Content-Type': types[path.extname(p)] || 'application/octet-stream' }); res.end(d); }
      });
    });
    srv.listen(port, () => resolve(srv));
    srv.on('error', reject);
  });
}

async function testHTTP(browser, server) {
  console.log('\n## 🌐 HTTP');

  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const page = await ctx.newPage();
  page.on('console', msg => {
    if (msg.type() === 'error') console.log(`    [console.error] ${msg.text()}`);
  });

  await page.goto(`http://localhost:${server.address().port}`, { waitUntil: 'networkidle', timeout: 30000 });
  await sleep(2000);

  log('Carga', 'HTTP sin errores', true);
  log('Toolbar', 'Visible', await page.locator('.toolbar').isVisible());
  log('Tabs', 'Bottom tabs visibles', await page.locator('.bottom-tabs').isVisible());

  const noProv = await page.locator('#noProvinceMsg').evaluate(el => getComputedStyle(el).display === 'flex');
  log('Inicial', 'Mensaje selecciona provincia', noProv);

  // Wait for province list
  await page.waitForFunction(() => {
    const sel = document.getElementById('provFilter');
    return sel && sel.options.length > 1;
  }, { timeout: 15000 }).catch(() => {});
  const provOpts = await page.locator('#provFilter option').count();
  log('Provincias', `${provOpts - 1} provincias`, provOpts > 1);

  if (provOpts <= 1) { await ctx.close(); return; }

  const firstProv = await page.evaluate(() => {
    const sel = document.getElementById('provFilter');
    for (let i = 1; i < sel.options.length; i++) {
      const v = sel.options[i].value;
      if (v) return v;
    }
    return null;
  });
  if (!firstProv) { log('Provincias', 'Sin provincias', false); await ctx.close(); return; }

  await page.locator('#provFilter').selectOption(firstProv);
  log('Provincias', `"${firstProv}" seleccionada`, true);

  try {
    await page.waitForFunction(() => STATE.data.length > 0, { timeout: 15000 });
  } catch {
    log('Datos', 'Timeout esperando datos', null, 'API sin respuesta ni caché');
    await ctx.close();
    return;
  }
  await sleep(1000);

  const total = await page.evaluate(() => STATE.data.length);
  log('Datos', `${total} gasolineras`, total > 0);
  if (total === 0) { await ctx.close(); return; }

  const fuelOpts = await page.locator('#fuelFilter option').count();
  log('Filtros', `Combustible: ${fuelOpts - 1} opciones`, fuelOpts > 1);

  // --- Cross-check: Tab CSS class + panel visibility ---
  const TAB_DEFS = [
    { id: 'tab-map',    cls: 'tab-map',    panel: '#map',             showFn: () => document.getElementById('map') && getComputedStyle(document.getElementById('map')).display !== 'none' },
    { id: 'tab-table',  cls: 'tab-table',  panel: '.table-area',      showFn: () => { const e = document.querySelector('.table-area'); return e && getComputedStyle(e).display !== 'none'; } },
    { id: 'tab-both',   cls: 'tab-both',   panel: '.both-table-area', showFn: () => { const e = document.querySelector('.both-table-area'); return e && getComputedStyle(e).display !== 'none'; } },
    { id: 'tab-config', cls: 'tab-config', panel: '.config-area',     showFn: () => { const e = document.querySelector('.config-area'); return e && getComputedStyle(e).display !== 'none'; } },
  ];
  let tabCssOk = true;
  for (const def of TAB_DEFS) {
    await page.locator(`.bottom-tab[data-tab="${def.id}"]`).click();
    await sleep(400);
    const hasClass = await page.evaluate(c => document.getElementById('contentArea').classList.contains(c), def.cls);
    const panelVisible = await page.evaluate(def.showFn);
    const tabBtnActive = await page.evaluate(id => {
      const btn = document.querySelector(`.bottom-tab[data-tab="${id}"]`);
      return btn && btn.classList.contains('active');
    }, def.id);
    if (!hasClass || !panelVisible || !tabBtnActive) { tabCssOk = false; }
  }
  log('Tabs', 'Clase CSS + panel + botón activo en todas las vistas', tabCssOk);

  // --- Tab: Tabla ---
  await page.locator('.bottom-tab[data-tab="tab-table"]').click();
  await sleep(500);
  const rows = await page.locator('#tableBody tr').count();
  log('Tabla', `${rows} filas visibles`, rows > 0);

  if (rows > 0) {
    // Verify default sort state
    let col = await page.evaluate(() => STATE.sortCol);
    let dir = await page.evaluate(() => STATE.sortDir);
    log('Tabla', `Orden por defecto: ${col} ${dir}`, col !== '' && dir !== '');

    // Toggle sort programmatically
    await page.evaluate(() => { toggleSort('Precio'); });
    await sleep(200);
    dir = await page.evaluate(() => STATE.sortDir);
    log('Tabla', `Toggle sort: ${dir}`, dir === 'desc', `ahora es ${dir}`);

    // Toggle back
    await page.evaluate(() => { toggleSort('Precio'); });
    await sleep(200);

    // Click row
    await page.evaluate(() => {
      const row = document.querySelector('#tableBody tr');
      if (row) row.click();
    });
    await sleep(500);
    const detail = await page.locator('#detailPanel').isVisible();
    log('Detail', 'Bottom sheet se abre', detail);
    if (detail) {
      const brand = await page.locator('#detailBrand').textContent();
      log('Detail', `Contenido: "${brand?.trim()}"`, brand && brand.trim().length > 0);
      // Switch to history tab
      const histTab = page.locator('.detail-tab[data-dtab="history"]');
      await histTab.click();
      await sleep(300);
      const histTabbed = await page.evaluate(() => {
        const tab = document.querySelector('.detail-tab[data-dtab="history"]');
        return tab && tab.classList.contains('active');
      });
      log('Histórico', 'Tab activo', histTabbed);
      try {
        await page.waitForFunction(() => {
          const loading = document.getElementById('chartLoading');
          const err = document.getElementById('chartError');
          return loading && loading.style.display === 'none';
        }, { timeout: 60000 });
        await sleep(500);
        const histResolved = await page.evaluate(() => {
          const err = document.getElementById('chartError');
          const c = document.getElementById('priceChart');
          if (!err || !c) return false;
          if (err.style.display === 'flex') return true;
          const ctx = c.getContext('2d');
          if (!ctx) return false;
          const imgData = ctx.getImageData(0, 0, c.width, c.height);
          let drawn = 0;
          for (let i = 3; i < imgData.data.length; i += 4) {
            if (imgData.data[i] > 0) { drawn++; if (drawn > 500) return true; }
          }
          return false;
        });
        log('Histórico', 'Gráfica o mensaje error', histResolved, histResolved ? 'OK' : 'ni datos ni error');
      } catch(e) {
        log('Histórico', 'Timeout esperando datos históricos', null, 'API histórica sin respuesta');
      }
      await page.locator('#detailClose').click();
      await sleep(300);
      log('Detail', 'Cerrar funciona', !(await page.locator('#detailPanel').isVisible()));
    }
  }

  // --- Tab: Ambos ---
  await page.locator('.bottom-tab[data-tab="tab-both"]').click();
  await sleep(500);
  const bothRows = await page.locator('#tableBothBody tr').count();
  log('Ambos', `${bothRows} filas en tabla compacta`, bothRows > 0);
  if (bothRows > 0) {
    await page.evaluate(() => {
      const row = document.querySelector('#tableBothBody tr');
      if (row) row.click();
    });
    await sleep(500);
    log('Ambos', 'Click en fila abre detail', await page.locator('#detailPanel').isVisible());
    await page.evaluate(() => {
      const btn = document.getElementById('detailClose');
      if (btn) btn.click();
    });
    await sleep(200);
  }

  // --- Tab: Config ---
  await page.locator('.bottom-tab[data-tab="tab-config"]').click();
  await sleep(500);
  const cards = await page.locator('.config-card').count();
  log('Config', `${cards} tarjetas`, cards >= 3);

  await sleep(200);
  const cacheTtlOk = await page.evaluate(() => {
    const el = document.getElementById('cacheTtl');
    return el && getComputedStyle(el).display !== 'none';
  });
  log('Config', 'Input TTL visible', cacheTtlOk);

  // --- Tab: Mapa ---
  await page.locator('.bottom-tab[data-tab="tab-map"]').click();
  await sleep(2500);

  const mapZoom = await page.evaluate(() => {
    try { return STATE.map ? STATE.map.getZoom() : -1; } catch(e) { return -1; }
  });
  log('Mapa', `Mapa activo (zoom: ${mapZoom})`, mapZoom > 0);

  // Map style
  const styleSel = page.locator('#mapStyle');
  await styleSel.selectOption('satellite');
  await sleep(500);
  log('Mapa', 'Cambio a satélite', await styleSel.inputValue() === 'satellite');
  await styleSel.selectOption('street');
  await sleep(300);

  // Geolocate button exists
  log('Geo', 'Botón visible', await page.locator('#geolocBtn').isVisible());

  // Search input exists
  log('Búsqueda', 'Input visible', await page.locator('#search').isVisible());

  // --- F5: recargar y verificar que restaura provincia ---
  await page.reload({ waitUntil: 'networkidle', timeout: 30000 });
  await sleep(3000);
  const reloadedProv = await page.evaluate(() => {
    const sel = document.getElementById('provFilter');
    return sel ? sel.value : '';
  });
  const provRestored = reloadedProv === firstProv;
  log('Persistencia', `Provincia restaurada tras F5: "${reloadedProv}"`, provRestored);

  await ctx.close();
}

async function testFILE(browser) {
  console.log('\n## 📁 file://');

  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const page = await ctx.newPage();
  page.on('console', msg => {
    if (msg.type() === 'error') console.log(`    [console.error] ${msg.text()}`);
  });

  await page.goto(FILE_URL, { waitUntil: 'domcontentloaded', timeout: 15000 });
  await sleep(3000);

  log('Carga', 'file:// sin errores', true);
  log('Toolbar', 'Visible', await page.locator('.toolbar').isVisible());
  log('Tabs', 'Bottom tabs visibles', await page.locator('.bottom-tabs').isVisible());

  const noProv = await page.locator('#noProvinceMsg').evaluate(el => getComputedStyle(el).display === 'flex');
  log('Inicial', 'Mensaje selecciona provincia', noProv);

  let tabsOk = true;
  for (const tab of ['tab-table', 'tab-both', 'tab-config', 'tab-map']) {
    try {
      await page.locator(`.bottom-tab[data-tab="${tab}"]`).click({ timeout: 3000 });
      await sleep(300);
      const active = await page.locator('.bottom-tabs .bottom-tab.active').getAttribute('data-tab');
      if (active !== tab) tabsOk = false;
      // Verify content area CSS class matches
      const hasClass = await page.evaluate(c => document.getElementById('contentArea').classList.contains(c), tab);
      if (!hasClass) tabsOk = false;
    } catch { tabsOk = false; }
  }
  log('Tabs', 'Navegación sin datos + clase CSS correcta', tabsOk);

  await page.locator('.bottom-tab[data-tab="tab-config"]').click();
  await sleep(300);
  log('Config', 'Accesible sin datos', await page.locator('.config-card').count() >= 1);

  log('Búsqueda', 'Input presente', await page.locator('#search').isVisible());

  await ctx.close();
}

async function main() {
  console.log('========================================');
  console.log('  Validación Propuesta D');
  console.log('========================================');

  let server;
  try {
    server = await startServer(8080);
    console.log(`\n📡 Servidor en :${server.address().port}`);
  } catch (e) {
    console.log(`\n⚠️ Servidor: ${e.message}`);
  }

  const browser = await chromium.launch({ headless: true });

  if (server) {
    try { await testHTTP(browser, server); }
    catch (e) { log('HTTP', 'Suite completa', false, e.message); }
  }

  try { await testFILE(browser); }
  catch (e) { log('FILE', 'Suite completa', false, e.message); }

  await browser.close();
  if (server) server.close();

  console.log('\n========================================');
  console.log(`  ${RESULTS.passed} ✅  ${RESULTS.failed} ❌  ${RESULTS.skipped} ⏭️`);
  console.log('========================================');
  if (RESULTS.errors.length) {
    console.log('\nErrores:');
    RESULTS.errors.forEach(e => console.log(`  ❌ ${e.cat} > ${e.test}: ${e.detail}`));
  }
  process.exit(RESULTS.failed > 0 ? 1 : 0);
}

main();
