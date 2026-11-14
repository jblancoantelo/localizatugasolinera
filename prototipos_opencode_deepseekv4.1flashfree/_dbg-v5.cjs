/* Depuración visual de v5 · Copiloto IA
   Uso: node prototipos_opencode_deepseekv4.1flashfree/_dbg-v5.cjs
   Genera capturas en prototipos_opencode_deepseekv4.1flashfree/capturas/_dbg-v5-*.png */
const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

const ROOT = path.resolve(__dirname, '..');
const OUT = path.join(ROOT, 'prototipos_opencode_deepseekv4.1flashfree', 'capturas');
const URL_BASE = 'http://127.0.0.1:8899/prototipos_opencode_deepseekv4.1flashfree/v5-ia.html';

function startServer() {
  const http = require('http');
  const types = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png' };
  const srv = http.createServer((req, res) => {
    let p = decodeURIComponent(req.url.split('?')[0]);
    if (p === '/') p = '/index.html';
    const file = path.join(ROOT, p);
    fs.readFile(file, (err, data) => {
      if (err) { res.writeHead(404); res.end(''); return; }
      res.writeHead(200, { 'Content-Type': types[path.extname(file)] || 'application/octet-stream' });
      res.end(data);
    });
  });
  return new Promise(r => srv.listen(8899, '127.0.0.1', () => r(srv)));
}

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const srv = await startServer();
  const browser = await chromium.launch();
  const errors = [];

  async function shot(page, name) {
    await page.screenshot({ path: path.join(OUT, `_dbg-v5-${name}.png`) });
    console.log('  →', `_dbg-v5-${name}.png`);
  }

  /* ---------- Móvil: conversación completa ---------- */
  {
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, hasTouch: true, isMobile: true });
    const page = await ctx.newPage();
    page.on('pageerror', e => errors.push('[movil pageerror] ' + e.message));
    page.on('console', m => { if (m.type() === 'error') errors.push('[movil console] ' + m.text()); });
    await page.goto(URL_BASE + '?embed=1&theme=light');
    await page.waitForTimeout(500);

    /* Pregunta por la estación más barata → respuesta con citas, mapa y meta */
    await page.click('[data-ask="¿Dónde reposto más barato cerca?"]');
    await page.waitForTimeout(1000);
    await shot(page, 'movil-pensando');
    await page.waitForTimeout(4500);
    await shot(page, 'movil-respuesta-1');

    /* Segunda pregunta: tendencia (gráfica) */
    await page.fill('#ask', '¿Sube o baja el diésel?');
    await page.click('#sendBtn');
    await page.waitForTimeout(8000);
    await shot(page, 'movil-respuesta-2');

    /* Total del hilo hasta arriba */
    await page.evaluate(() => { document.getElementById('thread').scrollTop = 0; });
    await page.waitForTimeout(300);
    await shot(page, 'movil-hilo-arriba');
    await page.evaluate(() => { const t = document.getElementById('thread'); t.scrollTop = t.scrollHeight; });
    await page.waitForTimeout(300);

    /* Detalle desde una cita */
    await page.click('.cite');
    await page.waitForTimeout(700);
    await shot(page, 'movil-detalle');
    await page.click('#stationSheet [data-sheet-close]');
    await page.waitForTimeout(600);

    /* Panel de contexto */
    await page.click('nav.bottomnav [data-tab="ctx"]');
    await page.waitForTimeout(500);
    await shot(page, 'movil-contexto');

    /* Comparativa */
    await page.click('nav.bottomnav [data-tab="cmp"]');
    await page.waitForTimeout(500);
    await shot(page, 'movil-comparar');

    /* Ajustes */
    await page.click('nav.bottomnav [data-tab="set"]');
    await page.waitForTimeout(500);
    await shot(page, 'movil-ajustes');

    /* Prompt enviado */
    await page.click('nav.bottomnav [data-tab="chat"]');
    await page.waitForTimeout(300);
    await page.click('[data-sheet-open="prompt"]');
    await page.waitForTimeout(700);
    await shot(page, 'movil-prompt');
    await page.click('#promptSheet [data-sheet-close]');
    await page.waitForTimeout(600);

    /* Voz */
    await page.click('#micBtn');
    await page.waitForTimeout(1400);
    await shot(page, 'movil-voz');
    await page.click('#voiceSheet [data-sheet-close]');
    await page.waitForTimeout(600);

    /* NVIDIA sin configurar */
    await page.click('#provBtn');
    await page.waitForTimeout(600);
    await shot(page, 'movil-proveedores');
    await page.click('#provSheet .row-item[data-prov="nvidia"]');
    await page.waitForTimeout(400);
    await page.fill('#ask', '¿dónde reposto barato?');
    await page.click('#sendBtn');
    await page.waitForTimeout(800);
    await shot(page, 'movil-nvidia-error');
    await page.click('[data-testproxy]');
    await page.waitForTimeout(400);
    await shot(page, 'movil-nvidia-proxy');

    /* Tema oscuro del hilo */
    await page.click('#provBtn');
    await page.waitForTimeout(500);
    await page.click('#provSheet .row-item[data-prov="google"]');
    await page.waitForTimeout(400);
    await page.click('#ask');
    await page.fill('#ask', '¿Me compensa el desvío?');
    await page.click('#sendBtn');
    await page.waitForTimeout(5200);
    await page.click('header.topbar [data-theme-toggle]');
    await page.waitForTimeout(700);
    await shot(page, 'movil-oscuro');

    await ctx.close();
  }

  /* ---------- Escritorio: hilo + columna de contexto ---------- */
  {
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 });
    const page = await ctx.newPage();
    page.on('pageerror', e => errors.push('[desk pageerror] ' + e.message));
    page.on('console', m => { if (m.type() === 'error') errors.push('[desk console] ' + m.text()); });
    await page.goto(URL_BASE + '?embed=1&theme=light');
    await page.waitForTimeout(500);
    await page.click('[data-ask="Resumen de precios en Madrid"]');
    await page.waitForTimeout(6500);
    await shot(page, 'desk-hilo');
    await page.click('[data-tab="cmp"]');
    await page.waitForTimeout(600);
    await shot(page, 'desk-comparar');
    await page.click('[data-tab="set"]');
    await page.waitForTimeout(600);
    await shot(page, 'desk-ajustes');
    await page.click('[data-tab="ctx"]');
    await page.waitForTimeout(600);
    await shot(page, 'desk-contexto');
    await ctx.close();
  }

  await browser.close();
  srv.close();

  if (errors.length) {
    console.log('\n❌ Errores de consola:');
    errors.forEach(e => console.log('  ' + e));
    process.exitCode = 1;
  } else {
    console.log('\n✓ capturas v5 listas, sin errores de consola');
  }
})();
