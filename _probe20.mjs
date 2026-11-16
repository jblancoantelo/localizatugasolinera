import { chromium } from 'playwright';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const base = path.resolve('prototipos_opencode_bigpickle');
const b = await chromium.launch();
const ctx = await b.newContext({ viewport: { width: 1440, height: 900 } });
const p = await ctx.newPage();
await p.goto(pathToFileURL(path.join(base, 'prototipo5-split-comparador', 'index.html')).href);
await p.waitForTimeout(800);

const m = () => p.evaluate(() => ({
  tablas: [...document.querySelectorAll('table')].map((t) => (t.id || t.className) + ' tr=' + t.querySelectorAll('tr').length),
  filas: [...document.querySelectorAll('[data-id]')].length,
  info: document.querySelector('#paginacion .pag-info')?.textContent.trim(),
  primerPrecio: document.querySelector('#listaScroll, #panelLista')?.innerText.replace(/\s+/g, ' ').match(/1,\d{3}/)?.[0],
  marca: !!document.querySelector('#pageSizeSel[data-marca]'),
}));

console.log('antes  ', JSON.stringify(await m()));
await p.evaluate(() => { document.querySelector('#pageSizeSel').dataset.marca = 'x'; });
await p.selectOption('#pageSizeSel', '15');
await p.waitForTimeout(800);
console.log('size 15', JSON.stringify(await m()));
console.log('filas visibles en lista:', JSON.stringify(await p.evaluate(() => {
  const el = document.querySelector('#listaScroll');
  const rows = [...document.querySelectorAll('tbody tr')].filter((r) => r.getBoundingClientRect().height > 0);
  return { lista: el?.innerText.replace(/\s+/g, ' ').slice(0, 200), trVisibles: rows.length, trTotal: document.querySelectorAll('tbody tr').length };
})));
await b.close();
