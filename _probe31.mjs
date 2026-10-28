import { chromium } from 'playwright';
import { readdir } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const base = path.resolve('prototipos_opencode_bigpickle');
const dirs = (await readdir(base, { withFileTypes: true }))
  .filter((d) => d.isDirectory() && /^prototipo/i.test(d.name)).map((d) => d.name).sort();
const b = await chromium.launch();

for (const dir of dirs) {
  const ctx = await b.newContext({ viewport: { width: 1440, height: 900 } });
  const p = await ctx.newPage();
  await p.goto(pathToFileURL(path.join(base, dir, 'index.html')).href);
  await p.waitForTimeout(800);
  const antes = await p.evaluate(() => ({
    claves: Object.keys(localStorage).filter((k) => /gasolineras|proto|estado|state/i.test(k)),
    selects: [...document.querySelectorAll('select')].filter((s) => s.getBoundingClientRect().width > 20 && s.options.length > 1).map((s) => s.id + '=' + s.value).slice(0, 4),
  }));
  /* cambia el primer select útil y una caja de búsqueda */
  await p.evaluate(() => {
    const s = [...document.querySelectorAll('select')].find((x) => x.getBoundingClientRect().width > 20 && x.options.length > 2 && !/mapa|estilo|orden|dias|periodo|pageSize/i.test(x.id));
    if (s) { s.value = s.options[s.options.length - 1].value; s.dispatchEvent(new Event('change', { bubbles: true })); }
    const i = [...document.querySelectorAll('input[type="search"], input[type="text"]')].find((x) => x.getBoundingClientRect().width > 40);
    if (i) { i.value = 'zz'; i.dispatchEvent(new Event('input', { bubbles: true })); i.dispatchEvent(new Event('change', { bubbles: true })); }
  });
  await p.waitForTimeout(900);
  const tras = await p.evaluate(() => ({
    claves: Object.keys(localStorage).filter((k) => /gasolineras|proto|estado|state/i.test(k)),
    selects: [...document.querySelectorAll('select')].filter((s) => s.getBoundingClientRect().width > 20 && s.options.length > 1).map((s) => s.id + '=' + s.value).slice(0, 4),
    input: [...document.querySelectorAll('input[type="search"], input[type="text"]')].map((i) => i.value).filter(Boolean).slice(0, 2),
  }));
  await p.reload();
  await p.waitForTimeout(900);
  const recarga = await p.evaluate(() => ({
    claves: Object.keys(localStorage).filter((k) => /gasolineras|proto|estado|state/i.test(k)),
    selects: [...document.querySelectorAll('select')].filter((s) => s.getBoundingClientRect().width > 20 && s.options.length > 1).map((s) => s.id + '=' + s.value).slice(0, 4),
    input: [...document.querySelectorAll('input[type="search"], input[type="text"]')].map((i) => i.value).filter(Boolean).slice(0, 2),
  }));
  const persiste = JSON.stringify(tras.selects) === JSON.stringify(recarga.selects) && JSON.stringify(tras.input) === JSON.stringify(recarga.input);
  console.log(dir.split('-')[0].padEnd(4), 'claves', antes.claves.length, '→', tras.claves.length, '| persiste tras F5:', persiste ? 'SÍ' : 'no',
    '\n     selects', JSON.stringify(tras.selects), '→', JSON.stringify(recarga.selects), '| input', JSON.stringify(tras.input), '→', JSON.stringify(recarga.input));
  await ctx.close();
}
await b.close();
