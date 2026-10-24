const { chromium } = require('playwright');
const path = require('path');

const url = (f) => 'file:///' + path.resolve(__dirname, f).replace(/\\/g, '/');

(async () => {
  const browser = await chromium.launch();
  const out = path.join(__dirname, 'capturas');
  const errores = [];
  const watch = (page, tag) => {
    page.on('pageerror', (e) => errores.push(tag + ': ' + e.message));
    page.on('console', (m) => { if (m.type() === 'error') errores.push(tag + ': ' + m.text()); });
  };

  /* v3: explorador de paridad */
  {
    const page = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1 });
    watch(page, 'v3');
    await page.goto(url('v3-cards.html'));
    await page.waitForTimeout(600);
    await page.click('#dataBtn3');
    await page.waitForTimeout(800);
    await page.screenshot({ path: path.join(out, '_dbg-v3-explorer.png') });
    console.log('v3 explorador:', await page.evaluate(() => ({
      abierto: !!document.querySelector('.pf-overlay.on, .pf-overlay.open'),
      filas: document.querySelectorAll('#dataFeat3 .pf-ex-item').length,
      cuenta: document.querySelector('#dataFeat3 [data-opt-count]')?.textContent,
    })));
    await page.close();
  }

  /* v4: mapa con estilos + leyenda */
  {
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 });
    watch(page, 'v4');
    await page.goto(url('v4-desktop.html'));
    await page.waitForTimeout(700);
    await page.click('#viewSwitch [data-view="map"]');
    await page.waitForTimeout(900);
    await page.selectOption('#mapStyle4', { index: 2 });
    await page.waitForTimeout(400);
    await page.screenshot({ path: path.join(out, '_dbg-v4-map.png') });
    console.log('v4 mapa:', await page.evaluate(() => ({
      leyenda: document.getElementById('legend4').textContent.trim().slice(0, 40),
      opciones: document.getElementById('mapStyle4').options.length,
      filtro: document.getElementById('mapHost').style.filter,
      marcadores: document.querySelectorAll('#mapHost [data-id], #mapHost .pin').length,
    })));
    await page.close();
  }

  /* v6: lista completa con marcas, distancia y orden */
  {
    const page = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1 });
    watch(page, 'v6');
    await page.goto(url('v6-drive.html'));
    await page.waitForTimeout(600);
    await page.click('#moreBtn');
    await page.waitForTimeout(500);
    await page.click('[data-sheet-open="opts"]');
    await page.waitForTimeout(800);
    const marca = await page.evaluate(() => {
      const c = {};
      PROTO.STATIONS.filter(s => s.province === 'Madrid').forEach(s => { c[s.brand] = (c[s.brand] || 0) + 1; });
      return Object.entries(c).sort((a, b) => b[1] - a[1])[0][0];
    });
    await page.evaluate((m) => document.querySelector(`[data-opt-brand="${m}"]`).click(), marca);
    await page.waitForTimeout(300);
    await page.evaluate(() => document.querySelector('[data-opt-sort="distance"]').click());
    await page.waitForTimeout(300);
    await page.evaluate(() => {
      const km = document.getElementById('optsKm');
      km.value = 20;
      km.dispatchEvent(new Event('input', { bubbles: true }));
    });
    await page.waitForTimeout(300);
    await page.screenshot({ path: path.join(out, '_dbg-v6-opts.png') });
    console.log('v6 lista:', { marca, ...(await page.evaluate(() => ({
      snap: document.getElementById('optsSheet').dataset.snap,
      cuenta: document.getElementById('optsCount').textContent,
      marcasOn: [...document.querySelectorAll('#optsBrands .chip.on')].map(c => c.textContent.trim()),
      orden: document.querySelector('#optsSort .on')?.dataset.optSort,
      filas: document.querySelectorAll('#optsList [data-opt-detail]').length,
      leyenda: document.getElementById('optsLegend').textContent.trim().length > 0,
      etiquetaKm: document.getElementById('optsKmLabel').textContent,
    }))) });
    await page.close();
  }

  /* v7: barra superior accesible */
  {
    const page = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1 });
    watch(page, 'v7');
    await page.goto(url('v7-compare.html'));
    await page.waitForTimeout(700);
    await page.screenshot({ path: path.join(out, '_dbg-v7-topbar.png') });
    console.log('v7 aria-label:', await page.evaluate(() => document.querySelectorAll('[aria-label]').length));
    await page.close();
  }

  await browser.close();
  console.log(errores.length ? '\nERRORES:\n' + errores.join('\n') : '\nSin errores de consola');
})();
