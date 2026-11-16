// Prueba rápida de los prototipos: carga cada página, captura errores de consola y hace screenshot
import { chromium } from 'playwright';
import { fileURLToPath } from 'url';
import path from 'path';

const root = path.dirname(fileURLToPath(import.meta.url));
const conceptos = ['c1-flow', 'c2-atlas', 'c3-nocturne', 'c4-radar', 'c5-cockpit', 'c6-gesture'];

const browser = await chromium.launch();
const errores = [];

for (const c of conceptos) {
  // móvil
  {
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1, bypassCSP: true });
    const page = await ctx.newPage();
    await page.route('**/*', route => route.continue({ headers: { ...route.request().headers(), 'cache-control': 'no-cache' } }));
    const errs = [];
    page.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
    page.on('pageerror', e => errs.push('PAGEERROR: ' + e.message));
    await page.goto('file:///' + path.join(root, c, 'index.html').replace(/\\/g, '/'), { waitUntil: 'load' });
    await page.waitForTimeout(900);
    await page.screenshot({ path: path.join(root, `_shots`, `${c}-movil.png`), fullPage: false, animations: 'disabled' });
    if (errs.length) errores.push({ c, vista: 'movil', errs });
    await ctx.close();
  }
  // escritorio
  {
    const ctx = await browser.newContext({ viewport: { width: 1400, height: 900 }, deviceScaleFactor: 1 });
    const page = await ctx.newPage();
    const errs = [];
    page.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
    page.on('pageerror', e => errs.push('PAGEERROR: ' + e.message));
    await page.goto('file:///' + path.join(root, c, 'index.html').replace(/\\/g, '/'));
    await page.waitForTimeout(700);
    await page.screenshot({ path: path.join(root, `_shots`, `${c}-escritorio.png`) });
    if (errs.length) errores.push({ c, vista: 'escritorio', errs });
    await ctx.close();
  }
}

// galería
{
  const ctx = await browser.newContext({ viewport: { width: 1300, height: 1000 } });
  const page = await ctx.newPage();
  const errs = [];
  page.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
  page.on('pageerror', e => errs.push('PAGEERROR: ' + e.message));
  await page.goto('file:///' + path.join(root, 'index.html').replace(/\\/g, '/'));
  await page.waitForTimeout(1200);
  await page.screenshot({ path: path.join(root, `_shots`, `galeria.png`) });
  if (errs.length) errores.push({ c: 'galeria', vista: 'escritorio', errs });
  await ctx.close();
}

await browser.close();
if (errores.length) { console.log(JSON.stringify(errores, null, 2)); process.exit(1); }
console.log('TODO OK: sin errores de consola en 6 conceptos (móvil + escritorio) y la galería');
