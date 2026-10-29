/* Depuración visual de v1 · cableado de la capa de paridad (IA + Ajustes + detalle)
   Uso: node prototipos_opencode_deepseekv4.1flashfree/_dbg-v1.cjs
   Genera capturas en prototipos_opencode_deepseekv4.1flashfree/capturas/_dbg-v1-*.png */
const { chromium } = require('playwright');
const path = require('path');
const OUT = path.join(__dirname, 'capturas') + path.sep;
const RAIL = 'file:///' + __dirname.replace(/\\/g, '/') + '/';

(async () => {
  const b = await chromium.launch({ headless: true });

  /* ---------------- Móvil ---------------- */
  {
    const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, colorScheme: 'light' });
    const p = await ctx.newPage();
    p.on('pageerror', e => console.log('[movil pageerror]', e.message));
    p.on('console', m => { if (m.type() === 'error') console.log('[movil console]', m.text()); });
    await p.goto(RAIL + 'v1-sheet.html?embed=1');
    await p.waitForTimeout(700);
    await p.screenshot({ path: OUT + '_dbg-v1-movil-lista.png' });

    /* Detalle: chips de días nuevos (7..180) + selector combustible */
    await p.click('#cardList .station');
    await p.waitForTimeout(600);
    await p.evaluate(() => { document.querySelector('#dDays').scrollIntoView({ block: 'center' }); });
    await p.waitForTimeout(250);
    await p.screenshot({ path: OUT + '_dbg-v1-movil-detalle-dias.png' });
    await p.click('#dDays [data-val="90"]');
    await p.waitForTimeout(400);
    await p.screenshot({ path: OUT + '_dbg-v1-movil-detalle-90d.png' });
    await p.evaluate(() => { document.querySelector('#detailSheet [data-sheet-close]')?.click(); });
    await p.waitForTimeout(400);

    /* IA: pestaña propia */
    await p.click('.bottomnav [data-nav-tab="ia"]');
    await p.waitForTimeout(500);
    await p.screenshot({ path: OUT + '_dbg-v1-movil-ia-general.png' });

    await p.click('.pf-ia-prompts .chip');
    await p.waitForTimeout(2600);
    await p.screenshot({ path: OUT + '_dbg-v1-movil-ia-respuesta.png' });

    await p.click('.pf-ia-tabs .chip[data-p="groq"]');
    await p.waitForTimeout(300);
    await p.fill('.pf-input', '¿me compensa desviarme 4 km?');
    await p.click('.pf-send');
    await p.waitForTimeout(2400);
    await p.screenshot({ path: OUT + '_dbg-v1-movil-ia-groq.png' });

    /* Ajustes: panel completo */
    await p.click('.bottomnav [data-nav-tab="config"]');
    await p.waitForTimeout(500);
    await p.screenshot({ path: OUT + '_dbg-v1-movil-config-1.png' });
    await p.evaluate(() => { document.querySelector('[data-sec="push"]').scrollIntoView({ block: 'center' }); });
    await p.waitForTimeout(250);
    await p.screenshot({ path: OUT + '_dbg-v1-movil-config-2.png' });

    /* Descuento en vivo: BALLENOIL a 5 ¢ y volver a la lista */
    await p.evaluate(() => { document.querySelector('[data-sec="disc"]').scrollIntoView({ block: 'center' }); });
    await p.fill('[data-disc="BALLENOIL"]', '5');
    await p.dispatchEvent('[data-disc="BALLENOIL"]', 'change');
    await p.waitForTimeout(300);
    await p.screenshot({ path: OUT + '_dbg-v1-movil-config-descuento.png' });
    await p.click('.bottomnav [data-nav-tab="list"]');
    await p.waitForTimeout(400);
    await p.screenshot({ path: OUT + '_dbg-v1-movil-lista-descuento.png' });

    /* Ocultar pestaña Groq desde Config y comprobar en IA */
    await p.click('.bottomnav [data-nav-tab="config"]');
    await p.waitForTimeout(400);
    await p.evaluate(() => { document.querySelector('[data-sec="iatabs"]').scrollIntoView({ block: 'center' }); });
    await p.uncheck('[data-iatab="groq"]');
    await p.waitForTimeout(300);
    await p.click('.bottomnav [data-nav-tab="ia"]');
    await p.waitForTimeout(400);
    const tabsVisibles = await p.$$eval('.pf-ia-tabs .chip[data-p]:not([hidden])', els => els.map(e => e.dataset.p));
    console.log('[check] pestañas IA visibles tras ocultar groq:', tabsVisibles.join(', '));
    await p.screenshot({ path: OUT + '_dbg-v1-movil-ia-sin-groq.png' });

    await ctx.close();
  }

  /* ---------------- Escritorio ---------------- */
  {
    const ctx = await b.newContext({ viewport: { width: 1440, height: 900 } });
    const p = await ctx.newPage();
    p.on('pageerror', e => console.log('[desk pageerror]', e.message));
    p.on('console', m => { if (m.type() === 'error') console.log('[desk console]', m.text()); });
    await p.goto(RAIL + 'v1-sheet.html?embed=1');
    await p.waitForTimeout(800);
    await p.screenshot({ path: OUT + '_dbg-v1-desk-lista-mapa.png' });

    await p.click('.topnav [data-nav-tab="ia"]');
    await p.waitForTimeout(500);
    await p.screenshot({ path: OUT + '_dbg-v1-desk-ia.png' });

    await p.click('.topnav [data-nav-tab="config"]');
    await p.waitForTimeout(500);
    await p.screenshot({ path: OUT + '_dbg-v1-desk-config.png' });

    /* Mapa: cambio de estilo */
    await p.click('.topnav [data-nav-tab="map"]');
    await p.waitForTimeout(900);
    await p.selectOption('#mapStyle', 'Oscuro');
    await p.waitForTimeout(500);
    await p.screenshot({ path: OUT + '_dbg-v1-desk-mapa-oscuro.png' });

    await ctx.close();
  }

  await b.close();
  console.log('capturas v1 listas en capturas/');
})();
