/* Depuración visual de v4: vistas mapa/ambos, inspector y command palette (borrar al final) */
const { chromium } = require('playwright');
const path = require('path');
const OUT = path.join(__dirname, 'capturas') + path.sep;
const RAIL = 'file:///' + __dirname.replace(/\\/g, '/') + '/';

(async () => {
  const b = await chromium.launch({ headless: true });
  const p = await b.newPage({ viewport: { width: 1440, height: 900 } });
  await p.goto(RAIL + 'v4-desktop.html?embed=1');
  await p.waitForTimeout(500);

  // Selecciona una estación (inspector) y abre la pestaña Histórico
  const rows = await p.$$('#table tbody tr');
  if (rows[2]) { await rows[2].click(); await p.waitForTimeout(500); }
  await p.screenshot({ path: OUT + '_dbg-v4-inspector.png' });

  await p.click('#inspTabs [data-tab="cmp"]');
  await p.waitForTimeout(400);
  await p.screenshot({ path: OUT + '_dbg-v4-comparativa.png' });

  await p.click('#inspTabs [data-tab="hist"]');
  await p.waitForTimeout(400);
  await p.screenshot({ path: OUT + '_dbg-v4-historico.png' });

  await p.click('#viewSwitch [data-view="both"]');
  await p.waitForTimeout(900);
  await p.screenshot({ path: OUT + '_dbg-v4-ambos.png' });

  await p.keyboard.press('Control+k');
  await p.waitForTimeout(300);
  await p.type('#cmdkInput', 'ballenoil');
  await p.waitForTimeout(300);
  await p.screenshot({ path: OUT + '_dbg-v4-cmdk.png' });

  await b.close();
  console.log('capturas v4 listas');
})();
