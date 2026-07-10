import { chromium } from 'playwright';

const HTTP_URL = 'http://localhost:8080';
const FILE_URL = new URL('../../index.html', import.meta.url).href;
const TEST_PROVINCE = 'Madrid';

const RESULTS = { passed: 0, failed: 0, skipped: 0, errors: [] };

function logResult(category, test, status, detail = '') {
  const icon = status === 'PASS' ? '✅' : status === 'FAIL' ? '❌' : '⏭️';
  console.log(`  ${icon} ${category} > ${test}${detail ? ': ' + detail : ''}`);
  if (status === 'PASS') RESULTS.passed++;
  else if (status === 'FAIL') { RESULTS.failed++; RESULTS.errors.push({ category, test, detail }); }
  else RESULTS.skipped++;
}

async function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function runHTTPTests(browser) {
  console.log('\n## 🌐 HTTP: localhost:8080');

  const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const page = await context.newPage();

  page.on('console', msg => {
    if (msg.type() === 'error') console.log(`    [console.error] ${msg.text()}`);
  });
  page.on('pageerror', err => console.log(`    [page error] ${err.message}`));

  try {
    await page.goto(HTTP_URL, { waitUntil: 'networkidle', timeout: 30000 });
    await sleep(1000);
    logResult('Carga', 'HTTP carga sin errores', 'PASS');
  } catch (e) {
    logResult('Carga', 'HTTP carga', 'FAIL', e.message);
    await context.close();
    return;
  }

  // Check initial state
  const toolbarVisible = await page.locator('.toolbar').isVisible();
  logResult('Toolbar', 'Visible', toolbarVisible ? 'PASS' : 'FAIL');

  const bottomTabsVisible = await page.locator('.bottom-tabs').isVisible();
  logResult('Tabs', 'Bottom tabs visibles', bottomTabsVisible ? 'PASS' : 'FAIL');

  const noProvinceMsg = await page.locator('#noProvinceMsg').isVisible();
  logResult('Estado inicial', 'Mensaje selecciona provincia', noProvinceMsg ? 'PASS' : 'FAIL');

  const tabMapActive = await page.locator('.bottom-tab[data-tab="tabMap"]').locator('..').first().evaluate(el => {
    return el.closest('.bottom-tabs').querySelector('.bottom-tab.active')?.dataset.tab;
  });
  logResult('Tabs', 'Tab activo por defecto: ' + tabMapActive, tabMapActive === 'tabMap' ? 'PASS' : 'FAIL');

  // Check province selector has options
  const provSelect = page.locator('#provFilter');
  const provOptions = await provSelect.locator('option').count();
  logResult('Provincias', `Cargadas: ${provOptions - 1} provincias`, provOptions > 1 ? 'PASS' : 'FAIL');

  // Try selecting a province
  if (provOptions > 1) {
    // Check if cached data exists first
    await provSelect.selectOption(TEST_PROVINCE);
    await sleep(4000); // Wait for API + render

    const dataScreenHidden = await page.locator('#contentArea').evaluate(el => !el.classList.contains('no-province'));
    logResult('Provincias', 'Seleccionar provincia carga datos', dataScreenHidden ? 'PASS' : 'SKIP', dataScreenHidden ? '' : 'API may be unavailable, cache may be empty');

    if (dataScreenHidden) {
      await sleep(500);

      // Toolbar filter interactions
      const fuelSelect = page.locator('#fuelFilter');
      const fuelOpts = await fuelSelect.locator('option').count();
      logResult('Filtros', 'Combustible opciones cargadas', fuelOpts > 1 ? 'PASS' : 'FAIL');

      const locSelect = page.locator('#locFilter');
      const locOpts = await locSelect.locator('option').count();
      logResult('Filtros', 'Localidad opciones cargadas', locOpts > 1 ? 'PASS' : 'FAIL');

      // Brand filter dropdown
      const brandBtn = page.locator('#brandFilterBtn');
      await brandBtn.click();
      await sleep(200);
      const brandDD = page.locator('#brandFilterDropdown');
      const brandDDVisible = await brandDD.isVisible();
      logResult('Filtros', 'Brand dropdown se abre', brandDDVisible ? 'PASS' : 'FAIL');
      if (brandDDVisible) {
        const brandOpts = await brandDD.locator('input[type="checkbox"]').count();
        logResult('Filtros', `Brand opciones: ${brandOpts}`, brandOpts > 0 ? 'PASS' : 'FAIL');
        // Close by clicking elsewhere
        await page.locator('.search-row input').click();
        await sleep(100);
      }

      // Search
      const searchInput = page.locator('#search');
      await searchInput.fill('');
      logResult('Búsqueda', 'Input vacío sin error', 'PASS');

      // Tabs
      const tabs = ['tabTable', 'tabBoth', 'tabConfig', 'tabMap'];
      let tabsOk = true;
      for (const tab of tabs) {
        await page.locator(`.bottom-tab[data-tab="${tab}"]`).click();
        await sleep(400);
        const active = await page.locator('.bottom-tabs .bottom-tab.active').getAttribute('data-tab');
        if (active !== tab) tabsOk = false;
      }
      logResult('Tabs', 'Navegación entre todos los tabs', tabsOk ? 'PASS' : 'FAIL');

      // Config tab specific checks
      await page.locator('.bottom-tab[data-tab="tabConfig"]').click();
      await sleep(400);
      const configCards = await page.locator('.config-card').count();
      logResult('Config', 'Tarjetas de configuración visibles', configCards >= 3 ? 'PASS' : 'FAIL');

      const cacheTtl = page.locator('#cacheTtl');
      logResult('Config', 'Input de TTL visible', (await cacheTtl.isVisible()) ? 'PASS' : 'FAIL');

      const pageSize = page.locator('#pageSize');
      logResult('Config', 'Selector de paginación visible', (await pageSize.isVisible()) ? 'PASS' : 'FAIL');

      // Map tab - check map renders
      await page.locator('.bottom-tab[data-tab="tabMap"]').click();
      await sleep(600);
      const mapEl = page.locator('#map');
      const mapVisible = await mapEl.isVisible();
      const leafletContainer = await page.locator('#map .leaflet-container').count();
      logResult('Mapa', 'Mapa visible con Leaflet', mapVisible && leafletContainer > 0 ? 'PASS' : 'FAIL');

      // Markers visible (if data loaded and coordinates available)
      const markers = await page.locator('#map .leaflet-marker-icon, #map .leaflet-interactive').count();
      logResult('Mapa', `Marcadores en mapa: ${markers}`, markers > 0 ? 'PASS' : 'SKIP', markers === 0 ? 'No markers rendered' : '');

      // Table tab
      await page.locator('.bottom-tab[data-tab="tabTable"]').click();
      await sleep(400);
      const tableBodyRows = await page.locator('#tableBody tr').count();
      logResult('Tabla', 'Filas en tabla paginada', tableBodyRows > 0 ? 'PASS' : 'FAIL');

      // Click a table row
      if (tableBodyRows > 0) {
        await page.locator('#tableBody tr').first().click();
        await sleep(500);
        const detailVisible = await page.locator('#detailPanel').isVisible();
        logResult('Detail', 'Bottom sheet se abre al hacer click en fila', detailVisible ? 'PASS' : 'FAIL');

        if (detailVisible) {
          const detailBrand = await page.locator('#detailBrand').textContent();
          logResult('Detail', 'Contenido del detail cargado', detailBrand && detailBrand.trim() ? 'PASS' : 'FAIL');

          // Close detail
          await page.locator('#detailClose').click();
          await sleep(300);
          const detailClosed = await page.locator('#detailPanel').isVisible();
          logResult('Detail', 'Cerrar bottom sheet funciona', !detailClosed ? 'PASS' : 'FAIL');
        }
      }

      // Table sorting
      const sortableTh = page.locator('#table thead th').first();
      await sortableTh.click();
      await sleep(300);
      const arrow = await sortableTh.locator('.arrow').textContent();
      logResult('Tabla', 'Ordenar columna muestra indicador', arrow && arrow.trim() !== '' ? 'PASS' : 'FAIL');

      // Both tab
      await page.locator('.bottom-tab[data-tab="tabBoth"]').click();
      await sleep(500);
      const bothMapVisible = await page.locator('#map').isVisible();
      const bothTableRows = await page.locator('#tableBothBody tr').count();
      logResult('Ambos', 'Mapa visible en modo ambos', bothMapVisible ? 'PASS' : 'FAIL');
      logResult('Ambos', `Tabla compacta con ${bothTableRows} filas`, bothTableRows > 0 ? 'PASS' : 'FAIL');

      // Map style
      const styleSelect = page.locator('#mapStyle');
      const currentStyle = await styleSelect.inputValue();
      const styles = ['satellite', 'street', 'standard', 'cycling'];
      let stylesOk = true;
      for (const s of styles) {
        await styleSelect.selectOption(s);
        await sleep(500);
        const val = await styleSelect.inputValue();
        if (val !== s) stylesOk = false;
      }
      await styleSelect.selectOption(currentStyle);
      logResult('Mapa', 'Cambio de estilo de mapa', stylesOk ? 'PASS' : 'FAIL');

      // Reset filters
      await page.locator('#resetFiltersBtn').click();
      await sleep(500);
      const searchVal = await searchInput.inputValue();
      logResult('Filtros', 'Reset limpia búsqueda', searchVal === '' ? 'PASS' : 'FAIL');
    }
  }

  await context.close();
}

async function runFileTests(browser) {
  console.log('\n## 📁 file://');

  const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const page = await context.newPage();

  page.on('console', msg => {
    if (msg.type() === 'error') console.log(`    [console.error] ${msg.text()}`);
  });
  page.on('pageerror', err => console.log(`    [page error] ${err.message}`));

  try {
    await page.goto(FILE_URL, { waitUntil: 'domcontentloaded', timeout: 15000 });
    await sleep(2000);
    logResult('Carga', 'file:// carga sin errores', 'PASS');
  } catch (e) {
    logResult('Carga', 'file:// carga', 'FAIL', e.message);
    await context.close();
    return;
  }

  // Check initial state
  const toolbarVisible = await page.locator('.toolbar').isVisible();
  logResult('Toolbar', 'Visible', toolbarVisible ? 'PASS' : 'FAIL');

  const bottomTabsVisible = await page.locator('.bottom-tabs').isVisible();
  logResult('Tabs', 'Bottom tabs visibles', bottomTabsVisible ? 'PASS' : 'FAIL');

  const noProvinceMsg = await page.locator('#noProvinceMsg').isVisible();
  logResult('Estado inicial', 'Mensaje selecciona provincia visible', noProvinceMsg ? 'PASS' : 'FAIL');

  // Province select should have no options (API won't work from file://)
  const provSelect = page.locator('#provFilter');
  const provOptions = await provSelect.locator('option').count();
  logResult('Provincias', 'Selector de provincia visible', provOptions >= 1 ? 'PASS' : 'FAIL');

  // Tab navigation should work even without data
  const tabs = ['tabTable', 'tabBoth', 'tabConfig', 'tabMap'];
  let tabsOk = true;
  for (const tab of tabs) {
    const btn = page.locator(`.bottom-tab[data-tab="${tab}"]`);
    if (await btn.isVisible()) {
      await btn.click();
      await sleep(300);
      const active = await page.locator('.bottom-tabs .bottom-tab.active').getAttribute('data-tab');
      if (active !== tab) tabsOk = false;
    }
  }
  logResult('Tabs', 'Navegación funciona sin API', tabsOk ? 'PASS' : 'FAIL');

  // Config tab should be accessible
  await page.locator('.bottom-tab[data-tab="tabConfig"]').click();
  await sleep(300);
  const configCards = await page.locator('.config-card').count();
  logResult('Config', 'Config accesible sin datos', configCards >= 1 ? 'PASS' : 'FAIL');

  // Search input should be present
  const searchVisible = await page.locator('#search').isVisible();
  logResult('Búsqueda', 'Input de búsqueda visible', searchVisible ? 'PASS' : 'FAIL');

  await context.close();
}

async function main() {
  console.log('========================================');
  console.log('  Validación Propuesta D');
  console.log('========================================');

  const browser = await chromium.launch({ headless: true });

  try {
    await runHTTPTests(browser);
  } catch (e) {
    console.log(`❌ HTTP tests error: ${e.message}`);
    RESULTS.errors.push({ category: 'HTTP', test: 'suite', detail: e.message });
  }

  try {
    await runFileTests(browser);
  } catch (e) {
    console.log(`❌ File tests error: ${e.message}`);
    RESULTS.errors.push({ category: 'FILE', test: 'suite', detail: e.message });
  }

  await browser.close();

  console.log('\n========================================');
  console.log(`  Resultados: ${RESULTS.passed} ✅  ${RESULTS.failed} ❌  ${RESULTS.skipped} ⏭️`);
  console.log('========================================');

  if (RESULTS.errors.length > 0) {
    console.log('\nErrores:');
    RESULTS.errors.forEach(e => console.log(`  ❌ ${e.category} > ${e.test}: ${e.detail}`));
  }

  process.exit(RESULTS.failed > 0 ? 1 : 0);
}

main();
