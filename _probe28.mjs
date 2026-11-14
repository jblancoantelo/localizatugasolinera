import { chromium } from 'playwright';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const base = path.resolve('prototipos_opencode_bigpickle');
const b = await chromium.launch();
const ctx = await b.newContext({ viewport: { width: 1440, height: 900 } });
const p = await ctx.newPage();
p.setDefaultTimeout(4000);
const errs = []; p.on('pageerror', (e) => errs.push(e.message));
await p.goto(pathToFileURL(path.join(base, 'prototipo4-modo-noche-conduccion', 'index.html')).href);
await p.waitForTimeout(900);

const r = await p.evaluate(() => {
  const out = {};
  out.datos = (window.FAKE?.estacionesDe?.('28') || []).map((e) => ({ id: e.id, marca: e.marca, dist: e.dist, km: e.km }));
  out.max = document.querySelector('#rngDist')?.max;
  out.step = document.querySelector('#rngDist')?.step;
  out.resumen = document.querySelector('.resumen, #resumen, .cabecera-resumen')?.textContent.replace(/\s+/g, ' ').slice(0, 120);
  return out;
});
console.log(JSON.stringify(r, null, 1).slice(0, 2000));

const m = () => p.evaluate(() => ({
  titulo: [...document.querySelectorAll('h1, h2, h3, .cabecera, .subtitulo, .resumen')].map((e) => e.textContent.replace(/\s+/g, ' ').trim()).filter((t) => /estaciones/i.test(t)).slice(0, 3),
  dist: document.querySelector('#distValor')?.textContent.trim(),
}));
for (const v of [1, 2, 5, 10]) {
  await p.evaluate((vv) => { const r2 = document.querySelector('#rngDist'); r2.value = String(vv); r2.dispatchEvent(new Event('input', { bubbles: true })); r2.dispatchEvent(new Event('change', { bubbles: true })); }, v);
  await p.waitForTimeout(500);
  console.log(v + ' km →', JSON.stringify(await m()));
}
if (errs.length) console.log('errs', errs);
await b.close();
