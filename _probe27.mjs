import { chromium } from 'playwright';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const base = path.resolve('prototipos_opencode_bigpickle');
const b = await chromium.launch();
const abrir = async (dir, w = 1440, h = 900) => {
  const ctx = await b.newContext({ viewport: { width: w, height: h } });
  const p = await ctx.newPage();
  p.setDefaultTimeout(4000);
  const errs = []; p.on('pageerror', (e) => errs.push(e.message));
  await p.goto(pathToFileURL(path.join(base, dir, 'index.html')).href);
  await p.waitForTimeout(800);
  return { ctx, p, errs };
};

/* P8: comparador desde la vista Panel */
{
  const { ctx, p, errs } = await abrir('prototipo8-panel-de-datos');
  const card = p.locator('.tarjeta', { hasText: 'Comparador' }).first();
  const n = await card.locator('.comp-op').count();
  const antes = (await card.innerText()).replace(/\s+/g, ' ').slice(0, 120);
  if (n >= 2) {
    await card.locator('.comp-op').nth(0).click({ force: true });
    await p.waitForTimeout(300);
    await card.locator('.comp-op').nth(1).click({ force: true });
  }
  await p.waitForTimeout(700);
  const card2 = p.locator('.tarjeta', { hasText: 'Comparador' }).first();
  const desp = (await card2.innerText()).replace(/\s+/g, ' ').slice(0, 300);
  console.log('P8 panel comp-op n=' + n, '\n  antes :', antes, '\n  despues:', desp);
  if (errs.length) console.log(' errs', errs);
  await ctx.close();
}

/* P8: + Comparar en la tabla */
{
  const { ctx, p, errs } = await abrir('prototipo8-panel-de-datos');
  await p.locator('button:has-text("Estaciones")').first().click({ force: true });
  await p.waitForTimeout(700);
  const antes = await p.evaluate(() => [...document.querySelectorAll('#tablaEst [data-comp]')].slice(0, 3).map((x) => x.textContent.trim() + '/' + x.getAttribute('aria-pressed')));
  await p.evaluate(() => {
    const btns = [...document.querySelectorAll('#tablaEst [data-comp]')];
    btns[0].click(); btns[1].click();
  });
  await p.waitForTimeout(600);
  const desp = await p.evaluate(() => [...document.querySelectorAll('#tablaEst [data-comp]')].slice(0, 3).map((x) => x.textContent.trim() + '/' + x.getAttribute('aria-pressed')));
  const panel = await p.evaluate(() => {
    const c = [...document.querySelectorAll('.tarjeta')].find((t) => /Comparador/.test(t.innerText));
    return (c?.innerText || '').replace(/\s+/g, ' ').slice(0, 220);
  });
  console.log('P8 tabla +Comparar', JSON.stringify(antes), '→', JSON.stringify(desp), '\n  tarjeta:', panel);
  if (errs.length) console.log(' errs', errs);
  await ctx.close();
}

/* P8: geometría de #ordenEst */
{
  const { ctx, p } = await abrir('prototipo8-panel-de-datos');
  await p.locator('button:has-text("Estaciones")').first().click({ force: true });
  await p.waitForTimeout(700);
  const g = await p.evaluate(() => [...document.querySelectorAll('#ordenEst button')].map((b) => {
    const r = b.getBoundingClientRect();
    const t = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2);
    return { txt: b.textContent.trim(), rect: [Math.round(r.x), Math.round(r.y), Math.round(r.width), Math.round(r.height)], top: t ? t.tagName + '.' + t.className : null, mismo: t === b };
  }));
  console.log('P8 botones orden:', JSON.stringify(g, null, 1));
  await ctx.close();
}

/* P4: lista con distancia > 0 (5 km) y comprobación de elementos */
{
  const { ctx, p } = await abrir('prototipo4-modo-noche-conduccion');
  const m = () => p.evaluate(() => ({
    sub: document.body.innerText.replace(/\s+/g, ' ').match(/Madrid[^·]*·[^·]*·[^F]*/)?.[0],
    dist: document.querySelector('#distValor')?.textContent.trim(),
    n: document.querySelectorAll('[data-estacion], .estacion, .tarjeta, .fila, .ficha, [data-id]').length,
  }));
  for (const v of [2, 5, 10, 50]) {
    await p.evaluate((vv) => { const r = document.querySelector('#rngDist'); r.value = String(vv); r.dispatchEvent(new Event('input', { bubbles: true })); }, v);
    await p.waitForTimeout(500);
    console.log('P4 ' + v + ' km', JSON.stringify(await m()));
  }
  await ctx.close();
}
await b.close();
