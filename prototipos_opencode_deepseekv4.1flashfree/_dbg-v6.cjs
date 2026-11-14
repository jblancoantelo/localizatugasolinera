/* Depuración visual de v6 · Modo repostaje (una mano)
   Uso: node prototipos_opencode_deepseekv4.1flashfree/_dbg-v6.cjs
   Genera capturas en prototipos_opencode_deepseekv4.1flashfree/capturas/_dbg-v6-*.png */
const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

const ROOT = path.resolve(__dirname, '..');
const OUT = path.join(ROOT, 'prototipos_opencode_deepseekv4.1flashfree', 'capturas');
const URL_BASE = 'http://127.0.0.1:8895/prototipos_opencode_deepseekv4.1flashfree/v6-drive.html';

function startServer() {
  const http = require('http');
  const types = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png' };
  const srv = http.createServer((req, res) => {
    let p = decodeURIComponent(req.url.split('?')[0]);
    if (p === '/') p = '/index.html';
    fs.readFile(path.join(ROOT, p), (err, data) => {
      if (err) { res.writeHead(404); res.end(''); return; }
      res.writeHead(200, { 'Content-Type': types[path.extname(p)] || 'application/octet-stream' });
      res.end(data);
    });
  });
  return new Promise(r => srv.listen(8895, '127.0.0.1', () => r(srv)));
}

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const srv = await startServer();
  const browser = await chromium.launch();
  const errors = [];
  const shot = async (page, name) => { await page.screenshot({ path: path.join(OUT, `_dbg-v6-${name}.png`) }); console.log('  →', `_dbg-v6-${name}.png`); };

  /* ---------------- Móvil ---------------- */
  {
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, hasTouch: true, isMobile: true });
    const page = await ctx.newPage();
    page.on('pageerror', e => errors.push('[movil pageerror] ' + e.message));
    page.on('console', m => { if (m.type() === 'error') errors.push('[movil console] ' + m.text()); });
    await page.goto(URL_BASE + '?embed=1&theme=dark');
    await page.waitForTimeout(500);
    await shot(page, 'movil-paso1');

    /* Importe 50 € y combustible G95 */
    await page.click('[data-amount="50"]');
    await page.waitForTimeout(250);
    await page.click('[data-fuel="g95"]');
    await page.waitForTimeout(250);
    await shot(page, 'movil-paso1-g95');
    await page.click('[data-fuel="diesel"]');
    await page.waitForTimeout(200);

    /* Paso 2 */
    await page.click('#cta');
    await page.waitForTimeout(700);
    await shot(page, 'movil-paso2');
    await page.click('.opt:nth-child(2)');
    await page.waitForTimeout(400);
    await shot(page, 'movil-paso2-sel');

    /* Paso 3 · camino */
    await page.click('#cta');
    await page.waitForTimeout(600);
    await shot(page, 'movil-paso3');

    /* Paso 4 · surtidor */
    await page.click('#cta');
    await page.waitForTimeout(600);
    await shot(page, 'movil-paso4');
    /* Precio más alto que la app */
    await page.evaluate(() => {
      const el = document.getElementById('pumpPrice');
      el.value = '1.449';
      el.dispatchEvent(new Event('input', { bubbles: true }));
    });
    await page.waitForTimeout(300);
    await shot(page, 'movil-paso4-carosurtidor');
    /* Litros rápidos */
    await page.click('[data-quick="30"]');
    await page.waitForTimeout(300);
    await shot(page, 'movil-paso4-litros');

    /* Guardar → paso 5 */
    await page.click('#cta');
    await page.waitForTimeout(800);
    await shot(page, 'movil-paso5');

    /* Sheets */
    await page.click('#moreBtn');
    await page.waitForTimeout(600);
    await shot(page, 'movil-menu');
    await page.click('#moreSheet [data-sheet-open="log"]');
    await page.waitForTimeout(800);
    await shot(page, 'movil-repostajes');
    await page.click('#logSheet [data-sheet-close]');
    await page.waitForTimeout(500);

    await page.click('#moreBtn');
    await page.waitForTimeout(500);
    await page.click('#moreSheet [data-sheet-open="set"]');
    await page.waitForTimeout(700);
    await shot(page, 'movil-ajustes');
    await page.click('#setSheet [data-sheet-close]');
    await page.waitForTimeout(400);

    await page.click('#moreBtn');
    await page.waitForTimeout(500);
    await page.click('#moreSheet [data-sheet-open="opts"]');
    await page.waitForTimeout(700);
    await shot(page, 'movil-todas');
    await page.click('#optsSheet [data-sheet-close]');
    await page.waitForTimeout(400);

    /* Voz */
    await page.click('#voiceBtn');
    await page.waitForTimeout(1600);
    await shot(page, 'movil-voz');
    await page.click('#voiceUse');
    await page.waitForTimeout(700);
    await shot(page, 'movil-voz-aplicada');

    /* Detalle de estación desde el registro */
    await page.click('#moreBtn');
    await page.waitForTimeout(500);
    await page.click('#moreSheet [data-sheet-open="log"]');
    await page.waitForTimeout(700);
    await page.click('#logSheet .refuel');
    await page.waitForTimeout(800);
    await shot(page, 'movil-detalle');
    await page.click('#stationSheet [data-sheet-close]');
    await page.waitForTimeout(400);
    await page.click('#logSheet [data-sheet-close]');
    await page.waitForTimeout(400);

    /* Tipografía XL + tema claro (comprobación de contraste) */
    await page.evaluate(() => document.querySelector('[data-theme-toggle]').click());
    await page.waitForTimeout(400);
    await page.click('#amoledBtn');
    await page.waitForTimeout(400);
    await shot(page, 'movil-claro');
    await ctx.close();
  }

  /* ---------------- Escritorio ---------------- */
  {
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 });
    const page = await ctx.newPage();
    page.on('pageerror', e => errors.push('[desk pageerror] ' + e.message));
    page.on('console', m => { if (m.type() === 'error') errors.push('[desk console] ' + m.text()); });
    await page.goto(URL_BASE + '?embed=1&theme=dark');
    await page.waitForTimeout(500);
    await shot(page, 'desk-paso1');
    await page.click('#cta');
    await page.waitForTimeout(800);
    await shot(page, 'desk-paso2');
    await page.click('#cta');
    await page.waitForTimeout(600);
    await shot(page, 'desk-paso3');
    await page.click('#cta');
    await page.waitForTimeout(600);
    await shot(page, 'desk-paso4');
    await page.click('#cta');
    await page.waitForTimeout(800);
    await shot(page, 'desk-paso5');
    await ctx.close();
  }

  /* ------------- Móvil 2 · paridad: IA, ajustes, búsqueda -------------- */
  {
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, hasTouch: true, isMobile: true });
    const page = await ctx.newPage();
    page.on('pageerror', e => errors.push('[paridad pageerror] ' + e.message));
    page.on('console', m => { if (m.type() === 'error') errors.push('[paridad console] ' + m.text()); });
    await page.goto(URL_BASE + '?embed=1&theme=dark');
    await page.waitForTimeout(500);

    /* Más → IA */
    await page.click('#moreBtn');
    await page.waitForTimeout(500);
    await shot(page, 'paridad-menu');
    await page.click('#moreIa');
    await page.waitForTimeout(600);
    await shot(page, 'paridad-ia');
    await page.click('.pf-ia-prompts .chip');
    await page.waitForTimeout(2600);
    await shot(page, 'paridad-ia-respuesta');
    await page.click('.pf-cite');
    await page.waitForTimeout(800);
    await shot(page, 'paridad-detalle-desde-ia');
    await page.click('#stationSheet [data-sheet-close]');
    await page.waitForTimeout(400);

    /* Más → Ajustes: descuento + ocultar groq */
    await page.click('#moreBtn');
    await page.waitForTimeout(500);
    await page.click('#moreCfg');
    await page.waitForTimeout(600);
    await shot(page, 'paridad-ajustes');
    await page.evaluate(() => {
      const r = document.querySelector('[data-disc="REPSOL"]');
      r.value = r.max; r.dispatchEvent(new Event('input', { bubbles: true }));
    });
    await page.waitForTimeout(400);
    await page.evaluate(() => { document.querySelector('[data-sec="iatabs"]').scrollIntoView({ block: 'center' }); });
    await page.waitForTimeout(250);
    await page.click('[data-iatab="groq"]');
    await page.waitForTimeout(300);
    await shot(page, 'paridad-ajustes-iatabs');
    await page.click('.pf-overlay.on [data-pf-close]');
    await page.waitForTimeout(400);

    /* Buscar en "Todas las estaciones" */
    await page.click('#moreBtn');
    await page.waitForTimeout(500);
    await page.click('#moreSheet [data-sheet-open="opts"]');
    await page.waitForTimeout(700);
    await page.fill('#optsQ', 'galp');
    await page.waitForTimeout(400);
    await shot(page, 'paridad-todas-busqueda');
    await page.fill('#optsQ', 'zzz');
    await page.waitForTimeout(400);
    await shot(page, 'paridad-todas-vacia');
    await page.click('#optsSheet [data-sheet-close]');
    await page.waitForTimeout(400);

    /* IA de nuevo: groq oculto */
    await page.click('#moreBtn');
    await page.waitForTimeout(400);
    await page.click('#moreIa');
    await page.waitForTimeout(600);
    const tabs = await page.evaluate(() => [...document.querySelectorAll('.pf-ia-tabs .chip:not([hidden])')].map(c => c.dataset.p).join(', '));
    errors.length === 0 && console.log('[check] v6 pestañas IA visibles tras ocultar groq:', tabs);
    await ctx.close();
  }

  await browser.close();
  srv.close();
  if (errors.length) {
    console.log('\n❌ Errores de consola:');
    errors.forEach(e => console.log('  ' + e));
    process.exitCode = 1;
  } else {
    console.log('\n✓ capturas v6 listas, sin errores de consola');
  }
})();
