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

/* P8: inventario de la vista Estaciones */
{
  const { ctx, p } = await abrir('prototipo8-panel-de-datos');
  await p.locator('button:has-text("Estaciones")').first().click({ force: true });
  await p.waitForTimeout(800);
  const info = await p.evaluate(() => {
    const vis = (e) => { const r = e.getBoundingClientRect(); const cs = getComputedStyle(e); return r.width > 2 && r.height > 2 && cs.display !== 'none' && cs.visibility !== 'hidden'; };
    return {
      botones: [...document.querySelectorAll('button')].filter(vis).map((x) => (x.textContent || '').trim().slice(0, 14) + ' ' + [...x.attributes].filter((a) => a.name.startsWith('data-') || a.name === 'aria-pressed').map((a) => a.name + '=' + a.value).join(',')).slice(0, 30),
      compOps: [...document.querySelectorAll('[data-comp]')].map((x) => (x.className || '') + (vis(x) ? ' VISIBLE' : ' oculto')),
      primero: [...document.querySelectorAll('[data-comp]')].filter(vis).length,
    };
  });
  console.log('P8 estaciones →', JSON.stringify(info, null, 1).slice(0, 1600));
  await ctx.close();
}

/* P8: comparador con botones visibles */
{
  const { ctx, p, errs } = await abrir('prototipo8-panel-de-datos');
  await p.locator('button:has-text("Estaciones")').first().click({ force: true });
  await p.waitForTimeout(800);
  const btn = p.locator('[data-comp]:visible');
  const n = await btn.count();
  if (n >= 2) { await btn.nth(0).click({ force: true }); await p.waitForTimeout(400); await btn.nth(1).click({ force: true }); await p.waitForTimeout(700); }
  const r = await p.evaluate(() => {
    const f = document.querySelector('#fichaComparar');
    return { visibles: [...document.querySelectorAll('[data-comp]:not([hidden])')].length, ficha: f ? { h: f.getBoundingClientRect().height, txt: (f.innerText || '').replace(/\s+/g, ' ').slice(0, 130) } : null, pulsados: [...document.querySelectorAll('[data-comp][aria-pressed="true"]')].length };
  });
  console.log('P8 comparador → n=' + n, JSON.stringify(r));
  if (errs.length) console.log(' errs', errs);
  await ctx.close();
}

/* P4: distancia */
{
  const { ctx, p, errs } = await abrir('prototipo4-modo-noche-conduccion');
  const m = () => p.evaluate(() => ({
    tarjetas: document.querySelectorAll('.estacion, .tarjeta, [data-estacion]').length,
    lista: [...document.querySelectorAll('.estacion, .tarjeta, [data-estacion]')].slice(0, 3).map((e) => (e.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 40)),
    dist: document.querySelector('#distValor')?.textContent.trim(),
    filtros: (document.querySelector('.resumen, .barra, #filtros')?.textContent || '').replace(/\s+/g, ' ').slice(0, 60),
  }));
  const vista = p.locator('button:has-text("Lista"), [data-vista="lista"]').first();
  if (await vista.count()) { await vista.click({ force: true }); await p.waitForTimeout(600); }
  console.log('P4 antes  ', JSON.stringify(await m()));
  await p.evaluate(() => {
    const r = document.querySelector('#rngDist');
    r.value = 1;
    r.dispatchEvent(new Event('input', { bubbles: true }));
    r.dispatchEvent(new Event('change', { bubbles: true }));
  });
  await p.waitForTimeout(900);
  console.log('P4 dist 1 ', JSON.stringify(await m()));
  const btns = await p.evaluate(() => [...document.querySelectorAll('button')].map((x) => (x.textContent || '').trim().slice(0, 14)).filter(Boolean).slice(0, 24));
  console.log('P4 botones', JSON.stringify(btns));
  if (errs.length) console.log(' errs', errs);
  await ctx.close();
}
await b.close();
