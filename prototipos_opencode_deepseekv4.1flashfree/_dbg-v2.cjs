/* DepuraciÃ³n visual de v2 Â· overlays de paridad (IA, Ajustes, HistÃ³rico) + estilos de mapa
   Uso: node prototipos_opencode_deepseekv4.1flashfree/_dbg-v2.cjs */
const { chromium } = require('playwright');
const path = require('path');
const OUT = path.join(__dirname, 'capturas') + path.sep;
const RAIL = 'file:///' + __dirname.replace(/\\/g, '/') + '/';

(async () => {
  const b = await chromium.launch({ headless: true });

  /* ---------------- MÃ³vil ---------------- */
  {
    const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, colorScheme: 'light' });
    const p = await ctx.newPage();
    p.on('pageerror', e => console.log('[movil pageerror]', e.message));
    p.on('console', m => { if (m.type() === 'error') console.log('[movil console]', m.text()); });
    await p.goto(RAIL + 'v2-map.html?embed=1');
    await p.waitForTimeout(800);

    /* MenÃº â†’ HistÃ³rico */
    await p.click('#menuBtn');
    await p.waitForTimeout(400);
    await p.click('[data-goto="history"]');
    await p.waitForTimeout(900);
    await p.screenshot({ path: OUT + '_dbg-v2-movil-historico.png' });
    await p.click('[data-hd="30"]');
    await p.waitForTimeout(500);
    await p.screenshot({ path: OUT + '_dbg-v2-movil-historico-30d.png' });
    await p.click('.pf-overlay.on [data-pf-close]');
    await p.waitForTimeout(300);

    /* MenÃº â†’ IA */
    await p.click('#menuBtn');
    await p.waitForTimeout(300);
    await p.click('[data-goto="ia"]');
    await p.waitForTimeout(500);
    await p.screenshot({ path: OUT + '_dbg-v2-movil-ia.png' });
    await p.click('.pf-ia-prompts .chip');
    await p.waitForTimeout(2600);
    await p.screenshot({ path: OUT + '_dbg-v2-movil-ia-respuesta.png' });
    /* Cita â†’ detalle real */
    await p.click('.pf-cite');
    await p.waitForTimeout(700);
    await p.screenshot({ path: OUT + '_dbg-v2-movil-detalle-desde-ia.png' });
    await p.click('#detailPanel [data-close-panel]');
    await p.waitForTimeout(300);

    /* MenÃº â†’ Ajustes */
    await p.click('#menuBtn');
    await p.waitForTimeout(300);
    await p.click('[data-goto="config"]');
    await p.waitForTimeout(500);
    await p.screenshot({ path: OUT + '_dbg-v2-movil-config.png' });
    await p.evaluate(() => { document.querySelector('[data-sec="iatabs"]').scrollIntoView({ block: 'center' }); });
    await p.waitForTimeout(250);
    await p.screenshot({ path: OUT + '_dbg-v2-movil-config-iatabs.png' });
    await p.click('.pf-overlay.on [data-pf-close]');
    await p.waitForTimeout(300);

    /* Capas: estilos de mapa */
    await p.click('#layersFab');
    await p.waitForTimeout(300);
    await p.screenshot({ path: OUT + '_dbg-v2-movil-capas.png' });
    await p.selectOption('#mapStyle', 'Oscuro');
    await p.waitForTimeout(500);
    await p.screenshot({ path: OUT + '_dbg-v2-movil-capas-oscuro.png' });

    await ctx.close();
  }

  /* ---------------- Escritorio ---------------- */
  {
    const ctx = await b.newContext({ viewport: { width: 1440, height: 900 } });
    const p = await ctx.newPage();
    p.on('pageerror', e => console.log('[desk pageerror]', e.message));
    await p.goto(RAIL + 'v2-map.html?embed=1');
    await p.waitForTimeout(800);
    await p.click('#menuBtn');
    await p.waitForTimeout(400);
    await p.click('[data-goto="ia"]');
    await p.waitForTimeout(600);
    await p.screenshot({ path: OUT + '_dbg-v2-desk-ia.png' });
    await ctx.close();
  }

  await b.close();
  console.log('capturas v2 listas en capturas/');
})();

