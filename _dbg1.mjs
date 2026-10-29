import { chromium } from 'playwright';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1440, height: 900 } });
p.on('pageerror', (e) => console.log('PAGEERROR', e.message));
await p.goto(pathToFileURL(path.resolve('prototipos_opencode_bigpickle/prototipo1-mapa-hojas/index.html')).href);
await p.waitForTimeout(800);

console.log(await p.evaluate(() => {
  const sels = [...document.querySelectorAll('select')];
  return {
    selects: sels.map((s) => ({ id: s.id, n: s.options.length, prim: [...s.options].slice(0, 3).map((o) => o.textContent) })),
    tieneSig: typeof window.__sig,
    listaSel: !!document.querySelector('#listaTarjetas'),
    txt: (document.querySelector('#listaTarjetas')?.innerText || '').slice(0, 80),
  };
}));

try {
  console.log(await p.evaluate(() => {
    const sels = [...document.querySelectorAll('select')];
    const sel = sels.find((s) => [...s.options].some((o) => /madrid|barcelona/i.test(o.textContent)));
    if (!sel) return { hay: false };
    const idx = [...sel.options].findIndex((o) => o.value && o.value !== sel.value);
    return { hay: true, id: sel.id, idx, opts: sel.options.length };
  }));
} catch (e) {
  console.log('ERROR', e.message);
}
await b.close();
