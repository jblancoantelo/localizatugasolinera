/* Depuración visual de v7 · Comparador con veredicto
   Uso: node prototipos_opencode_deepseekv4.1flashfree/_dbg-v7.cjs
   Genera capturas en prototipos_opencode_deepseekv4.1flashfree/capturas/_dbg-v7-*.png */
const { chromium } = require('playwright');
const path = require('path');
const OUT = path.join(__dirname, 'capturas') + path.sep;
const RAIL = 'file:///' + __dirname.replace(/\\/g, '/') + '/';

(async () => {
  const b = await chromium.launch({ headless: true });

  /* ---------------- Móvil claro ---------------- */
  {
    const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, colorScheme: 'light' });
    const p = await ctx.newPage();
    p.on('pageerror', e => console.log('[movil pageerror]', e.message));
    p.on('console', m => { if (m.type() === 'error') console.log('[movil console]', m.text()); });
    await p.goto(RAIL + 'v7-compare.html?embed=1&theme=light');
    await p.waitForTimeout(700);
    await p.screenshot({ path: OUT + '_dbg-v7-movil-veredicto.png' });

    await p.evaluate(() => document.querySelector('.cmp-wrap').scrollIntoView({ block: 'start' }));
    await p.waitForTimeout(300);
    await p.screenshot({ path: OUT + '_dbg-v7-movil-tabla.png' });

    await p.click('.selchip [data-remove]');
    await p.waitForTimeout(300);
    await p.click('#addChip');
    await p.waitForTimeout(500);
    await p.screenshot({ path: OUT + '_dbg-v7-movil-selector.png' });

    await p.fill('#pickSearch', 'ballenoil');
    await p.waitForTimeout(300);
    await p.screenshot({ path: OUT + '_dbg-v7-movil-selector-buscar.png' });

    await p.click('#pickList [data-pick]');
    await p.waitForTimeout(400);
    await p.screenshot({ path: OUT + '_dbg-v7-movil-selector-add.png' });
    await p.click('#pickerSheet [data-sheet-close]');
    await p.waitForTimeout(400);

    await p.evaluate(() => document.querySelector('.insight')?.scrollIntoView({ block: 'center' }));
    await p.waitForTimeout(300);
    await p.screenshot({ path: OUT + '_dbg-v7-movil-porque.png' });

    await ctx.close();
  }

  /* ---------------- Móvil oscuro + quitar estación ---------------- */
  {
    const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, colorScheme: 'dark' });
    const p = await ctx.newPage();
    p.on('pageerror', e => console.log('[oscuro pageerror]', e.message));
    await p.goto(RAIL + 'v7-compare.html?embed=1');
    await p.waitForTimeout(600);
    await p.screenshot({ path: OUT + '_dbg-v7-movil-oscuro.png' });
    await p.click('.selchip [data-remove]');
    await p.waitForTimeout(400);
    await p.screenshot({ path: OUT + '_dbg-v7-movil-quitar.png' });
    await p.click('[data-tab="mapa"]');
    await p.waitForTimeout(900);
    await p.screenshot({ path: OUT + '_dbg-v7-movil-mapa.png' });
    await p.click('#sidePanel [data-close-panel]');
    await p.waitForTimeout(300);
    await p.click('[data-tab="ajustes"]');
    await p.waitForTimeout(600);
    await p.screenshot({ path: OUT + '_dbg-v7-movil-ajustes.png' });
    await ctx.close();
  }

  /* ---------------- Escritorio ---------------- */
  {
    const ctx = await b.newContext({ viewport: { width: 1440, height: 900 } });
    const p = await ctx.newPage();
    p.on('pageerror', e => console.log('[desk pageerror]', e.message));
    await p.goto(RAIL + 'v7-compare.html?embed=1');
    await p.waitForTimeout(900);
    await p.screenshot({ path: OUT + '_dbg-v7-desk.png' });

    await p.click('.selchip[data-id] .sc-main');
    await p.waitForTimeout(600);
    await p.screenshot({ path: OUT + '_dbg-v7-desk-detalle.png' });
    await p.click('#detailPanel [data-close-panel]');
    await p.waitForTimeout(300);

    await p.selectOption('#fuel', 'g95');
    await p.waitForTimeout(700);
    await p.screenshot({ path: OUT + '_dbg-v7-desk-g95.png' });
    await ctx.close();
  }

  await b.close();
  console.log('capturas v7 listas en capturas/');
})();
