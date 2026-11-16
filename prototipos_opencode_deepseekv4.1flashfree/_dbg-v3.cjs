/* Depuración visual de v3 · búsqueda, ver más, IA y ajustes desde "Mis sitios"
   Uso: node prototipos_opencode_deepseekv4.1flashfree/_dbg-v3.cjs */
const { chromium } = require('playwright');
const path = require('path');
const OUT = path.join(__dirname, 'capturas') + path.sep;
const RAIL = 'file:///' + __dirname.replace(/\\/g, '/') + '/';

(async () => {
  const b = await chromium.launch({ headless: true });
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, colorScheme: 'light' });
  const p = await ctx.newPage();
  p.on('pageerror', e => console.log('[movil pageerror]', e.message));
  p.on('console', m => { if (m.type() === 'error') console.log('[movil console]', m.text()); });
  await p.goto(RAIL + 'v3-cards.html');
  await p.waitForTimeout(900);

  /* Búsqueda */
  await p.click('#searchBtn');
  await p.waitForTimeout(300);
  await p.fill('#searchInput', 'galp');
  await p.waitForTimeout(500);
  await p.screenshot({ path: OUT + '_dbg-v3-movil-busqueda.png' });
  await p.fill('#searchInput', 'zzz');
  await p.waitForTimeout(400);
  await p.screenshot({ path: OUT + '_dbg-v3-movil-busqueda-vacia.png' });
  await p.fill('#searchInput', '');
  await p.waitForTimeout(400);

  /* Ver más */
  const moreVisible = await p.evaluate(() => getComputedStyle(document.getElementById('moreBtn')).display !== 'none');
  console.log('[check] moreBtn visible con default 8:', moreVisible);
  await p.evaluate(() => document.getElementById('moreBtn').scrollIntoView({ block: 'center' }));
  await p.screenshot({ path: OUT + '_dbg-v3-movil-ver-mas.png' });
  await p.click('#moreBtn');
  await p.waitForTimeout(400);
  const nCards = await p.evaluate(() => document.querySelectorAll('#feed .feed-card').length);
  console.log('[check] tarjetas tras "Ver más":', nCards);

  /* Mis sitios → IA */
  await p.click('.bottomnav [data-tab="yo"]');
  await p.waitForTimeout(600);
  await p.evaluate(() => window.scrollTo(0, 0));
  await p.screenshot({ path: OUT + '_dbg-v3-movil-mis-sitios.png' });
  await p.evaluate(() => document.getElementById('sideIaBtn').scrollIntoView({ block: 'center' }));
  await p.screenshot({ path: OUT + '_dbg-v3-movil-mis-sitios-ia-card.png' });
  await p.click('#sideIaBtn');
  await p.waitForTimeout(600);
  await p.screenshot({ path: OUT + '_dbg-v3-movil-ia.png' });
  await p.click('.pf-ia-prompts .chip');
  await p.waitForTimeout(2600);
  await p.screenshot({ path: OUT + '_dbg-v3-movil-ia-respuesta.png' });
  await p.click('.pf-cite');
  await p.waitForTimeout(700);
  await p.screenshot({ path: OUT + '_dbg-v3-movil-detalle-desde-ia.png' });
  await p.click('#detailPanel [data-close-panel]');
  await p.waitForTimeout(300);
  await p.click('.pf-overlay.on [data-pf-close]');
  await p.waitForTimeout(300);

  /* Mis sitios → Ajustes */
  await p.click('.bottomnav [data-tab="yo"]');
  await p.waitForTimeout(500);
  await p.click('#sideCfgBtn');
  await p.waitForTimeout(600);
  await p.screenshot({ path: OUT + '_dbg-v3-movil-config.png' });
  /* Descuento Repsol al máximo */
  await p.evaluate(() => {
    const r = document.querySelector('[data-disc="REPSOL"]');
    r.value = r.max; r.dispatchEvent(new Event('input', { bubbles: true }));
  });
  await p.waitForTimeout(400);
  await p.click('.pf-overlay.on [data-pf-close]');
  await p.waitForTimeout(300);
  await p.screenshot({ path: OUT + '_dbg-v3-movil-feed-descuento.png' });

  /* Ocultar pestaña groq en IA */
  await p.click('.bottomnav [data-tab="yo"]');
  await p.waitForTimeout(400);
  await p.click('#sideCfgBtn');
  await p.waitForTimeout(500);
  await p.evaluate(() => { document.querySelector('[data-sec="iatabs"]').scrollIntoView({ block: 'center' }); });
  await p.waitForTimeout(250);
  await p.screenshot({ path: OUT + '_dbg-v3-movil-config-iatabs.png' });
  await p.click('[data-iatab="groq"]');
  await p.waitForTimeout(300);
  await p.click('.pf-overlay.on [data-pf-close]');
  await p.waitForTimeout(300);
  await p.click('.bottomnav [data-tab="yo"]');
  await p.waitForTimeout(400);
  await p.click('#sideIaBtn');
  await p.waitForTimeout(600);
  const tabs = await p.evaluate(() => [...document.querySelectorAll('.pf-ia-tabs .chip:not([hidden])')].map(c => c.dataset.p).join(', '));
  console.log('[check] pestañas IA visibles tras ocultar groq:', tabs);
  await p.screenshot({ path: OUT + '_dbg-v3-movil-ia-sin-groq.png' });

  await ctx.close();
  await b.close();
  console.log('capturas v3 listas en capturas/');
})();
