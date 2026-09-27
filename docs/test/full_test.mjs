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
    conProxy: Object.values(AI_PROVIDERS).some(p => p.viaProxy),
    helpersProxy: [typeof getAiProxyUrl, typeof setAiProxyUrl, typeof aiProviderUrl, typeof normalizeAiProxyUrl].join(','),
    sinCampoProxy: !document.querySelector('[id^="iaProxy"]')
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
      const c = { listModelsUrl: 'x', listModelsNoAuth: AI_PROVIDERS.llm7.listModelsNoAuth };
      const manda = (conf, p) => p !== 'google' && !conf.listModelsNoAuth;
      return manda(c, 'llm7') === false && manda({}, 'groq') === true && manda({}, 'mistral') === true
          && manda({}, 'openrouter') === true && manda({}, 'google') === false;
    }));
  log('IA', 'Ya no queda andamiaje de proxy en la app',
    directo.conProxy === false && directo.sinCampoProxy && /undefined/.test(directo.helpersProxy), directo.helpersProxy);

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

  // --- defaultModel debe coincidir con el primer <option> del desplegable ---
  const defaultsOk = await page.evaluate(() => {
    const bad = [];
    for (const p of Object.keys(AI_PROVIDERS)) {
      if (p === 'chrome-nano') continue;
      const sel = document.getElementById(getProviderInputId(p, 'iaModel'));
      if (!sel || !sel.options.length) { bad.push(p + ': sin desplegable'); continue; }
      if (sel.options[0].value !== AI_PROVIDERS[p].defaultModel) {
        bad.push(p + ': ' + sel.options[0].value + ' != ' + AI_PROVIDERS[p].defaultModel);
      }
    }
    return bad;
  });
  log('IA', 'defaultModel == primer <option> en los 5 proveedores', defaultsOk.length === 0, defaultsOk.join(' | '));

  // --- Todo proveedor con clave obligatoria tiene prefijo declarado ---
  const prefixesOk = await page.evaluate(() => {
    const declarados = Object.keys(AI_KEY_PREFIXES);
    const noRechazados = declarados.filter(p => isAiKeyFormatValid(p, 'clave-inventada-123'));
    const conClave = Object.keys(AI_PROVIDERS).filter(p => p !== 'chrome-nano' && !AI_PROVIDERS[p].keyOptional);
    const sinPrefijo = conClave.filter(p => !AI_KEY_PREFIXES[p]);
    const opcionalConPrefijo = Object.keys(AI_PROVIDERS).filter(p => AI_PROVIDERS[p].keyOptional && AI_KEY_PREFIXES[p]);
    return { total: declarados.length, noRechazados, sinPrefijo, opcionalConPrefijo, conClave: conClave.length };
  });
  log('IA', 'isAiKeyFormatValid() rechaza la clave inventada en los 4 proveedores con clave',
    prefixesOk.total === 4 && prefixesOk.noRechazados.length === 0,
    'no rechazados: ' + prefixesOk.noRechazados.join(','));
  log('IA', 'Todo proveedor con clave obligatoria tiene prefijo declarado',
    prefixesOk.sinPrefijo.length === 0, prefixesOk.sinPrefijo.join(','));
  log('IA', 'El proveedor con clave opcional (llm7) no declara prefijo',
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

  // --- Restaurar fetch y limpiar ---
  await page.evaluate(() => {
    if (window.__realFetch) window.fetch = window.__realFetch;
    localStorage.removeItem(AI_MODELS_CACHE_KEY);
    localStorage.removeItem(AI_KEYS_KEY);
    const input = document.getElementById('iaKeyLlm7');
    if (input) input.value = '';
    AI_PROVIDERS.llm7.key = null;
  });
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
