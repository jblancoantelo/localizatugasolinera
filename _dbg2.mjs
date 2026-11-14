import { chromium } from 'playwright';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const HELPERS = `
  window.__sig = (sel) => {
    const el = sel ? document.querySelector(sel) : document.body;
    const t = (el ? el.innerText : '').replace(/\\s+/g, ' ').trim();
    return t.length + '|' + t.slice(0, 200);
  };
  window.__selectProv = () => [...document.querySelectorAll('select')].find((s) =>
    [...s.options].some((o) => /madrid|barcelona|valencia|sevilla/i.test(o.textContent)));
  'ok';
`;

const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1440, height: 900 } });
await p.goto(pathToFileURL(path.resolve('prototipos_opencode_bigpickle/prototipo3-lista-tarjetas/index.html')).href);
await p.waitForTimeout(700);
console.log('help:', await p.evaluate(HELPERS));
console.log('tipos:', await p.evaluate(() => ({ sig: typeof window.__sig, prov: typeof window.__selectProv })));
const h = await p.evaluateHandle(() => window.__selectProv());
console.log('hayProv:', await h.evaluate((el) => !!el));
try {
  const r = await h.evaluate((el) => {
    const antes = {
      lista: window.__sig('#listaTarjetas, #lista, #listaScroll, .tabla-cuerpo, .table-wrap, #resultados'),
      sel: el.value,
      opts: el.options.length,
      localidades: [...document.querySelectorAll('select')].map((s) => s.options.length),
    };
    return antes;
  });
  console.log('antes:', r);
} catch (e) {
  console.log('ERROR', e.message);
}
await b.close();
