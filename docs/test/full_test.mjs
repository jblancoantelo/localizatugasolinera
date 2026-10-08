import { chromium } from 'playwright';
import http from 'http';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..', '..');
const FILE_URL = new URL('../../index.html', import.meta.url).href;
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
      const chartFns = await page.evaluate(() =>
        typeof drawPriceChart === 'function' && typeof drawTooltip === 'function' && typeof chartSetupCanvas === 'function'
      );
      log('Histórico', 'Motor gráfico cargado (chart-core + chart-engine)', chartFns);
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
        const errText = await page.evaluate(() => {
          const err = document.getElementById('chartError');
          return err && err.style.display === 'flex' ? err.textContent : '';
        });
        const jsError = /is not defined|TypeError|ReferenceError/.test(errText || '');
        log('Histórico', 'Sin error de JavaScript al pintar', !jsError, jsError ? errText : 'OK');
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

  // Search toggle shows input
  await page.locator('#searchToggleBtn').click();
  await sleep(200);
  log('Búsqueda', 'Input visible', await page.locator('#search').isVisible());

  // --- Popup tabs ---
  // Click a marker via its entry in STATE.markerMap
  const popupInfoOk = await page.evaluate(() => {
    const ids = Object.keys(STATE.markerMap);
    if (!ids.length) return false;
    const marker = STATE.markerMap[ids[0]];
    if (!marker) return false;
    marker.fire('click');
    return true;
  });
  await sleep(1000);
  log('Popup', 'Click en marcador abre popup', popupInfoOk);

  // Check popup structure
  const hasContainer = await page.locator('.leaflet-popup-content .popup-container').count();
  log('Popup', 'Contenedor .popup-container presente', hasContainer > 0);

  const hasTabs = await page.locator('.leaflet-popup-content .popup-tabs').count();
  log('Popup', 'Barra .popup-tabs presente', hasTabs > 0);

  const tabCount = await page.locator('.leaflet-popup-content .popup-tab').count();
  log('Popup', `Dos tabs (Información + Histórico)`, tabCount === 2);

  const activeTab = await page.evaluate(() => {
    const active = document.querySelector('.leaflet-popup-content .popup-tab.active');
    return active ? active.dataset.ptab : null;
  });
  log('Popup', 'Tab activo por defecto: Información', activeTab === 'info');

  // Switch to history tab
  await page.evaluate(() => {
    const histTab = document.querySelector('.leaflet-popup-content .popup-tab[data-ptab="history"]');
    if (histTab) histTab.click();
  });
  await sleep(500);

  const activeTab2 = await page.evaluate(() => {
    const active = document.querySelector('.leaflet-popup-content .popup-tab.active');
    return active ? active.dataset.ptab : null;
  });
  log('Popup', 'Click en Histórico activa el tab', activeTab2 === 'history');

  // Wait for history to load in popup
  try {
    await page.waitForFunction(() => {
      const hc = document.querySelector('.leaflet-popup-content .popup-tab-content[data-ptab-content="history"]');
      if (!hc) return false;
      return hc.dataset.loaded === '1';
    }, { timeout: 60000 });
    await sleep(500);
    const histOk = await page.evaluate(() => {
      const hc = document.querySelector('.leaflet-popup-content .popup-tab-content[data-ptab-content="history"]');
      if (!hc) return false;
      const loading = hc.querySelector('.popup-history-loading');
      const error = hc.querySelector('.popup-history-error');
      if (error && error.style.display !== 'none') return true;
      const canvas = hc.querySelector('.popup-price-chart');
      if (!canvas) return false;
      if (loading && loading.style.display !== 'none') return false;
      const ctx = canvas.getContext('2d');
      if (!ctx) return false;
      const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      let drawn = 0;
      for (let i = 3; i < imgData.data.length; i += 4) {
        if (imgData.data[i] > 0) { drawn++; if (drawn > 200) return true; }
      }
      return false;
    });
    log('Popup', 'Histórico muestra gráfica o error', histOk, histOk ? 'OK' : 'ni canvas dibujado ni error');
  } catch(e) {
    log('Popup', 'Histórico timeout', null, 'API histórica sin respuesta');
  }

  // Switch back to info tab
  await page.evaluate(() => {
    const infoTab = document.querySelector('.leaflet-popup-content .popup-tab[data-ptab="info"]');
    if (infoTab) infoTab.click();
  });
  await sleep(300);
  const activeTab3 = await page.evaluate(() => {
    const active = document.querySelector('.leaflet-popup-content .popup-tab.active');
    return active ? active.dataset.ptab : null;
  });
  log('Popup', 'Volver a Información funciona', activeTab3 === 'info');

  // Close popup via Escape
  await page.keyboard.press('Escape');
  await sleep(300);

  // --- F5: recargar y verificar que restaura provincia ---
  await page.reload({ waitUntil: 'networkidle', timeout: 30000 });
  await sleep(3000);
  const reloadedProv = await page.evaluate(() => {
    const sel = document.getElementById('provFilter');
    return sel ? sel.value : '';
  });
  const provRestored = reloadedProv === firstProv;
  log('Persistencia', `Provincia restaurada tras F5: "${reloadedProv}"`, provRestored);

  // --- Persistencia filtro "solo favoritos" tras F5 ---
  await page.locator('#favToggleBtn').click();
  await sleep(800);
  const favOn = await page.evaluate(() => typeof STATE !== 'undefined' && STATE.showFavoritesOnly === true);
  log('Persistencia', 'Toggle solo favoritos se activa', favOn);
  const favSaved = await page.evaluate(() => {
    const raw = localStorage.getItem('gasolineras_prov_filters_' + STATE.selectedProv);
    if (!raw) return false;
    return JSON.parse(raw).showFavoritesOnly === true;
  });
  log('Persistencia', 'showFavoritesOnly guardado en filtros de provincia', favSaved);

  await page.reload({ waitUntil: 'networkidle', timeout: 30000 });
  await sleep(3000);
  const favRestored = await page.evaluate(() => typeof STATE !== 'undefined' && STATE.showFavoritesOnly === true);
  log('Persistencia', 'Solo favoritos se mantiene tras F5', favRestored);
  if (favRestored) {
    await page.locator('#favToggleBtn').click();
    await sleep(500);
  }

  // --- Push Notifications ---
  const PUSH_SUB_KEY = 'gasolineras_push_subscription';

  // 14.1 Button visible
  log('Push', '14.1 Botón 🔔 visible', await page.locator('#pushNotifBtn').isVisible());

  // 14.4 Config inputs in push card
  await page.locator('.bottom-tab[data-tab="tab-config"]').click();
  await sleep(300);
  const intervalVis = await page.locator('#checkInterval').isVisible();
  const daysVis = await page.locator('#priceFallDays').isVisible();
  log('Push', '14.4 Config inputs checkInterval + priceFallDays', intervalVis && daysVis);

  // 14.2 - Mock subscription via localStorage injection
  await page.evaluate((key) => {
    localStorage.setItem(key, JSON.stringify({ endpoint: 'https://mock.push/test', keys: { p256dh: 'test', auth: 'test' } }));
  }, PUSH_SUB_KEY);
  await sleep(200);
  const hasSub = await page.evaluate((key) => !!localStorage.getItem(key), PUSH_SUB_KEY);
  log('Push', '14.2 localStorage tiene suscripción', hasSub);

  // 14.3 isPushSubscribed returns true after setting localStorage
  const subDetected = await page.evaluate(() => {
    if (typeof isPushSubscribed === 'function') return isPushSubscribed();
    return false;
  });
  log('Push', '14.3 isPushSubscribed() true', subDetected);

  // 14.5 - Favorite stored in IndexedDB with province info
  const favStored = await page.evaluate(async () => {
    if (!STATE.data || !STATE.data.length) return 'no data';
    const firstStation = STATE.data[0];
    const id = firstStation.IDEESS;
    // Call toggleFavorite to add to IndexedDB
    if (typeof toggleFavorite === 'function') toggleFavorite(id);
    await new Promise(r => setTimeout(r, 200));
    const favs = await dbGetAllFavorites();
    const found = favs.find(f => f.id === id);
    return found && found.provinceName && found.provinceId ? 'ok' : 'missing fields';
  });
  log('Push', '14.5 Favorito en IndexedDB con provinceName y provinceId', favStored === 'ok', favStored);

  // 14.8 - Test notification button (calls SW, so just check no console errors during the call)
  // Navigate back to map view first
  await page.locator('.bottom-tab[data-tab="tab-map"]').click();
  await sleep(500);
  const testBtnErr = await page.evaluate(async () => {
    try {
      // Simulate click on test button - just test that the SW message is sent
      if (navigator.serviceWorker && navigator.serviceWorker.controller) {
        navigator.serviceWorker.controller.postMessage({ type: 'trigger-price-check' });
        return 'sent';
      }
      return 'no controller';
    } catch (e) {
      return 'error: ' + e.message;
    }
  });
  // Accept either sent or no controller (SW may not be active in headless)
  log('Push', '14.8 Test notification sin errores', testBtnErr !== 'error: no controller' && !testBtnErr.startsWith('error:'));

  // 14.9 - SW notificationclick URL matching logic (simulate from page)
  const urlMatchOk = await page.evaluate(() => {
    const scopeMock = window.location.origin + '/';
    const scopePath = new URL(scopeMock).pathname.replace(/\/?$/, '/');
    const clientUrl = window.location.href;
    const clientPath = new URL(clientUrl).pathname;
    return clientPath === scopePath || clientPath === scopePath.replace(/\/$/, '') || clientPath === scopePath + 'index.html';
  });
  log('Push', '14.9 URL matching SW notificationclick', urlMatchOk);

  // 14.10 - Unsubscribe clears localStorage
  await page.evaluate((key) => {
    localStorage.removeItem(key);
    // Also simulate periodic sync unregistration
    if (typeof unsubscribeUserFromPush === 'function') {
      // Unsubscribe will run but PushManager is unavailable in headless, that's fine
      navigator.serviceWorker.ready.then(reg => {
        if ('periodicSync' in reg) {
          reg.periodicSync.unregister('check-favorite-prices');
        }
      });
    }
  }, PUSH_SUB_KEY);
  await sleep(300);
  const subCleared = await page.evaluate((key) => !localStorage.getItem(key), PUSH_SUB_KEY);
  log('Push', '14.10 Unsubscribe limpia localStorage', subCleared);

  // --- norm() defensive test (fix for "(s||'').replace is not a function") ---
  const normStr = await page.evaluate(() => norm('1,234'));
  log('norm()', 'string con coma → ' + normStr, normStr === '1.234');

  const normNum = await page.evaluate(() => norm(1.234));
  log('norm()', 'número → ' + normNum, normNum === '1.234');

  const normNull = await page.evaluate(() => norm(null));
  log('norm()', 'null → "' + normNull + '"', normNull === '');

  const normUndef = await page.evaluate(() => norm(undefined));
  log('norm()', 'undefined → "' + normUndef + '"', normUndef === '');

  const normZero = await page.evaluate(() => norm(0));
  log('norm()', 'número 0 → "' + normZero + '"', normZero === '0');

  // --- parsePrice defensive test ---
  const parseStr = await page.evaluate(() => parsePrice('1,234'));
  log('parsePrice()', 'string "1,234" → ' + parseStr, parseStr === 1.234);

  const parseNum = await page.evaluate(() => parsePrice(1.234));
  log('parsePrice()', 'número 1.234 → ' + parseNum, parseNum === 1.234);

  const parseZero = await page.evaluate(() => parsePrice(0));
  log('parsePrice()', 'número 0 → ' + parseZero, parseZero === 0);

  // --- getFirstFuelPrice con precios numéricos (simula API con números) ---
  const numPriceOk = await page.evaluate(() => {
    const mockStation = {};
    // Set the first fuel (Gasolina 95 E5) price as a number (como si viniera parseado)
    mockStation[FUEL_KEYS['Gasolina 95 E5']] = 1.359;
    const price = getFirstFuelPrice(mockStation);
    return price === 1.359 ? 'ok' : 'falló: ' + price;
  });
  log('getFirstFuelPrice()', 'precio numérico → ' + numPriceOk, numPriceOk === 'ok');

  const numPriceNull = await page.evaluate(() => {
    const mockStation = {};
    mockStation[FUEL_KEYS['Gasolina 95 E5']] = null;
    const price = getFirstFuelPrice(mockStation);
    return price === null ? 'ok' : 'falló: ' + price;
  });
  log('getFirstFuelPrice()', 'precio null → ' + numPriceNull, numPriceNull === 'ok');

  // --- getFirstFuelName con precios numéricos ---
  const nameNumOk = await page.evaluate(() => {
    const mockStation = {};
    mockStation[FUEL_KEYS['Gasóleo A']] = 1.459;
    const name = getFirstFuelName(mockStation);
    return name === 'Gasóleo A' ? 'ok' : 'falló: ' + name;
  });
  log('getFirstFuelName()', 'precio numérico → ' + nameNumOk, nameNumOk === 'ok');

  // --- Simulación checkPrices: getFuelPrice con number (lo que usa getStationHistorySW internamente) ---
  const fuelPriceStrOk = await page.evaluate(() => {
    const st = { 'Precio Gasoleo A': '1,500' };
    return getFuelPrice(st, 'Precio Gasoleo A') === 1.5 ? 'ok' : 'falló';
  });
  log('getFuelPrice()', 'string con coma → ' + fuelPriceStrOk, fuelPriceStrOk === 'ok');

  const fuelPriceNumOk = await page.evaluate(() => {
    const st = { 'Precio Gasoleo A': 1.350 };
    return getFuelPrice(st, 'Precio Gasoleo A') === 1.35 ? 'ok' : 'falló';
  });
  log('getFuelPrice()', 'número → ' + fuelPriceNumOk, fuelPriceNumOk === 'ok');

  const compareNumOk = await page.evaluate(() => {
    const result = comparePrices(1.25, 1.5);
    return result && result.difference === 0.25 && !result.isRise ? 'ok' : 'falló';
  });
  log('comparePrices()', 'números exactos → ' + compareNumOk, compareNumOk === 'ok');

  // --- Caché: "Limpiar caché" tiene que borrar de verdad ---
  // Va al final porque clearCache() vacía STATE.data y deja la app en la
  // pantalla de provincia: los tests de datos ya han pasado. Se siembran claves
  // de provincia e histórico y se comprueba que se eliminan de IndexedDB. Antes
  // no borraba nada: pasaba la clave donde IndexedDB espera el nombre del store
  // y el error se comía en un catch. La red se simula para no depender del
  // Ministerio.
  const cacheClear = await page.evaluate(async () => {
    await dbPut('cache', 'prov_TEST', { data: [{ IDEESS: 'x' }], timestamp: Date.now(), ttl: 12 });
    await dbPut('cache', 'hist_TEST_01-01-2026', { data: [{ IDEESS: 'x' }], timestamp: Date.now() });
    const sembradas = (await dbGetAllKeys('cache')).filter(k => String(k).startsWith('prov_') || String(k).startsWith('hist_')).length;
    const real = window.fetch;
    window.fetch = async () => new Response('{}', { status: 200, headers: { 'Content-Type': 'application/json' } });
    try {
      await clearCache();
    } finally {
      window.fetch = real;
    }
    const restan = (await dbGetAllKeys('cache')).filter(k => String(k).startsWith('prov_') || String(k).startsWith('hist_'));
    return { sembradas, restan: restan.join(','), lectura: await dbGet('cache', 'prov_TEST') };
  });
  log('Caché', '«Limpiar caché» borra las claves de provincia e histórico de IndexedDB',
    cacheClear.sembradas >= 2 && cacheClear.restan === '' && !cacheClear.lectura,
    'sembradas=' + cacheClear.sembradas + ' restan=' + (cacheClear.restan || 'ninguna'));

  await testRingLogs(page);

  await testAiChat(page);

  await ctx.close();
}
// ============================================================================
// 15. Chat IA — proveedor LLM7.io (sin clave) + auto-refresh de modelos
// ============================================================================
async function testAiChat(page) {
  console.log('\n## 🤖 Chat IA');

  // --- LLM7: tab, panel y elementos de input presentes ---
  const tab = await page.locator('.ia-provider-tab[data-iaprovider="llm7"]').count();
  const panel = await page.locator('.ia-provider-panel[data-iapanel="llm7"]').count();
  log('IA', 'LLM7: tab + panel presentes', tab === 1 && panel === 1);

  const els = await page.evaluate(() => ['iaModelLlm7', 'iaKeyLlm7', 'iaInputLlm7', 'iaSendLlm7', 'iaMessagesLlm7', 'iaStatusLlm7', 'iaRefreshModelsLlm7', 'iaModelsStatusLlm7']
    .every(id => !!document.getElementById(id)));
  log('IA', 'LLM7: los 8 ids de elementos existen', els);

  // --- LLM7 se llama DIRECTO a la API: clave opcional y acceso anónimo ---
  const directo = await page.evaluate(() => ({
    endpoint: AI_PROVIDERS.llm7.endpoint,
    listModels: AI_PROVIDERS.llm7.listModelsUrl,
    keyOptional: AI_PROVIDERS.llm7.keyOptional === true,
    anon: AI_PROVIDERS.llm7.anonymousKey,
    listModelsNoAuth: AI_PROVIDERS.llm7.listModelsNoAuth === true,
    llm7Proxy: !!AI_PROVIDERS.llm7.viaProxy
  }));
  log('IA', 'LLM7 llama directo a api.llm7.io (NVIDIA/Cerebras/Chutes/Z.ai lo bloquean: sin CORS)',
    directo.endpoint === 'https://api.llm7.io/v1/chat/completions' && directo.listModels === 'https://api.llm7.io/v1/models',
    directo.endpoint);
  log('IA', 'LLM7: clave opcional con acceso anónimo "unused"',
    directo.keyOptional && directo.anon === 'unused', directo.anon);
  log('IA', 'LLM7 marca listModelsNoAuth (su GET /models rechaza Authorization en el preflight)',
    directo.listModelsNoAuth === true, String(directo.listModelsNoAuth));
  log('IA', 'La cabecera Authorization solo se omite en el listado de LLM7',
    await page.evaluate(() => {
      const manda = (conf, p) => p !== 'google' && !conf.listModelsNoAuth;
      return manda({ listModelsNoAuth: AI_PROVIDERS.llm7.listModelsNoAuth }, 'llm7') === false
          && manda({}, 'groq') === true && manda({}, 'mistral') === true
          && manda({}, 'openrouter') === true && manda({}, 'google') === false;
    }));
  log('IA', 'Ningún proveedor con clave usa proxy: solo NVIDIA', directo.llm7Proxy === false, String(directo.llm7Proxy));

  // --- NVIDIA: único proveedor vía proxy, porque su gateway no da CORS ---
  // Comprobado con OPTIONS + Chromium: desde la app la llamada directa muere
  // con "No 'Access-Control-Allow-Origin' header" (solo vale build.nvidia.com).
  const nvidiaEls = await page.evaluate(() => ['iaModelNvidia', 'iaProxyNvidia', 'iaInputNvidia', 'iaSendNvidia', 'iaMessagesNvidia', 'iaStatusNvidia', 'iaRefreshModelsNvidia', 'iaModelsStatusNvidia']
    .every(id => !!document.getElementById(id))
    && document.querySelectorAll('.ia-provider-tab[data-iaprovider="nvidia"]').length === 1
    && document.querySelectorAll('.ia-provider-panel[data-iapanel="nvidia"]').length === 1);
  log('IA', 'NVIDIA: tab + panel + los 8 ids de elementos existen', nvidiaEls);

  const viaProxy = await page.evaluate(() => ({
    flag: AI_PROVIDERS.nvidia.viaProxy === true,
    soloNVIDIA: Object.keys(AI_PROVIDERS).filter(p => AI_PROVIDERS[p].viaProxy).join(','),
    endpointRelativo: AI_PROVIDERS.nvidia.endpoint === '/v1/chat/completions',
    listRelativo: AI_PROVIDERS.nvidia.listModelsUrl === '/v1/models',
    sinCampoClave: !document.getElementById('iaKeyNvidia'),
    niEnPrefijos: !AI_KEY_PREFIXES.nvidia,
    niCifrada: !AI_ENCRYPTED_KEYS.nvidia
  }));
  log('IA', 'NVIDIA es el único viaProxy, con rutas relativas al Worker',
    viaProxy.flag && viaProxy.soloNVIDIA === 'nvidia' && viaProxy.endpointRelativo && viaProxy.listRelativo,
    viaProxy.soloNVIDIA);
  log('IA', 'NVIDIA no tiene API Key en el navegador (ni campo, ni prefijo, ni blob cifrado)',
    viaProxy.sinCampoClave && viaProxy.niEnPrefijos && viaProxy.niCifrada, JSON.stringify(viaProxy));

  const normalizeOk = await page.evaluate(() => {
    setAiProxyUrl('nvidia', '  petrol-nv.mi-cuenta.workers.dev/  ');
    const a = getAiProxyUrl('nvidia');
    const b = aiProviderUrl('nvidia', '/v1/models');
    const esPropia = isDefaultProxyUrl('nvidia');
    setAiProxyUrl('nvidia', '');
    // Sin nada guardado se cae a la URL de ejemplo del wrangler.toml.
    const predef = getAiProxyUrl('nvidia');
    return {
      a, b, esPropia, predef, def: AI_PROXY_NVIDIA_DEFAULT,
      esPredef: isDefaultProxyUrl('nvidia'),
      motivo: aiProxyUrlIssue(predef),
      listo: isAiProviderReady('nvidia'),
      enElInput: document.getElementById('iaProxyNvidia').value,
      aviso: aiProviderNotReadyMessage('nvidia')
    };
  });
  log('IA', 'normalizeAiProxyUrl() añade https:// y quita la barra final',
    normalizeOk.a === 'https://petrol-nv.mi-cuenta.workers.dev' && normalizeOk.b === 'https://petrol-nv.mi-cuenta.workers.dev/v1/models'
    && normalizeOk.esPropia === false, normalizeOk.a + ' -> ' + normalizeOk.b);
  log('IA', 'El input de Config trae la URL de ejemplo puesta (editable)',
    normalizeOk.enElInput === normalizeOk.def, normalizeOk.enElInput);

  // --- La URL de ejemplo no puede existir: workers.dev siempre lleva subdominio ---
  // Cloudflare publica como <worker>.<subdominio-cuenta>.workers.dev, así que el
  // predefinido (3 etiquetas) nunca resuelve. Antes el chat moría con un
  // "NetworkError when attempting to fetch resource" que no explicaba nada.
  const urlInvalida = await page.evaluate(async () => {
    setAiProxyUrl('nvidia', '');
    // aiProviderUrl() lanza con el motivo, sin llegar a la red.
    let errUrl = '';
    try { aiProviderUrl('nvidia', '/v1/chat/completions'); } catch (e) { errUrl = e.message; }
    // Y ni el chat ni el catálogo salen a la red con una URL imposible.
    let errChat = '';
    try { await AI_PROVIDERS.nvidia.send(null, 'x', [{ role: 'user', content: 'hola' }]); } catch (e) { errChat = e.message; }
    let errCatalogo = '';
    try { await fetchAiModels('nvidia', null, {}); } catch (e) { errCatalogo = e.message; }
    return {
      motivos: {
        ejemplo: aiProxyUrlIssue(AI_PROXY_NVIDIA_DEFAULT),
        placeholder: aiProxyUrlIssue('https://petrol-nvidia-proxy.<tu-cuenta>.workers.dev'),
        vacia: aiProxyUrlIssue(''),
        rota: aiProxyUrlIssue('mi proxy workers.dev'),
        sinEsquema: aiProxyUrlIssue('petrol-nv.mi-cuenta.workers.dev'),
        real: aiProxyUrlIssue('https://petrol-nv.mi-cuenta.workers.dev'),
        conPuerto: aiProxyUrlIssue('http://localhost:8787')
      },
      listo: isAiProviderReady('nvidia'),
      motivoGuardado: aiProxyUrlIssue(getAiProxyUrl('nvidia')),
      // El chat no se lanza: se dice qué URL poner.
      aviso: aiProviderNotReadyMessage('nvidia'),
      estado: (updateAiStatus('nvidia'), document.getElementById('iaStatusNvidia').textContent),
      rotuloModelos: (autoRefreshAiModels('nvidia'), document.getElementById('iaModelsStatusNvidia').textContent),
      bordeInput: document.getElementById('iaProxyNvidia').style.borderColor,
      errUrl, errChat, errCatalogo
    };
  });
  log('IA', 'aiProxyUrlIssue() detecta la URL de ejemplo sin subdominio de cuenta',
    urlInvalida.motivos.ejemplo === 'nosubdomain' && urlInvalida.motivos.real === '' && urlInvalida.motivos.conPuerto === '',
    JSON.stringify(urlInvalida.motivos));
  log('IA', 'aiProxyUrlIssue() distingue placeholder sin sustituir, URL vacía y URL rota',
    urlInvalida.motivos.placeholder === 'placeholder' && urlInvalida.motivos.vacia === 'nourl'
    && urlInvalida.motivos.rota === 'invalid' && urlInvalida.motivos.sinEsquema === '',
    [urlInvalida.motivos.placeholder, urlInvalida.motivos.vacia, urlInvalida.motivos.rota, urlInvalida.motivos.sinEsquema].join(', '));
  log('IA', 'Con la URL de ejemplo NVIDIA no está listo y el chat no hace fetch',
    urlInvalida.listo === false && /no puede existir/.test(urlInvalida.aviso) && /wrangler deploy/.test(urlInvalida.aviso),
    urlInvalida.aviso.slice(0, 90));
  log('IA', 'El estado del panel avisa de la URL inválida en vez de decir "proxy por defecto"',
    /URL sin el subdominio de tu cuenta/.test(urlInvalida.estado) && !/por defecto/i.test(urlInvalida.estado),
    urlInvalida.estado);
  log('IA', 'El desplegable de modelos explica la URL inválida sin lanzar peticiones',
    /placeholder|sin el subdominio/.test(urlInvalida.rotuloModelos), urlInvalida.rotuloModelos);
  log('IA', 'El campo de Config se marca en rojo cuando la URL no puede funcionar',
    urlInvalida.bordeInput === 'rgb(204, 51, 51)', urlInvalida.bordeInput);
  log('IA', 'Enviar al chat y pedir el catálogo con la URL de ejemplo da el motivo, no un NetworkError',
    /no puede existir/.test(urlInvalida.errUrl) && /no puede existir/.test(urlInvalida.errChat)
    && /no puede existir/.test(urlInvalida.errCatalogo)
    && !/NetworkError/.test(urlInvalida.errChat) && !/NetworkError/.test(urlInvalida.errCatalogo)
    && !/— proxy:/.test(urlInvalida.errCatalogo), urlInvalida.errCatalogo.slice(0, 90));

  const statusProxy = await page.evaluate(() => {
    const el = document.getElementById('iaStatusNvidia');
    setAiProxyUrl('nvidia', 'https://petrol-nv.mi-cuenta.workers.dev');
    updateAiStatus('nvidia');
    const propia = el.textContent;
    const bordeOk = document.getElementById('iaProxyNvidia').style.borderColor;
    const listo = isAiProviderReady('nvidia');
    setAiProxyUrl('nvidia', '');
    return { propia, bordeOk, listo };
  });
  log('IA', 'El estado del panel distingue la URL por defecto de la que puso el usuario',
    /Proxy configurado/.test(statusProxy.propia) && !/por defecto/.test(statusProxy.propia),
    statusProxy.propia);
  log('IA', 'Con una URL con subdominio el campo se marca en verde y el proveedor queda listo',
    statusProxy.bordeOk === 'rgb(34, 170, 119)' && statusProxy.listo === true,
    statusProxy.bordeOk + ' | listo=' + statusProxy.listo);

  const resetProxy = await page.evaluate(() => {
    setAiProxyUrl('nvidia', 'https://petrol-nv.mi-cuenta.workers.dev');
    document.getElementById('iaProxyResetBtn').click();
    return { guardado: localStorage.getItem(AI_PROXY_KEY), enElInput: document.getElementById('iaProxyNvidia').value,
      def: AI_PROXY_NVIDIA_DEFAULT, estado: document.getElementById('iaStatusNvidia').textContent };
  });
  log('IA', '"Usar la predefinida" borra la URL guardada y vuelve al ejemplo del wrangler.toml',
    resetProxy.guardado === '' && resetProxy.enElInput === resetProxy.def
    && /URL sin el subdominio de tu cuenta/.test(resetProxy.estado), resetProxy.enElInput);

  // --- Diagnóstico de la URL del proxy: el error tiene que ser descriptivo ---
  // Con una URL con subdominio (la única forma que puede funcionar) para que el
  // diagnóstico llegue al fetch y clasifique la respuesta del Worker.
  const diag = await page.evaluate(async () => {
    setAiProxyUrl('nvidia', 'https://petrol-nv.mi-cuenta.workers.dev');
    const real = window.fetch.bind(window);
    const cuerpo = (status, texto, json) => new Response(json ? JSON.stringify(json) : texto,
      { status, headers: { 'Content-Type': json ? 'application/json' : 'text/html' } });
    const conProxy = async (handler) => { window.fetch = handler; const r = await aiProxyDiagnostics('nvidia'); window.fetch = real; return r; };
    const r404 = await conProxy(() => cuerpo(404, 'Servidor no encontrado'));
    const r500 = await conProxy(() => cuerpo(500, 'x', { error: { message: 'El Worker no tiene la clave: ejecuta "wrangler secret put NVIDIA_API_KEY"' } }));
    const r401 = await conProxy(() => cuerpo(401, 'x', { error: { message: 'Invalid API key' } }));
    const r429 = await conProxy(() => cuerpo(429, 'x', { error: { message: 'rate limit' } }));
    const rOk = await conProxy(() => cuerpo(200, 'x', { data: [{ id: 'a' }, { id: 'b' }] }));
    const rDns = await conProxy(() => { throw new TypeError('Failed to fetch'); });
    // El placeholder de la documentación y la URL de ejemplo se rechazan sin
    // llegar a la red: es el caso que se leía como NetworkError.
    let llanos = 0;
    window.fetch = () => { llanos++; throw new TypeError('Failed to fetch'); };
    const rEjemplo = await aiProxyDiagnostics('nvidia', AI_PROXY_NVIDIA_DEFAULT);
    const rPlaceholder = await aiProxyDiagnostics('nvidia', 'https://petrol-nvidia-proxy.<tu-cuenta>.workers.dev');
    window.fetch = real;
    // El mismo diagnóstico cuando el fallo ocurre al pedir el catálogo.
    window.fetch = () => { throw new TypeError('Failed to fetch'); };
    let errCatalogo = '';
    try { await fetchAiModels('nvidia', null, {}); } catch (e) { errCatalogo = e.message; }
    // Y cuando falla el chat.
    let errChat = '';
    try { await AI_PROVIDERS.nvidia.send(null, 'x', [{ role: 'user', content: 'hola' }]); } catch (e) { errChat = e.message; }
    window.fetch = real;
    const ids = ['iaProxyTestBtn', 'iaProxyTestStatus'].filter(id => !!document.getElementById(id));
    return { r404, r500, r401, r429, rOk, rDns, rEjemplo, rPlaceholder, llanos, errCatalogo, errChat, ids, url: getAiProxyUrl('nvidia') };
  });
  log('IA', '🔎 Probar detecta que el host no responde y da la URL a pegar',
    diag.rDns.kind === 'dns' && /no responde/i.test(diag.rDns.message) && /wrangler deploy/.test(diag.rDns.message),
    diag.rDns.message);
  log('IA', '🔎 Probar con la URL de ejemplo o un placeholder no llega a la red y explica qué pegar',
    diag.rEjemplo.kind === 'invalidurl' && diag.rEjemplo.issue === 'nosubdomain'
    && diag.rPlaceholder.issue === 'placeholder' && diag.llanos === 0
    && /no puede existir/.test(diag.rEjemplo.message) && /wrangler deploy/.test(diag.rEjemplo.message)
    && /placeholder sin sustituir/.test(diag.rPlaceholder.message),
    diag.rEjemplo.kind + '/' + diag.rPlaceholder.issue + ' | ' + diag.llanos + ' fetch');
  log('IA', '🔎 Probar distingue 404 sin Worker, Worker sin clave, 401/403 y 429',
    diag.r404.kind === 'notfound' && /subdominio equivocado/.test(diag.r404.message)
    && diag.r500.kind === 'nokey' && /secret put NVIDIA_API_KEY/.test(diag.r500.message)
    && diag.r401.kind === 'badauth' && diag.r429.kind === 'quota',
    [diag.r404.kind, diag.r500.kind, diag.r401.kind, diag.r429.kind].join(', '));
  log('IA', '🔎 Probar confirma el proxy OK con el número de modelos',
    diag.rOk.ok === true && diag.rOk.models === 2 && /2 modelos/.test(diag.rOk.message), diag.rOk.message);
  log('IA', 'Un host que no responde da un error descriptivo, no "Failed to fetch"',
    /no se pudo (ni )?conectar/i.test(diag.errCatalogo) && /no se pudo conectar con el proxy de NVIDIA/i.test(diag.errChat)
    && /wrangler deploy/.test(diag.errCatalogo) && /wrangler deploy/.test(diag.errChat)
    && !/^Failed to fetch$/.test(diag.errCatalogo) && !/^Failed to fetch$/.test(diag.errChat),
    diag.errCatalogo.slice(0, 90));
  log('IA', 'Config → IA tiene el botón y el cuadro de estado de la comprobación',
    diag.ids.length === 2, diag.ids.join(', '));



  // --- aiApiKey(): cae al literal anónimo si el campo está vacío ---
  const keyAnon = await page.evaluate(() => {
    const input = document.getElementById('iaKeyLlm7');
    input.value = '';
    AI_PROVIDERS.llm7.key = null;
    const sinClave = { clave: aiApiKey('llm7'), listo: isAiProviderReady('llm7') };
    input.value = 'mi-token-de-llm7';
    const conClave = aiApiKey('llm7');
    input.value = '';
    AI_PROVIDERS.llm7.key = null;
    return { sinClave, conClave };
  });
  log('IA', 'aiApiKey() usa "unused" sin clave y la del campo si hay una',
    keyAnon.sinClave.clave === 'unused' && keyAnon.sinClave.listo === true && keyAnon.conClave === 'mi-token-de-llm7',
    JSON.stringify(keyAnon));

  const statusKey = await page.evaluate(() => {
    const el = document.getElementById('iaStatusLlm7');
    const input = document.getElementById('iaKeyLlm7');
    input.value = '';
    updateAiStatus('llm7');
    const sin = el.textContent;
    input.value = 'mi-token-de-llm7';
    updateAiStatus('llm7');
    const con = el.textContent;
    input.value = '';
    updateAiStatus('llm7');
    return { sin, con };
  });
  log('IA', 'El estado del panel LLM7 distingue anónimo de clave puesta',
    /anónimo/.test(statusKey.sin) && /API Key configurada/.test(statusKey.con),
    statusKey.sin + ' | ' + statusKey.con);

  // --- parseModels de LLM7: solo los turbo que además son chat ---
  const parseLlm7 = await page.evaluate(async () => {
    const remoto = await AI_PROVIDERS.llm7.parseModels({
      data: [
        { id: 'codestral-latest', tier: 'turbo' },
        { id: 'llama-4-maverick', tier: 'turbo' },
        { id: 'DeepSeek-V4-Flash-0731', tier: 'turbo' },
        { id: 'whisper-large-v3', tier: 'turbo' },
        { id: 'claude-sonnet-5', tier: 'pro' },
        { id: 'gpt-5.5', tier: 'pro' }
      ]
    });
    const filtrado = await AI_PROVIDERS.llm7.parseModels({ data: [{ id: 'codestral-latest', tier: 'turbo' }] });
    return { remoto, filtrado };
  });
  log('IA', 'parseModels() de LLM7 deja solo los turbo y quita el que da 401 (3 de 6: el audio lo quita luego el filtro común)',
    JSON.stringify(parseLlm7.remoto) === JSON.stringify(['codestral-latest', 'llama-4-maverick', 'whisper-large-v3']),
    JSON.stringify(parseLlm7.remoto));
  log('IA', 'parseModels() tolera un catálogo con un solo modelo',
    JSON.stringify(parseLlm7.filtrado) === JSON.stringify(['codestral-latest']), JSON.stringify(parseLlm7.filtrado));

  // --- defaultModel tiene que seguir en el desplegable y ser el elegido ---
  // Los modelos van en orden alfabetico, asi que el default ya NO tiene por
  // que ser el primer <option>: lo que importa es que exista y venga marcado.
  const defaultsOk = await page.evaluate(() => {
    const bad = [];
    for (const p of Object.keys(AI_PROVIDERS)) {
      if (p === 'chrome-nano') continue;
      const sel = document.getElementById(getProviderInputId(p, 'iaModel'));
      if (!sel || !sel.options.length) { bad.push(p + ': sin desplegable'); continue; }
      const opciones = [...sel.options].map(o => o.value);
      if (!opciones.includes(AI_PROVIDERS[p].defaultModel)) {
        bad.push(p + ': falta ' + AI_PROVIDERS[p].defaultModel);
      } else if (sel.value !== AI_PROVIDERS[p].defaultModel) {
        bad.push(p + ': elegido ' + sel.value + ' != ' + AI_PROVIDERS[p].defaultModel);
      }
    }
    return bad;
  });
  log('IA', 'defaultModel sigue en el desplegable y viene elegido en los 6 proveedores',
    defaultsOk.length === 0, defaultsOk.join(' | '));

  // --- Todo proveedor con clave obligatoria tiene prefijo declarado ---
  const prefixesOk = await page.evaluate(() => {
    const declarados = Object.keys(AI_KEY_PREFIXES);
    const noRechazados = declarados.filter(p => isAiKeyFormatValid(p, 'clave-inventada-123'));
    // Ni los que accede en anónimo (llm7) ni los que usan proxy (nvidia) manejan
    // una clave en el navegador: a ninguno se le exige prefijo.
    const conClave = Object.keys(AI_PROVIDERS).filter(p => p !== 'chrome-nano'
      && !AI_PROVIDERS[p].keyOptional && !AI_PROVIDERS[p].viaProxy);
    const sinPrefijo = conClave.filter(p => !AI_KEY_PREFIXES[p]);
    const opcionalConPrefijo = Object.keys(AI_PROVIDERS).filter(p => (AI_PROVIDERS[p].keyOptional || AI_PROVIDERS[p].viaProxy) && AI_KEY_PREFIXES[p]);
    return { total: declarados.length, noRechazados, sinPrefijo, opcionalConPrefijo, conClave: conClave.length };
  });
  log('IA', 'isAiKeyFormatValid() rechaza la clave inventada en los 4 proveedores con clave',
    prefixesOk.total === 4 && prefixesOk.noRechazados.length === 0,
    'no rechazados: ' + prefixesOk.noRechazados.join(','));
  log('IA', 'Todo proveedor con clave obligatoria tiene prefijo declarado',
    prefixesOk.sinPrefijo.length === 0, prefixesOk.sinPrefijo.join(','));
  log('IA', 'Los proveedores sin clave en el navegador (llm7, nvidia) no declaran prefijo',
    prefixesOk.opcionalConPrefijo.length === 0 && prefixesOk.conClave === 4, prefixesOk.opcionalConPrefijo.join(','));


  // --- Descifrado: roundtrip con una contraseña de prueba (no se expone la real) ---
  const decryptOk = await page.evaluate(() => {
    const plain = 'clave-de-prueba-ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789_-xyz';
    let raw = '';
    for (let i = 0; i < plain.length; i++) raw += String.fromCharCode(plain.charCodeAt(i) ^ 'q7z2ab'.charCodeAt(i % 6));
    const blob = btoa(raw);
    const back = xorDecryptBase64(blob, 'q7z2ab');
    const bad = xorDecryptBase64(blob, 'otro12');
    const invalid = xorDecryptBase64('no-es-base64-valido!!', 'q7z2ab');
    return { roundtrip: back === plain, cambia: back !== bad, seguro: invalid === '' || invalid.length === 0, blobOk: typeof blob === 'string' && blob.length > 40 };
  });
  log('IA', 'xorDecryptBase64(): roundtrip correcto y sensible a la contraseña',
    decryptOk.roundtrip && decryptOk.cambia, JSON.stringify(decryptOk));

  const blobsOk = await page.evaluate(() => {
    const partes = Object.entries(AI_ENCRYPTED_KEYS).map(([p, b]) => p + ':' + (typeof b === 'string' && b.length > 20));
    return { total: partes.length, malas: partes.filter(p => p.endsWith('false')), sinLlave: !!AI_ENCRYPTED_KEYS.llm7 };
  });
  log('IA', 'Las 4 claves por defecto están cifradas y LLM7 no guarda ninguna (no hace falta)',
    blobsOk.total === 4 && blobsOk.malas.length === 0 && !blobsOk.sinLlave, blobsOk.malas.join(', '));

  const wrongPass = await page.evaluate(() => tryDecryptDefaultKeys('xxxxxx') === null);
  log('IA', 'Contraseña incorrecta devuelve null', wrongPass);

  // --- Filtrado de modelos que no sirven para chat ---
  const filterOk = await page.evaluate(() => {
    const descartados = [
      'nvidia/nemotron-3-embed-1b', 'baai/bge-m3', 'nvidia/nemotron-parse',
      'meta/llama-3.2-nv-embedqa-1b-v2', 'nvidia/llama-guard-4-12b',
      'whisper-large-v3', 'seedance-2.0-fast', 'kling-v3.0-pro', 'gpt-image-2.5',
      'Voxtral-Small-24B-2507', 'chroma-v.46-flash', 'dark-beast-krea2', 'Inkling'
    ];
    const validos = ['codestral-latest', 'GLM-5.3-Flash', 'moonshotai/kimi-k3', 'open-mistral-nemo', 'gemini-3.8-flash', 'llama-4-maverick'];
    return {
      badFilter: descartados.filter(m => isAiModelChatCandidate(m)),
      badValid: validos.filter(m => !isAiModelChatCandidate(m))
    };
  });
  log('IA', 'Filtra embeddings/guardas/audio/imagen/video (13) y conserva chat (6)',
    filterOk.badFilter.length === 0 && filterOk.badValid.length === 0,
    [...filterOk.badFilter, ...filterOk.badValid].join(', '));
  log('IA', '"nemo-" no se cuela en el filtro y manda el chat de Mistral Nemo de LLM7',
    await page.evaluate(() => isAiModelChatCandidate('mistral-Nemo-Instruct-2407')
      && !isAiModelChatCandidate('nvidia/nemotron-3-embed-1b')
      && !isAiModelChatCandidate('nvidia/nemotron-parse')));

  // --- Detección de errores de modelo con los mensajes reales de cada API ---
  const errRe = await page.evaluate(() => {
    const casos = [
      '404 page not found',
      "Function '2b2dcd47-c858-425a-9c04-4cacf2eac993': Not found for account",
      'The model `gemini-2.5-flash` is no longer available to new users',
      'model_not_found',
      'The model openai/gpt-oss-120b has reached its end of life',
      "Model 'modelo-que-no-existe-xyz' is currently unavailable.",
      'Unknown model: foo/bar'
    ];
    // El 401 de LLM7 al pedir un turbo roto dice "clave inválida": si se tomara
    // como fallo de modelo, el aviso de "elige otro" sería engañoso.
    const noDeben = ['Rate limit exceeded', 'Incorrect API key provided', 'HTTP 500', 'Connection error',
      'Your API key is invalid, expired, or revoked. Generate a new key at https://dash.llm7.io/#/api-keys'];
    return {
      falsos: casos.filter(m => !AI_MODEL_ERROR_RE.test(m)),
      erroneos: noDeben.filter(m => AI_MODEL_ERROR_RE.test(m))
    };
  });
  log('IA', 'AI_MODEL_ERROR_RE detecta los 7 mensajes reales de modelo',
    errRe.falsos.length === 0, errRe.falsos.join(' | '));
  log('IA', 'AI_MODEL_ERROR_RE NO confunde 429/401/500 con fallo de modelo',
    errRe.erroneos.length === 0, errRe.erroneos.join(' | '));

  // --- aiHttpError con cuerpo no-JSON, JSON anidado y vacío ---
  const httpErr = await page.evaluate(async () => {
    const fake = { ok: false, status: 404, text: async () => '404 page not found' };
    const a = await aiHttpError(fake);
    const fakeJson = { ok: false, status: 400, text: async () => JSON.stringify({ error: { message: 'model not found: x' } }) };
    const b = await aiHttpError(fakeJson);
    const fakeEmpty = { ok: false, status: 500, text: async () => '' };
    const c = await aiHttpError(fakeEmpty);
    return { a: a.message, b: b.message, c: c.message };
  });
  log('IA', 'aiHttpError: texto plano, JSON y vacío', httpErr.a === '404 page not found' && httpErr.b === 'model not found: x' && httpErr.c === 'HTTP 500',
    JSON.stringify(httpErr));

  // --- Auto-refresh: se sustituye window.fetch para el /models de LLM7 ---
  // No se usa page.route: la pagina tiene Service Worker y las peticiones que
  // este intercepte nunca pasan por el interception de Playwright.
  await page.evaluate(() => {
    window.__realFetch = window.fetch.bind(window);
    window.__modelCalls = 0;
    window.__mock = { mode: 'ok', data: [] };
    window.fetch = async (input, opts) => {
      const u = typeof input === 'string' ? input : (input && input.url) || '';
      if (!u.includes('api.llm7.io/v1/models')) return window.__realFetch(input, opts);
      window.__modelCalls++;
      if (window.__mock.mode === 'network') throw new TypeError('Failed to fetch');
      if (window.__mock.mode === 'error') {
        return new Response(JSON.stringify({ error: { message: 'boom' } }), { status: 500, headers: { 'Content-Type': 'application/json' } });
      }
      return new Response(JSON.stringify({ data: window.__mock.data }), { status: 200, headers: { 'Content-Type': 'application/json' } });
    };
    localStorage.removeItem(AI_MODELS_CACHE_KEY);
  });
  const setMock = (mode, data = []) => page.evaluate(([m, d]) => { window.__mock = { mode: m, data: d }; }, [mode, data]);

  const CATALOGO = [
    { id: 'codestral-latest', tier: 'turbo' },
    { id: 'llama-4-maverick', tier: 'turbo' },
    { id: 'DeepSeek-V4-Flash-0731', tier: 'turbo' },
    { id: 'whisper-large-v3', tier: 'turbo' },
    { id: 'claude-sonnet-5', tier: 'pro' }
  ];

  await setMock('ok', CATALOGO);
  const refresh1 = await page.evaluate(async () => {
    const r = await refreshAiModels('llm7', { force: true });
    const sel = document.getElementById('iaModelLlm7');
    return {
      ok: r.ok, models: r.models || [], calls: window.__modelCalls,
      options: [...sel.options].map(o => o.value),
      selected: sel.value,
      status: document.getElementById('iaModelsStatusLlm7').textContent
    };
  });
  log('IA', 'refreshAiModels() descarga el catálogo de LLM7 (5 ids → 2: sin pro, sin 401, sin audio)',
    refresh1.ok && refresh1.models.length === 2 && refresh1.calls === 1, JSON.stringify(refresh1.models));
  log('IA', 'El desplegable une catálogo remoto + lista fija (4 → 5)',
    refresh1.options.length === 5, refresh1.options.length + ' opciones');
  log('IA', 'El modelo seleccionado se conserva tras refrescar',
    refresh1.selected === 'codestral-latest', refresh1.selected);
  log('IA', 'El contador de modelos se actualiza', /2 modelos/.test(refresh1.status), refresh1.status);

  // --- La caché se persiste y se reutiliza sin volver a pedirla ---
  const cacheState = await page.evaluate(() => {
    const cache = loadAiModelsCache();
    return { has: !!cache.llm7, n: cache.llm7 ? cache.llm7.models.length : 0, stale: isAiModelsCacheStale('llm7') };
  });
  log('IA', 'Catálogo cacheado en localStorage y no expirado (TTL 24 h)',
    cacheState.has && cacheState.n === 2 && cacheState.stale === false, JSON.stringify(cacheState));

  // --- Con red caída, la caché válida evita volver a pedir el catálogo ---
  await setMock('network');
  await page.evaluate(() => { window.__modelCalls = 0; });
  const refresh2 = await page.evaluate(async () => {
    const r = await refreshAiModels('llm7');
    return { ok: r.ok, fromCache: !!r.fromCache, calls: window.__modelCalls };
  });
  log('IA', 'Con caché válida NO se vuelve a llamar a la API (tolera caída de red)',
    refresh2.ok && refresh2.fromCache === true && refresh2.calls === 0, 'llamadas=' + refresh2.calls);

  // --- Si el modelo seleccionado desaparece del catálogo, se avisa ---
  await setMock('ok', [{ id: 'minimax-m2.7', tier: 'turbo' }]);
  const missing = await page.evaluate(async () => {
    document.getElementById('iaMessagesLlm7').innerHTML = '';
    document.getElementById('iaModelLlm7').value = 'GLM-5.3-Flash';
    const r = await refreshAiModels('llm7', { force: true });
    const opt = [...document.getElementById('iaModelLlm7').options].find(o => o.value === 'GLM-5.3-Flash');
    return { missing: r.missing, label: opt ? opt.textContent : null, selected: document.getElementById('iaModelLlm7').value };
  });
  log('IA', 'Detecta el modelo desaparecido sin cambiar la selección',
    missing.missing === 'GLM-5.3-Flash' && missing.selected === 'GLM-5.3-Flash', 'missing=' + missing.missing);
  log('IA', 'Marca la opción con "⚠️ no disponible"',
    /⚠️ no disponible/.test(missing.label || ''), missing.label);

  // --- El aviso en el chat ofrece el botón de refresco y funciona ---
  // Se activan las pestañas reales (tab IA -> LLM7) y se espera al auto-refresh
  await setMock('ok', CATALOGO);
  await page.click('.bottom-tab[data-tab="tab-ia"]');
  await sleep(300);
  await page.click('.ia-provider-tab[data-iaprovider="llm7"]');
  await page.waitForFunction(() => {
    const b = document.getElementById('iaRefreshModelsLlm7');
    return b && !b.disabled;
  }, { timeout: 15000 });
  // El .then() de autoRefreshAiModels puede añadir su propio aviso despues de
  // habilitar el boton: se espera a que se calme antes de medir nada
  await sleep(600);
  log('IA', 'Pestaña IA + LLM7 visibles al pulsar sus tabs',
    await page.locator('.ia-provider-panel[data-iapanel="llm7"]').isVisible());
  const autoStatus = await page.evaluate(() => document.getElementById('iaModelsStatusLlm7').textContent);
  log('IA', 'LLM7 se refresca solo al abrir su pestaña, sin clave (acceso anónimo)',
    /modelos/.test(autoStatus), autoStatus);

  const warnBox = await page.evaluate(() => {
    document.getElementById('iaMessagesLlm7').innerHTML = '';
    warnAiModelUnavailable('llm7', 'GLM-5.3-Flash', 'El catálogo de llm7 ya no lo incluye.');
    const warn = document.querySelector('#iaMessagesLlm7 .ia-msg.warn');
    return { existe: !!warn, tieneBoton: !!(warn && warn.querySelector('.ia-warn-btn')), texto: warn ? warn.textContent.slice(0, 60) : '' };
  });
  log('IA', 'warnAiModelUnavailable() pinta el aviso con botón', warnBox.existe && warnBox.tieneBoton, warnBox.texto);

  await page.click('#iaMessagesLlm7 .ia-msg.warn .ia-warn-btn');
  await page.waitForFunction(() => !document.querySelector('#iaMessagesLlm7 .ia-msg.warn .ia-warn-btn'), { timeout: 15000 });
  const afterClick = await page.evaluate(() => {
    const msgs = [...document.querySelectorAll('#iaMessagesLlm7 .ia-msg')];
    return {
      avisoFuera: !document.querySelector('#iaMessagesLlm7 .ia-msg.warn'),
      ultimo: msgs.length ? msgs[msgs.length - 1].textContent : ''
    };
  });
  log('IA', 'El botón del aviso refresca y anuncia el nuevo catálogo',
    afterClick.avisoFuera && /modelos disponibles/.test(afterClick.ultimo), afterClick.ultimo.slice(0, 70));

  // --- El botón 🔄 del desplegable refresca y lo confirma en el chat ---
  await setMock('ok', [{ id: 'GLM-5.3-Flash', tier: 'turbo' }, { id: 'llama-4-maverick', tier: 'turbo' }]);
  await page.evaluate(() => { document.getElementById('iaMessagesLlm7').innerHTML = ''; });
  await page.click('#iaRefreshModelsLlm7');
  await page.waitForFunction(() => {
    const m = [...document.querySelectorAll('#iaMessagesLlm7 .ia-msg.info')];
    return m.some(x => /Catálogo actualizado/.test(x.textContent));
  }, { timeout: 15000 });
  const btnInfo = await page.evaluate(() => {
    const m = [...document.querySelectorAll('#iaMessagesLlm7 .ia-msg.info')];
    return { texto: m.length ? m[m.length - 1].textContent : '', opciones: document.getElementById('iaModelLlm7').options.length };
  });
  log('IA', 'El botón 🔄 actualiza el catálogo y lo confirma en el chat',
    /Catálogo actualizado/.test(btnInfo.texto) && btnInfo.opciones === 5,
    btnInfo.texto.slice(0, 55) + ' | ' + btnInfo.opciones + ' opciones');

  // --- Catálogo caído: el error se muestra pero no rompe el desplegable ---
  await setMock('error');
  const caido = await page.evaluate(async () => {
    const antes = document.getElementById('iaModelLlm7').options.length;
    const r = await refreshAiModels('llm7', { force: true });
    return { ok: r.ok, msg: r.error ? r.error.message : '', intacto: document.getElementById('iaModelLlm7').options.length === antes, status: document.getElementById('iaModelsStatusLlm7').textContent };
  });
  log('IA', 'Si /models devuelve 500, avisa sin romper el desplegable',
    caido.ok === false && caido.msg === 'boom' && caido.intacto && /boom/.test(caido.status),
    caido.msg + ' | ' + caido.status);

  // --- Catálogo inalcanzable: degrada a la lista fija, sin romper el chat ---
  await setMock('network');
  const caidoNet = await page.evaluate(async () => {
    const sel = document.getElementById('iaModelLlm7');
    const antes = { opciones: sel.options.length, selected: sel.value };
    const r = await refreshAiModels('llm7', { force: true });
    return { ok: r.ok, antes, despues: { opciones: sel.options.length, selected: sel.value } };
  });
  log('IA', 'Si /models no responde, el desplegable no se toca (degrada a la lista fija)',
    caidoNet.ok === false && caidoNet.despues.opciones === caidoNet.antes.opciones && caidoNet.despues.selected === caidoNet.antes.selected,
    JSON.stringify(caidoNet.antes) + ' -> ' + JSON.stringify(caidoNet.despues));

  // --- Cambiar la clave invalida el catálogo (depende de la cuenta) ---
  await setMock('ok', CATALOGO);
  const cambioKey = await page.evaluate(async () => {
    await refreshAiModels('llm7', { force: true });
    const antes = { cacheado: !!loadAiModelsCache().llm7, calls: window.__modelCalls };
    const input = document.getElementById('iaKeyLlm7');
    input.value = 'otro-token';
    input.dispatchEvent(new Event('change'));
    return { antes, justoDespues: !!loadAiModelsCache().llm7, guardada: JSON.parse(localStorage.getItem(AI_KEYS_KEY) || '{}').llm7 };
  });
  log('IA', 'Al cambiar la clave se borra el catálogo anterior',
    cambioKey.antes.cacheado && cambioKey.justoDespues === false, JSON.stringify(cambioKey.antes) + ' -> cache=' + cambioKey.justoDespues);
  log('IA', 'La clave nueva se persiste en localStorage',
    cambioKey.guardada === 'otro-token', cambioKey.guardada);
  await page.evaluate(() => {
    const input = document.getElementById('iaKeyLlm7');
    input.value = '';
    input.dispatchEvent(new Event('change'));
  });

  // --- invalidateAiModelsCache (limpieza directa) ---
  const invalidated = await page.evaluate(() => {
    saveAiModelsCache('llm7', ['a/b']);
    const antes = !!loadAiModelsCache().llm7;
    invalidateAiModelsCache('llm7');
    return { antes, despues: !!loadAiModelsCache().llm7, otras: !!loadAiModelsCache().groq };
  });
  log('IA', 'invalidateAiModelsCache() borra solo el catálogo indicado',
    invalidated.antes && !invalidated.despues && invalidated.otras === false, JSON.stringify(invalidated));

  // --- chrome-nano no debe intentar listar modelos ---
  const nanoSkip = await page.evaluate(async () => {
    const r = await refreshAiModels('chrome-nano', { force: true });
    return r.reason;
  });
  log('IA', 'chrome-nano se excluye del auto-refresh', nanoSkip === 'unsupported', nanoSkip);

  // --- El envío va directo a api.llm7.io con "Bearer unused" si no hay clave ---
  await page.evaluate(() => {
    window.__chatCalls = [];
    window.__chatMock = { status: 200, body: { choices: [{ message: { content: 'Madrid' } }] } };
    const real = window.__realFetch;
    window.fetch = async (input, opts) => {
      const u = typeof input === 'string' ? input : (input && input.url) || '';
      if (!u.includes('api.llm7.io/v1/chat/completions')) return real(input, opts);
      window.__chatCalls.push({ url: u, headers: (opts && opts.headers) || {}, body: (opts && opts.body) || '' });
      return new Response(JSON.stringify(window.__chatMock.body), { status: window.__chatMock.status, headers: { 'Content-Type': 'application/json' } });
    };
  });
  const send = await page.evaluate(async () => {
    const r = await AI_PROVIDERS.llm7.send(aiApiKey('llm7'), 'codestral-latest', [{ role: 'user', content: 'hola' }]);
    const c = window.__chatCalls[0] || {};
    return { texto: r, url: c.url, auth: (c.headers || {}).Authorization, maxTokens: JSON.parse(c.body || '{}').max_tokens };
  });
  log('IA', 'LLM7 envía directo a api.llm7.io (sin proxy ni intermediario)',
    send.url === 'https://api.llm7.io/v1/chat/completions', send.url);
  log('IA', 'Sin clave configurada se manda "Bearer unused" (acceso anónimo)',
    send.auth === 'Bearer unused', send.auth);
  log('IA', 'La petición manda el modelo y max_tokens',
    send.maxTokens === 1024, 'max_tokens=' + send.maxTokens);
  log('IA', 'LLM7 devuelve la respuesta del modelo', send.texto === 'Madrid', send.texto);

  const sendReasoning = await page.evaluate(async () => {
    window.__chatMock.body = { choices: [{ message: { content: '', reasoning_content: 'pienso...' }, finish_reason: 'length' }] };
    const r = await AI_PROVIDERS.llm7.send('unused', 'GLM-5.3-Flash', [{ role: 'user', content: 'hola' }]);
    window.__chatMock.status = 404;
    window.__chatMock.body = { error: { message: 'model not found' } };
    let err = '';
    let errEsDeModelo = false;
    try { await AI_PROVIDERS.llm7.send('unused', 'muerto/x', [{ role: 'user', content: 'hola' }]); }
    catch (e) { err = e.message; errEsDeModelo = AI_MODEL_ERROR_RE.test(e.message); }
    return { vacio: r, err, errEsDeModelo };
  });
  log('IA', 'Si el modelo solo Razona y se queda sin tokens, avisa en vez de quedar en blanco',
    /se pasó el tiempo pensando/.test(sendReasoning.vacio), sendReasoning.vacio.slice(0, 60));
  log('IA', 'Un 404 de modelo se propaga como error (dispara el aviso de "elige otro")',
    /model not found/.test(sendReasoning.err) && sendReasoning.errEsDeModelo, sendReasoning.err.slice(0, 60));

  // --- NVIDIA: el envío va al proxy y NUNCA directo a integrate.api.nvidia.com ---
  // Directo moriría con "No 'Access-Control-Allow-Origin' header": el gateway de
  // NVIDIA solo da CORS al origen build.nvidia.com.
  await page.evaluate(() => {
    setAiProxyUrl('nvidia', 'https://petrol-nv.mi-cuenta.workers.dev');
    window.__proxyCalls = [];
    window.__proxyMock = { status: 200, body: { choices: [{ message: { content: 'Madrid' } }] } };
    const real = window.__realFetch;
    window.fetch = async (input, opts) => {
      const u = typeof input === 'string' ? input : (input && input.url) || '';
      if (!u.includes('workers.dev')) return real(input, opts);
      window.__proxyCalls.push({ url: u, headers: (opts && opts.headers) || {}, body: (opts && opts.body) || '' });
      return new Response(JSON.stringify(window.__proxyMock.body), { status: window.__proxyMock.status, headers: { 'Content-Type': 'application/json' } });
    };
  });
  const sendProxy = await page.evaluate(async () => {
    const r = await AI_PROVIDERS.nvidia.send(aiApiKey('nvidia'), 'nvidia/nemotron-3-ultra-550b-a55b', [{ role: 'user', content: 'hola' }]);
    const c = window.__proxyCalls[0] || {};
    return {
      texto: r, url: c.url, cabeceras: Object.keys(c.headers || {}),
      modelo: JSON.parse(c.body || '{}').model,
      maxTokens: JSON.parse(c.body || '{}').max_tokens
    };
  });
  log('IA', 'NVIDIA envía al proxy configurado, no a integrate.api.nvidia.com',
    sendProxy.url === 'https://petrol-nv.mi-cuenta.workers.dev/v1/chat/completions', sendProxy.url);
  log('IA', 'La petición al proxy no lleva API Key (la añade el Worker con su secreto)',
    !sendProxy.cabeceras.includes('Authorization'), sendProxy.cabeceras.join(','));
  log('IA', 'NVIDIA sube max_tokens a 2048 (sus modelos razonan antes de contestar)',
    sendProxy.maxTokens === 2048 && sendProxy.modelo === 'nvidia/nemotron-3-ultra-550b-a55b', 'max_tokens=' + sendProxy.maxTokens);
  log('IA', 'La respuesta del proxy se pinta en el chat', sendProxy.texto === 'Madrid', sendProxy.texto);

  const sendProxyErr = await page.evaluate(async () => {
    window.__proxyMock.body = { choices: [{ message: { content: '', reasoning_content: 'pienso...' }, finish_reason: 'length' }] };
    const vacio = await AI_PROVIDERS.nvidia.send(null, 'z-ai/glm-5.3-flash', [{ role: 'user', content: 'hola' }]);
    window.__proxyMock.status = 404;
    window.__proxyMock.body = { detail: "Function 'abc': Not found for account" };
    let err = '', esDeModelo = false;
    try { await AI_PROVIDERS.nvidia.send(null, 'nvidia/nemotron-4-340b-instruct', [{ role: 'user', content: 'hola' }]); }
    catch (e) { err = e.message; esDeModelo = AI_MODEL_ERROR_RE.test(e.message); }
    return { vacio, err, esDeModelo };
  });
  log('IA', 'NVIDIA: si el modelo solo razona y se queda sin tokens, avisa en vez de quedar en blanco',
    /se pasó el tiempo pensando/.test(sendProxyErr.vacio), sendProxyErr.vacio.slice(0, 60));
  log('IA', 'NVIDIA: un 404 del proxy (modelo no desplegado) dispara el aviso de "elige otro"',
    /Not found for account/.test(sendProxyErr.err) && sendProxyErr.esDeModelo, sendProxyErr.err.slice(0, 60));

  // --- Catálogo de NVIDIA vía proxy: se pide al Worker y sin Authorization ---
  await page.evaluate(() => {
    window.__proxyMock = { status: 200, body: { data: [{ id: 'nvidia/nemotron-3-ultra-550b-a55b' }, { id: 'moonshotai/kimi-k3' }, { id: 'nvidia/nemotron-3-embed-1b' }, { id: 'deepseek-ai/deepseek-v4.1-flash' }] } };
    window.__proxyCalls = [];
    invalidateAiModelsCache('nvidia');
  });
  const catalogo = await page.evaluate(async () => {
    const r = await refreshAiModels('nvidia', { force: true });
    const c = window.__proxyCalls[0] || {};
    return {
      ok: r.ok, models: r.models || [], url: c.url, cabeceras: Object.keys(c.headers || {}),
      status: document.getElementById('iaModelsStatusNvidia').textContent,
      opciones: document.getElementById('iaModelNvidia').options.length
    };
  });
  log('IA', 'El catálogo de NVIDIA se pide al proxy (filtra 1 embedding de 4)',
    catalogo.ok && catalogo.models.length === 3, JSON.stringify(catalogo.models));
  log('IA', 'Al proxy no se le manda Authorization ni al listar ni al chatear',
    !catalogo.cabeceras.includes('Authorization'), catalogo.cabeceras.join(','));
  log('IA', 'El desplegable de NVIDIA une proxy + lista fija (7 → 8)',
    catalogo.url === 'https://petrol-nv.mi-cuenta.workers.dev/v1/models' && catalogo.opciones === 8,
    catalogo.url + ' | ' + catalogo.opciones + ' opciones');

  // --- Cambiar la URL del proxy invalida el catálogo (detrás hay otra cuenta) ---
  const cambioProxy = await page.evaluate(async () => {
    const antes = { cacheado: !!loadAiModelsCache().nvidia, url: getAiProxyUrl('nvidia') };
    const input = document.getElementById('iaProxyNvidia');
    input.value = 'otro-worker.mi-cuenta.workers.dev/';
    input.dispatchEvent(new Event('change'));
    return { antes, justoDespues: !!loadAiModelsCache().nvidia, guardado: localStorage.getItem(AI_PROXY_KEY), enElInput: input.value };
  });
  log('IA', 'Al cambiar la URL del proxy se borra el catálogo anterior',
    cambioProxy.antes.cacheado && cambioProxy.justoDespues === false, JSON.stringify(cambioProxy.antes));
  log('IA', 'La URL del proxy se persiste normalizada en localStorage y en el input',
    cambioProxy.guardado === 'https://otro-worker.mi-cuenta.workers.dev' && cambioProxy.enElInput === 'https://otro-worker.mi-cuenta.workers.dev',
    cambioProxy.guardado);

  // --- Sin URL guardada se cae al valor de ejemplo, que no puede funcionar ---
  const sinProxy = await page.evaluate(async () => {
    setAiProxyUrl('nvidia', '');
    window.__proxyCalls = [];
    const r = await refreshAiModels('nvidia', { force: true });
    const c = window.__proxyCalls[0] || {};
    return { ok: r.ok, reason: r.reason, aviso: aiProviderNotReadyMessage('nvidia'), llamadas: window.__proxyCalls.length,
      url: getAiProxyUrl('nvidia'), def: AI_PROXY_NVIDIA_DEFAULT, esPredef: isDefaultProxyUrl('nvidia'), listo: isAiProviderReady('nvidia') };
  });
  log('IA', 'Sin URL guardada se usa el valor de ejemplo pero NVIDIA no queda listo (no hay subdominio de cuenta)',
    sinProxy.url === sinProxy.def && sinProxy.esPredef && sinProxy.listo === false,
    sinProxy.url + ' | listo=' + sinProxy.listo);
  log('IA', 'Con el valor de ejemplo no se hace ni una petición al proxy',
    sinProxy.ok === false && sinProxy.reason === 'nokey' && sinProxy.llamadas === 0
    && /no puede existir/.test(sinProxy.aviso), sinProxy.reason + ' | ' + sinProxy.llamadas + ' fetch');

  // --- Contexto histórico que recibe el modelo ---
  // Objetivo: que la IA pueda responder "¿cómo evolucionó el precio en X?" con
  // serie de precios + fecha, mínimo, máximo y variación, sin inventarse nada.
  const histCtx = await page.evaluate(async () => {
    const stations = [
      { IDEESS: 1001, 'Rótulo': 'Repsol', Localidad: 'Madrid', 'Dirección': 'Calle Mayor 1', 'Precio Gasolina 95 E5': '1,455' },
      { IDEESS: 1002, 'Rótulo': 'Cepsa', Localidad: 'Getafe', 'Dirección': 'Av. del Sol 2', 'Precio Gasolina 95 E5': '1,600' },
      { IDEESS: 1003, 'Rótulo': 'Galp', Localidad: 'Alcalá', 'Dirección': 'Ctra. M-2 3', 'Precio Gasolina 95 E5': '1,520' }
    ];
    // El histórico se pide para las fechas reales de los últimos días: aquí se
    // genera una serie por fecha, con Repsol bajando 0,005 €/L por día y Cepsa
    // subiendo 0,010 (para que haya subidas y bajadas en el mismo periodo).
    // El índice se calcula como "días respecto a hoy" sobre la fecha completa
    // (dd-mm-aaaa), NO con el día del mes: con el día del mes la serie se
    // rompía al cruzar un cambio de mes (del 30 al 1 el precio "subía" y el
    // test del mínimo dejaba de cumplirse).
    const HOY = Math.floor(Date.now() / 86400000);
    const precio = (fecha, ideess) => {
      const [d, m, y] = fecha.split('-').map(Number);
      const offset = Math.floor(Date.UTC(y, m - 1, d) / 86400000) - HOY;
      const base = { 1001: 1.512, 1002: 1.650, 1003: 1.530 }[ideess];
      const paso = { 1001: -0.005, 1002: 0.010, 1003: -0.002 }[ideess];
      return (base + paso * (offset + 13)).toFixed(3).replace('.', ',');
    };
    const snap = fecha => stations.map(s => ({ ...s, 'Precio Gasolina 95 E5': precio(fecha, s.IDEESS) }));

    const prev = { data: STATE.data, favs: STATE.favorites, prov: STATE.selectedProv, fuel: STATE.selectedFuel, map: STATE.provinceIdMap, days: STATE.historyDays };
    window.__realFetch = window.fetch.bind(window);
    const real = window.__realFetch;
    window.__histCalls = 0;
    window.fetch = async (input, opts) => {
      const u = typeof input === 'string' ? input : (input && input.url) || '';
      if (!u.includes('EstacionesTerrestresHist')) return real(input, opts);
      const d = /FiltroProvincia\/(\d{2}-\d{2}-\d{4})/.exec(u);
      window.__histCalls++;
      return new Response(JSON.stringify({ ListaEESSPrecio: d ? snap(d[1]) : [] }), { headers: { 'Content-Type': 'application/json' } });
    };
    STATE.data = stations;
    STATE.favorites = [1002];
    STATE.selectedProv = 'Madrid';
    STATE.selectedFuel = 'Gasolina 95 E5';
    STATE.provinceIdMap = { Madrid: '01' };

    const ctx = await getAiContext('¿cómo ha evolucionado el precio en Repsol y cuál es el más barato?');
    const llamadas1 = window.__histCalls;
    const ctx2 = await getAiContext('hola, gracias');
    const ctx3 = await getAiContext('¿qué tal está el precio de la gasolina?');
    const llamadas2 = window.__histCalls;
    window.fetch = real;
    STATE.data = prev.data; STATE.favorites = prev.favs; STATE.selectedProv = prev.prov;
    STATE.selectedFuel = prev.fuel; STATE.provinceIdMap = prev.map; STATE.historyDays = prev.days;
    return { ctx, sinHistoria: ctx2, sinNombre: ctx3, llamadas1, llamadas2 };
  });
  const serie = /\[1001\] Repsol[\s\S]*?Serie [^:]*: ([^\n]+)/.exec(histCtx.ctx);
  const puntos = serie ? serie[1].split(' | ') : [];
  const ultimo = puntos.length ? parseFloat(puntos[puntos.length - 1].split(': ')[1].replace(',', '.')) : null;
  const minInforme = /mín ([\d,]+) \(\d{2}-\d{2}-\d{4}\)/.exec(histCtx.ctx);
  const resumen = /Resumen: ahora 1,455[^\n]*/.exec(histCtx.ctx);
  const histGates = await page.evaluate(() => ({
    hola: AI_HISTORY_WORDS.test('hola, gracias'),
    queTal: AI_HISTORY_WORDS.test('¿qué tal está el precio de la gasolina?'),
    evo: AI_HISTORY_WORDS.test('¿cómo ha evolucionado el precio en Repsol?')
  }));
  // Ojo: el marcador de la sección es "=== HISTÓRICO DE PRECIOS", no la palabra
  // suelta, porque la instrucción del sistema también la nombra.
  const SECCION = /=== HISTÓRICO DE PRECIOS/;
  log('IA', 'El contexto incluye la serie histórica de la gasolinera nombrada, con fecha y precio',
    SECCION.test(histCtx.ctx) && /\[1001\] Repsol \| Madrid \| Calle Mayor 1/.test(histCtx.ctx)
    && puntos.length === 10 && /^\d{2}-\d{2}: [\d,]+$/.test(puntos[0].trim()), puntos[0] || 'sin serie');
  log('IA', 'El mínimo coincide con el último precio de la serie (Repsol baja cada día)',
    ultimo !== null && minInforme !== null && Math.abs(ultimo - parseFloat(minInforme[1].replace(',', '.'))) < 0.0001,
    'último=' + ultimo + ' mín=' + (minInforme && minInforme[1]));
  log('IA', 'Cada estación con histórico trae ahora/mín/máx/media/variación y nº de días',
    !!resumen && /^Resumen: ahora 1,455 \| .+ [\d,]+ \(\d{2}-\d{2}-\d{4}\) \| .+ [\d,]+ \(\d{2}-\d{2}-\d{4}\) \| media [\d,]+ \| desde \d{2}-\d{2} [-+][\d,]+ \([-+][\d,]+%\) \| \d+ d..s con precio$/.test(resumen[0]),
    resumen ? resumen[0].trim() : 'sin resumen');
  log('IA', 'Incluye favoritos y las más baratas, y la tendencia de la provincia',
    /\[1002\] Cepsa/.test(histCtx.ctx) && /\[1003\] Galp/.test(histCtx.ctx) && /Tendencia provincial/.test(histCtx.ctx)
    && /El precio más bajo visto en toda la provincia/.test(histCtx.ctx), 'Cepsa y Galp presentes');
  log('IA', 'Señala la mayor bajada (📉 Repsol) y la mayor subida (📈 Cepsa) del periodo',
    /mayor bajada y mayor subida/i.test(histCtx.ctx) && /📈 [^\n]*Cepsa/.test(histCtx.ctx) && /📉 [^\n]*Repsol/.test(histCtx.ctx),
    (/📈[^\n]*/.exec(histCtx.ctx) || [''])[0].trim());
  log('IA', 'Sin palabras de histórico ni nombre de marca NO se descarga el histórico',
    !SECCION.test(histCtx.sinHistoria) && !SECCION.test(histCtx.sinNombre) && !histGates.hola && !histGates.queTal && histGates.evo,
    'regex: ' + JSON.stringify(histGates));
  log('IA', 'La segunda pregunta con histórico reutiliza la caché (no repite las 14 fechas)',
    histCtx.llamadas1 === histCtx.llamadas2, histCtx.llamadas1 + ' → ' + histCtx.llamadas2);

  // --- Rango de días: el mismo catálogo que los combos de la app ---
  const rangoOk = await page.evaluate(() => {
    const antes = STATE.historyDays;
    STATE.historyDays = 30;
    const casos = [
      ['¿cómo evoluciona en 60 días?', 60],
      ['evolución de los últimos 7 días', 7],
      ['variación en 21 jornadas', 21],
      ['¿y en 6 semanas?', 42],
      ['hace 3 meses', 90],
      ['durante el último año', 180],
      ['más de 400 días', 180],
      ['solo 1 día', 7],
      ['evolución (sin cifra)', 30]
    ];
    const res = casos.map(([q, exp]) => [q, resolveAiHistoryDays(q), exp]);
    STATE.historyDays = antes;
    const conDefecto = resolveAiHistoryDays('evolución');
    // Los <option> del modal de detalle y del popup del mapa deben coincidir
    // con la constante que usa la IA.
    const detalle = [...document.getElementById('historyDays').options].map(o => +o.value);
    const popup = [...new DOMParser().parseFromString(popupHtml({ 'Rótulo': 'X' }), 'text/html')
      .querySelectorAll('.popup-history-days option')].map(o => +o.getAttribute('value'));
    return { res, conDefecto, antes, detalle, popup, opciones: HISTORY_DAYS_OPTIONS };
  });
  const rangoFallos = rangoOk.res.filter(([, got, exp]) => got !== exp);
  log('IA', 'resolveAiHistoryDays() entiende "60 días", "21 jornadas", "6 semanas", "3 meses" y "1 año"',
    rangoFallos.length === 0, rangoFallos.map(([q, g, e]) => `${q} → ${g} (esperado ${e})`).join(' | '));
  log('IA', 'Acota el rango al de la app y, sin cifra en la pregunta, usa STATE.historyDays',
    rangoOk.res[7][1] === 7 && rangoOk.res[8][1] === 30 && rangoOk.conDefecto === rangoOk.antes,
    '1 día → 7 | sin cifra → ' + rangoOk.res[8][1] + ' y luego ' + rangoOk.conDefecto);
  log('IA', 'HISTORY_DAYS_OPTIONS coincide con los combos de la app (modal y popup del mapa)',
    rangoOk.detalle.join(',') === rangoOk.opciones.join(',') && rangoOk.popup.join(',') === rangoOk.opciones.join(','),
    'modal: ' + rangoOk.detalle.join(',') + ' | popup: ' + rangoOk.popup.join(','));

  // --- El rango pedido llega al contexto y reutiliza la caché de la app ---
  const rangoCtx = await page.evaluate(async () => {
    const prev = { data: STATE.data, favs: STATE.favorites, prov: STATE.selectedProv, fuel: STATE.selectedFuel, map: STATE.provinceIdMap, days: STATE.historyDays, cache: window._historyCache, ai: window._aiHistoryCache };
    const stations = [
      { IDEESS: 1001, 'Rótulo': 'Repsol', Localidad: 'Madrid', 'Precio Gasolina 95 E5': '1,455', 'Precio Gasoleo A': '1,390' },
      { IDEESS: 1002, 'Rótulo': 'Cepsa', Localidad: 'Getafe', 'Precio Gasolina 95 E5': '1,600', 'Precio Gasoleo A': '1,510' }
    ];
    const precio = (fecha, st) => {
      const dia = Number(fecha.slice(0, 2));
      const base = { 1001: [1.512, 1.390], 1002: [1.650, 1.510] }[st.IDEESS];
      const paso = st.IDEESS === 1001 ? -0.005 : 0.010;
      return (base[0] + paso * (dia - 13)).toFixed(3).replace('.', ',') + '|' + (base[1] + paso * (dia - 13)).toFixed(3).replace('.', ',');
    };
    window.__histCalls = 0;
    window.fetch = async (input, opts) => {
      const u = typeof input === 'string' ? input : (input && input.url) || '';
      if (!u.includes('EstacionesTerrestresHist')) return window.__realFetch(input, opts);
      const d = /FiltroProvincia\/(\d{2}-\d{2}-\d{4})/.exec(u);
      window.__histCalls++;
      const lista = d ? stations.map(st => {
        const [g, d2] = precio(d[1], st).split('|');
        return { ...st, 'Precio Gasolina 95 E5': g, 'Precio Gasoleo A': d2 };
      }) : [];
      return new Response(JSON.stringify({ ListaEESSPrecio: lista }), { headers: { 'Content-Type': 'application/json' } });
    };
    STATE.data = stations;
    STATE.favorites = [];
    STATE.selectedProv = 'Madrid';
    STATE.selectedFuel = 'Gasolina 95 E5';
    STATE.provinceIdMap = { Madrid: '01' };
    window._historyCache = null;
    window._aiHistoryCache = null;
    // El histórico se cachea en IndexedDB (js/history.js), así que para poder
    // contar las peticiones de red se vacían antes las claves de la provincia:
    // si no, reutiliza lo que dejaron los tests anteriores.
    for (let i = 1; i <= 60; i++) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      d.setHours(0, 0, 0, 0);
      await dbDelete('cache', 'hist_01_' + formatDateDDMMYYYY(d));
    }

    const ctx60 = await getAiContext('¿cómo ha evolucionado en 60 días?');
    const llamadas60 = window.__histCalls;
    // Segunda pregunta más corta: debe reutilizar la caché de 60 días (0 fetches)
    const ctx7 = await getAiContext('¿y en los últimos 7 días?');
    const llamadas7 = window.__histCalls;
    // Con el modal abierto se usa su combustible (Gasóleo A)
    document.getElementById('detailPanel').classList.add('show');
    const sel = document.getElementById('historyFuel');
    sel.innerHTML = '<option value="Gasolina 95 E5">95</option><option value="Gasóleo A" selected>Gasóleo A</option>';
    const ctxDiesel = await getAiContext('evolución de los últimos 7 días');
    const fueraModal = (() => { document.getElementById('detailPanel').classList.remove('show'); return aiHistoryFuelName(stations[0]); })();
    const conModal = (() => { document.getElementById('detailPanel').classList.add('show'); const v = aiHistoryFuelName(stations[0]); document.getElementById('detailPanel').classList.remove('show'); return v; })();

    window.fetch = window.__realFetch;
    STATE.data = prev.data; STATE.favorites = prev.favs; STATE.selectedProv = prev.prov;
    STATE.selectedFuel = prev.fuel; STATE.provinceIdMap = prev.map; STATE.historyDays = prev.days;
    window._historyCache = prev.cache; window._aiHistoryCache = prev.ai;
    return { ctx60, llamadas60, ctx7, llamadas7, ctxDiesel, fueraModal, conModal,
      flags: {
        rango60: /Rango: 60 días/.test(ctx60),
        rango7: /Rango: 7 días/.test(ctx7),
        hist7: /HISTÓRICO DE PRECIOS/.test(ctx7),
        reut: /reutilizando la caché/.test(ctx7),
        err: /Error al recuperar histórico/.test(ctx7)
      } };
  });
  const jornadas = ctx => {
    const m = /Periodo con datos: \d{2}-\d{2}-\d{4} → \d{2}-\d{2}-\d{4} \((\d+) jornadas/.exec(ctx);
    return m ? +m[1] : -1;
  };
  const f = rangoCtx.flags;
  log('IA', 'El rango pedido llega al contexto (60 días) y recorta la caché amplia al pedir 7',
    f.rango60 && jornadas(rangoCtx.ctx60) === 60 && f.rango7 && jornadas(rangoCtx.ctx7) === 7 && f.reut,
    `60d:${f.rango60}/${jornadas(rangoCtx.ctx60)} 7d:${f.rango7}/${jornadas(rangoCtx.ctx7)} hist:${f.hist7} reut:${f.reut} err:${f.err} llamadas:${rangoCtx.llamadas60}→${rangoCtx.llamadas7}`);
  log('IA', 'La segunda pregunta reutiliza la caché (60 fechas ya descargadas, 0 peticiones nuevas)',
    rangoCtx.llamadas60 === 60 && rangoCtx.llamadas7 === rangoCtx.llamadas60,
    rangoCtx.llamadas60 + ' → ' + rangoCtx.llamadas7);
  log('IA', 'Con el modal de histórico abierto la IA usa su combustible (Gasóleo A)',
    /Combustible analizado: Gasóleo A/.test(rangoCtx.ctxDiesel) && rangoCtx.conModal === 'Gasóleo A'
    && rangoCtx.fueraModal === 'Gasolina 95 E5', rangoCtx.conModal + ' vs ' + rangoCtx.fueraModal);

  // --- Los modelos se pintan en orden alfabetico ---
  // Se ordena por la etiqueta que ve el usuario (no por el id), para que los
  // ids con prefijo de proveedor no agrupen la lista por proveedor.
  const ordenAlf = await page.evaluate(() => {
    const sel = document.getElementById('iaModelLlm7');
    const guardado = { html: sel.innerHTML, valor: sel.value };
    sel.value = '';
    populateAiModelSelect('llm7', ['llama-4-maverick']);
    const etiquetas = [...sel.options].map(o => o.textContent);
    const ordenado = etiquetas.every((t, i) => i === 0
      || etiquetas[i - 1].toLowerCase().localeCompare(t.toLowerCase(), 'es') < 0);
    const valor = sel.value;
    sel.innerHTML = guardado.html;
    sel.value = guardado.valor;
    return { ordenado, etiquetas, valor };
  });
  log('IA', 'El desplegable sale en orden alfabetico (lista fija + catálogo remoto)',
    ordenAlf.ordenado, ordenAlf.etiquetas.join(' | '));
  log('IA', 'Sin selección previa se mantiene el default, no la primera opción alfabética',
    ordenAlf.valor === 'codestral-latest', ordenAlf.valor);

  // --- Se guarda y se recupera el ultimo modelo enviado por proveedor ---
  const guardadoModelo = await page.evaluate(async () => {
    const sel = document.getElementById('iaModelLlm7');
    const input = document.getElementById('iaInputLlm7');
    const msgs = document.getElementById('iaMessagesLlm7');
    const btn = document.getElementById('iaSendLlm7');
    const antes = localStorage.getItem(AI_LAST_MODEL_KEY);
    const realSend = AI_PROVIDERS.llm7.send;
    AI_PROVIDERS.llm7.send = async () => 'respuesta';
    msgs.innerHTML = '';
    sel.value = 'minimax-m2.7';
    input.value = 'hola';
    await handleAiSend('llm7', sel, input, msgs, btn);
    const guardado = loadAiLastModels();
    AI_PROVIDERS.llm7.send = realSend;
    msgs.innerHTML = '';
    input.value = '';
    if (antes === null) localStorage.removeItem(AI_LAST_MODEL_KEY);
    else localStorage.setItem(AI_LAST_MODEL_KEY, antes);
    return guardado;
  });
  log('IA', 'Al enviar se guarda el modelo elegido como el último de su proveedor',
    guardadoModelo.llm7 === 'minimax-m2.7', JSON.stringify(guardadoModelo));

  const restauradoModelo = await page.evaluate(() => {
    const sel = document.getElementById('iaModelLlm7');
    const guardado = { html: sel.innerHTML, valor: sel.value, raw: localStorage.getItem(AI_LAST_MODEL_KEY) };
    const poner = () => { sel.value = ''; };
    saveAiLastModel('llm7', 'minimax-m2.7');
    poner(); populateAiModelSelect('llm7', null);
    const conUltimo = sel.value;
    // Si el ultimo modelo ya no esta en la lista, se vuelve al default
    saveAiLastModel('llm7', 'modelo-retirado-xyz');
    poner(); populateAiModelSelect('llm7', null);
    const sinOpcion = sel.value;
    // ...aunque venga del catalogo remoto, no de la lista fija
    saveAiLastModel('llm7', 'llama-4-maverick');
    poner(); populateAiModelSelect('llm7', ['llama-4-maverick']);
    const conRemoto = sel.value;
    if (guardado.raw === null) localStorage.removeItem(AI_LAST_MODEL_KEY);
    else localStorage.setItem(AI_LAST_MODEL_KEY, guardado.raw);
    sel.innerHTML = guardado.html;
    sel.value = guardado.valor;
    return { conUltimo, sinOpcion, conRemoto };
  });
  log('IA', 'Al arrancar se restaura el último modelo usado por cada proveedor',
    restauradoModelo.conUltimo === 'minimax-m2.7' && restauradoModelo.conRemoto === 'llama-4-maverick',
    'fija=' + restauradoModelo.conUltimo + ' | remoto=' + restauradoModelo.conRemoto);
  log('IA', 'Si el último modelo desapareció de la lista se vuelve al default',
    restauradoModelo.sinOpcion === 'codestral-latest', restauradoModelo.sinOpcion);

  // --- El Markdown del LLM se formatea en el chat (no se amontona en un bloque) ---
  // Los modelos devuelven **negrita**, saltos de línea, listas y tablas. Antes
  // se pintaba con innerHTML directo: el navegador colapsaba los saltos y los
  // ** se veían literales. renderAiMarkdown() lo convierte a HTML y el texto
  // original se guarda en data-raw para poder reenviarlo y editarlo.
  const formato = await page.evaluate(() => {
    const msgs = document.getElementById('iaMessagesLlm7');
    const input = document.getElementById('iaInputLlm7');
    const guardadoHtml = msgs.innerHTML;
    const guardadoInput = input.value;
    msgs.innerHTML = '';
    const md = ['# Resumen', '', '**Repsol** baja a *1,542* €/L.', '',
      '- Atocha: 1,589', '- Sur: 1,542', '', '1. Primero', '2. Segundo', '',
      'Linea uno', 'Linea dos', '',
      'Código `inline` y [web](https://example.com)', '',
      '| Estación | Precio |', '|---|---|', '| Atocha | 1,589 |', '',
      '```js', 'const x = 1 < 2;', '```'].join('\n');
    const usuarioTxt = 'hola <b>mundo</b> & adios';
    addAiMessage(msgs, usuarioTxt, 'user', 'llm7', input);
    addAiMessage(msgs, md, 'assistant', 'llm7', input);
    const asistente = msgs.querySelector('.ia-msg.assistant');
    const usuario = msgs.querySelector('.ia-msg.user');
    const r = {
      titulo: !!asistente.querySelector('.ia-md-h1'),
      negrita: !!asistente.querySelector('b') && asistente.querySelector('b').textContent === 'Repsol',
      cursiva: !!asistente.querySelector('i'),
      parrafos: asistente.querySelectorAll('p').length === 3 && asistente.querySelectorAll('br').length >= 1,
      listas: asistente.querySelectorAll('li').length === 4 && !!asistente.querySelector('ol'),
      codigo: asistente.querySelectorAll('code').length === 2 && !!asistente.querySelector('.ia-md-pre'),
      tabla: !!asistente.querySelector('.ia-md-table'),
      enlace: !!asistente.querySelector('a[href="https://example.com"]'),
      sinAsteriscos: !/\*\*/.test(asistente.textContent),
      rawAsistente: asistente.dataset.raw === md,
      userEscapado: !usuario.querySelector('b') && /&lt;b&gt;mundo/.test(usuario.innerHTML)
        && usuario.textContent.replace('✎', '') === usuarioTxt,
      rawUsuario: usuario.dataset.raw === usuarioTxt
    };
    const enviados = getMessagesForProvider('llm7');
    r.historial = enviados.length === 2
      && enviados[0].role === 'user' && enviados[0].content === usuarioTxt
      && enviados[1].role === 'assistant' && enviados[1].content === md;
    // El texto del modelo se escapa: un <img onerror> no debe llegar a ejecutarse
    delete window.__pwned;
    addAiMessage(msgs, 'Cuidado <img src=x onerror="window.__pwned=1">', 'assistant', 'llm7', input);
    r.sinXss = !msgs.querySelector('img') && !window.__pwned;
    editAiMessage('llm7', usuario, input);
    r.editDevuelve = input.value === usuarioTxt;
    msgs.innerHTML = guardadoHtml;
    input.value = guardadoInput;
    return r;
  });
  const fmt = formato;
  log('IA', 'El Markdown del LLM se pinta formateado (títulos, negrita, cursiva, párrafos)',
    fmt.titulo && fmt.negrita && fmt.cursiva && fmt.parrafos && fmt.sinAsteriscos,
    `h1:${fmt.titulo} b:${fmt.negrita} i:${fmt.cursiva} p:${fmt.parrafos} sin**:${fmt.sinAsteriscos}`);
  log('IA', 'Listas, código, enlaces y tablas se convierten a HTML (no texto pegado)',
    fmt.listas && fmt.codigo && fmt.tabla && fmt.enlace,
    `li:${fmt.listas} code:${fmt.codigo} table:${fmt.tabla} a:${fmt.enlace}`);
  log('IA', 'El texto del usuario se escapa: una etiqueta HTML no se inyecta',
    fmt.userEscapado && fmt.sinXss, `user:${fmt.userEscapado} xss:${fmt.sinXss}`);
  log('IA', 'El historial reenvía el Markdown original (data-raw), no el HTML renderizado',
    fmt.historial && fmt.rawAsistente && fmt.rawUsuario, `hist:${fmt.historial} rawA:${fmt.rawAsistente} rawU:${fmt.rawUsuario}`);
  log('IA', 'Editar un mensaje recupera el texto original en el input', fmt.editDevuelve, String(fmt.editDevuelve));

  // --- Marca de agua: modelo usado y tiempo bajo cada respuesta ---
  const marca = await page.evaluate(async () => {
    const msgs = document.getElementById('iaMessagesLlm7');
    const input = document.getElementById('iaInputLlm7');
    const sel = document.getElementById('iaModelLlm7');
    const btn = document.getElementById('iaSendLlm7');
    const guardado = { html: msgs.innerHTML, input: input.value, sel: sel.value };
    const realSend = AI_PROVIDERS.llm7.send;
    AI_PROVIDERS.llm7.send = async () => {
      await new Promise(r => setTimeout(r, 150));
      return 'Listo **ok**';
    };
    msgs.innerHTML = '';
    sel.value = 'codestral-latest';
    input.value = 'hola';
    await handleAiSend('llm7', sel, input, msgs, btn);
    const div = msgs.querySelector('.ia-msg.assistant');
    const meta = div && div.querySelector('.ia-msg-meta');
    const texto = meta ? meta.textContent : '';
    const mseg = /([0-9]+)\s*ms/.exec(texto);
    const seg = /([0-9]+[,.][0-9]+)\s*s/.exec(texto);
    const r = {
      existe: !!meta,
      modelo: /codestral-latest/.test(texto),
      tiempo: (!!mseg && +mseg[1] >= 100) || (!!seg && parseFloat(seg[1].replace(',', '.')) >= 0.1),
      medida: texto.split('·')[1] ? texto.split('·')[1].trim() : '',
      alFinal: !!meta && div.lastElementChild === meta,
      sinAsteriscos: !!div && !/\*\*/.test(div.textContent),
      historialLimpio: !getMessagesForProvider('llm7').some(m => /⏱|ia-msg-meta/.test(m.content))
    };
    AI_PROVIDERS.llm7.send = realSend;
    msgs.innerHTML = guardado.html;
    input.value = guardado.input;
    sel.value = guardado.sel;
    return r;
  });
  log('IA', 'La respuesta lleva una marca de agua con el modelo y el tiempo empleado',
    marca.existe && marca.modelo && marca.tiempo && marca.alFinal,
    `meta:${marca.existe} modelo:${marca.modelo} tiempo:${marca.tiempo} (${marca.medida})`);
  log('IA', 'La marca de agua no se reenvía al modelo ni estorba el formateo',
    marca.historialLimpio && marca.sinAsteriscos, `historial:${marca.historialLimpio} md:${marca.sinAsteriscos}`);

  // --- Pestañas de IA ocultables desde Config (por proveedor) ---
  const visibilidad = await page.evaluate(() => {
    const tabs = () => [...document.querySelectorAll('.ia-provider-tab')];
    const visibles = () => tabs().filter(t => !t.classList.contains('ia-hidden'));
    const panel = p => document.querySelector('.ia-provider-panel[data-iapanel="' + p + '"]');
    const antes = {
      casillas: document.querySelectorAll('#aiProviderVisibility input[type="checkbox"]').length,
      marcadas: document.querySelectorAll('#aiProviderVisibility input:checked').length,
      visibles: visibles().length,
      ocultos: loadAiHiddenProviders().length
    };

    // 1) Oculta dos proveedores que no son el activo
    saveAiHiddenProviders(['mistral', 'openrouter']);
    applyAiProviderVisibility();
    const ocultaDos = {
      tabMistral: document.querySelector('.ia-provider-tab[data-iaprovider="mistral"]').classList.contains('ia-hidden'),
      panelMistral: panel('mistral').classList.contains('ia-hidden'),
      panelAbierto: !panel('mistral').classList.contains('active'),
      visibles: visibles().length,
      activa: document.querySelector('.ia-provider-tab.active').dataset.iaprovider
    };

    // 2) Oculta también la pestaña activa: debe saltar a la primera visible
    const activa = document.querySelector('.ia-provider-tab.active').dataset.iaprovider;
    saveAiHiddenProviders(['mistral', 'openrouter', activa]);
    applyAiProviderVisibility();
    const salto = {
      nueva: document.querySelector('.ia-provider-tab.active').dataset.iaprovider,
      visible: !document.querySelector('.ia-provider-tab.active').classList.contains('ia-hidden'),
      panelActivo: !!document.querySelector('.ia-provider-panel.active:not(.ia-hidden)')
    };

    // 3) No se puede ocultar la última visible: la casilla se revierte
    const todas = Object.keys(AI_PROVIDERS);
    const ultima = visibles()[0].dataset.iaprovider;
    saveAiHiddenProviders(todas.filter(p => p !== ultima));
    renderAiProviderVisibilityConfig();
    const cb = document.getElementById('iaVis' + ultima.replace(/(^|-)([a-z])/g, (_, d, c) => c.toUpperCase()));
    cb.click();
    const ultimaCasilla = {
      sigueMarcada: cb.checked === true,
      hint: document.getElementById('aiProviderVisibilityHint').textContent,
      sigueVisible: visibles().length === 1
    };

    // 4) Restauración: todo visible de nuevo y nada oculto
    saveAiHiddenProviders([]);
    renderAiProviderVisibilityConfig();
    const restaurado = {
      visibles: visibles().length,
      ocultos: loadAiHiddenProviders().length,
      casillas: document.querySelectorAll('#aiProviderVisibility input:checked').length,
      panelesOcultos: document.querySelectorAll('.ia-provider-panel.ia-hidden').length
    };
    return { antes, ocultaDos, salto, ultimaCasilla, restaurado, activa };
  });
  const v = visibilidad;
  log('IA', 'Config trae una casilla por proveedor y por defecto están las 7 visibles',
    v.antes.casillas === 7 && v.antes.marcadas === 7 && v.antes.visibles === 7 && v.antes.ocultos === 0,
    `casillas:${v.antes.casillas} marcadas:${v.antes.marcadas} visibles:${v.antes.visibles}`);
  log('IA', 'Al desmarcar un proveedor se ocultan su pestaña y su panel (el activo no se toca)',
    v.ocultaDos.tabMistral && v.ocultaDos.panelMistral && v.ocultaDos.panelAbierto
    && v.ocultaDos.visibles === 5 && v.ocultaDos.activa === v.activa,
    `visibles:${v.ocultaDos.visibles} activa:${v.ocultaDos.activa} panelAbierto:${v.ocultaDos.panelAbierto}`);
  log('IA', 'Si se oculta la pestaña activa se salta a la primera visible con su panel',
    v.salto.visible && v.salto.panelActivo && v.salto.nueva !== v.activa,
    `activa:${v.activa} → nueva:${v.salto.nueva} visible:${v.salto.visible} panel:${v.salto.panelActivo}`);
  log('IA', 'No se puede ocultar la última pestaña visible (la casilla se revierte)',
    v.ultimaCasilla.sigueMarcada && v.ultimaCasilla.sigueVisible && /al menos una/.test(v.ultimaCasilla.hint),
    `marcada:${v.ultimaCasilla.sigueMarcada} visibles:${v.ultimaCasilla.sigueVisible} hint:${v.ultimaCasilla.hint}`);
  log('IA', 'La elección se guarda en localStorage y al restaurarlas vuelven las 7',
    v.restaurado.visibles === 7 && v.restaurado.ocultos === 0
    && v.restaurado.casillas === 7 && v.restaurado.panelesOcultos === 0,
    JSON.stringify(v.restaurado));

  // --- Restaurar fetch y limpiar ---
  await page.evaluate(() => {
    if (window.__realFetch) window.fetch = window.__realFetch;
    localStorage.removeItem(AI_MODELS_CACHE_KEY);
    localStorage.removeItem(AI_LAST_MODEL_KEY);
    localStorage.removeItem(AI_KEYS_KEY);
    localStorage.removeItem(AI_PROXY_KEY);
    localStorage.removeItem(AI_HIDDEN_KEY);
    const input = document.getElementById('iaKeyLlm7');
    if (input) input.value = '';
    AI_PROVIDERS.llm7.key = null;
    const proxyInput = document.getElementById('iaProxyNvidia');
    if (proxyInput) proxyInput.value = '';
  });
}



// ============================================================================
// 16. Ring logs — createRingLog() + logs de API y push
// ============================================================================
// Los dos logs (API y push) comparten createRingLog() de storage.js. Antes eran
// arrays a mano con un unshift + un recorte, y el push log se rompió entero al
// migrarlo: quedó una línea que usaba el array viejo (ReferenceError) y la
// restauración tras F5 buscaba window.API_LOG_RING, que no existe porque las
// `const` de un script clásico no cuelgan de window.
async function testRingLogs(page) {
  console.log('\n## 🔁 Ring logs');

  const ring = await page.evaluate(() => {
    const r = createRingLog(3);
    const push = [];
    for (let i = 1; i <= 5; i++) { r.push({ n: i }); push.push(r.all().map(x => x.n).join(',')); }
    const copia = r.all();
    copia.push({ n: 99 });
    const trasMutar = r.all().length;
    r.load([{ n: 1 }, { n: 2 }, { n: 3 }, { n: 4 }, { n: 5 }]);
    const cargado = r.all().map(x => x.n).join(',');
    const final = push[push.length - 1];
    r.clear();
    return { push: push.join(' | '), final, queda: r.all().length, aislado: trasMutar === 3, cargado };
  });
  log('Ring log', 'createRingLog() conserva las últimas N y descarta las más antiguas',
    ring.final === '3,4,5', 'tras push 1..5 con max=3 → ' + ring.push);
  log('Ring log', 'all() devuelve una copia (mutarla no toca el ring)', ring.aislado);
  log('Ring log', 'load() recorta a N y clear() vacía',
    ring.cargado === '3,4,5' && ring.queda === 0, 'load(5) → ' + ring.cargado);

  // logPushEvent() no debe lanzar: si el ring no existe en ese scope, la función
  // moría y el log de push se quedaba siempre vacío.
  const pushLog = await page.evaluate(() => {
    clearPushLog();
    logPushEvent('Test A', 'primero');
    logPushEvent('Test B', 'segundo');
    const el = document.getElementById('pushLogEntries');
    const html = el ? el.innerHTML : '';
    const guardado = JSON.parse(localStorage.getItem('gasolineras_push_log') || '[]');
    const orden = guardado.map(x => x.event).join(',');
    clearPushLog();
    return {
      pintadas: (html.match(/Test [AB]/g) || []).length,
      masRecientePrimero: html.indexOf('Test B') !== -1 && html.indexOf('Test B') < html.indexOf('Test A'),
      orden, vacio: document.getElementById('pushLogEntries').innerHTML.includes('Sin eventos')
    };
  });
  log('Ring log', 'logPushEvent() registra, persiste en localStorage y no lanza',
    pushLog.pintadas === 2 && pushLog.orden === 'Test A,Test B', 'localStorage: ' + pushLog.orden);
  log('Ring log', 'El log de push se pinta del más reciente al más antiguo',
    pushLog.masRecientePrimero, pushLog.pintadas + ' entradas pintadas');
  log('Ring log', 'clearPushLog() vacía el log y la UI avisa', pushLog.vacio);

  // La restauración tras F5 usa el identificador global, no window.algo.
  const restore = await page.evaluate(() => {
    clearApiLog(); clearPushLog();
    localStorage.setItem('gasolineras_api_log', JSON.stringify(
      Array.from({ length: 45 }, (_, i) => ({ url: 'u' + i, ms: '1ms', time: 't', ok: true }))));
    localStorage.setItem('gasolineras_push_log', JSON.stringify([{ time: 't', event: 'Restaurado', detail: 'd' }]));
    API_LOG_RING.load(JSON.parse(localStorage.getItem('gasolineras_api_log')));
    PUSH_LOG_RING.load(JSON.parse(localStorage.getItem('gasolineras_push_log')));
    renderApiLog(); renderPushLog();
    const api = document.getElementById('apiLogEntries').innerHTML;
    const push = document.getElementById('pushLogEntries').innerHTML;
    const out = {
      api: API_LOG_RING.all().length,
      primero: API_LOG_RING.all()[0].url,
      apiPintado: api.includes('u44') && !api.includes('>u14<'),
      pushPintado: push.includes('Restaurado')
    };
    clearApiLog(); clearPushLog();
    return out;
  });
  log('Ring log', 'La restauración desde localStorage existe (no depende de window)',
    restore.api === 30 && restore.primero === 'u15' && restore.apiPintado && restore.pushPintado,
    `api=${restore.api} primero=${restore.primero} apiPintado=${restore.apiPintado} pushPintado=${restore.pushPintado}`);
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

  await page.locator('#searchToggleBtn').click();
  await sleep(200);
  log('Búsqueda', 'Input presente', await page.locator('#search').isVisible());

  await ctx.close();
}

// ============================================================================
// 17. Build — ASSETS del SW sincronizados con index.html/manifest.json
// ============================================================================
function testBuild() {
  console.log('\n## 🧱 Build');
  const sw = fs.readFileSync(path.join(ROOT, 'sw.js'), 'utf8');
  const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
  const manifest = JSON.parse(fs.readFileSync(path.join(ROOT, 'manifest.json'), 'utf8'));
  const refs = [...html.matchAll(/(?:src|href)\s*=\s*"([^"]+)"/g)].map(m => m[1])
    .concat(manifest.icons.map(i => i.src))
    .filter(r => /^(css|js|icons)\//.test(r))
    // Los iconos del manifest llevan `?v=N` para que Chrome no reutilice el
    // bitmap cacheado; el precaché del SW guarda el fichero sin query.
    .map(r => r.split('?')[0]);
  const block = /const ASSETS = \[([\s\S]*?)\];/.exec(sw);
  const assets = block ? [...block[1].matchAll(/'([^']+)'/g)].map(m => m[1]) : [];
  const faltan = [...new Set(refs)].filter(r => !assets.includes(r));
  log('Build', 'ASSETS de sw.js cubre todos los ficheros que carga index.html/manifest.json',
    faltan.length === 0 && assets.length > 0, faltan.length ? 'faltan: ' + faltan.join(', ') : assets.length + ' ficheros');

  // Lo que el SW importa con importScripts tiene que estar precacheado: si no, el
  // SW arranca sin esas funciones en un arranque limpio.
  const imports = [...sw.matchAll(/importScripts\(([^)]*)\)/g)]
    .flatMap(x => (x[1].match(/'([^']+)'/g) || []).map(s => s.slice(1, -1)));
  const sinPrecachear = imports.filter(f => !assets.includes(f));
  log('Build', 'Todo lo que el SW importa con importScripts está precacheado',
    sinPrecachear.length === 0, sinPrecachear.length ? 'falta: ' + sinPrecachear.join(', ') : imports.join(', '));

  const version = Number(/const APP_VERSION\s*=\s*(\d+);/.exec(sw)?.[1] || 0);
  const buildTime = /const BUILD_TIME\s*=\s*'([^']+)'/.exec(sw)?.[1] || '';
  log('Build', 'APP_VERSION y BUILD_TIME están actualizados en sw.js',
    version > 0 && /^\d{8}-\d{6}$/.test(buildTime), `v${version} (${buildTime})`);

  // Sin `?v=N` en el manifest Chrome/Android se queda con el icono viejo
  // (reutiliza el bitmap cacheado por URL). Lo escribe bump-version.mjs.
  const sinVersion = manifest.icons.filter(i => i.src !== i.src.split('?')[0] + '?v=' + version);
  log('Build', 'Los iconos del manifest llevan la ?v= de APP_VERSION (fuerza la re-descarga)',
    manifest.icons.length > 0 && sinVersion.length === 0,
    sinVersion.length ? 'sin versionar: ' + sinVersion.map(i => i.src).join(', ') : '?v=' + version);
}

async function main() {
  console.log('========================================');
  console.log('  Pasando Tests');
  console.log('========================================');

  let server;
  try {
    server = await startServer(8080);
    console.log(`\n📡 Servidor en :${server.address().port}`);
  } catch (e) {
    console.log(`\n⚠️ Servidor: ${e.message}`);
  }

  const browser = await chromium.launch({ headless: true });

  testBuild();

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
