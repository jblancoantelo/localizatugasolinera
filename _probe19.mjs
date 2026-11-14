import { chromium } from 'playwright';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const base = path.resolve('prototipos_opencode_bigpickle');
const b = await chromium.launch();
const ctx = await b.newContext({ viewport: { width: 1440, height: 900 } });
const p = await ctx.newPage();
await p.goto(pathToFileURL(path.join(base, 'prototipo5-split-comparador', 'index.html')).href);
await p.waitForTimeout(800);
console.log(JSON.stringify(await p.evaluate(() => {
  const s = document.querySelector('#pageSizeSel');
  const cadena = [];
  let n = s;
  while (n && n !== document.body) { cadena.push(n.tagName.toLowerCase() + (n.id ? '#' + n.id : '') + (n.className ? '.' + String(n.className).replace(/\s+/g, '.') : '')); n = n.parentElement; }
  return {
    paginaciones: document.querySelectorAll('#paginacion').length,
    selects: document.querySelectorAll('#pageSizeSel').length,
    cadena,
    pag1: document.querySelector('#paginacion')?.innerText.replace(/\s+/g, ' ').slice(0, 90),
    otros: [...document.querySelectorAll('.paginacion')].map((e) => (e.id || e.className) + ':' + e.innerText.replace(/\s+/g, ' ').slice(0, 40)),
  };
}), null, 1));
await b.close();
